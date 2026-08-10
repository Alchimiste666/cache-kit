export interface CacheMetrics {
  hits: number;

  misses: number;

  loads: number;

  evictions: number;

  writes: number;

  deletes: number;
}

export interface CacheMetricsRecorder {
  hits(count?: number): void;

  misses(count?: number): void;

  loads(count?: number): void;

  evictions(count?: number): void;

  writes(count?: number): void;

  deletes(count?: number): void;
}

export interface CacheMetricsSnapshot {
  stats(): CacheMetrics;

  reset(): void;
}
