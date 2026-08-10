import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * S3 FIFO eviction policy (Simple and Scalable Caching with Three Static First-In-First-Out Queues)
 *
 * Newly added entries start in a cold FIFO queue. Accessed entries are promoted
 * to a warm FIFO queue. Eviction candidates are chosen from the cold queue first,
 * then from the warm queue, preserving insertion order within each segment.
 */
export class S3FIFOCacheEviction<K, V> implements CacheEviction<K, V> {
  private readonly coldEntries = new Map<K, CacheEntry<K, V>>();
  private readonly warmEntries = new Map<K, CacheEntry<K, V>>();

  onGet(entry: CacheEntry<K, V>): void {
    if (this.coldEntries.has(entry.key)) {
      this.coldEntries.delete(entry.key);
      this.warmEntries.set(entry.key, entry);
    }
  }

  onSet(entry: CacheEntry<K, V>): void {
    if (this.warmEntries.has(entry.key)) {
      this.warmEntries.delete(entry.key);
      this.warmEntries.set(entry.key, entry);
      return;
    }

    if (this.coldEntries.has(entry.key)) {
      this.coldEntries.delete(entry.key);
    }

    this.coldEntries.set(entry.key, entry);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.coldEntries.delete(entry.key);
    this.warmEntries.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    return [...this.coldEntries.values(), ...this.warmEntries.values()];
  }
}
