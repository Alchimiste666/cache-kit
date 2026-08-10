import type { CacheSetOptions, CacheStore, WriteThroughCache } from "../types";

/**
 * Cache wrapper that adds write-through semantics.
 *
 * Writes are persisted to the cache store and then propagated to an external
 * writer function, ensuring the backing data source stays in sync.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class WriteThroughCacheWrapper<K, V> implements WriteThroughCache<K, V> {
  constructor(private readonly store: CacheStore<K, V>) {}

  has(key: K): Promise<boolean> {
    return this.store.has(key);
  }

  get(key: K): Promise<V | undefined> {
    return this.store.get(key);
  }

  set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    return this.store.set(key, value, options);
  }

  delete(key: K): Promise<boolean> {
    return this.store.delete(key);
  }

  clear(): Promise<void> {
    return this.store.clear();
  }

  async put(
    key: K,
    value: V,
    writer: (key: K, value: V) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    await this.set(key, value, options);
    await writer(key, value);
  }
}
