import type {
  BatchReadThroughCache,
  CacheLoadOptions,
  CacheSetOptions,
  ReadThroughCache,
} from "../types";

/**
 * A cache decorator that deduplicates concurrent loads for the same key.
 *
 * When multiple callers request the same key simultaneously, only one loader
 * invocation is made and its result is shared across all waiters. This prevents
 * cache stampedes under high concurrency.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class CoalescingCache<K, V> implements BatchReadThroughCache<K, V> {
  private readonly cache: ReadThroughCache<K, V> | BatchReadThroughCache<K, V>;
  private readonly inFlight = new Map<K, Promise<V | undefined>>();

  private isBatchReadThroughCache(
    cache: ReadThroughCache<K, V>,
  ): cache is BatchReadThroughCache<K, V> {
    return typeof (cache as Partial<BatchReadThroughCache<K, V>>).getOrReadMany === "function";
  }

  constructor(cache: ReadThroughCache<K, V>) {
    this.cache = cache;
  }

  has(key: K): Promise<boolean> {
    return this.cache.has(key);
  }

  get(key: K): Promise<V | undefined> {
    return this.cache.get(key);
  }

  set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    return this.cache.set(key, value, options);
  }

  delete(key: K): Promise<boolean> {
    return this.cache.delete(key);
  }

  clear(): Promise<void> {
    return this.cache.clear();
  }

  getMany(keys: readonly K[]): Promise<Map<K, V>> {
    if (!this.isBatchReadThroughCache(this.cache)) {
      throw new Error("CoalescingCache.getMany requires BatchReadThroughCache");
    }

    return this.cache.getMany(keys);
  }

  setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    if (!this.isBatchReadThroughCache(this.cache)) {
      throw new Error("CoalescingCache.setMany requires BatchReadThroughCache");
    }

    return this.cache.setMany(entries, options);
  }

  deleteMany(keys: readonly K[]): Promise<number> {
    if (!this.isBatchReadThroughCache(this.cache)) {
      throw new Error("CoalescingCache.deleteMany requires BatchReadThroughCache");
    }

    return this.cache.deleteMany(keys);
  }

  async getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V> {
    if (!options?.forceRefresh) {
      const cached = await this.cache.get(key);

      if (cached !== undefined) {
        return cached as V;
      }
    }

    const existing = this.inFlight.get(key);

    if (existing) {
      return (await existing) as V;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        await this.cache.set(key, value, options);
        return value as V;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);

    return await promise;
  }

  async getOrReadMany(
    keys: readonly K[],
    loader: (keys: readonly K[]) => Promise<Map<K, V>>,
    options?: CacheLoadOptions,
  ): Promise<Map<K, V>> {
    const result = new Map<K, V>();
    const toLoad: K[] = [];
    const toAwait: K[] = [];

    // Task 2.1: Collect all non-cached, non-in-flight keys into a single array
    for (const key of keys) {
      // Task 2.5: forceRefresh bypasses cached values
      if (!options?.forceRefresh) {
        const cached = await this.cache.get(key);

        if (cached !== undefined) {
          result.set(key, cached);
          continue;
        }
      }

      // Task 2.5: Still respect in-flight deduplication even with forceRefresh
      if (this.inFlight.has(key)) {
        toAwait.push(key);
        continue;
      }

      toLoad.push(key);
    }

    // Task 2.2: Invoke the loader exactly once with the collected missing keys
    if (toLoad.length > 0) {
      const batchPromise = loader(toLoad).then(async (loaded) => {
        for (const [k, v] of loaded) {
          await this.cache.set(k, v, options);
        }
        return loaded;
      });

      // Task 2.3: Register per-key in-flight promises that resolve from the single batch promise
      for (const key of toLoad) {
        const perKeyPromise = batchPromise
          .then((m) => m.get(key))
          .finally(() => {
            // Task 2.4: Clean up in-flight entry for this key on resolution or rejection
            this.inFlight.delete(key);
          });
        // Prevent unhandled rejection warnings for per-key promises stored in the map
        perKeyPromise.catch(() => {
          /* no-op */
        });
        this.inFlight.set(key, perKeyPromise);
      }
    }

    // Await all in-flight (both pre-existing and newly created)
    // Capture references before awaiting to avoid issues with cleanup during iteration
    const inFlightPromises: Promise<V | undefined>[] = [];
    const inFlightKeys: K[] = [...toLoad, ...toAwait];

    for (const key of inFlightKeys) {
      const promise = this.inFlight.get(key);
      if (promise) {
        inFlightPromises.push(promise);
      } else {
        inFlightPromises.push(Promise.resolve(undefined));
      }
    }

    const values = await Promise.all(inFlightPromises);
    for (let i = 0; i < inFlightKeys.length; i++) {
      const value = values[i];
      if (value !== undefined) {
        result.set(inFlightKeys[i], value);
      }
    }

    return result;
  }
}
