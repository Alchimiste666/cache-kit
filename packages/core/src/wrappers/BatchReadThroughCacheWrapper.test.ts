import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { BatchReadThroughCacheWrapper } from "./BatchReadThroughCacheWrapper";

describe("BatchReadThroughCacheWrapper", () => {
  let cache: BatchReadThroughCacheWrapper<string, string>;

  beforeEach(() => {
    cache = new BatchReadThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("getOrRead", () => {
    it("should load and cache on miss", async () => {
      const loader = jest.fn().mockResolvedValue("loaded");

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("loaded");
      expect(await cache.get("key")).toBe("loaded");
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should return cached value without calling loader on hit", async () => {
      await cache.set("key", "cached");
      const loader = jest.fn();

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("cached");
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe("getOrReadMany", () => {
    it("should return all cached values without calling loader when all keys are cached", async () => {
      await cache.set("a", "1");
      await cache.set("b", "2");
      const loader = jest.fn();

      const result = await cache.getOrReadMany(["a", "b"], loader);

      expect(result.get("a")).toBe("1");
      expect(result.get("b")).toBe("2");
      expect(loader).not.toHaveBeenCalled();
    });

    it("should call loader only for missing keys", async () => {
      await cache.set("a", "cached-a");

      const loader = jest.fn().mockResolvedValue(new Map([["b", "loaded-b"]]));

      const result = await cache.getOrReadMany(["a", "b"], loader);

      expect(result.get("a")).toBe("cached-a");
      expect(result.get("b")).toBe("loaded-b");
      expect(loader).toHaveBeenCalledWith(["b"]);
    });

    it("should cache loaded values for subsequent reads", async () => {
      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["x", "val-x"],
          ["y", "val-y"],
        ]),
      );

      await cache.getOrReadMany(["x", "y"], loader);

      expect(await cache.get("x")).toBe("val-x");
      expect(await cache.get("y")).toBe("val-y");
    });
  });
});
