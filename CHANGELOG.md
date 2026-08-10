# Changelog

## 1.0.0

### Features

- Fluent `CacheBuilder` API supporting Cache-Aside, Read-Through, Write-Through, and batch patterns
- In-memory store with capacity, eviction, expiration, and admission policies
- Eviction strategies: LRU, FIFO, Random, TTL, TinyLFU, S3-FIFO, Composite
- Capacity policies: MaxEntries, HighLowWatermark, WeightedCapacity with pluggable weighers
- Expiration: TTL, absolute timestamp, custom policy
- `FailSafeCacheStore` with auto-reconnection and health checks
- `RegionCacheStore` for namespaced key partitioning
- `NoOpCacheStore` for testing and fallback
- `CoalescingCache` decorator for stampede prevention
- `InMemoryCacheMetricsRecorder` for hit/miss/eviction tracking
- `JsonSerializer` for binary store encoding
- `@alchemist-software/cache-kit-redis` — Redis store adapter (peer: `redis ^6.2.0`)
- `@alchemist-software/cache-kit-valkey` — Valkey store adapter (peer: `iovalkey ^0.4.0`)
- `@alchemist-software/cache-kit-telemetry` — OpenTelemetry tracing and metrics
