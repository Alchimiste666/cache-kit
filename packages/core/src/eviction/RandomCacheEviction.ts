import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * Eviction policy that selects a random entry for eviction.
 */
export class RandomCacheEviction<K, V> implements CacheEviction<K, V> {
  private readonly entries = new Map<K, CacheEntry<K, V>>();

  onGet(_entry: CacheEntry<K, V>): void {
    // no-op for random eviction
  }

  onSet(entry: CacheEntry<K, V>): void {
    this.entries.set(entry.key, entry);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    const values = Array.from(this.entries.values());

    if (values.length === 0) {
      return [];
    }

    // Select a random index from the array of entries
    const randomIndex = Math.floor(Math.random() * values.length);

    return [values[randomIndex]];
  }
}
