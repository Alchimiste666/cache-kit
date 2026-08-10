import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { BatchWriteThroughCacheWrapper } from "./BatchWriteThroughCacheWrapper";

describe("BatchWriteThroughCacheWrapper", () => {
  let cache: BatchWriteThroughCacheWrapper<string, string>;

  beforeEach(() => {
    cache = new BatchWriteThroughCacheWrapper(new MemoryCacheStore());
  });

  describe("put", () => {
    it("should cache the value and call the writer", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);

      await cache.put("key", "value", writer);

      expect(await cache.get("key")).toBe("value");
      expect(writer).toHaveBeenCalledWith("key", "value");
    });
  });

  describe("putMany", () => {
    it("should cache all entries and call the writer with the full map", async () => {
      const writer = jest.fn().mockResolvedValue(undefined);
      const entries = new Map([
        ["a", "1"],
        ["b", "2"],
      ]);

      await cache.putMany(entries, writer);

      expect(await cache.get("a")).toBe("1");
      expect(await cache.get("b")).toBe("2");
      expect(writer).toHaveBeenCalledWith(entries);
    });

    it("should propagate writer errors after caching", async () => {
      const writer = jest.fn().mockRejectedValue(new Error("write failed"));
      const entries = new Map([["x", "val"]]);

      await expect(cache.putMany(entries, writer)).rejects.toThrow("write failed");

      // Value is still cached since setMany happens before writer
      expect(await cache.get("x")).toBe("val");
    });
  });
});
