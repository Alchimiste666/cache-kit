import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * Simple LRU eviction policy backed by a Map to track access order.
 */
export class LRUCacheEviction<K, V> implements CacheEviction<K, V> {
  // Map preserves insertion order; we move accessed/set keys to the end.
  private readonly entries = new Map<K, CacheEntry<K, V>>();

  onGet(entry: CacheEntry<K, V>): void {
    // move to the end to mark as most recently used
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
  }

  onSet(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    // Least-recently-used is at the beginning of the Map
    return Array.from(this.entries.values());
  }
}
