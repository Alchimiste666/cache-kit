import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { WriteThroughCacheWrapper } from "./WriteThroughCacheWrapper";

describe("WriteThroughCacheWrapper", () => {
  let cache: WriteThroughCacheWrapper<string, string>;

  beforeEach(() => {
    cache = new WriteThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("put", () => {
    it("should write to cache and call the writer", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);

      await cache.put("key", "value", writer);

      expect(await cache.get("key")).toBe("value");
      expect(writer).toHaveBeenCalledWith("key", "value");
    });

    it("should propagate writer errors after caching", async () => {
      const writer = jest.fn().mockRejectedValue(new Error("write failed"));

      await expect(cache.put("key", "value", writer)).rejects.toThrow("write failed");

      // Value is still cached since set() happens before writer()
      expect(await cache.get("key")).toBe("value");
    });
  });
});
