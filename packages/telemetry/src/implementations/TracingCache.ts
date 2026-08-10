import type { Cache, CacheSetOptions } from "@alchemist-software/cache-kit-core";
import { type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";

export type TracingCacheOptions = {
  tracerName?: string;
  spanPrefix?: string;
};

/**
 * Cache implementation that wraps each operation in an OpenTelemetry span.
 *
 * Span names follow the pattern `{prefix}.{operation}` and include attributes
 * for the cache key and hit/miss status.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class TracingCache<K, V> implements Cache<K, V> {
  protected readonly tracer: Tracer;
  protected readonly spanPrefix: string;

  constructor(
    protected readonly cache: Cache<K, V>,
    options: TracingCacheOptions = {},
  ) {
    this.tracer = trace.getTracer(options.tracerName ?? "cache");
    this.spanPrefix = options.spanPrefix ?? "cache";
  }

  protected async traced<T>(operation: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(`${this.spanPrefix}.${operation}`, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  has(key: K): Promise<boolean> {
    return this.traced("has", (span) => {
      span.setAttribute("cache.key", String(key));
      return this.cache.has(key);
    });
  }

  get(key: K): Promise<V | undefined> {
    return this.traced("get", async (span) => {
      span.setAttribute("cache.key", String(key));
      const value = await this.cache.get(key);
      span.setAttribute("cache.hit", value !== undefined);
      return value;
    });
  }

  set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    return this.traced("set", (span) => {
      span.setAttribute("cache.key", String(key));
      return this.cache.set(key, value, options);
    });
  }

  delete(key: K): Promise<boolean> {
    return this.traced("delete", (span) => {
      span.setAttribute("cache.key", String(key));
      return this.cache.delete(key);
    });
  }

  clear(): Promise<void> {
    return this.traced("clear", () => this.cache.clear());
  }
}
