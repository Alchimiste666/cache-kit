import { MemoryCacheStore } from "./MemoryCacheStore";
import { RegionCacheStore } from "./RegionCacheStore";

describe("RegionCacheStore", () => {
  let store: RegionCacheStore<number>;

  beforeEach(() => {
    store = new RegionCacheStore(new MemoryCacheStore());
  });

  it("should namespace keys by region", async () => {
    await store.set("key", 1, { region: "us" });
    await store.set("key", 2, { region: "eu" });

    expect(await store.get("key", { region: "us" })).toBe(1);
    expect(await store.get("key", { region: "eu" })).toBe(2);
  });

  it("should use default region when no region is specified", async () => {
    await store.set("key", 42);

    expect(await store.get("key")).toBe(42);
    // Different region should not find it
    expect(await store.get("key", { region: "other" })).toBeUndefined();
  });

  it("should support has() with region", async () => {
    await store.set("key", 1, { region: "us" });

    expect(await store.has("key", { region: "us" })).toBe(true);
    expect(await store.has("key", { region: "eu" })).toBe(false);
  });

  it("should support delete() with region", async () => {
    await store.set("key", 1, { region: "us" });
    await store.set("key", 2, { region: "eu" });

    await store.delete("key", { region: "us" });

    expect(await store.has("key", { region: "us" })).toBe(false);
    expect(await store.get("key", { region: "eu" })).toBe(2);
  });

  it("should clear all regions when no region is specified", async () => {
    await store.set("a", 1, { region: "us" });
    await store.set("b", 2, { region: "eu" });

    await store.clear();

    expect(await store.has("a", { region: "us" })).toBe(false);
    expect(await store.has("b", { region: "eu" })).toBe(false);
  });

  it("should clear only the specified region", async () => {
    await store.set("a", 1, { region: "us" });
    await store.set("b", 2, { region: "us" });
    await store.set("c", 3, { region: "eu" });

    await store.clear("us");

    expect(await store.has("a", { region: "us" })).toBe(false);
    expect(await store.has("b", { region: "us" })).toBe(false);
    expect(await store.get("c", { region: "eu" })).toBe(3);
  });

  describe("Property 8: Region-specific clear removes exactly the target region's entries", () => {
    it("should remove all target region entries and preserve all others", async () => {
      await store.set("a", 1, { region: "us" });
      await store.set("b", 2, { region: "us" });
      await store.set("c", 3, { region: "eu" });
      await store.set("d", 4, { region: "eu" });
      await store.set("e", 5, { region: "jp" });

      await store.clear("us");

      expect(await store.has("a", { region: "us" })).toBe(false);
      expect(await store.has("b", { region: "us" })).toBe(false);
      expect(await store.get("c", { region: "eu" })).toBe(3);
      expect(await store.get("d", { region: "eu" })).toBe(4);
      expect(await store.get("e", { region: "jp" })).toBe(5);
    });

    it("should handle clearing a region with many entries while other regions remain intact", async () => {
      // Populate multiple regions
      for (let i = 0; i < 10; i++) {
        await store.set(`key-${i}`, i, { region: "target" });
        await store.set(`key-${i}`, i + 100, { region: "keep" });
      }

      await store.clear("target");

      for (let i = 0; i < 10; i++) {
        expect(await store.has(`key-${i}`, { region: "target" })).toBe(false);
        expect(await store.get(`key-${i}`, { region: "keep" })).toBe(i + 100);
      }
    });

    it("should handle delete operations before region clear", async () => {
      await store.set("a", 1, { region: "us" });
      await store.set("b", 2, { region: "us" });
      await store.set("c", 3, { region: "eu" });

      // Delete one entry from the target region before clearing
      await store.delete("a", { region: "us" });

      await store.clear("us");

      expect(await store.has("a", { region: "us" })).toBe(false);
      expect(await store.has("b", { region: "us" })).toBe(false);
      expect(await store.get("c", { region: "eu" })).toBe(3);
    });

    it("should handle clearing a region that does not exist", async () => {
      await store.set("a", 1, { region: "us" });

      // Clearing a non-existent region should not throw
      await store.clear("nonexistent");

      expect(await store.get("a", { region: "us" })).toBe(1);
    });

    it("should handle same key in different regions independently", async () => {
      await store.set("shared", 1, { region: "us" });
      await store.set("shared", 2, { region: "eu" });
      await store.set("shared", 3, { region: "jp" });

      await store.clear("eu");

      expect(await store.get("shared", { region: "us" })).toBe(1);
      expect(await store.has("shared", { region: "eu" })).toBe(false);
      expect(await store.get("shared", { region: "jp" })).toBe(3);
    });
  });

  describe("Property 9: Full clear removes all entries across all regions", () => {
    it("should remove all entries from all regions after clear()", async () => {
      await store.set("a", 1, { region: "us" });
      await store.set("b", 2, { region: "eu" });
      await store.set("c", 3, { region: "jp" });
      await store.set("d", 4); // default region

      await store.clear();

      expect(await store.has("a", { region: "us" })).toBe(false);
      expect(await store.has("b", { region: "eu" })).toBe(false);
      expect(await store.has("c", { region: "jp" })).toBe(false);
      expect(await store.has("d")).toBe(false);
    });

    it("should allow new entries after full clear", async () => {
      await store.set("a", 1, { region: "us" });
      await store.set("b", 2, { region: "eu" });

      await store.clear();

      await store.set("new", 99, { region: "us" });
      expect(await store.get("new", { region: "us" })).toBe(99);
    });

    it("should reset region index after full clear so subsequent region clear is clean", async () => {
      await store.set("a", 1, { region: "us" });
      await store.set("b", 2, { region: "us" });

      await store.clear();

      // Add new entries to same region
      await store.set("c", 3, { region: "us" });

      // Region clear should only remove "c", not ghost entries from before
      await store.clear("us");
      expect(await store.has("c", { region: "us" })).toBe(false);
    });
  });
});
