import type { CacheEntry } from "./CacheEntry";

/**
 * Measures the "cost" of a cache entry for capacity purposes.
 *
 * A weigher decouples *how* the size of the cache is measured from the policy
 * that decides *when* to evict. Implementations can measure entry count,
 * approximate memory footprint, a domain-specific weight, or any custom metric.
 *
 * The returned weight should be a non-negative, finite number. The total weight
 * of a cache is the sum of the weights of all its entries.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export interface CacheWeigher<K, V> {
  /**
   * Returns the weight contributed by a single entry.
   *
   * @param entry - The entry to weigh.
   */
  weigh(entry: CacheEntry<K, V>): number;
}
