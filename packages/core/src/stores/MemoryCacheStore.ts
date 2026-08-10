import type { BatchCacheStore, CacheAdmission, CacheSetOptions } from "../types";
import type { CacheCapacity } from "../types/CacheCapacity";
import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";
import {
  type CacheExpiration,
  CacheExpirationType,
  resolveExpiresAt,
} from "../types/CacheExpiration";

export type MemoryCacheStoreOptions<K, V> = {
  capacity?: CacheCapacity<K, V>;
  eviction?: CacheEviction<K, V>;
  expiration?: CacheExpiration;
  admission?: CacheAdmission<K, V>;
  sweepIntervalMs?: number;
};

/**
 * In-memory cache store backed by a {@link Map}.
 *
 * Supports pluggable capacity, eviction, expiration, and admission policies.
 * Optionally runs a periodic sweep to remove expired entries.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class MemoryCacheStore<K, V> implements BatchCacheStore<K, V> {
  capacity?: CacheCapacity<K, V>;

  eviction?: CacheEviction<K, V>;

  expiration?: CacheExpiration;

  admission?: CacheAdmission<K, V>;

  private readonly map = new Map<K, CacheEntry<K, V>>();

  private evictionBatch: CacheEntry<K, V>[] | null = null;

  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param options - Optional configuration for capacity, eviction, expiration, admission, and sweep interval.
   */
  constructor(options?: MemoryCacheStoreOptions<K, V>) {
    if (options) {
      this.capacity = options.capacity;
      this.eviction = options.eviction;
      this.expiration = options.expiration;
      this.admission = options.admission;

      if (options.sweepIntervalMs) {
        this.sweepTimer = setInterval(() => this.sweep(), options.sweepIntervalMs);
      }
    }
  }

  async has(key: K): Promise<boolean> {
    const entry = this.map.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async get(key: K): Promise<V | undefined> {
    const entry = this.map.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      await this.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = Date.now();

    this.eviction?.onGet(entry);

    return entry.value;
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    const now = Date.now();

    const existing = this.map.get(key);

    const overwrite = options?.overwrite !== false;

    if (existing && !overwrite) {
      return;
    }

    const expiration = options?.expiration ??
      this.expiration ?? { type: CacheExpirationType.Never };

    const expiresAt = resolveExpiresAt(expiration, now);

    const entry: CacheEntry<K, V> = {
      key,
      value,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      lastAccessedAt: now,
      expiresAt,
    };

    if (this.admission?.shouldAdmit(entry) === false) {
      return;
    }

    this.map.set(key, entry);

    this.eviction?.onSet(entry);

    // enforce capacity
    if (this.capacity?.shouldEvict(this.map)) {
      this.evictUntil(() => this.capacity?.isWithinLimit(this.map) ?? true);
    }
  }

  private evictUntil(isSatisfied: () => boolean): void {
    this.evictionBatch = null;

    while (!isSatisfied()) {
      if (!this.evictionBatch || this.evictionBatch.length === 0) {
        this.evictionBatch = this.eviction
          ? this.eviction.candidates()
          : Array.from(this.map.values());

        if (this.evictionBatch.length === 0) {
          break;
        }
      }

      const victim = this.evictionBatch.shift();

      if (victim === undefined) {
        break;
      }

      // Skip candidates that are no longer in the map (e.g., already expired/removed)
      if (!this.map.has(victim.key as K)) {
        continue;
      }

      this.map.delete(victim.key as K);
      this.eviction?.onDelete(victim as CacheEntry<K, V>);
    }

    this.evictionBatch = null;
  }

  async delete(key: K): Promise<boolean> {
    const entry = this.map.get(key);
    const deleted = this.map.delete(key);

    if (deleted && entry) {
      this.eviction?.onDelete(entry);
    }

    return deleted;
  }

  async clear(): Promise<void> {
    for (const entry of this.map.values()) {
      this.eviction?.onDelete(entry);
    }

    this.map.clear();
  }

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
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
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    let count = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  private sweep(): void {
    const now = Date.now();
    const keys = Array.from(this.map.keys());

    for (const key of keys) {
      const entry = this.map.get(key);

      if (entry?.expiresAt && now >= entry.expiresAt) {
        this.map.delete(key);
        this.eviction?.onDelete(entry);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
