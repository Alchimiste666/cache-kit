import type { BatchReadThroughCache, CacheLoadOptions } from "../types";
import { BatchCacheWrapper } from "./BatchCacheWrapper";

/**
 * Cache wrapper that adds batch read-through semantics.
 *
 * Extends {@link BatchCacheWrapper} with loader-based reads that fetch missing
 * keys in bulk and store the results.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class BatchReadThroughCacheWrapper<K, V>
  extends BatchCacheWrapper<K, V>
  implements BatchReadThroughCache<K, V>
{
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

  async getOrReadMany(
    keys: readonly K[],
    loader: (keys: readonly K[]) => Promise<Map<K, V>>,
    options?: CacheLoadOptions,
  ): Promise<Map<K, V>> {
    const result = await this.getMany(keys);
    const missingKeys = keys.filter((key) => !result.has(key));
    if (missingKeys.length === 0 && !options?.forceRefresh) {
      return result;
    }

    const loaded = await loader(missingKeys);
    await this.setMany(loaded, options);

    const merged = new Map(result);
    for (const [key, value] of loaded) {
      merged.set(key, value);
    }

    return merged;
  }
}
