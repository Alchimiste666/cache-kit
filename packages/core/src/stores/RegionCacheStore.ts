import type { CacheGetOptions, CacheSetOptions, CacheStore } from "../types";

const DEFAULT_REGION = "default";

function buildRegionKey(region: string, key: string): string {
  return `${region}:${key}`;
}

/**
 * A store decorator that partitions keys into named regions by prefixing keys with a region identifier.
 *
 * Supports clearing all entries in a specific region without affecting other regions.
 *
 * @typeParam V - The cache value type.
 */
export class RegionCacheStore<V> implements CacheStore<string, V> {
  private readonly regionIndex: Map<string, Set<string>> = new Map();

  /**
   * @param store - Underlying store that holds the region-prefixed keys.
   * @param defaultRegion - Region used when no region option is specified.
   * @defaultValue "default"
   */
  constructor(
    private readonly store: CacheStore<string, V>,
    private readonly defaultRegion: string = DEFAULT_REGION,
  ) {}

  async has(key: string, options?: CacheGetOptions): Promise<boolean> {
    const regionKey = buildRegionKey(options?.region ?? this.defaultRegion, key);
    return this.store.has(regionKey);
  }

  async get(key: string, options?: CacheGetOptions): Promise<V | undefined> {
    const regionKey = buildRegionKey(options?.region ?? this.defaultRegion, key);
    return this.store.get(regionKey);
  }

  async set(key: string, value: V, options?: CacheSetOptions): Promise<void> {
    const region = options?.region ?? this.defaultRegion;
    const regionKey = buildRegionKey(region, key);

    const writeOptions = { ...options };
    (writeOptions as Partial<CacheSetOptions>).region = undefined;

    await this.store.set(regionKey, value, writeOptions);

    let keys = this.regionIndex.get(region);
    if (!keys) {
      keys = new Set();
      this.regionIndex.set(region, keys);
    }
    keys.add(regionKey);
  }

  async delete(key: string, options?: CacheGetOptions): Promise<boolean> {
    const region = options?.region ?? this.defaultRegion;
    const regionKey = buildRegionKey(region, key);

    const result = await this.store.delete(regionKey);

    const keys = this.regionIndex.get(region);
    if (keys) {
      keys.delete(regionKey);
    }

    return result;
  }

  async clear(region?: string): Promise<void> {
    if (region === undefined) {
      await this.store.clear();
      this.regionIndex.clear();
      return;
    }

    const keys = this.regionIndex.get(region);
    if (keys) {
      for (const regionKey of keys) {
        await this.store.delete(regionKey).catch(() => {
          /* no-op */
        });
      }
      keys.clear();
    }
  }
}
