import type { CacheLoadOptions, CacheSetOptions } from "./CacheOptions";

export interface Cache<K, V> {
  has(key: K): Promise<boolean>;

  get(key: K): Promise<V | undefined>;

  set(key: K, value: V, options?: CacheSetOptions): Promise<void>;

  delete(key: K): Promise<boolean>;

  clear(): Promise<void>;
}

export type CacheDecorator<K, V, C extends Cache<K, V> = Cache<K, V>> = (cache: C) => Cache<K, V>;

export interface BatchCache<K, V> extends Cache<K, V> {
  getMany(keys: readonly K[]): Promise<Map<K, V>>;

  setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void>;

  deleteMany(keys: readonly K[]): Promise<number>;
}

export interface ReadThroughCache<K, V> extends Cache<K, V> {
  getOrRead(key: K, loader: () => Promise<V>, options?: CacheLoadOptions): Promise<V>;
}

export interface BatchReadThroughCache<K, V> extends BatchCache<K, V>, ReadThroughCache<K, V> {
  getOrReadMany(
    keys: readonly K[],
    loader: (keys: readonly K[]) => Promise<Map<K, V>>,
    options?: CacheLoadOptions,
  ): Promise<Map<K, V>>;
}

export interface WriteThroughCache<K, V> extends Cache<K, V> {
  put(
    key: K,
    value: V,
    writer: (key: K, value: V) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void>;
}

export interface BatchWriteThroughCache<K, V> extends BatchCache<K, V>, WriteThroughCache<K, V> {
  putMany(
    entries: ReadonlyMap<K, V>,
    writer: (entries: ReadonlyMap<K, V>) => Promise<void>,
    options?: CacheSetOptions,
  ): Promise<void>;
}

export interface ReadWriteThroughCache<K, V>
  extends ReadThroughCache<K, V>,
    WriteThroughCache<K, V> {}

export interface BatchReadWriteThroughCache<K, V>
  extends BatchReadThroughCache<K, V>,
    BatchWriteThroughCache<K, V> {}
