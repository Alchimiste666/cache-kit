import type { CacheEntry } from "../types/CacheEntry";
import type { CacheWeigher } from "../types/CacheWeigher";
import { WeightedCapacity } from "./WeightedCapacity";

function entry(key: string, value: number): CacheEntry<string, number> {
  return {
    key,
    value,
    createdAt: 0,
    updatedAt: 0,
    lastAccessedAt: 0,
  };
}

function mapOf(...entries: CacheEntry<string, number>[]): Map<string, CacheEntry<string, number>> {
  return new Map(entries.map((e) => [e.key, e]));
}

// Weighs each entry by its numeric value, so total weight is easy to reason about.
const valueWeigher: CacheWeigher<string, number> = {
  weigh: (e) => e.value,
};

describe("WeightedCapacity", () => {
  describe("shouldEvict", () => {
    it("should not evict when total weight is within the limit", () => {
      const capacity = new WeightedCapacity({ maxWeight: 10, weigher: valueWeigher });

      expect(capacity.shouldEvict(mapOf(entry("a", 4), entry("b", 6)))).toBe(false);
    });

    it("should evict when total weight exceeds the limit", () => {
      const capacity = new WeightedCapacity({ maxWeight: 10, weigher: valueWeigher });

      expect(capacity.shouldEvict(mapOf(entry("a", 4), entry("b", 7)))).toBe(true);
    });

    it("should treat weight equal to the limit as within capacity", () => {
      const capacity = new WeightedCapacity({ maxWeight: 10, weigher: valueWeigher });

      expect(capacity.shouldEvict(mapOf(entry("a", 10)))).toBe(false);
    });
  });

  describe("isWithinLimit", () => {
    it("should stop eviction once weight returns to maxWeight when no target is set", () => {
      const capacity = new WeightedCapacity({ maxWeight: 10, weigher: valueWeigher });

      expect(capacity.isWithinLimit(mapOf(entry("a", 10)))).toBe(true);
      expect(capacity.isWithinLimit(mapOf(entry("a", 11)))).toBe(false);
    });

    it("should continue eviction down to the target weight when provided", () => {
      const capacity = new WeightedCapacity({
        maxWeight: 10,
        targetWeight: 4,
        weigher: valueWeigher,
      });

      // Above the low target, so eviction should continue.
      expect(capacity.isWithinLimit(mapOf(entry("a", 5)))).toBe(false);
      // At the target, eviction stops.
      expect(capacity.isWithinLimit(mapOf(entry("a", 4)))).toBe(true);
    });
  });

  describe("validation", () => {
    it("should throw when maxWeight is negative", () => {
      expect(() => new WeightedCapacity({ maxWeight: -1, weigher: valueWeigher })).toThrow(
        "maxWeight must be >= 0",
      );
    });

    it("should throw when targetWeight exceeds maxWeight", () => {
      expect(
        () => new WeightedCapacity({ maxWeight: 10, targetWeight: 20, weigher: valueWeigher }),
      ).toThrow("targetWeight must be between 0 and maxWeight");
    });

    it("should throw when targetWeight is negative", () => {
      expect(
        () => new WeightedCapacity({ maxWeight: 10, targetWeight: -5, weigher: valueWeigher }),
      ).toThrow("targetWeight must be between 0 and maxWeight");
    });
  });
});
