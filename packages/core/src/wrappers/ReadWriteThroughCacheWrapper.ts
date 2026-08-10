import type {
  CacheLoadOptions,
  CacheSetOptions,
  CacheStore,
  ReadWriteThroughCache,
} from "../types";
import { ReadThroughCacheWrapper } from "./ReadThroughCacheWrapper";
import { WriteThroughCacheWrapper } from "./WriteThroughCacheWrapper";

/**
 * Combines read-through and write-through cache semantics in a single wrapper.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class ReadWriteThroughCacheWrapper<K, V> implements ReadWriteThroughCache<K, V> {
  private readonly readCache: ReadThroughCacheWrapper<K, V>;
  private readonly writeCache: WriteThroughCacheWrapper<K, V>;

  constructor(store: CacheStore<K, V>) {
    this.readCache = new ReadThroughCacheWrapper(store);
    this.writeCache = new WriteThroughCacheWrapper(store);
  }

  has(key: K): Promise<boolean> {
    return this.readCache.has(key);
  }

  get(key: K): Promise<V | undefined> {
    return this.readCache.get(key);
  }

  set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    return this.readCache.set(key, value, options);
  }

  delete(key: K): Promise<boolean> {
    return this.readCache.delete(key);
  }

  clear(): Promise<void> {
    return this.readCache.clear();
  }

  getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V> {
    return this.readCache.getOrRead(key, loader, options);
  }

  put(
    key: K,
    value: V,
    writer: (key: K, value: V) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    return this.writeCache.put(key, value, writer, options);
  }
}
