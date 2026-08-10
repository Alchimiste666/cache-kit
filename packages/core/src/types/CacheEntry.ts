/**
 * Represents a single entry stored in a cache.
 *
 * In addition to the key and value, each entry records timestamps that can be
 * used by cache policies such as expiration (TTL) or eviction (LRU, LFU, etc.).
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export interface CacheEntry<K, V> {
  /**
   * The unique key associated with the cached value.
   */
  key: K;

  /**
   * The value stored in the cache.
   */
  value: V;

  /**
   * The time, in milliseconds since the Unix epoch, when the entry was first
   * created.
   */
  createdAt: number;

  /**
   * The time, in milliseconds since the Unix epoch, when the entry was last
   * updated.
   *
   * This value changes whenever the cached value is replaced or modified. It
   * does not necessarily change when the entry is merely accessed.
   */
  updatedAt?: number;

  /**
   * The time, in milliseconds since the Unix epoch, when the entry was last
   * successfully accessed.
   *
   * This value is updated whenever the cache returns the entry in response to a
   * read operation. It is not modified when the entry is created or updated
   * unless those operations are also considered accesses by the cache
   * implementation.
   *
   * This timestamp is commonly used by eviction and expiration policies, such as
   * Least Recently Used (LRU) and idle expiration.
   */
  lastAccessedAt: number;

  /**
   * Optional absolute expiry time (ms since epoch) for this entry.
   * When present, the cache should treat the entry as expired when
   * `Date.now() >= expiresAt`.
   */
  expiresAt?: number;
}
