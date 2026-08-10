import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { DefaultCache } from "./DefaultCache";

describe("DefaultCache", () => {
  let cache: DefaultCache<string, number>;

  beforeEach(() => {
    cache = new DefaultCache(new MemoryCacheStore());
  });

  it("should return false for has() on missing key", async () => {
    expect(await cache.has("x")).toBe(false);
  });

  it("should return undefined for get() on missing key", async () => {
    expect(await cache.get("x")).toBeUndefined();
  });

  it("should store and retrieve a value", async () => {
    await cache.set("k", 42);
    expect(await cache.has("k")).toBe(true);
    expect(await cache.get("k")).toBe(42);
  });

  it("should delete an existing key", async () => {
    await cache.set("k", 1);
    expect(await cache.delete("k")).toBe(true);
    expect(await cache.has("k")).toBe(false);
  });

  it("should return false when deleting a non-existent key", async () => {
    expect(await cache.delete("nope")).toBe(false);
  });

  it("should clear all entries", async () => {
    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.clear();
    expect(await cache.has("a")).toBe(false);
    expect(await cache.has("b")).toBe(false);
  });
});
