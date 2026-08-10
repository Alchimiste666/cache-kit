import type { CacheCapacity } from "../types/CacheCapacity";
import type { CacheEntry } from "../types/CacheEntry";

/**
 * Triggers eviction when entries exceed the high watermark,
 * and continues evicting until the low watermark is reached.
 */
export class HighLowWatermarkCapacity<K, V> implements CacheCapacity<K, V> {
  /**
   * @param highWatermark - Entry count that triggers eviction.
   * @param lowWatermark - Entry count at which eviction stops.
   */
  constructor(
    private readonly highWatermark: number,
    private readonly lowWatermark: number,
  ) {
    if (lowWatermark > highWatermark) {
      throw new Error("lowWatermark must be <= highWatermark");
    }
  }

  shouldEvict(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return entries.size > this.highWatermark;
  }

  isWithinLimit(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return entries.size <= this.lowWatermark;
  }
}
