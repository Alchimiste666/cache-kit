# @alchemist-software/cache-kit

A modular, type-safe caching toolkit for TypeScript. Pluggable stores, eviction strategies, capacity management, metrics, and read/write-through patterns — all composable via a fluent builder.

## Packages

| Package | Description |
|---------|-------------|
| `@alchemist-software/cache-kit-core` | Core — stores, eviction, capacity, builder, metrics |
| `@alchemist-software/cache-kit-redis` | Redis store adapter |
| `@alchemist-software/cache-kit-valkey` | Valkey store adapter |
| `@alchemist-software/cache-kit-dynamodb` | DynamoDB store adapter (with optional DAX support) |
| `@alchemist-software/cache-kit-telemetry` | OpenTelemetry tracing & metrics |

## Installation

```bash
npm install @alchemist-software/cache-kit-core

# Optional adapters (install alongside their peer dependency)
npm install @alchemist-software/cache-kit-redis redis
npm install @alchemist-software/cache-kit-valkey iovalkey
npm install @alchemist-software/cache-kit-dynamodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm install @alchemist-software/cache-kit-telemetry @opentelemetry/api
```

## Quick Start

```ts
import {
  CacheBuilder,
  CacheExpirationType,
  LRUCacheEviction,
  MaxEntriesCapacity,
  MemoryCacheStore,
} from "@alchemist-software/cache-kit-core";

type UserID = string;
type UserProfile = { displayName: string; active: boolean };

const cache = new CacheBuilder<UserID, UserProfile>()
  .withStore(new MemoryCacheStore())
  .withCapacity(new MaxEntriesCapacity(1000))
  .withEviction(new LRUCacheEviction())
  .withExpiration({ type: CacheExpirationType.TimeToLive, milliSeconds: 3600_000 })
  .buildDefaultCache();

await cache.set("usr_9f2a3b", { displayName: "Ada Lovelace", active: true });
const profile = await cache.get("usr_9f2a3b");
```

---

## Cache Interface

```ts
interface Cache<K, V> {
  has(key: K): Promise<boolean>;
  get(key: K): Promise<V | undefined>;
  set(key: K, value: V, options?: CacheSetOptions): Promise<void>;
  delete(key: K): Promise<boolean>;
  clear(): Promise<void>;
}
```

Extended interfaces:

| Interface | Adds |
|-----------|------|
| `ReadThroughCache` | `getOrRead(key, loader)` — fetch on miss |
| `WriteThroughCache` | `put(key, value, writer)` — write to origin + cache |
| `ReadWriteThroughCache` | Both of the above |
| `BatchCache` | `getMany`, `setMany`, `deleteMany` |
| `BatchReadThroughCache` | Batch + `getOrReadMany` |
| `BatchWriteThroughCache` | Batch + `putMany` |
| `BatchReadWriteThroughCache` | All combined |

### CacheSetOptions

```ts
await cache.set(key, value, {
  expiration: { type: CacheExpirationType.TimeToLive, milliSeconds: 30_000 },
  overwrite: false,        // skip if key exists (default: true)
  tags: ["team:backend"],  // tag-based group invalidation
  region: "inventory",       // cache region for partitioning
  metadata: { priority: 1 },
});
```

### CacheLoadOptions

```ts
const profile = await cache.getOrRead(
  userId,
  () => fetchFromDB(userId),
  { forceRefresh: true },  // bypass cache, always invoke loader
);
```

---

## CacheBuilder

Fluent API to compose all cache concerns:

```ts
new CacheBuilder<K, V>()
  .withStore(store)
  .withCapacity(capacity)
  .withEviction(eviction)
  .withExpiration(expiration)
  .withAdmission(admission)
  .withMetrics(recorder)
  .withDecorator((cache) => new CoalescingCache(cache))
  .buildDefaultCache();
```

| Build Method | Returns | Pattern |
|--------------|---------|---------|
| `buildDefaultCache()` | `Cache<K, V>` | Cache-Aside |
| `buildReadThroughCache()` | `ReadThroughCache<K, V>` | Read-Through |
| `buildWriteThroughCache()` | `WriteThroughCache<K, V>` | Write-Through |
| `buildReadWriteThroughCache()` | `ReadWriteThroughCache<K, V>` | Read/Write-Through |
| `buildBatchCache()` | `BatchCache<K, V>` | Cache-Aside (batch) |
| `buildBatchReadThroughCache()` | `BatchReadThroughCache<K, V>` | Read-Through (batch) |
| `buildBatchWriteThroughCache()` | `BatchWriteThroughCache<K, V>` | Write-Through (batch) |
| `buildBatchReadWriteThroughCache()` | `BatchReadWriteThroughCache<K, V>` | Read/Write-Through (batch) |

---

## Stores

### MemoryCacheStore

In-process store with built-in support for capacity, eviction, expiration, and admission:

```ts
const store = new MemoryCacheStore<string, object>();
```

### FailSafeCacheStore

Auto-reconnecting wrapper with health checks. Falls back to a secondary store when primary is down:

```ts
const store = new FailSafeCacheStore({
  createStore: () => new RedisCacheStore({ client }),
  fallbackStore: new MemoryCacheStore(), // optional (default: NoOpCacheStore)
  healthCheck: () => client.ping(),      // optional
  checkInterval: 5000,                   // ms between checks (default: 10000)
});
```

### RegionCacheStore

Namespaces keys by region for scoped invalidation:

```ts
const store = new RegionCacheStore(new MemoryCacheStore(), "users");

await store.set("usr_1", profile);                        // key: "users:usr_1"
await store.set("usr_2", profile2, { region: "admins" }); // key: "admins:usr_2"
await store.clear("admins");                              // clears only "admins"
```

### NoOpCacheStore

Does nothing — useful for disabling cache in tests or as a fallback:

```ts
const store = new NoOpCacheStore<string, object>();
```

### RedisCacheStore

```ts
import { RedisCacheStore } from "@alchemist-software/cache-kit-redis";
import { createClient } from "redis";

const store = new RedisCacheStore({ client: createClient({ url: "redis://localhost:6379" }) });
```

### ValkeyCacheStore

```ts
import { ValkeyCacheStore } from "@alchemist-software/cache-kit-valkey";
import Valkey from "iovalkey";

const store = new ValkeyCacheStore({ client: new Valkey({ host: "localhost", port: 6379 }) });
```

### DynamoDBCacheStore

```ts
import { DynamoDBCacheStore } from "@alchemist-software/cache-kit-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const store = new DynamoDBCacheStore({
  client: new DynamoDBClient({ region: "us-east-1" }),
  tableName: "my-cache",
});
```

With DAX acceleration — same store, just a different client endpoint:

```ts
import { DynamoDBCacheStore } from "@alchemist-software/cache-kit-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const store = new DynamoDBCacheStore({
  client: new DynamoDBClient({ endpoint: "dax://my-cluster.abc123.dax-clusters.us-east-1.amazonaws.com:8111" }),
  tableName: "my-cache",
  consistentRead: true,
});
```

Table requirements:
- Partition key: `pk` (String) — or customize via `partitionKey` option
- TTL attribute: `expiresAt` (Number, epoch seconds) — enable TTL on the table
- Value attribute: `value` (Binary)

Caveats:
- `clear()` performs a full table scan + batch delete — expensive for large tables. Consider using `RegionCacheStore` for scoped invalidation or a dedicated table per cache namespace.
- `deleteMany()` returns the number of keys requested for deletion (best-effort count) since DynamoDB's `BatchWriteItem` does not confirm individual delete outcomes.
- DynamoDB TTL deletion is eventually consistent (items may linger up to 48h). The store filters expired items on reads to ensure strict expiry semantics.

---

## Eviction Strategies

| Strategy | Algorithm |
|----------|-----------|
| `LRUCacheEviction` | Least Recently Used |
| `FIFOCacheEviction` | First In, First Out |
| `RandomCacheEviction` | Random |
| `TTLCacheEviction` | Nearest-to-expiry first |
| `TinyLFUCacheEviction` | Frequency-based (TinyLFU) |
| `S3FIFOCacheEviction` | S3-FIFO segmented |
| `CompositeCacheEviction` | Combines multiple strategies |

---

## Capacity

```ts
import {
  MaxEntriesCapacity,
  HighLowWatermarkCapacity,
  WeightedCapacity,
  JsonSizeWeigher,
} from "@alchemist-software/cache-kit-core";

// Fixed count
new MaxEntriesCapacity(1000);

// High/low watermark — evicts past high, stops at low
new HighLowWatermarkCapacity(1000, 800);

// Weight-based with a memory budget
new WeightedCapacity({
  maxWeight: 50 * 1024 * 1024,
  targetWeight: 40 * 1024 * 1024,
  weigher: new JsonSizeWeigher(),
});
```

### Weighers

| Weigher | Measures |
|---------|----------|
| `JsonSizeWeigher` | Byte size via JSON serialization |
| `EntryCountWeigher` | Constant 1 per entry |
| `FunctionWeigher` | Custom `(entry) => number` |

```ts
const weigher = new FunctionWeigher((entry) => entry.value.payload.length);
```

---

## Expiration

```ts
import { CacheExpirationType } from "@alchemist-software/cache-kit-core";

// TTL
{ type: CacheExpirationType.TimeToLive, milliSeconds: 60_000 }

// Absolute timestamp
{ type: CacheExpirationType.Timestamp, timestamp: Date.now() + 60_000 }

// Custom policy (jitter, sliding window, schedule-aligned, etc.)
{ type: CacheExpirationType.Custom, policy: { getExpiresAt: (now) => now + jitter() } }
```

---

## Admission

Gates whether an entry should be cached at all:

```ts
import type { CacheAdmission, CacheEntry } from "@alchemist-software/cache-kit-core";

class MinSizeAdmission<K, V> implements CacheAdmission<K, V> {
  shouldAdmit(entry: CacheEntry<K, V>): boolean {
    return JSON.stringify(entry.value).length > 64;
  }
}

const cache = new CacheBuilder<string, object>()
  .withAdmission(new MinSizeAdmission())
  .buildDefaultCache();
```

---

## Serializers

Used by Redis/Valkey stores for binary encoding. Built-in `JsonSerializer`:

```ts
import { JsonSerializer } from "@alchemist-software/cache-kit-core";

const serializer = new JsonSerializer<UserProfile>();
const bytes = serializer.serialize({ displayName: "Ada", active: true });
const value = serializer.deserialize(bytes);
```

Custom serializer:

```ts
import type { CacheSerializer } from "@alchemist-software/cache-kit-core";

class MsgPackSerializer<V> implements CacheSerializer<V> {
  serialize(value: V): Uint8Array { /* ... */ }
  deserialize(data: Uint8Array): V { /* ... */ }
}
```

### Compression

Layer compression on any serializer:

```ts
import { gzipSync, gunzipSync } from "node:zlib";
import type { CacheSerializer } from "@alchemist-software/cache-kit-core";

interface CompressionCodec {
  compress(data: Uint8Array): Uint8Array;
  decompress(data: Uint8Array): Uint8Array;
}

const GzipCodec: CompressionCodec = {
  compress: (data) => gzipSync(data),
  decompress: (data) => gunzipSync(data),
};

class CompressedSerializer<V> implements CacheSerializer<V> {
  constructor(
    private readonly inner: CacheSerializer<V>,
    private readonly codec: CompressionCodec = GzipCodec,
  ) {}

  serialize(value: V): Uint8Array {
    return this.codec.compress(this.inner.serialize(value));
  }

  deserialize(data: Uint8Array): V {
    return this.inner.deserialize(this.codec.decompress(data));
  }
}

const serializer = new CompressedSerializer(new JsonSerializer(), GzipCodec);
```

---

## Metrics

```ts
import { InMemoryCacheMetricsRecorder } from "@alchemist-software/cache-kit-core";

const recorder = new InMemoryCacheMetricsRecorder();

const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .withMetrics(recorder)
  .buildDefaultCache();

recorder.stats(); // { hits, misses, loads, evictions, writes, deletes }
```

---

## Decorators

### CoalescingCache

Deduplicates concurrent reads for the same key — one loader runs, all waiters share the result:

```ts
const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .withDecorator((cache) => new CoalescingCache(cache))
  .buildBatchReadThroughCache();
```

---

## Telemetry

### TracingCache

OpenTelemetry spans for every cache operation:

```ts
import { TracingCache } from "@alchemist-software/cache-kit-telemetry";

const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .withDecorator((cache) => new TracingCache(cache, { spanPrefix: "user-profiles" }))
  .buildDefaultCache();
```

### OpenTelemetryCacheMetricsRecorder

Push cache counters to an OTel Meter:

```ts
import { OpenTelemetryCacheMetricsRecorder } from "@alchemist-software/cache-kit-telemetry";
import { metrics } from "@opentelemetry/api";

const recorder = new OpenTelemetryCacheMetricsRecorder(metrics.getMeter("app"), "user-cache");

const cache = new CacheBuilder<string, object>()
  .withMetrics(recorder)
  .buildDefaultCache();
```

---

## Advanced Patterns

### Shared Store

Multiple cache instances over a single store:

```ts
const store = new MemoryCacheStore<string, object>();
const cache1 = new DefaultCache(store);
const cache2 = new DefaultCache(store);

await cache1.set("key", value);
await cache2.get("key"); // same value
```

### Composing Decorators

Applied in order — combine coalescing, tracing, and metrics:

```ts
const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .withMetrics(recorder)
  .withDecorator((cache) => new CoalescingCache(cache))
  .withDecorator((cache) => new TracingCache(cache, { spanPrefix: "my-cache" }))
  .buildBatchReadThroughCache();
```

---

## Custom Implementations

All abstractions are interface-based. Plug your own into the builder.

### Custom Store

```ts
import type { CacheStore, CacheSetOptions } from "@alchemist-software/cache-kit-core";

class DynamoDBCacheStore<K, V> implements CacheStore<K, V> {
  async has(key: K): Promise<boolean> { /* ... */ }
  async get(key: K): Promise<V | undefined> { /* ... */ }
  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> { /* ... */ }
  async delete(key: K): Promise<boolean> { /* ... */ }
  async clear(): Promise<void> { /* ... */ }
  async connect(): Promise<void> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
}
```

For batch support, implement `BatchCacheStore<K, V>`:

```ts
import type { BatchCacheStore, CacheSetOptions } from "@alchemist-software/cache-kit-core";

class DynamoDBBatchStore<K, V> implements BatchCacheStore<K, V> {
  // ...all CacheStore methods, plus:
  async getMany(keys: readonly K[]): Promise<Map<K, V>> { /* ... */ }
  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> { /* ... */ }
  async deleteMany(keys: readonly K[]): Promise<number> { /* ... */ }
}
```

### Custom Capacity

```ts
import type { CacheCapacity, CacheEntry } from "@alchemist-software/cache-kit-core";

class MemoryBudgetCapacity<K, V> implements CacheCapacity<K, V> {
  constructor(private readonly maxBytes: number) {}

  shouldEvict(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return this.estimate(entries) > this.maxBytes;
  }

  isWithinLimit(entries: ReadonlyMap<K, CacheEntry<K, V>>): boolean {
    return this.estimate(entries) <= this.maxBytes * 0.8;
  }

  private estimate(entries: ReadonlyMap<K, CacheEntry<K, V>>): number { /* ... */ }
}
```

### Custom Eviction

```ts
import type { CacheEviction, CacheEntry } from "@alchemist-software/cache-kit-core";

class PriorityEviction<K, V> implements CacheEviction<K, V> {
  onGet(entry: CacheEntry<K, V>): void { /* ... */ }
  onSet(entry: CacheEntry<K, V>): void { /* ... */ }
  onDelete(entry: CacheEntry<K, V>): void { /* ... */ }
  candidates(): CacheEntry<K, V>[] { /* ordered by eviction priority */ }
}
```

### Custom Expiration

```ts
import { CacheExpirationType, type CacheExpirationPolicy } from "@alchemist-software/cache-kit-core";

const jitteredTTL: CacheExpirationPolicy = {
  getExpiresAt(now: number) {
    return now + 60_000 + Math.random() * 10_000;
  },
};

const cache = new CacheBuilder<string, object>()
  .withExpiration({ type: CacheExpirationType.Custom, policy: jitteredTTL })
  .buildDefaultCache();
```

### Custom Metrics Recorder

```ts
import type { CacheMetricsRecorder } from "@alchemist-software/cache-kit-core";

class DatadogRecorder implements CacheMetricsRecorder {
  hits(count = 1): void { /* statsd.increment('cache.hits', count) */ }
  misses(count = 1): void { /* ... */ }
  loads(count = 1): void { /* ... */ }
  evictions(count = 1): void { /* ... */ }
  writes(count = 1): void { /* ... */ }
  deletes(count = 1): void { /* ... */ }
}
```

### Custom Decorator

```ts
import type { Cache, CacheSetOptions } from "@alchemist-software/cache-kit-core";

class LoggingCache<K, V> implements Cache<K, V> {
  constructor(private readonly inner: Cache<K, V>) {}

  async get(key: K) { console.log(`GET ${key}`); return this.inner.get(key); }
  async set(key: K, value: V, opts?: CacheSetOptions) { return this.inner.set(key, value, opts); }
  async has(key: K) { return this.inner.has(key); }
  async delete(key: K) { return this.inner.delete(key); }
  async clear() { return this.inner.clear(); }
}

const cache = new CacheBuilder<string, object>()
  .withDecorator((cache) => new LoggingCache(cache))
  .buildDefaultCache();
```

---

## License

MIT
