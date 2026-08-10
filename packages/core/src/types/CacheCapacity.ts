import type { CacheEntry } from "./CacheEntry";

/**
 * Defines a capacity policy for a cache store.
 *
 * A capacity policy determines whether the cache has exceeded its limit
 * after a new entry is added, and what the target size should be after
 * eviction. Implementations can use entry count, memory size, weight
 * functions, or any custom metric.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export interface CacheCapacity<K, V> {
  /**
   * Returns true if eviction is needed given the current state.
   *
   * Called after a new entry is inserted.
   *
   * @param entries - All current cache entries.
   */
  shouldEvict(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean;

  /**
   * Returns true when the cache is back within acceptable capacity bounds.
   *
   * Called repeatedly during eviction to know when to stop removing entries.
   *
   * @param entries - All current cache entries.
   */
  isWithinLimit(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean;
}
