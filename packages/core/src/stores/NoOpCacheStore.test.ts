import { NoOpCacheStore } from "./NoOpCacheStore";

describe("NoOpCacheStore", () => {
  let store: NoOpCacheStore<string, number>;

  beforeEach(() => {
    store = new NoOpCacheStore();
  });

  it("should always return false for has()", async () => {
    expect(await store.has("any")).toBe(false);
  });

  it("should always return undefined for get()", async () => {
    expect(await store.get("any")).toBeUndefined();
  });

  it("should accept set() without error", async () => {
    await expect(store.set("k", 1)).resolves.toBeUndefined();
  });

  it("should always return false for delete()", async () => {
    expect(await store.delete("any")).toBe(false);
  });

  it("should accept clear() without error", async () => {
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it("should accept connect() without error", async () => {
    await expect(store.connect()).resolves.toBeUndefined();
  });

  it("should accept disconnect() without error", async () => {
    await expect(store.disconnect()).resolves.toBeUndefined();
  });

  it("should not store values (set then get returns undefined)", async () => {
    await store.set("k", 42);
    expect(await store.get("k")).toBeUndefined();
  });
});
