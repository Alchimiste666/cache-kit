import { DynamoDBCacheStore } from "@alchemist-software/cache-kit-dynamodb";
import { RedisCacheStore } from "@alchemist-software/cache-kit-redis";
import { TracingCache } from "@alchemist-software/cache-kit-telemetry";
import { ValkeyCacheStore } from "@alchemist-software/cache-kit-valkey";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import Valkey from "iovalkey";
import { createClient as createRedisClient } from "redis";
import {
  type BatchReadThroughCache,
  type BatchReadWriteThroughCache,
  type Cache,
  CacheBuilder,
  CacheExpirationType,
  type CacheStore,
  CoalescingCache,
  DefaultCache,
  FailSafeCacheStore,
  InMemoryCacheMetricsRecorder,
  JsonSizeWeigher,
  LRUCacheEviction,
  MaxEntriesCapacity,
  MemoryCacheStore,
  MetricsCacheStore,
  WeightedCapacity,
} from "../../core/src/index";

// ─── Types ───────────────────────────────────────────────────────────────────

type UserID = string;

type UserProfile = {
  displayName: string;
  active: boolean;
};

type DemoScenario = {
  name: string;
  run: () => Promise<void>;
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const userId: UserID = "usr_9f2a3b";

const userProfile: UserProfile = {
  displayName: "Ada Lovelace",
  active: true,
};

// ─── Store Factories ─────────────────────────────────────────────────────────

function createMemoryCacheStore(): MemoryCacheStore<UserID, UserProfile> {
  return new MemoryCacheStore<UserID, UserProfile>();
}

function createRedisCacheStore(): RedisCacheStore<UserID, UserProfile> {
  const redisClient = createRedisClient({
    socket: {
      host: "localhost",
      port: 6380,
      reconnectStrategy: false,
    },
  });

  return new RedisCacheStore<UserID, UserProfile>({
    client: redisClient as ReturnType<typeof createRedisClient>,
  });
}

function createValkeyCacheStore(): ValkeyCacheStore<UserID, UserProfile> {
  const valkeyClient = new Valkey({
    host: "localhost",
    port: 6379,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: () => null,
    maxRetriesPerRequest: 0,
  });

  return new ValkeyCacheStore<UserID, UserProfile>({ client: valkeyClient });
}

function createDynamoDBCacheStore(): DynamoDBCacheStore<UserID, UserProfile> {
  const dynamoClient = new DynamoDBClient({
    region: "us-east-1",
    endpoint: "http://localhost:8000", // local DynamoDB
  });

  return new DynamoDBCacheStore<UserID, UserProfile>({
    client: dynamoClient,
    tableName: "cache-demo",
  });
}

function createDynamoDBCacheStoreWithDAX(): DynamoDBCacheStore<UserID, UserProfile> {
  const daxClient = new DynamoDBClient({
    endpoint: "dax://my-cluster.abc123.dax-clusters.us-east-1.amazonaws.com:8111",
    region: "us-east-1",
  });

  return new DynamoDBCacheStore<UserID, UserProfile>({
    client: daxClient,
    tableName: "cache-demo",
    consistentRead: true,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function printHeader(name: string): void {
  const size = Math.max(name.length + 2, 12);

  console.log(`\n╭${"─".repeat(size)}╮`);
  console.log(`│ ${name.padEnd(size - 1)}│`);
  console.log(`╰${"─".repeat(size)}╯`);
}

function printResult(operation: string, result?: unknown): void {
  const value = result === undefined ? "" : result;
  console.log(`${operation.padEnd(12)} ✓`, value);
}

async function runCacheOperations(cache: Cache<UserID, UserProfile>): Promise<void> {
  await cache.clear();
  await cache.set(userId, userProfile);
  printResult("SET");
  printResult("HAS", await cache.has(userId));
  printResult("GET", await cache.get(userId));
  printResult("DELETE", await cache.delete(userId));
  printResult("GET", await cache.get(userId));
}

async function runStoreDemo(store: CacheStore<UserID, UserProfile>): Promise<void> {
  if (store.connect) {
    await store.connect();
    printResult("OPEN");
  }

  await runCacheOperations(new DefaultCache(store));
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

const scenarios: DemoScenario[] = [
  {
    name: "Memory Store (shared instances)",
    run: async () => {
      const store = createMemoryCacheStore();

      const cache1 = new DefaultCache(store);
      const cache2 = new DefaultCache(store);

      await cache1.set(userId, userProfile);
      printResult("CACHE 1 GET", await cache1.get(userId));
      printResult("CACHE 2 GET", await cache2.get(userId));

      await cache2.delete(userId);

      printResult("CACHE 1 GET", await cache1.get(userId));
    },
  },
  {
    name: "Memory Store",
    run: () => runStoreDemo(createMemoryCacheStore()),
  },
  {
    name: "Redis (Fail Safe)",
    run: () => runStoreDemo(new FailSafeCacheStore({ createStore: () => createRedisCacheStore() })),
  },
  {
    name: "Valkey (Fail Safe)",
    run: () =>
      runStoreDemo(new FailSafeCacheStore({ createStore: () => createValkeyCacheStore() })),
  },
  {
    name: "DynamoDB (Fail Safe)",
    run: () =>
      runStoreDemo(new FailSafeCacheStore({ createStore: () => createDynamoDBCacheStore() })),
  },
  {
    name: "DynamoDB with DAX (Fail Safe)",
    run: () =>
      runStoreDemo(
        new FailSafeCacheStore({ createStore: () => createDynamoDBCacheStoreWithDAX() }),
      ),
  },
  {
    name: "Memory Store with Metrics",
    run: async () => {
      const metricsRecorder = new InMemoryCacheMetricsRecorder();

      const store = new MetricsCacheStore(createMemoryCacheStore(), metricsRecorder);

      const cache = new DefaultCache(store);

      await cache.set(userId, userProfile);
      await cache.get(userId);
      await cache.get("missing");

      printResult("STATS", JSON.stringify(metricsRecorder.stats()));
    },
  },
  {
    name: "CacheBuilder: Memory + LRU + TTL + Metrics + Coalescing",
    run: async () => {
      const store = createMemoryCacheStore();

      const metricsRecorder = new InMemoryCacheMetricsRecorder();

      const cache = new CacheBuilder<UserID, UserProfile>()
        .withStore(store)
        .withCapacity(new MaxEntriesCapacity(1000))
        .withEviction(new LRUCacheEviction())
        .withExpiration({ type: CacheExpirationType.TimeToLive, milliSeconds: 3600_000 })
        .withMetrics(metricsRecorder)
        .withDecorator<BatchReadWriteThroughCache<UserID, UserProfile>>(
          (cache) => new CoalescingCache(cache),
        )
        .buildBatchReadWriteThroughCache();

      await runCacheOperations(cache);

      printResult("STATS", JSON.stringify(metricsRecorder.stats()));
    },
  },
  {
    name: "CacheBuilder: Redis (Fail Safe) + Metrics + Coalescing",
    run: async () => {
      const metricsRecorder = new InMemoryCacheMetricsRecorder();

      const cache = new CacheBuilder<UserID, UserProfile>()
        .withStore(new FailSafeCacheStore({ createStore: () => createRedisCacheStore() }))
        .withMetrics(metricsRecorder)
        .withDecorator<BatchReadThroughCache<UserID, UserProfile>>(
          (cache) => new CoalescingCache(cache),
        )
        .buildBatchReadThroughCache();

      await runCacheOperations(cache);

      printResult("STATS", JSON.stringify(metricsRecorder.stats()));
    },
  },
  {
    name: "CacheBuilder: Memory + Tracing + Metrics",
    run: async () => {
      const store = createMemoryCacheStore();

      const metricsRecorder = new InMemoryCacheMetricsRecorder();

      const cache = new CacheBuilder<UserID, UserProfile>()
        .withStore(store)
        .withCapacity(
          new WeightedCapacity({
            maxWeight: 50 * 1024 * 1024, // 50 MB budget
            targetWeight: 40 * 1024 * 1024,
            weigher: new JsonSizeWeigher(),
          }),
        )
        .withMetrics(metricsRecorder)
        .withDecorator((cache) => new TracingCache(cache, { spanPrefix: "user-profiles" }))
        .buildDefaultCache();

      await runCacheOperations(cache);

      printResult("STATS", JSON.stringify(metricsRecorder.stats()));
    },
  },
  {
    name: "CacheBuilder: Memory + Coalescing + Tracing + Metrics",
    run: async () => {
      const store = createMemoryCacheStore();

      const metricsRecorder = new InMemoryCacheMetricsRecorder();

      const cache = new CacheBuilder<UserID, UserProfile>()
        .withStore(store)
        .withMetrics(metricsRecorder)
        .withDecorator<BatchReadThroughCache<UserID, UserProfile>>(
          (cache) => new CoalescingCache(cache),
        )
        .withDecorator((cache) => new TracingCache(cache, { spanPrefix: "user-profiles" }))
        .buildBatchReadThroughCache();

      await runCacheOperations(cache);

      printResult("STATS", JSON.stringify(metricsRecorder.stats()));
    },
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  for (let index = 0; index < scenarios.length; index++) {
    const scenario = scenarios[index];

    if (index > 0) {
      console.log(`\n${"═".repeat(100)}`);
    }

    printHeader(scenario.name);

    try {
      await scenario.run();
    } catch (error) {
      console.error("ERROR", error);
    }
  }
}

main().catch(console.error);
