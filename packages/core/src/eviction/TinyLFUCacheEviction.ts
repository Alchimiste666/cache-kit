import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * TinyLFU eviction policy.
 *
 * Entries are ranked by a lightweight frequency estimate. The eviction candidate
 * list is ordered from least frequently used to most frequently used.
 */
export class TinyLFUCacheEviction<K, V> implements CacheEviction<K, V> {
  private readonly entries = new Map<K, CacheEntry<K, V>>();
  private readonly frequencies = new Map<K, number>();
  private readonly maxFrequency = 1_000_000;

  private incrementFrequency(key: K): void {
    const frequency = this.frequencies.get(key) ?? 0;
    this.frequencies.set(key, Math.min(frequency + 1, this.maxFrequency));
  }

  onGet(entry: CacheEntry<K, V>): void {
    this.incrementFrequency(entry.key);
  }

  onSet(entry: CacheEntry<K, V>): void {
    this.entries.set(entry.key, entry);
    this.incrementFrequency(entry.key);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
    this.frequencies.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    return Array.from(this.entries.values()).sort((left, right) => {
      const leftFrequency = this.frequencies.get(left.key) ?? 0;
      const rightFrequency = this.frequencies.get(right.key) ?? 0;

      if (leftFrequency !== rightFrequency) {
        return leftFrequency - rightFrequency;
      }

      return left.createdAt - right.createdAt;
    });
  }
}
