import type { CacheEntry } from "../types/CacheEntry";
import { MaxEntriesCapacity } from "./MaxEntriesCapacity";

function makeEntries<K>(keys: K[]): ReadonlyMap<K, CacheEntry<K, number>> {
  const map = new Map<K, CacheEntry<K, number>>();
  for (const key of keys) {
    map.set(key, { key, value: 0, createdAt: 0, lastAccessedAt: 0 });
  }
  return map;
}

describe("MaxEntriesCapacity", () => {
  it("should not trigger eviction when size <= max", () => {
    const cap = new MaxEntriesCapacity<string, number>(3);
    expect(cap.shouldEvict(makeEntries(["a", "b", "c"]))).toBe(false);
  });

  it("should trigger eviction when size > max", () => {
    const cap = new MaxEntriesCapacity<string, number>(3);
    expect(cap.shouldEvict(makeEntries(["a", "b", "c", "d"]))).toBe(true);
  });

  it("should report within limit when size <= max", () => {
    const cap = new MaxEntriesCapacity<string, number>(2);
    expect(cap.isWithinLimit(makeEntries(["a", "b"]))).toBe(true);
    expect(cap.isWithinLimit(makeEntries(["a"]))).toBe(true);
    expect(cap.isWithinLimit(makeEntries([]))).toBe(true);
  });

  it("should report not within limit when size > max", () => {
    const cap = new MaxEntriesCapacity<string, number>(2);
    expect(cap.isWithinLimit(makeEntries(["a", "b", "c"]))).toBe(false);
  });

  it("should work with max of 0", () => {
    const cap = new MaxEntriesCapacity<string, number>(0);
    expect(cap.shouldEvict(makeEntries(["a"]))).toBe(true);
    expect(cap.isWithinLimit(makeEntries([]))).toBe(true);
  });
});
