import type { CacheLoadOptions, CacheSetOptions, CacheStore, ReadThroughCache } from "../types";

/**
 * Cache wrapper that adds read-through semantics.
 *
 * On cache miss, invokes a user-supplied loader to fetch the value, stores it,
 * and returns it to the caller.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class ReadThroughCacheWrapper<K, V> implements ReadThroughCache<K, V> {
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

  async getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V> {
    if (!options?.forceRefresh) {
      const cached = await this.get(key);

      if (cached !== undefined) {
        return cached;
      }
    }

    const value = await loader();
    await this.set(key, value, options);
    return value;
  }
}
