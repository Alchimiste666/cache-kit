import type { CacheSetOptions, CacheStore } from "../types";

/**
 * A cache store that performs no operations.
 * Useful as a fallback when the real cache store is unavailable.
 */
export class NoOpCacheStore<K, V> implements CacheStore<K, V> {
  async has(): Promise<boolean> {
    return false;
  }

  async get(): Promise<V | undefined> {
    return undefined;
  }

  async set(_key: K, _value: V, _options?: CacheSetOptions): Promise<void> {
    // no-op
  }

  async delete(): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {
    // no-op
  }

  async connect(): Promise<void> {
    // no-op
  }

  async disconnect(): Promise<void> {
    // no-op
  }
}
