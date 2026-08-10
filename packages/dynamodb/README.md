# @alchemist-software/cache-kit-dynamodb

DynamoDB cache store adapter for [@alchemist-software/cache-kit-core](https://www.npmjs.com/package/@alchemist-software/cache-kit-core), with optional DAX acceleration support.

## Installation

```bash
npm install @alchemist-software/cache-kit-core @alchemist-software/cache-kit-dynamodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Quick Start

```ts
import { CacheBuilder } from "@alchemist-software/cache-kit-core";
import { DynamoDBCacheStore } from "@alchemist-software/cache-kit-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const store = new DynamoDBCacheStore({
  client: new DynamoDBClient({ region: "us-east-1" }),
  tableName: "my-cache",
});

const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .buildDefaultCache();

await cache.set("key", { hello: "world" });
```

### With DAX

```ts
const store = new DynamoDBCacheStore({
  client: new DynamoDBClient({
    endpoint: "dax://my-cluster.abc123.dax-clusters.us-east-1.amazonaws.com:8111",
    region: "us-east-1",
  }),
  tableName: "my-cache",
  consistentRead: true,
});
```

## Table Requirements

| Attribute | Type | Purpose |
|-----------|------|---------|
| `pk` | String | Partition key (configurable via `partitionKey` option) |
| `value` | Binary | Serialized cache value |
| `expiresAt` | Number | TTL in epoch seconds (enable DynamoDB TTL on this attribute) |

## Documentation

Full documentation, API reference, and advanced usage examples are available in the [main project README](https://github.com/alchimiste666/cache-kit#readme).
