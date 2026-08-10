import { CacheBuilder } from "./CacheBuilder";
import { MaxEntriesCapacity } from "./capacity/MaxEntriesCapacity";
import { FIFOCacheEviction } from "./eviction/FIFOCacheEviction";
import { InMemoryCacheMetricsRecorder } from "./metrics/InMemoryCacheMetricsRecorder";
import { MemoryCacheStore } from "./stores/MemoryCacheStore";
import { CacheExpirationType } from "./types/CacheExpiration";

describe("CacheBuilder", () => {
  describe("buildDefaultCache", () => {
    it("should build a working cache with default in-memory store", async () => {
      const cache = new CacheBuilder<string, number>().buildDefaultCache();

      await cache.set("key", 42);
      expect(await cache.get("key")).toBe(42);
      expect(await cache.has("key")).toBe(true);
    });

    it("should use a custom store when provided", async () => {
      const customStore = new MemoryCacheStore<string, number>();
      await customStore.set("pre", 99);

      const cache = new CacheBuilder<string, number>().withStore(customStore).buildDefaultCache();

      expect(await cache.get("pre")).toBe(99);
    });
  });

  describe("buildReadThroughCache", () => {
    it("should support getOrRead on the built cache", async () => {
      const cache = new CacheBuilder<string, string>().buildReadThroughCache();

      const loader = jest.fn().mockResolvedValue("loaded");
      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("loaded");
      expect(await cache.get("key")).toBe("loaded");
    });
  });

  describe("buildWriteThroughCache", () => {
    it("should support put on the built cache", async () => {
      const cache = new CacheBuilder<string, string>().buildWriteThroughCache();
      const writer = jest.fn().mockResolvedValue(undefined);

      await cache.put("key", "value", writer);

      expect(await cache.get("key")).toBe("value");
      expect(writer).toHaveBeenCalledWith("key", "value");
    });
  });

  describe("withCapacity", () => {
    it("should enforce max entries capacity", async () => {
      const cache = new CacheBuilder<string, number>()
        .withEviction(new FIFOCacheEviction())
        .withCapacity(new MaxEntriesCapacity(2))
        .buildDefaultCache();

      await cache.set("a", 1);
      await cache.set("b", 2);
      await cache.set("c", 3);

      expect(await cache.has("a")).toBe(false);
      expect(await cache.get("b")).toBe(2);
      expect(await cache.get("c")).toBe(3);
    });
  });

  describe("withExpiration", () => {
    it("should apply default expiration to entries", async () => {
      jest.useFakeTimers();

      const cache = new CacheBuilder<string, number>()
        .withExpiration({ type: CacheExpirationType.TimeToLive, milliSeconds: 50 })
        .buildDefaultCache();

      await cache.set("key", 1);
      expect(await cache.get("key")).toBe(1);

      jest.advanceTimersByTime(51);
      expect(await cache.get("key")).toBeUndefined();

      jest.useRealTimers();
    });
  });

  describe("withMetrics", () => {
    it("should record metrics through the built cache", async () => {
      const metrics = new InMemoryCacheMetricsRecorder();

      const cache = new CacheBuilder<string, number>().withMetrics(metrics).buildDefaultCache();

      await cache.set("key", 1);
      await cache.get("key");
      await cache.get("miss");

      expect(metrics.stats().writes).toBe(1);
      expect(metrics.stats().hits).toBe(1);
      expect(metrics.stats().misses).toBe(1);
    });
  });

  describe("withDecorator", () => {
    it("should apply decorator to the built cache", async () => {
      const log: string[] = [];

      const cache = new CacheBuilder<string, number>()
        .withDecorator((inner) => ({
          has: (key) => inner.has(key),
          get: (key) => {
            log.push(`get:${key}`);
            return inner.get(key);
          },
          set: (key, value, opts) => inner.set(key, value, opts),
          delete: (key) => inner.delete(key),
          clear: () => inner.clear(),
        }))
        .buildDefaultCache();

      await cache.set("key", 1);
      await cache.get("key");

      expect(log).toEqual(["get:key"]);
    });
  });

  describe("resolver functions", () => {
    it("should accept a function resolver for eviction that receives context", async () => {
      const capacity = new MaxEntriesCapacity<string, number>(2);

      const cache = new CacheBuilder<string, number>()
        .withCapacity(capacity)
        .withEviction((context) => {
          // Capacity is resolved before eviction, so it should be available
          expect(context.capacity).toBe(capacity);
          return new FIFOCacheEviction();
        })
        .buildDefaultCache();

      await cache.set("a", 1);
      await cache.set("b", 2);
      await cache.set("c", 3);

      expect(await cache.has("a")).toBe(false);
      expect(await cache.get("c")).toBe(3);
    });
  });
});
