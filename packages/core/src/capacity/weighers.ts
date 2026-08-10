import type { CacheEntry } from "../types/CacheEntry";
import type { CacheWeigher } from "../types/CacheWeigher";

/**
 * Weighs every entry as 1, making {@link WeightedCapacity} behave like an
 * entry-count limit. Useful as a default or for composing with other metrics.
 */
export class EntryCountWeigher<K, V> implements CacheWeigher<K, V> {
  weigh(): number {
    return 1;
  }
}

/**
 * Approximates the in-memory footprint of an entry's value by serializing it to
 * JSON and measuring its UTF-8 byte length.
 *
 * This is an estimate, not an exact heap measurement. It is well suited to
 * bounding a cache of serializable payloads (e.g. product or cart responses) by
 * an approximate memory budget.
 */
export class JsonSizeWeigher<K, V> implements CacheWeigher<K, V> {
  weigh(entry: CacheEntry<K, V>): number {
    return Buffer.byteLength(JSON.stringify(entry.value) ?? "", "utf8");
  }
}

/**
 * Adapts an arbitrary function into a {@link CacheWeigher}.
 *
 * Useful for domain-specific weights, such as counting the number of variants
 * in a product or the number of line items in a cart.
 */
export class FunctionWeigher<K, V> implements CacheWeigher<K, V> {
  constructor(private readonly fn: (entry: CacheEntry<K, V>) => number) {}

  weigh(entry: CacheEntry<K, V>): number {
    return this.fn(entry);
  }
}
