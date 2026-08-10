import type { CacheLoadOptions, ReadThroughCache } from "@alchemist-software/cache-kit-core";
import type { Span } from "@opentelemetry/api";
import { TracingCache, type TracingCacheOptions } from "../implementations/TracingCache";

/**
 * Tracing wrapper for {@link ReadThroughCache} that creates spans for read-through operations.
 *
 * The `getOrRead` span records whether the loader was invoked (cache miss) or not (cache hit).
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class TracingReadThroughCache<K, V>
  extends TracingCache<K, V>
  implements ReadThroughCache<K, V>
{
  constructor(cache: ReadThroughCache<K, V>, options: TracingCacheOptions = {}) {
    super(cache, options);
  }

  async getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V> {
    return this.traced("getOrRead", async (span: Span) => {
      span.setAttribute("cache.key", String(key));

      let loaderCalled = false;
      const trackedLoader = async () => {
        loaderCalled = true;
        return loader();
      };

      const value = await (this.cache as ReadThroughCache<K, V>).getOrRead(
        key,
        trackedLoader,
        options,
      );

      span.setAttribute("cache.hit", !loaderCalled);
      return value;
    });
  }
}
