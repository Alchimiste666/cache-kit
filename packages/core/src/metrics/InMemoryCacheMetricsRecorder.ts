import type { CacheMetrics, CacheMetricsRecorder, CacheMetricsSnapshot } from ".";

/**
 * In-memory metrics recorder that accumulates cache operation counters.
 *
 * Useful for testing and lightweight monitoring scenarios where an external
 * telemetry backend is not required.
 */
export class InMemoryCacheMetricsRecorder implements CacheMetricsRecorder, CacheMetricsSnapshot {
  private readonly metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    loads: 0,
    evictions: 0,
    writes: 0,
    deletes: 0,
  };

  hits(count = 1): void {
    this.metrics.hits += count;
  }

  misses(count = 1): void {
    this.metrics.misses += count;
  }

  loads(count = 1): void {
    this.metrics.loads += count;
  }

  evictions(count = 1): void {
    this.metrics.evictions += count;
  }

  writes(count = 1): void {
    this.metrics.writes += count;
  }

  deletes(count = 1): void {
    this.metrics.deletes += count;
  }

  stats(): CacheMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.loads = 0;
    this.metrics.evictions = 0;
    this.metrics.writes = 0;
    this.metrics.deletes = 0;
  }
}
