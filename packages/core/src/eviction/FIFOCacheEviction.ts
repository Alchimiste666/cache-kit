import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * FIFO eviction: evict the oldest inserted entries first.
 */
export class FIFOCacheEviction<K, V> implements CacheEviction<K, V> {
  private readonly entries = new Map<K, CacheEntry<K, V>>();

  onGet(_entry: CacheEntry<K, V>): void {
    // no-op for FIFO
  }

  onSet(entry: CacheEntry<K, V>): void {
    // ensure insertion order; replace existing keeps position by delete/set
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    return Array.from(this.entries.values());
  }
}
