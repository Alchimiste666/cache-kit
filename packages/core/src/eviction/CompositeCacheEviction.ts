import type { CacheEntry } from "../types/CacheEntry";
import type { CacheEviction } from "../types/CacheEviction";

/**
 * Composite eviction that merges candidates from multiple policies.
 */
export class CompositeCacheEviction<K, V> implements CacheEviction<K, V> {
  constructor(private readonly policies: CacheEviction<K, V>[]) {}

  onGet(entry: CacheEntry<K, V>): void {
    for (const policy of this.policies) {
      policy.onGet(entry);
    }
  }

  onSet(entry: CacheEntry<K, V>): void {
    for (const policy of this.policies) {
      policy.onSet(entry);
    }
  }

  onDelete(entry: CacheEntry<K, V>): void {
    for (const policy of this.policies) {
      policy.onDelete(entry);
    }
  }

  candidates(): CacheEntry<K, V>[] {
    const seen = new Set<K>();
    const merged: CacheEntry<K, V>[] = [];

    for (const policy of this.policies) {
      for (const entry of policy.candidates()) {
        if (!seen.has(entry.key)) {
          seen.add(entry.key);
          merged.push(entry);
        }
      }
    }
    return merged;
  }
}
