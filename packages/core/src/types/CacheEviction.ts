import type { CacheEntry } from "./CacheEntry";

/**
 * Defines the eviction policy for a cache.
 *
 * An eviction policy tracks cache activity and determines which entries should
 * be removed when the cache exceeds its capacity. Implementations may use
 * algorithms such as LRU (Least Recently Used), LFU (Least Frequently Used),
 * FIFO (First In, First Out), or custom strategies.
 *
 * The cache notifies the policy whenever entries are accessed, added, or
 * removed. When eviction is required, the cache requests one or more eviction
 * candidates from the policy.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export interface CacheEviction<K, V> {
  /**
   * Notifies the policy that an entry was successfully retrieved from the cache.
   *
   * @param entry The accessed cache entry.
   */
  onGet(entry: CacheEntry<K, V>): void;

  /**
   * Notifies the policy that an entry was added to or updated in the cache.
   *
   * @param entry The inserted or updated cache entry.
   */
  onSet(entry: CacheEntry<K, V>): void;

  /**
   * Notifies the policy that an entry was removed from the cache.
   *
   * This is called regardless of whether the removal was caused by eviction,
   * expiration, or an explicit delete operation.
   *
   * @param entry The removed cache entry.
   */
  onDelete(entry: CacheEntry<K, V>): void;

  /**
   * Returns the entries that should be evicted next, ordered from highest to
   * lowest eviction priority.
   *
   * The returned array may contain any number of entries, including none. The
   * cache is responsible for deciding how many entries to evict.
   *
   * @returns An ordered list of eviction candidates.
   */
  candidates(): CacheEntry<K, V>[];
}
