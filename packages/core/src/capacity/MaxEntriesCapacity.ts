import type { CacheCapacity } from "../types/CacheCapacity";
import type { CacheEntry } from "../types/CacheEntry";

/**
 * Evicts when the number of entries exceeds the configured maximum.
 */
export class MaxEntriesCapacity<K, V> implements CacheCapacity<K, V> {
  /**
   * @param max - Maximum number of entries allowed before eviction is triggered.
   */
  constructor(private readonly max: number) {}

  shouldEvict(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return entries.size > this.max;
  }

  isWithinLimit(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return entries.size <= this.max;
  }
}
