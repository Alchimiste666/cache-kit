import { JsonSerializer } from "@alchemist-software/cache-kit-core";
import { ValkeyCacheStore } from "./ValkeyCacheStore";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockExists = jest.fn();
const mockGetBuffer = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockFlushall = jest.fn();
const mockMgetBuffer = jest.fn();
const mockMset = jest.fn();
const mockConnect = jest.fn();
const mockQuit = jest.fn();
const mockOn = jest.fn();
const mockOnce = jest.fn();
const mockPipeline = jest.fn();
const mockPexpireat = jest.fn();
const mockExec = jest.fn();

let mockStatus = "ready";

const mockClient = {
  exists: mockExists,
  getBuffer: mockGetBuffer,
  set: mockSet,
  del: mockDel,
  flushall: mockFlushall,
  mgetBuffer: mockMgetBuffer,
  mset: mockMset,
  connect: mockConnect,
  quit: mockQuit,
  on: mockOn,
  once: mockOnce,
  pipeline: mockPipeline,
  get status() {
    return mockStatus;
  },
};

jest.mock("iovalkey", () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockClient),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = "ready";
  mockPipeline.mockReturnValue({ pexpireat: mockPexpireat, exec: mockExec });
  mockPexpireat.mockReturnThis();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const serializer = new JsonSerializer<{ name: string }>();

function createStore() {
  return new ValkeyCacheStore<string, { name: string }>({
    client: mockClient as any,
  });
}

function serializedBuffer(value: { name: string }): Buffer {
  return Buffer.from(serializer.serialize(value));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ValkeyCacheStore", () => {
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
      mockGetBuffer.mockResolvedValueOnce(serializedBuffer(value));

      const store = createStore();
      expect(await store.get("key1")).toEqual(value);
    });

    it("returns undefined when key does not exist", async () => {
      mockGetBuffer.mockResolvedValueOnce(null);

      const store = createStore();
      expect(await store.get("key1")).toBeUndefined();
    });
  });

  describe("set", () => {
    it("sets value without options (overwrite)", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set("key1", { name: "Bob" });

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(Buffer));
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

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(Buffer), "PXAT", expect.any(Number));
    });

    it("sets with NX when overwrite is false", async () => {
      mockSet.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.set("key1", { name: "Bob" }, { overwrite: false });

      expect(mockSet).toHaveBeenCalledWith("key1", expect.any(Buffer), "NX");
    });

    it("sets with PXAT and NX when both options provided", async () => {
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

      expect(mockSet).toHaveBeenCalledWith(
        "key1",
        expect.any(Buffer),
        "PXAT",
        expect.any(Number),
        "NX",
      );
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
    it("calls flushall", async () => {
      mockFlushall.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.clear();

      expect(mockFlushall).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMany", () => {
    it("returns empty map for empty keys", async () => {
      const store = createStore();
      expect(await store.getMany([])).toEqual(new Map());
    });

    it("returns deserialized values, skipping nulls", async () => {
      const value1 = { name: "Alice" };
      mockMgetBuffer.mockResolvedValueOnce([serializedBuffer(value1), null]);

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

      expect(mockMset).not.toHaveBeenCalled();
    });

    it("calls mset with serialized pairs", async () => {
      mockMset.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.setMany(
        new Map([
          ["k1", { name: "Alice" }],
          ["k2", { name: "Bob" }],
        ]),
      );

      expect(mockMset).toHaveBeenCalledTimes(1);
      // Valkey mset takes alternating key/value args
      expect(mockMset).toHaveBeenCalledWith("k1", expect.any(Buffer), "k2", expect.any(Buffer));
    });

    it("sets expiry via pipeline when expiration provided", async () => {
      mockMset.mockResolvedValueOnce("OK");
      mockExec.mockResolvedValueOnce([]);

      const store = createStore();
      await store.setMany(new Map([["k1", { name: "Alice" }]]), {
        expiration: { type: "time-to-live" as const, milliSeconds: 30_000 },
      });

      expect(mockPipeline).toHaveBeenCalled();
      expect(mockPexpireat).toHaveBeenCalledWith("k1", expect.any(Number));
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe("deleteMany", () => {
    it("returns 0 for empty keys", async () => {
      const store = createStore();
      expect(await store.deleteMany([])).toBe(0);
    });

    it("returns count of deleted keys", async () => {
      mockDel.mockResolvedValueOnce(3);

      const store = createStore();
      expect(await store.deleteMany(["k1", "k2", "k3"])).toBe(3);
    });
  });

  describe("connect", () => {
    it("skips when already ready", async () => {
      mockStatus = "ready";

      const store = createStore();
      await store.connect();

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("connects when status is wait", async () => {
      mockStatus = "wait";
      mockConnect.mockResolvedValueOnce(undefined);

      const store = createStore();
      await store.connect();

      expect(mockConnect).toHaveBeenCalled();
    });

    it("connects when status is close", async () => {
      mockStatus = "close";
      mockConnect.mockResolvedValueOnce(undefined);

      const store = createStore();
      await store.connect();

      expect(mockConnect).toHaveBeenCalled();
    });

    it("waits for ready event when status is connecting", async () => {
      mockStatus = "connecting";
      mockOnce.mockImplementation((event: string, handler: () => void) => {
        if (event === "ready") {
          handler();
        }
      });

      const store = createStore();
      await store.connect();

      expect(mockOnce).toHaveBeenCalledWith("ready", expect.any(Function));
    });
  });

  describe("disconnect", () => {
    it("quits when status is ready", async () => {
      mockStatus = "ready";
      mockQuit.mockResolvedValueOnce("OK");

      const store = createStore();
      await store.disconnect();

      expect(mockQuit).toHaveBeenCalled();
    });

    it("skips quit when status is end", async () => {
      mockStatus = "end";

      const store = createStore();
      await store.disconnect();

      expect(mockQuit).not.toHaveBeenCalled();
    });

    it("skips quit when status is close", async () => {
      mockStatus = "close";

      const store = createStore();
      await store.disconnect();

      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
