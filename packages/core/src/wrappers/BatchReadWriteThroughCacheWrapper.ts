import type {
  BatchReadWriteThroughCache,
  CacheLoadOptions,
  CacheSetOptions,
  CacheStore,
} from "../types";
import { BatchReadThroughCacheWrapper } from "./BatchReadThroughCacheWrapper";
import { BatchWriteThroughCacheWrapper } from "./BatchWriteThroughCacheWrapper";

/**
 * Combines batch, read-through, and write-through cache semantics in a single wrapper.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class BatchReadWriteThroughCacheWrapper<K, V> implements BatchReadWriteThroughCache<K, V> {
  private readonly batchReadCache: BatchReadThroughCacheWrapper<K, V>;
  private readonly batchWriteCache: BatchWriteThroughCacheWrapper<K, V>;

  constructor(store: CacheStore<K, V>) {
    this.batchReadCache = new BatchReadThroughCacheWrapper(store);
    this.batchWriteCache = new BatchWriteThroughCacheWrapper(store);
  }

  has(key: K): Promise<boolean> {
    return this.batchReadCache.has(key);
  }

  get(key: K): Promise<V | undefined> {
    return this.batchReadCache.get(key);
  }

  set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    return this.batchReadCache.set(key, value, options);
  }

  delete(key: K): Promise<boolean> {
    return this.batchReadCache.delete(key);
  }

  clear(): Promise<void> {
    return this.batchReadCache.clear();
  }

  getMany(keys: readonly K[]): Promise<Map<K, V>> {
    return this.batchReadCache.getMany(keys);
  }

  setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    return this.batchReadCache.setMany(entries, options);
  }

  deleteMany(keys: readonly K[]): Promise<number> {
    return this.batchReadCache.deleteMany(keys);
  }

  getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V> {
    return this.batchReadCache.getOrRead(key, loader, options);
  }

  getOrReadMany(
    keys: readonly K[],
    loader: (keys: readonly K[]) => Promise<Map<K, V>>,
    options?: CacheLoadOptions,
  ): Promise<Map<K, V>> {
    return this.batchReadCache.getOrReadMany(keys, loader, options);
  }

  put(
    key: K,
    value: V,
    writer: (key: K, value: V) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    return this.batchWriteCache.put(key, value, writer, options);
  }

  putMany(
    entries: ReadonlyMap<K, V>,
    writer: (entries: ReadonlyMap<K, V>) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    return this.batchWriteCache.putMany(entries, writer, options);
  }
}
