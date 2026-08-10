import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { ReadThroughCacheWrapper } from "./ReadThroughCacheWrapper";

describe("ReadThroughCacheWrapper", () => {
  let cache: ReadThroughCacheWrapper<string, string>;

  beforeEach(() => {
    cache = new ReadThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("getOrRead", () => {
    it("should call loader and cache result on miss", async () => {
      const loader = jest.fn().mockResolvedValue("loaded-value");

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("loaded-value");
      expect(loader).toHaveBeenCalledTimes(1);
      expect(await cache.get("key")).toBe("loaded-value");
    });

    it("should return cached value without calling loader on hit", async () => {
      await cache.set("key", "cached");
      const loader = jest.fn().mockResolvedValue("new-value");

      const result = await cache.getOrRead("key", loader);

      expect(result).toBe("cached");
      expect(loader).not.toHaveBeenCalled();
    });

    it("should bypass cache and call loader when forceRefresh is true", async () => {
      await cache.set("key", "stale");
      const loader = jest.fn().mockResolvedValue("fresh");

      const result = await cache.getOrRead("key", loader, { forceRefresh: true });

      expect(result).toBe("fresh");
      expect(loader).toHaveBeenCalledTimes(1);
      expect(await cache.get("key")).toBe("fresh");
    });
  });
});
