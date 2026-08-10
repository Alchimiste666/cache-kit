import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { ReadThroughCacheWrapper } from "../wrappers/ReadThroughCacheWrapper";
import { CoalescingCache } from "./CoalescingCache";

describe("CoalescingCache", () => {
  let cache: CoalescingCache<string, string>;

  beforeEach(() => {
    const inner = new ReadThroughCacheWrapper<string, string>(new MemoryCacheStore());
    cache = new CoalescingCache(inner);
  });

  describe("getOrRead", () => {
    it("should return cached value without calling loader", async () => {
      await cache.set("key", "cached");
      const loader = jest.fn().mockResolvedValue("new");

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("cached");
      expect(loader).not.toHaveBeenCalled();
    });

    it("should call loader on cache miss and store result", async () => {
      const loader = jest.fn().mockResolvedValue("loaded");

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("loaded");
      expect(await cache.get("key")).toBe("loaded");
    });

    it("should coalesce concurrent requests for the same key", async () => {
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = jest.fn().mockReturnValue(loaderPromise);

      const promise1 = cache.getOrRead("key", loader);
      const promise2 = cache.getOrRead("key", loader);

      resolveLoader?.("result");

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should not coalesce requests for different keys", async () => {
      const loaderA = jest.fn().mockResolvedValue("a-value");
      const loaderB = jest.fn().mockResolvedValue("b-value");

      const [resultA, resultB] = await Promise.all([
        cache.getOrRead("a", loaderA),
        cache.getOrRead("b", loaderB),
      ]);

      expect(resultA).toBe("a-value");
      expect(resultB).toBe("b-value");
      expect(loaderA).toHaveBeenCalledTimes(1);
      expect(loaderB).toHaveBeenCalledTimes(1);
    });

    it("should allow new loader calls after previous one resolves", async () => {
      const loader = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

      const result1 = await cache.getOrRead("key", loader, { forceRefresh: true });
      const result2 = await cache.getOrRead("key", loader, { forceRefresh: true });

      expect(result1).toBe("first");
      expect(result2).toBe("second");
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("should clean up in-flight entry when loader throws", async () => {
      const failingLoader = jest.fn().mockRejectedValue(new Error("fail"));
      const successLoader = jest.fn().mockResolvedValue("ok");

      await expect(cache.getOrRead("key", failingLoader)).rejects.toThrow("fail");

      const result = await cache.getOrRead("key", successLoader);
      expect(result).toBe("ok");
    });
  });

  describe("getOrReadMany", () => {
    it("should call the loader once with all missing keys", async () => {
      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
          ["c", "val-c"],
        ]),
      );

      const result = await cache.getOrReadMany(["a", "b", "c"], loader);

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(["a", "b", "c"]);
      expect(result).toEqual(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
          ["c", "val-c"],
        ]),
      );
    });

    it("should store loaded values in the cache", async () => {
      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );

      await cache.getOrReadMany(["a", "b"], loader);

      expect(await cache.get("a")).toBe("val-a");
      expect(await cache.get("b")).toBe("val-b");
    });

    it("should skip cached keys and only load missing ones", async () => {
      await cache.set("a", "cached-a");

      const loader = jest.fn().mockResolvedValue(new Map([["b", "val-b"]]));

      const result = await cache.getOrReadMany(["a", "b"], loader);

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(["b"]);
      expect(result).toEqual(
        new Map([
          ["a", "cached-a"],
          ["b", "val-b"],
        ]),
      );
    });

    it("should not invoke the loader when all keys are cached", async () => {
      await cache.set("a", "cached-a");
      await cache.set("b", "cached-b");

      const loader = jest.fn();

      const result = await cache.getOrReadMany(["a", "b"], loader);

      expect(loader).not.toHaveBeenCalled();
      expect(result).toEqual(
        new Map([
          ["a", "cached-a"],
          ["b", "cached-b"],
        ]),
      );
    });

    it("should deduplicate against existing in-flight requests", async () => {
      let resolveFirst!: (value: Map<string, string>) => void;
      const firstLoaderPromise = new Promise<Map<string, string>>((resolve) => {
        resolveFirst = resolve;
      });
      const firstLoader = jest.fn().mockReturnValue(firstLoaderPromise);
      const secondLoader = jest.fn().mockResolvedValue(new Map([["c", "val-c"]]));

      // Start first batch that puts "a" and "b" in-flight
      const firstResult = cache.getOrReadMany(["a", "b"], firstLoader);

      // Flush microtasks to allow the first call to complete classification
      // and register in-flight entries (needs to pass through await cache.get for each key)
      await new Promise((r) => setImmediate(r));

      // Second batch with overlapping key "b" and new key "c"
      const secondResult = cache.getOrReadMany(["b", "c"], secondLoader);

      // Resolve first loader
      resolveFirst(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );

      const [result1, result2] = await Promise.all([firstResult, secondResult]);

      expect(firstLoader).toHaveBeenCalledWith(["a", "b"]);
      expect(secondLoader).toHaveBeenCalledWith(["c"]);
      expect(result1).toEqual(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );
      expect(result2).toEqual(
        new Map([
          ["b", "val-b"],
          ["c", "val-c"],
        ]),
      );
    });

    it("should clean up in-flight entries after loader resolves", async () => {
      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );

      await cache.getOrReadMany(["a", "b"], loader);

      // A new call should invoke the loader again since in-flight entries were cleaned up
      const secondLoader = jest.fn().mockResolvedValue(new Map([["a", "fresh-a"]]));
      await cache.getOrReadMany(["a"], secondLoader, { forceRefresh: true });

      expect(secondLoader).toHaveBeenCalledTimes(1);
      expect(secondLoader).toHaveBeenCalledWith(["a"]);
    });

    it("should clean up in-flight entries when loader rejects", async () => {
      const failingLoader = jest.fn().mockRejectedValue(new Error("batch failed"));

      await expect(cache.getOrReadMany(["a", "b"], failingLoader)).rejects.toThrow("batch failed");

      // After failure, keys should not remain in-flight
      const successLoader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );
      const result = await cache.getOrReadMany(["a", "b"], successLoader);

      expect(successLoader).toHaveBeenCalledTimes(1);
      expect(result).toEqual(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
        ]),
      );
    });

    it("should bypass cached values when forceRefresh is true", async () => {
      await cache.set("a", "cached-a");
      await cache.set("b", "cached-b");

      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "fresh-a"],
          ["b", "fresh-b"],
        ]),
      );

      const result = await cache.getOrReadMany(["a", "b"], loader, { forceRefresh: true });

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(["a", "b"]);
      expect(result).toEqual(
        new Map([
          ["a", "fresh-a"],
          ["b", "fresh-b"],
        ]),
      );
    });

    it("should respect in-flight deduplication even with forceRefresh", async () => {
      let resolveFirst!: (value: Map<string, string>) => void;
      const firstLoaderPromise = new Promise<Map<string, string>>((resolve) => {
        resolveFirst = resolve;
      });
      const firstLoader = jest.fn().mockReturnValue(firstLoaderPromise);
      const secondLoader = jest.fn().mockResolvedValue(new Map([["b", "fresh-b"]]));

      // Start first batch with "a" in-flight
      const firstResult = cache.getOrReadMany(["a"], firstLoader);

      // Flush microtasks to allow the first call to register in-flight entries
      await new Promise((r) => setImmediate(r));

      // Second call with forceRefresh for "a" (in-flight) and "b" (not in-flight)
      const secondResult = cache.getOrReadMany(["a", "b"], secondLoader, { forceRefresh: true });

      resolveFirst(new Map([["a", "val-a"]]));

      const [result1, result2] = await Promise.all([firstResult, secondResult]);

      // "a" should be awaited from the existing in-flight, "b" should be loaded fresh
      expect(secondLoader).toHaveBeenCalledWith(["b"]);
      expect(result1).toEqual(new Map([["a", "val-a"]]));
      expect(result2).toEqual(
        new Map([
          ["a", "val-a"],
          ["b", "fresh-b"],
        ]),
      );
    });

    it("should return an empty map for empty keys array", async () => {
      const loader = jest.fn();

      const result = await cache.getOrReadMany([], loader);

      expect(loader).not.toHaveBeenCalled();
      expect(result).toEqual(new Map());
    });
  });

  describe("batch operations without BatchReadThroughCache", () => {
    it("should throw on getMany when underlying cache is not batch-capable", () => {
      expect(() => cache.getMany(["a"])).toThrow(
        "CoalescingCache.getMany requires BatchReadThroughCache",
      );
    });

    it("should throw on setMany when underlying cache is not batch-capable", () => {
      expect(() => cache.setMany(new Map([["a", "1"]]))).toThrow(
        "CoalescingCache.setMany requires BatchReadThroughCache",
      );
    });

    it("should throw on deleteMany when underlying cache is not batch-capable", () => {
      expect(() => cache.deleteMany(["a"])).toThrow(
        "CoalescingCache.deleteMany requires BatchReadThroughCache",
      );
    });
  });
});
