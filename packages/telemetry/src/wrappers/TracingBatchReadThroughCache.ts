import type {
  BatchReadThroughCache,
  CacheLoadOptions,
  CacheSetOptions,
} from "@alchemist-software/cache-kit-core";
import type { Span } from "@opentelemetry/api";
import type { TracingCacheOptions } from "../implementations/TracingCache";
import { TracingReadThroughCache } from "./TracingReadThroughCache";

/**
 * Tracing wrapper for {@link BatchReadThroughCache} that creates spans for batch operations.
 *
 * Records per-operation hit and miss counts as span attributes for observability.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class TracingBatchReadThroughCache<K, V>
  extends TracingReadThroughCache<K, V>
  implements BatchReadThroughCache<K, V>
{
  constructor(cache: BatchReadThroughCache<K, V>, options: TracingCacheOptions = {}) {
    super(cache, options);
  }

  async getOrReadMany(
    keys: readonly K[],
    loader: (keys: readonly K[]) => Promise<Map<K, V>>,
    options?: CacheLoadOptions,
  ): Promise<Map<K, V>> {
    return this.traced("getOrReadMany", async (span: Span) => {
      span.setAttribute("cache.keys", keys.map(String).join(","));

      let loadedKeys: readonly K[] = [];
      const trackedLoader = async (missingKeys: readonly K[]) => {
        loadedKeys = missingKeys;
        return loader(missingKeys);
      };

      const result = await (this.cache as BatchReadThroughCache<K, V>).getOrReadMany(
        keys,
        trackedLoader,
        options,
      );

      const misses = loadedKeys.length;
      const hits = keys.length - misses;
      span.setAttribute("cache.hits", hits);
      span.setAttribute("cache.misses", misses);

      return result;
    });
  }

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
    return this.traced("getMany", async (span: Span) => {
      span.setAttribute("cache.keys", keys.map(String).join(","));
      return (this.cache as BatchReadThroughCache<K, V>).getMany(keys);
    });
  }

  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    return this.traced("setMany", async (span: Span) => {
      span.setAttribute("cache.keys", [...entries.keys()].map(String).join(","));
      return (this.cache as BatchReadThroughCache<K, V>).setMany(entries, options);
    });
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    return this.traced("deleteMany", async (span: Span) => {
      span.setAttribute("cache.keys", keys.map(String).join(","));
      return (this.cache as BatchReadThroughCache<K, V>).deleteMany(keys);
    });
  }
}
