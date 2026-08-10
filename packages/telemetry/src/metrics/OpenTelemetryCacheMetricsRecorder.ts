import type {
  CacheMetrics,
  CacheMetricsRecorder,
  CacheMetricsSnapshot,
} from "@alchemist-software/cache-kit-core";
import type { Meter } from "@opentelemetry/api";

/**
 * Metrics recorder that publishes cache counters to an OpenTelemetry {@link Meter}.
 *
 * Each metric type (hits, misses, loads, evictions, writes, deletes) is exposed
 * as a monotonic counter with a configurable name prefix.
 */
export class OpenTelemetryCacheMetricsRecorder
  implements CacheMetricsRecorder, CacheMetricsSnapshot
{
  private readonly hitCounter;
  private readonly missCounter;
  private readonly loadCounter;
  private readonly evictionCounter;
  private readonly writeCounter;
  private readonly deleteCounter;

  /**
   * @param meter - OpenTelemetry Meter to register counters with.
   * @param name - Prefix for counter metric names.
   * @defaultValue "cache"
   */
  constructor(meter: Meter, name = "cache") {
    this.hitCounter = meter.createCounter(`${name}.hits`);
    this.missCounter = meter.createCounter(`${name}.misses`);
    this.loadCounter = meter.createCounter(`${name}.loads`);
    this.evictionCounter = meter.createCounter(`${name}.evictions`);
    this.writeCounter = meter.createCounter(`${name}.writes`);
    this.deleteCounter = meter.createCounter(`${name}.deletes`);
  }

  hits(count = 1): void {
    this.hitCounter.add(count);
  }

  misses(count = 1): void {
    this.missCounter.add(count);
  }

  loads(count = 1): void {
    this.loadCounter.add(count);
  }

  evictions(count = 1): void {
    this.evictionCounter.add(count);
  }

  writes(count = 1): void {
    this.writeCounter.add(count);
  }

  deletes(count = 1): void {
    this.deleteCounter.add(count);
  }

  stats(): CacheMetrics {
    throw new Error(
      "OpenTelemetry metrics cannot be queried. Export them through an OpenTelemetry exporter.",
    );
  }

  reset(): void {
    // no-op
  }
}
