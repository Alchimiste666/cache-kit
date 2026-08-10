import type { CacheMetricsRecorder } from "../metrics";
import type { CacheSetOptions, CacheStore } from "../types";

/**
 * Store wrapper that records cache hit/miss/write/delete metrics via a {@link CacheMetricsRecorder}.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class MetricsCacheStore<K, V> implements CacheStore<K, V> {
  constructor(
    private readonly store: CacheStore<K, V>,
    private readonly metricsRecorder: CacheMetricsRecorder,
  ) {}

  async connect(): Promise<void> {
    await this.store.connect?.();
  }

  async disconnect(): Promise<void> {
    await this.store.disconnect?.();
  }

  async has(key: K): Promise<boolean> {
    const exists = await this.store.has(key);

    if (exists) {
      this.metricsRecorder.hits();
    } else {
      this.metricsRecorder.misses();
    }

    return exists;
  }

  async get(key: K): Promise<V | undefined> {
    const value = await this.store.get(key);

    if (value === undefined) {
      this.metricsRecorder.misses();
    } else {
      this.metricsRecorder.hits();
    }

    return value;
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    await this.store.set(key, value, options);

    this.metricsRecorder.writes();
  }

  async delete(key: K): Promise<boolean> {
    const deleted = await this.store.delete(key);

    if (deleted) {
      this.metricsRecorder.deletes();
    }

    return deleted;
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}
