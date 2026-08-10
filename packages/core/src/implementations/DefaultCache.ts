import type { Cache, CacheSetOptions, CacheStore } from "../types";

/**
 * Basic cache implementation that delegates all operations to a {@link CacheStore}.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class DefaultCache<K, V> implements Cache<K, V> {
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
}
