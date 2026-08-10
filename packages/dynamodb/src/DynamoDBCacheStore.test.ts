import { JsonSerializer } from "@alchemist-software/cache-kit-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBCacheStore } from "./DynamoDBCacheStore";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@aws-sdk/client-dynamodb");
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn(),
    },
  };
});

const mockSend = jest.fn();

const mockDocClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  jest.clearAllMocks();
  (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDocClient);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABLE_NAME = "test-cache";
const serializer = new JsonSerializer<{ name: string }>();

function createStore() {
  return new DynamoDBCacheStore<string, { name: string }>({
    client: new DynamoDBClient({}),
    tableName: TABLE_NAME,
  });
}

function serializedValue(value: { name: string }): Uint8Array {
  return serializer.serialize(value);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DynamoDBCacheStore", () => {
  describe("has", () => {
    it("returns true when item exists and is not expired", async () => {
      mockSend.mockResolvedValueOnce({ Item: { pk: "key1" } });

      const store = createStore();
      expect(await store.has("key1")).toBe(true);
    });

    it("returns false when item does not exist", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const store = createStore();
      expect(await store.has("key1")).toBe(false);
    });

    it("returns false when item is expired", async () => {
      const pastEpochSeconds = Math.floor(Date.now() / 1000) - 100;
      mockSend.mockResolvedValueOnce({ Item: { pk: "key1", expiresAt: pastEpochSeconds } });

      const store = createStore();
      expect(await store.has("key1")).toBe(false);
    });
  });

  describe("get", () => {
    it("returns deserialized value when item exists", async () => {
      const value = { name: "Alice" };
      mockSend.mockResolvedValueOnce({
        Item: { pk: "key1", value: serializedValue(value) },
      });

      const store = createStore();
      expect(await store.get("key1")).toEqual(value);
    });

    it("returns undefined when item does not exist", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const store = createStore();
      expect(await store.get("key1")).toBeUndefined();
    });

    it("returns undefined when item is expired", async () => {
      const pastEpochSeconds = Math.floor(Date.now() / 1000) - 100;
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "key1",
          value: serializedValue({ name: "stale" }),
          expiresAt: pastEpochSeconds,
        },
      });

      const store = createStore();
      expect(await store.get("key1")).toBeUndefined();
    });
  });

  describe("set", () => {
    it("puts item without TTL when no expiration given", async () => {
      mockSend.mockResolvedValueOnce({});

      const store = createStore();
      await store.set("key1", { name: "Bob" });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe(TABLE_NAME);
      expect(command.input.Item.pk).toBe("key1");
      expect(command.input.ConditionExpression).toBeUndefined();
    });

    it("includes TTL attribute when expiration is provided", async () => {
      mockSend.mockResolvedValueOnce({});

      const store = createStore();
      await store.set(
        "key1",
        { name: "Bob" },
        {
          expiration: { type: "time-to-live" as const, milliSeconds: 60_000 },
        },
      );

      const command = mockSend.mock.calls[0][0];
      const item = command.input.Item;
      expect(item.pk).toBe("key1");
      expect(item.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("uses ConditionExpression when overwrite is false", async () => {
      mockSend.mockResolvedValueOnce({});

      const store = createStore();
      await store.set("key1", { name: "Bob" }, { overwrite: false });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBe("attribute_not_exists(pk)");
    });

    it("swallows ConditionalCheckFailedException when overwrite is false", async () => {
      const error = new Error("Condition not met");
      (error as unknown as { name: string }).name = "ConditionalCheckFailedException";
      mockSend.mockRejectedValueOnce(error);

      const store = createStore();
      await expect(
        store.set("key1", { name: "Bob" }, { overwrite: false }),
      ).resolves.toBeUndefined();
    });

    it("rethrows non-conditional errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network failure"));

      const store = createStore();
      await expect(store.set("key1", { name: "Bob" })).rejects.toThrow("Network failure");
    });
  });

  describe("delete", () => {
    it("returns true when item existed", async () => {
      mockSend.mockResolvedValueOnce({ Attributes: { pk: "key1" } });

      const store = createStore();
      expect(await store.delete("key1")).toBe(true);
    });

    it("returns false when item did not exist", async () => {
      mockSend.mockResolvedValueOnce({ Attributes: undefined });

      const store = createStore();
      expect(await store.delete("key1")).toBe(false);
    });
  });

  describe("clear", () => {
    it("scans and batch-deletes all items", async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ pk: "a" }, { pk: "b" }], LastEvaluatedKey: undefined })
        .mockResolvedValueOnce({}); // BatchWrite

      const store = createStore();
      await store.clear();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("paginates through multiple scan pages", async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ pk: "a" }], LastEvaluatedKey: { pk: "a" } })
        .mockResolvedValueOnce({}) // BatchWrite page 1
        .mockResolvedValueOnce({ Items: [{ pk: "b" }], LastEvaluatedKey: undefined })
        .mockResolvedValueOnce({}); // BatchWrite page 2

      const store = createStore();
      await store.clear();

      expect(mockSend).toHaveBeenCalledTimes(4);
    });
  });

  describe("getMany", () => {
    it("returns empty map for empty keys", async () => {
      const store = createStore();
      expect(await store.getMany([])).toEqual(new Map());
    });

    it("returns deserialized values for found items", async () => {
      const value1 = { name: "Alice" };
      const value2 = { name: "Bob" };

      mockSend.mockResolvedValueOnce({
        Responses: {
          [TABLE_NAME]: [
            { pk: "k1", value: serializedValue(value1) },
            { pk: "k2", value: serializedValue(value2) },
          ],
        },
        UnprocessedKeys: {},
      });

      const store = createStore();
      const result = await store.getMany(["k1", "k2"]);

      expect(result.get("k1")).toEqual(value1);
      expect(result.get("k2")).toEqual(value2);
    });

    it("filters out expired items", async () => {
      const pastEpochSeconds = Math.floor(Date.now() / 1000) - 100;

      mockSend.mockResolvedValueOnce({
        Responses: {
          [TABLE_NAME]: [
            { pk: "k1", value: serializedValue({ name: "fresh" }) },
            { pk: "k2", value: serializedValue({ name: "stale" }), expiresAt: pastEpochSeconds },
          ],
        },
        UnprocessedKeys: {},
      });

      const store = createStore();
      const result = await store.getMany(["k1", "k2"]);

      expect(result.size).toBe(1);
      expect(result.get("k1")).toEqual({ name: "fresh" });
    });
  });

  describe("setMany", () => {
    it("does nothing for empty entries", async () => {
      const store = createStore();
      await store.setMany(new Map());

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("batch-writes entries", async () => {
      mockSend.mockResolvedValueOnce({ UnprocessedItems: {} });

      const store = createStore();
      await store.setMany(
        new Map([
          ["k1", { name: "Alice" }],
          ["k2", { name: "Bob" }],
        ]),
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteMany", () => {
    it("returns 0 for empty keys", async () => {
      const store = createStore();
      expect(await store.deleteMany([])).toBe(0);
    });

    it("batch-deletes and returns count", async () => {
      mockSend.mockResolvedValueOnce({});

      const store = createStore();
      const count = await store.deleteMany(["k1", "k2", "k3"]);

      expect(count).toBe(3);
    });
  });

  describe("connect / disconnect", () => {
    it("connect is a no-op", async () => {
      const store = createStore();
      await expect(store.connect()).resolves.toBeUndefined();
    });

    it("disconnect destroys the client", async () => {
      const mockDestroy = jest.fn();
      const client = { destroy: mockDestroy } as unknown as DynamoDBClient;
      (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDocClient);

      // Access the raw client via prototype hack — or just verify it doesn't throw
      const store = new DynamoDBCacheStore({
        client,
        tableName: TABLE_NAME,
      });

      await store.disconnect();
      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
