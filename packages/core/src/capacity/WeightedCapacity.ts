import type { CacheCapacity } from "../types/CacheCapacity";
import type { CacheEntry } from "../types/CacheEntry";
import type { CacheWeigher } from "../types/CacheWeigher";

export interface WeightedCapacityOptions<K, V> {
  /**
   * The maximum total weight the cache may hold. Eviction is triggered once the
   * summed weight of all entries exceeds this value.
   */
  maxWeight: number;

  /**
   * Measures the weight contributed by each entry (e.g. byte size, payload
   * length, or a domain-specific cost).
   */
  weigher: CacheWeigher<K, V>;

  /**
   * Optional lower target weight. When provided, eviction continues until the
   * total weight drops to or below this value, providing hysteresis similar to
   * {@link HighLowWatermarkCapacity}. Defaults to `maxWeight` (evict just enough
   * to return within the limit).
   */
  targetWeight?: number;
}

/**
 * Evicts based on the summed weight of all entries rather than their count.
 *
 * The weight of each entry is determined by a pluggable {@link CacheWeigher},
 * allowing capacity to be measured by approximate memory footprint, payload
 * size, or any custom cost metric.
 */
export class WeightedCapacity<K, V> implements CacheCapacity<K, V> {
  private readonly maxWeight: number;
  private readonly targetWeight: number;
  private readonly weigher: CacheWeigher<K, V>;

  /**
   * @param options - Configuration for maximum weight, weigher function, and optional target weight.
   */
  constructor(options: WeightedCapacityOptions<K, V>) {
    const { maxWeight, weigher, targetWeight } = options;

    if (maxWeight < 0) {
      throw new Error("maxWeight must be >= 0");
    }

    if (targetWeight !== undefined && (targetWeight < 0 || targetWeight > maxWeight)) {
      throw new Error("targetWeight must be between 0 and maxWeight");
    }

    this.maxWeight = maxWeight;
    this.weigher = weigher;
    this.targetWeight = targetWeight ?? maxWeight;
  }

  private totalWeight(entries: ReadonlyMap<K, CacheEntry<K, V>>): number {
    let total = 0;

    for (const entry of entries.values()) {
      total += this.weigher.weigh(entry);
    }

    return total;
  }

  shouldEvict(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return this.totalWeight(entries) > this.maxWeight;
  }

  isWithinLimit(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return this.totalWeight(entries) <= this.targetWeight;
  }
}
