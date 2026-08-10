import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { ReadWriteThroughCacheWrapper } from "./ReadWriteThroughCacheWrapper";

describe("ReadWriteThroughCacheWrapper", () => {
  let cache: ReadWriteThroughCacheWrapper<string, number>;

  beforeEach(() => {
    cache = new ReadWriteThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("basic cache operations", () => {
    it("should store and retrieve a value", async () => {
      await cache.set("k", 42);
      expect(await cache.get("k")).toBe(42);
    });

    it("should delete a key", async () => {
      await cache.set("k", 1);
      expect(await cache.delete("k")).toBe(true);
      expect(await cache.has("k")).toBe(false);
    });

    it("should clear all entries", async () => {
      await cache.set("a", 1);
      await cache.set("b", 2);
      await cache.clear();
      expect(await cache.has("a")).toBe(false);
    });
  });

  describe("read-through (getOrRead)", () => {
    it("should load and cache on miss", async () => {
      const loader = jest.fn().mockResolvedValue(99);

      const result = await cache.getOrRead("k", loader);
      expect(result).toBe(99);
      expect(await cache.get("k")).toBe(99);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should return cached value without calling loader on hit", async () => {
      await cache.set("k", 5);
      const loader = jest.fn().mockResolvedValue(99);

      const result = await cache.getOrRead("k", loader);
      expect(result).toBe(5);
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe("write-through (put)", () => {
    it("should write to origin and cache", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);

      await cache.put("k", 10, writer);
      expect(writer).toHaveBeenCalledWith("k", 10);
      expect(await cache.get("k")).toBe(10);
    });
  });
});
