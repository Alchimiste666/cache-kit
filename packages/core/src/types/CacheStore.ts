import type { CacheAdmission } from "./CacheAdmission";
import type { CacheCapacity } from "./CacheCapacity";
import type { CacheEviction } from "./CacheEviction";
import type { CacheExpiration } from "./CacheExpiration";
import type { CacheSetOptions } from "./CacheOptions";

export interface CacheStore<K, V> {
  capacity?: CacheCapacity<K, V>;

  expiration?: CacheExpiration;

  eviction?: CacheEviction<K, V>;

  admission?: CacheAdmission<K, V>;

  has(key: K): Promise<boolean>;

  get(key: K): Promise<V | undefined>;

  set(key: K, value: V, options?: CacheSetOptions): Promise<void>;

  delete(key: K): Promise<boolean>;

  clear(): Promise<void>;

  connect?(): Promise<void>;

  disconnect?(): Promise<void>;
}

export interface BatchCacheStore<K, V> extends CacheStore<K, V> {
  getMany(keys: readonly K[]): Promise<Map<K, V>>;

  setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void>;

  deleteMany(keys: readonly K[]): Promise<number>;
}

export function isBatchCacheStore<K, V>(store: CacheStore<K, V>): store is BatchCacheStore<K, V> {
  return "getMany" in store && "setMany" in store && "deleteMany" in store;
}

export type CacheStoreDecorator<K, V> = (store: CacheStore<K, V>) => CacheStore<K, V>;
