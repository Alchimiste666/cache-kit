import { FIFOCacheEviction } from "../eviction/FIFOCacheEviction";
import { MemoryCacheStore } from "../stores/MemoryCacheStore";
import { WeightedCapacity } from "./WeightedCapacity";
import { FunctionWeigher } from "./weighers";

describe("WeightedCapacity (integration with MemoryCacheStore)", () => {
  it("should evict entries once the summed weight exceeds the limit", async () => {
    // Each value's numeric magnitude is its weight; cap the total at 10.
    const capacity = new WeightedCapacity<string, number>({
      maxWeight: 10,
      weigher: new FunctionWeigher((entry) => entry.value),
    });

    const store = new MemoryCacheStore<string, number>({
      capacity,
      eviction: new FIFOCacheEviction(),
    });

    await store.set("a", 6);
    await store.set("b", 3);
    // Total weight is now 9, still within the limit.
    expect(await store.has("a")).toBe(true);
    expect(await store.has("b")).toBe(true);

    // Adding weight 5 pushes total to 14; oldest entries evicted until <= 10.
    await store.set("c", 5);

    expect(await store.has("a")).toBe(false);
    expect(await store.get("b")).toBe(3);
    expect(await store.get("c")).toBe(5);
  });
});
