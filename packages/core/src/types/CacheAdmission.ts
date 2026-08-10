import type { CacheEntry } from "./CacheEntry";

/**
 * Defines a policy that determines whether a cache entry should be admitted.
 *
 * Implementations can inspect the cache entry and optional metadata to decide
 * whether the value should be stored.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export interface CacheAdmission<K, V> {
  /**
   * Determines whether the provided cache entry should be admitted.
   *
   * @param entry - The candidate cache entry.
   * @returns `true` if the entry should be stored; otherwise `false`.
   */
  shouldAdmit(entry: CacheEntry<K, V>): boolean;
}
