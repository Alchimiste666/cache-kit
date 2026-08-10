import type { CacheEntry } from "../types/CacheEntry";
import { HighLowWatermarkCapacity } from "./HighLowWatermarkCapacity";

function makeEntries<K>(keys: K[]): ReadonlyMap<K, CacheEntry<K, number>> {
  const map = new Map<K, CacheEntry<K, number>>();
  for (const key of keys) {
    map.set(key, { key, value: 0, createdAt: 0, lastAccessedAt: 0 });
  }
  return map;
}

describe("HighLowWatermarkCapacity", () => {
  it("should throw when lowWatermark > highWatermark", () => {
    expect(() => new HighLowWatermarkCapacity(5, 10)).toThrow(
      "lowWatermark must be <= highWatermark",
    );
  });

  it("should allow lowWatermark equal to highWatermark", () => {
    expect(() => new HighLowWatermarkCapacity(5, 5)).not.toThrow();
  });

  it("should not trigger eviction when size <= highWatermark", () => {
    const cap = new HighLowWatermarkCapacity<string, number>(3, 1);
    expect(cap.shouldEvict(makeEntries(["a", "b", "c"]))).toBe(false);
  });

  it("should trigger eviction when size > highWatermark", () => {
    const cap = new HighLowWatermarkCapacity<string, number>(3, 1);
    expect(cap.shouldEvict(makeEntries(["a", "b", "c", "d"]))).toBe(true);
  });

  it("should report within limit when size <= lowWatermark", () => {
    const cap = new HighLowWatermarkCapacity<string, number>(5, 2);
    expect(cap.isWithinLimit(makeEntries(["a", "b"]))).toBe(true);
    expect(cap.isWithinLimit(makeEntries(["a"]))).toBe(true);
  });

  it("should report not within limit when size > lowWatermark", () => {
    const cap = new HighLowWatermarkCapacity<string, number>(5, 2);
    expect(cap.isWithinLimit(makeEntries(["a", "b", "c"]))).toBe(false);
  });
});
