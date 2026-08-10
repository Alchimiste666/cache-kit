import { DefaultCache } from "./implementations";
import { type CacheMetricsRecorder, InMemoryCacheMetricsRecorder } from "./metrics";
import { MemoryCacheStore, MetricsCacheStore } from "./stores";
import type {
  BatchCache,
  BatchReadThroughCache,
  BatchReadWriteThroughCache,
  BatchWriteThroughCache,
  Cache,
  CacheAdmission,
  CacheCapacity,
  CacheDecorator,
  CacheEviction,
  CacheExpiration,
  CacheStore,
  ReadThroughCache,
  ReadWriteThroughCache,
  WriteThroughCache,
} from "./types";
import {
  BatchCacheWrapper,
  BatchReadThroughCacheWrapper,
  BatchReadWriteThroughCacheWrapper,
  BatchWriteThroughCacheWrapper,
  ReadThroughCacheWrapper,
  ReadWriteThroughCacheWrapper,
  WriteThroughCacheWrapper,
} from "./wrappers";

type Resolver<T, C> = T | ((context: Readonly<C>) => T);

type CacheBuilderContext<K, V> = {
  store?: CacheStore<K, V>;
  capacity?: CacheCapacity<K, V>;
  eviction?: CacheEviction<K, V>;
  expiration?: CacheExpiration;
  admission?: CacheAdmission<K, V>;
  metricsRecorder?: CacheMetricsRecorder;
};

function resolve<T, C>(resolver: Resolver<T, C> | undefined, context: Readonly<C>): T | undefined {
  if (resolver === undefined) {
    return undefined;
  }

  return typeof resolver === "function"
    ? (resolver as (context: Readonly<C>) => T)(context)
    : resolver;
}

/**
 * Fluent builder for constructing cache instances with configurable stores,
 * capacity policies, eviction strategies, expiration, admission, and metrics.
 *
 * Each `with*` method accepts either a value or a factory function that receives
 * the partially-resolved builder context, enabling dependencies between options.
 *
 * @typeParam K - The cache key type.
 * @typeParam V - The cache value type.
 */
export class CacheBuilder<K, V> {
  private readonly cacheDecorators: CacheDecorator<K, V>[] = [];

  private store?: Resolver<CacheStore<K, V>, CacheBuilderContext<K, V>>;
  private capacity?: Resolver<CacheCapacity<K, V>, CacheBuilderContext<K, V>>;
  private eviction?: Resolver<CacheEviction<K, V>, CacheBuilderContext<K, V>>;
  private expiration?: Resolver<CacheExpiration, CacheBuilderContext<K, V>>;
  private admission?: Resolver<CacheAdmission<K, V>, CacheBuilderContext<K, V>>;
  private metricsRecorder?: Resolver<CacheMetricsRecorder, CacheBuilderContext<K, V>>;

  private resolveContext(): CacheBuilderContext<K, V> {
    const context: CacheBuilderContext<K, V> = {};

    context.store = resolve(this.store, context);
    context.capacity = resolve(this.capacity, context);
    context.eviction = resolve(this.eviction, context);
    context.expiration = resolve(this.expiration, context);
    context.admission = resolve(this.admission, context);
    context.metricsRecorder = resolve(this.metricsRecorder, context);

    return context;
  }

  private buildCache<C extends Cache<K, V>>(factory: (store: CacheStore<K, V>) => C): C {
    // Resolve the context to get the current configuration for the cache
    const { store, capacity, eviction, expiration, admission, metricsRecorder } =
      this.resolveContext();

    // If no store is provided, create a default in-memory store with the configured options
    const resolvedStore =
      store ??
      new MemoryCacheStore({
        capacity,
        eviction,
        expiration,
        admission,
      });

    // Wrap store with metrics if a metrics recorder is provided
    const cacheStore = metricsRecorder
      ? new MetricsCacheStore(resolvedStore, metricsRecorder)
      : resolvedStore;

    // Create cache from store
    const cache = factory(cacheStore);

    // Apply decorators in order
    const decoratedCache = this.cacheDecorators.reduce<Cache<K, V>>(
      (current, decorate) => decorate(current),
      cache,
    );

    // Return the fully constructed cache with all decorators applied
    return decoratedCache as C;
  }

  /**
   * Registers a decorator that will be applied to the cache after construction.
   *
   * @param decorator - Function that wraps the cache with additional behavior.
   * @returns This builder for chaining.
   */
  withDecorator<C extends Cache<K, V> = Cache<K, V>>(decorator: CacheDecorator<K, V, C>): this {
    this.cacheDecorators.push(decorator as CacheDecorator<K, V>);
    return this;
  }

  /**
   * Configures the capacity policy for the in-memory store.
   *
   * @param capacity - Capacity policy or factory function.
   * @returns This builder for chaining.
   */
  withCapacity(capacity: Resolver<CacheCapacity<K, V>, CacheBuilderContext<K, V>>): this {
    this.capacity = capacity;
    return this;
  }

  /**
   * Configures the eviction strategy for the in-memory store.
   *
   * @param eviction - Eviction strategy or factory function.
   * @returns This builder for chaining.
   */
  withEviction(eviction: Resolver<CacheEviction<K, V>, CacheBuilderContext<K, V>>): this {
    this.eviction = eviction;
    return this;
  }

  /**
   * Configures the default expiration policy for cache entries.
   *
   * @param expiration - Expiration policy or factory function.
   * @returns This builder for chaining.
   */
  withExpiration(expiration: Resolver<CacheExpiration, CacheBuilderContext<K, V>>): this {
    this.expiration = expiration;
    return this;
  }

  /**
   * Configures the admission policy that gates which entries are stored.
   *
   * @param admission - Admission policy or factory function.
   * @returns This builder for chaining.
   */
  withAdmission(admission: Resolver<CacheAdmission<K, V>, CacheBuilderContext<K, V>>): this {
    this.admission = admission;
    return this;
  }

  /**
   * Enables metrics collection by wrapping the store with a metrics-recording layer.
   *
   * @param metricsRecorder - Recorder implementation to use.
   * @defaultValue InMemoryCacheMetricsRecorder
   * @returns This builder for chaining.
   */
  withMetrics(metricsRecorder: CacheMetricsRecorder = new InMemoryCacheMetricsRecorder()): this {
    this.metricsRecorder = metricsRecorder;
    return this;
  }

  /**
   * Provides a custom cache store, bypassing the default in-memory store.
   *
   * @param store - Store instance or factory function.
   * @returns This builder for chaining.
   */
  withStore(store: Resolver<CacheStore<K, V>, CacheBuilderContext<K, V>>): this {
    this.store = store;
    return this;
  }

  /** Builds a basic {@link Cache} instance with the configured options. */
  buildDefaultCache(): Cache<K, V> {
    return this.buildCache((store) => new DefaultCache(store));
  }

  /** Builds a {@link ReadThroughCache} that supports loader-based reads. */
  buildReadThroughCache(): ReadThroughCache<K, V> {
    return this.buildCache((store) => new ReadThroughCacheWrapper(store));
  }

  /** Builds a {@link WriteThroughCache} that writes through to an external store. */
  buildWriteThroughCache(): WriteThroughCache<K, V> {
    return this.buildCache((store) => new WriteThroughCacheWrapper(store));
  }

  /** Builds a {@link ReadWriteThroughCache} combining read-through and write-through semantics. */
  buildReadWriteThroughCache(): ReadWriteThroughCache<K, V> {
    return this.buildCache((store) => new ReadWriteThroughCacheWrapper(store));
  }

  /** Builds a {@link BatchCache} supporting bulk get/set/delete operations. */
  buildBatchCache(): BatchCache<K, V> {
    return this.buildCache((store) => new BatchCacheWrapper(store));
  }

  /** Builds a {@link BatchReadThroughCache} combining batch operations with read-through loading. */
  buildBatchReadThroughCache(): BatchReadThroughCache<K, V> {
    return this.buildCache((store) => new BatchReadThroughCacheWrapper(store));
  }

  /** Builds a {@link BatchWriteThroughCache} combining batch operations with write-through semantics. */
  buildBatchWriteThroughCache(): BatchWriteThroughCache<K, V> {
    return this.buildCache((store) => new BatchWriteThroughCacheWrapper(store));
  }

  /** Builds a {@link BatchReadWriteThroughCache} combining batch, read-through, and write-through semantics. */
  buildBatchReadWriteThroughCache(): BatchReadWriteThroughCache<K, V> {
    return this.buildCache((store) => new BatchReadWriteThroughCacheWrapper(store));
  }
}
