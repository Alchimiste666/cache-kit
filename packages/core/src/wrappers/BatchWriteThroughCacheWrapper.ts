import type { BatchWriteThroughCache, CacheSetOptions } from "../types";
import { BatchCacheWrapper } from "./BatchCacheWrapper";

/**
 * Cache wrapper that adds batch write-through semantics.
 *
 * Extends {@link BatchCacheWrapper} with write-through operations that persist
 * entries to the cache and propagate them to an external writer.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class BatchWriteThroughCacheWrapper<K, V>
  extends BatchCacheWrapper<K, V>
  implements BatchWriteThroughCache<K, V>
{
  async put(
    key: K,
    value: V,
    writer: (key: K, value: V) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    await this.set(key, value, options);
    await writer(key, value);
  }

  async putMany(
    entries: ReadonlyMap<K, V>,
    writer: (entries: ReadonlyMap<K, V>) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void> {
    await this.setMany(entries, options);
    await writer(entries);
  }
}
