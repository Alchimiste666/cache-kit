import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { BatchReadWriteThroughCacheWrapper } from "./BatchReadWriteThroughCacheWrapper";

describe("BatchReadWriteThroughCacheWrapper", () => {
  let cache: BatchReadWriteThroughCacheWrapper<string, number>;

  beforeEach(() => {
    cache = new BatchReadWriteThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("basic operations", () => {
    it("should store and retrieve", async () => {
      await cache.set("k", 1);
      expect(await cache.get("k")).toBe(1);
    });

    it("should delete a key", async () => {
      await cache.set("k", 1);
      expect(await cache.delete("k")).toBe(true);
    });

    it("should clear all", async () => {
      await cache.set("a", 1);
      await cache.clear();
      expect(await cache.has("a")).toBe(false);
    });
  });

  describe("batch operations", () => {
    it("should getMany", async () => {
      await cache.set("a", 1);
      await cache.set("b", 2);
      const results = await cache.getMany(["a", "b", "c"]);
      expect(results.get("a")).toBe(1);
      expect(results.get("b")).toBe(2);
      expect(results.has("c")).toBe(false);
    });

    it("should setMany", async () => {
      await cache.setMany(
        new Map([
          ["x", 10],
          ["y", 20],
        ]),
      );
      expect(await cache.get("x")).toBe(10);
      expect(await cache.get("y")).toBe(20);
    });

    it("should deleteMany", async () => {
      await cache.set("a", 1);
      await cache.set("b", 2);
      expect(await cache.deleteMany(["a", "b"])).toBe(2);
    });
  });

  describe("read-through", () => {
    it("should getOrRead on miss", async () => {
      const loader = jest.fn().mockResolvedValue(42);
      expect(await cache.getOrRead("k", loader)).toBe(42);
      expect(await cache.get("k")).toBe(42);
    });

    it("should getOrReadMany loading only missing keys", async () => {
      await cache.set("a", 1);

      const loader = jest.fn().mockResolvedValue(new Map([["b", 2]]));
      const results = await cache.getOrReadMany(["a", "b"], loader);

      expect(results.get("a")).toBe(1);
      expect(results.get("b")).toBe(2);
      expect(loader).toHaveBeenCalledWith(["b"]);
    });
  });

  describe("write-through", () => {
    it("should put through writer", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);
      await cache.put("k", 99, writer);
      expect(writer).toHaveBeenCalledWith("k", 99);
      expect(await cache.get("k")).toBe(99);
    });

    it("should putMany through writer", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);
      const entries = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      await cache.putMany(entries, writer);
      expect(writer).toHaveBeenCalledWith(entries);
      expect(await cache.get("a")).toBe(1);
      expect(await cache.get("b")).toBe(2);
    });
  });
});
