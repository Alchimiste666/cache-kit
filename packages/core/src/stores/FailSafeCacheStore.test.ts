import { FailSafeCacheStore } from "./FailSafeCacheStore";
import { MemoryCacheStore } from "./MemoryCacheStore";

describe("FailSafeCacheStore", () => {
  let store: FailSafeCacheStore<string, number>;

  afterEach(async () => {
    if (store) {
      await store.disconnect();
    }
  });

  it("should use the primary store when creation succeeds", async () => {
    const primary = new MemoryCacheStore<string, number>();

    store = new FailSafeCacheStore<string, number>({
      createStore: () => primary,
    });

    await store.waitUntilReady(1000);

    await store.set("key", 42);
    expect(await store.get("key")).toBe(42);
  });

  it("should fall back to NoOp store when primary creation fails", async () => {
    store = new FailSafeCacheStore<string, number>({
      createStore: () => {
        throw new Error("connection refused");
      },
    });

    // Give time for tryConnect to fail
    await new Promise((r) => setTimeout(r, 50));

    // NoOp store returns defaults without throwing
    await store.set("key", 1);
    expect(await store.get("key")).toBeUndefined();
    expect(await store.has("key")).toBe(false);
    expect(await store.delete("key")).toBe(false);
  });

  it("should use a custom fallback store when primary is unavailable", async () => {
    const fallback = new MemoryCacheStore<string, number>();
    await fallback.set("fallback-key", 99);

    store = new FailSafeCacheStore<string, number>({
      createStore: () => {
        throw new Error("unavailable");
      },
      fallbackStore: fallback,
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(await store.get("fallback-key")).toBe(99);
  });

  it("should swallow errors from delegate operations gracefully", async () => {
    const failingStore = {
      has: () => Promise.reject(new Error("fail")),
      get: () => Promise.reject(new Error("fail")),
      set: () => Promise.reject(new Error("fail")),
      delete: () => Promise.reject(new Error("fail")),
      clear: () => Promise.reject(new Error("fail")),
    };

    store = new FailSafeCacheStore<string, number>({
      createStore: () => failingStore,
    });

    await store.waitUntilReady(1000);

    // None of these should throw
    expect(await store.has("key")).toBe(false);
    expect(await store.get("key")).toBeUndefined();
    await store.set("key", 1);
    expect(await store.delete("key")).toBe(false);
    await store.clear();
  });

  it("should recover when primary store becomes available on health check", async () => {
    const primary = new MemoryCacheStore<string, number>();
    let shouldFail = true;

    store = new FailSafeCacheStore<string, number>({
      createStore: () => {
        if (shouldFail) throw new Error("not ready");
        return primary;
      },
      checkInterval: 100,
    });

    await new Promise((r) => setTimeout(r, 50));

    // Initially unavailable
    expect(await store.get("key")).toBeUndefined();

    // Make store available and wait for health check
    shouldFail = false;
    await new Promise((r) => setTimeout(r, 150));

    await store.set("key", 123);
    expect(await store.get("key")).toBe(123);
  });
});
