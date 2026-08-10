# @alchemist-software/cache-kit-valkey

Valkey (Redis-compatible) cache store adapter for [@alchemist-software/cache-kit-core](https://www.npmjs.com/package/@alchemist-software/cache-kit-core).

## Installation

```bash
npm install @alchemist-software/cache-kit-core @alchemist-software/cache-kit-valkey iovalkey
```

## Quick Start

```ts
import { CacheBuilder } from "@alchemist-software/cache-kit-core";
import { ValkeyCacheStore } from "@alchemist-software/cache-kit-valkey";
import Valkey from "iovalkey";

const store = new ValkeyCacheStore({
  client: new Valkey({ host: "localhost", port: 6379 }),
});

const cache = new CacheBuilder<string, object>()
  .withStore(store)
  .buildDefaultCache();

await store.connect();
await cache.set("key", { hello: "world" });
```

## Documentation

Full documentation, API reference, and advanced usage examples are available in the [main project README](https://github.com/alchimiste666/cache-kit#readme).
