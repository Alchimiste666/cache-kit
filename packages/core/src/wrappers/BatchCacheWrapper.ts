import {
  type BatchCache,
  type CacheSetOptions,
  type CacheStore,
  isBatchCacheStore,
} from "../types";

/**
 * Note: When the underlying store implements BatchCacheStore, batch operations
 * (getMany, setMany, deleteMany) delegate directly to the store for optimal
 * performance (e.g., Redis MGET/MSET). This bypasses any eviction or admission
 * policies configured on the MemoryCacheStore layer. If you need eviction/admission
 * to apply to batch operations, use a store that does NOT implement BatchCacheStore
 * so the sequential fallback path is used (which goes through individual set/get/delete).
 */
export class BatchCacheWrapper<K, V> implements BatchCache<K, V> {
  constructor(protected readonly store: CacheStore<K, V>) {}

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

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
    if (isBatchCacheStore(this.store)) {
      return this.store.getMany(keys);
    }

    const results = new Map<K, V>();

    for (const key of keys) {
      const value = await this.get(key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    return results;
  }

  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    if (isBatchCacheStore(this.store)) {
      return this.store.setMany(entries, options);
    }

    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    if (isBatchCacheStore(this.store)) {
      return this.store.deleteMany(keys);
    }

    let deletedCount = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        deletedCount += 1;
      }
    }
    return deletedCount;
  }
}
