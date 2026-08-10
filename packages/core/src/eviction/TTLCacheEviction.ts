import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * Eviction policy that prioritizes entries closest to expiration.
 *
 * This policy is useful when cached entries have a defined `expiresAt`
 * timestamp and the cache should evict entries that are already expired or
 * will expire soonest.
 */
export class TTLCacheEviction<K, V> implements CacheEviction<K, V> {
  private readonly entries = new Map<K, CacheEntry<K, V>>();

  onGet(_entry: CacheEntry<K, V>): void {
    // TTL policy does not adjust ordering on reads.
  }

  onSet(entry: CacheEntry<K, V>): void {
    this.entries.set(entry.key, entry);
  }

  onDelete(entry: CacheEntry<K, V>): void {
    this.entries.delete(entry.key);
  }

  candidates(): CacheEntry<K, V>[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.expiresAt !== undefined)
      .sort((left, right) => (left.expiresAt as number) - (right.expiresAt as number));
  }
}
