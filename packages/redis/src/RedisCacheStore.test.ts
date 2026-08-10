import { JsonSerializer } from "@alchemist-software/cache-kit-core";
import { RedisCacheStore } from "./RedisCacheStore";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockExists = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockFlushAll = jest.fn();
const mockMGet = jest.fn();
const mockMSet = jest.fn();
const mockConnect = jest.fn();
const mockQuit = jest.fn();
const mockOn = jest.fn();
const mockMulti = jest.fn();
const mockPExpireAt = jest.fn();
const mockExec = jest.fn();

let mockIsOpen = false;

const mockClient = {
  exists: mockExists,
  get: mockGet,
  set: mockSet,
  del: mockDel,
  flushAll: mockFlushAll,
  mGet: mockMGet,
  mSet: mockMSet,
  connect: mockConnect,
  quit: mockQuit,
  on: mockOn,
  multi: mockMulti,
  get isOpen() {
    return mockIsOpen;
  },
};

jest.mock("redis", () => ({
  createClient: jest.fn(() => mockClient),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOpen = false;
  mockMulti.mockReturnValue({ pExpireAt: mockPExpireAt, exec: mockExec });
  mockPExpireAt.mockReturnThis();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const serializer = new JsonSerializer<{ name: string }>();

function createStore() {
  return new RedisCacheStore<string, { name: string }>({
    client: mockClient as any,
  });
}

function serializedString(value: { name: string }): string {
  return Buffer.from(serializer.serialize(value)).toString("binary");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RedisCacheStore", () => {
  describe("has", () => {
    it("returns true when key exists", async () => {
      mockExists.mockResolvedValueOnce(1);

      const store = createStore();
      expect(await store.has("key1")).toBe(true);
    });

    it("returns false when key does not exist", async () => {
      mockExists.mockResolvedValueOnce(0);

      const store = createStore();
      expect(await store.has("key1")).toBe(false);
    });
  });

  describe("get", () => {
    it("returns deserialized value when key exists", async () => {
      const value = { name: "Alice" };
      mockGet.mockResolvedValueOnce(serializedString(value));

      const store = createStore();
      expect(await store.get("key1")).toEqual(value);
    });

    it("returns undefined when key does not exist", async () => {
      mockGet.mockResolvedValueOnce(null);

      const store = createStore();
      expect(await store.get("key1")).toBeUndefined();
    });
  });

  describe("set", () => {
    it("sets value without options", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set("key1", { name: "Bob" });

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(String));
    });

    it("sets with PXAT when expiration is provided", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set(
        "key1",
        { name: "Bob" },
        {
          expiration: { type: "time-to-live" as const, milliSeconds: 60_000 },
        },
      );

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(String), {
        PXAT: expect.any(Number),
      });
    });

    it("sets with NX when overwrite is false", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set("key1", { name: "Bob" }, { overwrite: false });

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(String), { NX: true });
    });

    it("sets with both PXAT and NX when both options provided", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set(
        "key1",
        { name: "Bob" },
        {
          expiration: { type: "time-to-live" as const, milliSeconds: 60_000 },
          overwrite: false,
        },
      );

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(String), {
        PXAT: expect.any(Number),
        NX: true,
      });
    });
  });

  describe("delete", () => {
    it("returns true when key was deleted", async () => {
      mockDel.mockResolvedValueOnce(1);

      const store = createStore();
      expect(await store.delete("key1")).toBe(true);
    });

    it("returns false when key did not exist", async () => {
      mockDel.mockResolvedValueOnce(0);

      const store = createStore();
      expect(await store.delete("key1")).toBe(false);
    });
  });

  describe("clear", () => {
    it("calls flushAll", async () => {
      mockFlushAll.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.clear();

      expect(mockFlushAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMany", () => {
    it("returns empty map for empty keys", async () => {
      const store = createStore();
      expect(await store.getMany([])).toEqual(new Map());
    });

    it("returns deserialized values, skipping nulls", async () => {
      const value1 = { name: "Alice" };
      mockMGet.mockResolvedValueOnce([serializedString(value1), null]);

      const store = createStore();
      const result = await store.getMany(["k1", "k2"]);

      expect(result.size).toBe(1);
      expect(result.get("k1")).toEqual(value1);
      expect(result.has("k2")).toBe(false);
    });
  });

  describe("setMany", () => {
    it("does nothing for empty entries", async () => {
      const store = createStore();
      await store.setMany(new Map());

      expect(mockMSet).not.toHaveBeenCalled();
    });

    it("calls mSet with serialized pairs", async () => {
      mockMSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.setMany(
        new Map([
          ["k1", { name: "Alice" }],
          ["k2", { name: "Bob" }],
        ]),
      );

      expect(mockMSet).toHaveBeenCalledTimes(1);
      const pairs = mockMSet.mock.calls[0][0];
      expect(pairs).toHaveLength(2);
      expect(pairs[0][0]).toBe("k1");
      expect(pairs[1][0]).toBe("k2");
    });

    it("sets expiry via multi/pExpireAt when expiration provided", async () => {
      mockMSet.mockResolvedValueOnce("OK");
      mockExec.mockResolvedValueOnce([]);

      const store = createStore();
      await store.setMany(new Map([["k1", { name: "Alice" }]]), {
        expiration: { type: "time-to-live" as const, milliSeconds: 30_000 },
      });

      expect(mockMulti).toHaveBeenCalled();
      expect(mockPExpireAt).toHaveBeenCalledWith("k1", expect.any(Number));
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe("deleteMany", () => {
    it("returns 0 for empty keys", async () => {
      const store = createStore();
      expect(await store.deleteMany([])).toBe(0);
    });

    it("returns count of deleted keys", async () => {
      mockDel.mockResolvedValueOnce(2);

      const store = createStore();
      expect(await store.deleteMany(["k1", "k2"])).toBe(2);
    });
  });

  describe("connect", () => {
    it("connects when not open", async () => {
      mockIsOpen = false;
      mockConnect.mockResolvedValueOnce(undefined);

      const store = createStore();
      await store.connect();

      expect(mockConnect).toHaveBeenCalled();
    });

    it("skips connect when already open", async () => {
      mockIsOpen = true;

      const store = createStore();
      await store.connect();

      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe("disconnect", () => {
    it("quits when open", async () => {
      mockIsOpen = true;
      mockQuit.mockResolvedValueOnce(undefined);

      const store = createStore();
      await store.disconnect();

      expect(mockQuit).toHaveBeenCalled();
    });

    it("skips quit when not open", async () => {
      mockIsOpen = false;

      const store = createStore();
      await store.disconnect();

      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
