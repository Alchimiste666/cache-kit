import { InMemoryCacheMetricsRecorder } from "../metrics/InMemoryCacheMetricsRecorder";
import { MemoryCacheStore } from "./MemoryCacheStore";
import { MetricsCacheStore } from "./MetricsCacheStore";

describe("MetricsCacheStore", () => {
  let inner: MemoryCacheStore<string, number>;
  let metrics: InMemoryCacheMetricsRecorder;
  let store: MetricsCacheStore<string, number>;

  beforeEach(() => {
    inner = new MemoryCacheStore();
    metrics = new InMemoryCacheMetricsRecorder();
    store = new MetricsCacheStore(inner, metrics);
  });

  it("should record a hit on get() when value exists", async () => {
    await store.set("key", 1);
    await store.get("key");

    expect(metrics.stats().hits).toBe(1);
  });

  it("should record a miss on get() when value does not exist", async () => {
    await store.get("missing");

    expect(metrics.stats().misses).toBe(1);
  });

  it("should record a hit on has() when key exists", async () => {
    await store.set("key", 1);
    await store.has("key");

    expect(metrics.stats().hits).toBe(1);
  });

  it("should record a miss on has() when key does not exist", async () => {
    await store.has("missing");

    expect(metrics.stats().misses).toBe(1);
  });

  it("should record writes on set()", async () => {
    await store.set("a", 1);
    await store.set("b", 2);

    expect(metrics.stats().writes).toBe(2);
  });

  it("should record deletes on successful delete()", async () => {
    await store.set("key", 1);
    await store.delete("key");

    expect(metrics.stats().deletes).toBe(1);
  });

  it("should not record deletes on failed delete()", async () => {
    await store.delete("missing");

    expect(metrics.stats().deletes).toBe(0);
  });
});
