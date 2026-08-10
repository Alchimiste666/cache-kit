import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { BatchCacheWrapper } from "./BatchCacheWrapper";

describe("BatchCacheWrapper", () => {
  let cache: BatchCacheWrapper<string, number>;

  beforeEach(() => {
    cache = new BatchCacheWrapper(new MemoryCacheStore());
  });

  describe("single operations", () => {
    it("should store and retrieve a value", async () => {
      await cache.set("k", 10);
      expect(await cache.get("k")).toBe(10);
      expect(await cache.has("k")).toBe(true);
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
      expect(await cache.has("b")).toBe(false);
    });
  });

  describe("batch operations", () => {
    it("should get multiple values", async () => {
      await cache.set("a", 1);
      await cache.set("b", 2);

      const results = await cache.getMany(["a", "b", "missing"]);
      expect(results.get("a")).toBe(1);
      expect(results.get("b")).toBe(2);
      expect(results.has("missing")).toBe(false);
    });

    it("should set multiple values", async () => {
      await cache.setMany(
        new Map([
          ["x", 10],
          ["y", 20],
        ]),
      );
      expect(await cache.get("x")).toBe(10);
      expect(await cache.get("y")).toBe(20);
    });

    it("should delete multiple keys and return count", async () => {
      await cache.set("a", 1);
      await cache.set("b", 2);
      await cache.set("c", 3);

      const deleted = await cache.deleteMany(["a", "c", "missing"]);
      expect(deleted).toBe(2);
      expect(await cache.has("b")).toBe(true);
    });

    it("should return empty map for getMany with empty keys", async () => {
      const results = await cache.getMany([]);
      expect(results.size).toBe(0);
    });

    it("should return 0 for deleteMany with empty keys", async () => {
      expect(await cache.deleteMany([])).toBe(0);
    });
  });
});
