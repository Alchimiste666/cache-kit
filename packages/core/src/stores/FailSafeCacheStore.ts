import type { CacheSetOptions, CacheStore } from "../types";
import { NoOpCacheStore } from "./NoOpCacheStore";

const DEFAULT_HEALTH_CHECK_INTERVAL = 10_000;

/**
 * Configuration for a fail-safe cache store.
 */
export type FailSafeCacheStoreConfig<K, V> = {
  /**
   * Function that creates the cache store.
   * Retried on failure.
   */
  createStore: () => CacheStore<K, V> | Promise<CacheStore<K, V>>;

  /**
   * Store used when the primary store is unavailable.
   *
   * @defaultValue NoOpCacheStore
   */
  fallbackStore?: CacheStore<K, V>;

  /**
   * Checks whether the store is healthy.
   * Defaults to a successful store creation.
   */
  healthCheck?: () => Promise<boolean>;

  /**
   * Health check retry interval in milliseconds.
   *
   * @defaultValue 10000
   */
  checkInterval?: number;
};

/**
 * A cache store that falls back to a secondary store when the primary is unavailable.
 */
export class FailSafeCacheStore<K, V> implements CacheStore<K, V> {
  private readonly config: FailSafeCacheStoreConfig<K, V>;

  private actualStore: CacheStore<K, V> | null = null;
  private readonly fallbackStore: CacheStore<K, V>;

  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: FailSafeCacheStoreConfig<K, V>) {
    this.config = config;
    this.fallbackStore = config.fallbackStore ?? new NoOpCacheStore();
    this.initializeAndMonitor();
  }

  /**
   * Initialize the store and start periodic health checks.
   */
  private initializeAndMonitor(): void {
    if (!this.config) {
      throw new Error("FailSafeCacheStore configuration is required.");
    }

    // Try once on construction
    this.tryConnect();

    // Start periodic health checks
    const interval = this.config.checkInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL;

    this.healthCheckTimer = setInterval(() => this.tryConnect(), interval);
  }

  /**
   * Attempt to connect or verify the store's health.
   * If already connected, validates health and degrades to fallback if unhealthy.
   * If not connected, attempts to create the store.
   */
  private async tryConnect(): Promise<void> {
    try {
      if (this.config.healthCheck) {
        const isHealthy = await this.config.healthCheck();

        if (!isHealthy) {
          this.actualStore = null;
          return;
        }
      }

      if (!this.actualStore) {
        this.actualStore = await this.config.createStore();
      }
    } catch {
      this.actualStore = null;
    }
  }

  /**
   * Get the current store (actual or fallback).
   */
  private get delegate(): CacheStore<K, V> {
    return this.actualStore ?? this.fallbackStore;
  }

  /**
   * Wait for the store to be ready (only relevant for lazy-initialized stores).
   */
  async waitUntilReady(timeoutMs = 5000): Promise<boolean> {
    if (this.actualStore) {
      return true;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.actualStore) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  async has(key: K): Promise<boolean> {
    try {
      return await this.delegate.has(key);
    } catch {
      return false;
    }
  }

  async get(key: K): Promise<V | undefined> {
    try {
      return await this.delegate.get(key);
    } catch {
      return undefined;
    }
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    try {
      await this.delegate.set(key, value, options);
    } catch {
      // no-op
    }
  }

  async delete(key: K): Promise<boolean> {
    try {
      return await this.delegate.delete(key);
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.delegate.clear) {
      return;
    }

    try {
      await this.delegate.clear();
    } catch {
      // no-op
    }
  }

  async connect(): Promise<void> {
    try {
      await this.delegate.connect?.();
    } catch {
      this.actualStore = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    try {
      await this.actualStore?.disconnect?.();
    } catch {
      // no-op
    } finally {
      this.actualStore = null;
    }
  }
}
