import {
  type BatchCacheStore,
  type CacheSerializer,
  type CacheSetOptions,
  JsonSerializer,
  resolveExpiresAt,
} from "@alchemist-software/cache-kit-core";
import { createClient } from "redis";

/**
 * Configuration options for {@link RedisCacheStore}.
 *
 * @typeParam V - The cache value type.
 */
export interface RedisCacheStoreOptions<V> {
  /** Existing Redis client instance. If omitted, a default client connecting to localhost:6379 is created. */
  client?: ReturnType<typeof createClient>;
  /** Serializer for converting values to and from byte arrays. Defaults to JSON serialization. */
  serializer?: CacheSerializer<V>;
}

/**
 * Cache store backed by Redis, supporting batch operations via MGET/MSET.
 *
 * Values are serialized before storage using a pluggable {@link CacheSerializer}.
 *
 * @typeParam K - The cache key type (converted to string via {@link String}).
 * @typeParam V - The cache value type.
 */
export class RedisCacheStore<K, V> implements BatchCacheStore<K, V> {
  private readonly client: ReturnType<typeof createClient>;
  private readonly serializer: CacheSerializer<V>;

  /**
   * @param options - Redis client and serializer configuration.
   */
  constructor(options: RedisCacheStoreOptions<V>) {
    const { client, serializer } = options;

    this.client = client ?? createClient({ url: "redis://localhost:6379" });

    this.serializer = serializer ?? new JsonSerializer();

    this.client.on("error", (error: unknown) => {
      console.error("Redis error:", error);
    });
  }

  protected serializeKey(key: K): string {
    return String(key);
  }

  async has(key: K): Promise<boolean> {
    return (await this.client.exists(this.serializeKey(key))) === 1;
  }

  async get(key: K): Promise<V | undefined> {
    const data = await this.client.get(this.serializeKey(key));

    if (data === null) {
      return undefined;
    }

    return this.serializer.deserialize(new Uint8Array(Buffer.from(data)));
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    const raw = this.serializer.serialize(value);
    const serializedKey = this.serializeKey(key);
    const value_ = Buffer.from(raw).toString("binary");

    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());
    const nx = options?.overwrite === false;

    if (expiresAt !== undefined && nx) {
      await this.client.set(serializedKey, value_, { PXAT: expiresAt, NX: true });
    } else if (expiresAt !== undefined) {
      await this.client.set(serializedKey, value_, { PXAT: expiresAt });
    } else if (nx) {
      await this.client.set(serializedKey, value_, { NX: true });
    } else {
      await this.client.set(serializedKey, value_);
    }
  }

  async delete(key: K): Promise<boolean> {
    return ((await this.client.del(this.serializeKey(key))) as number) > 0;
  }

  async clear(): Promise<void> {
    await this.client.flushAll();
  }

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
    if (keys.length === 0) {
      return new Map();
    }

    const serializedKeys = keys.map((key) => this.serializeKey(key));
    const values = await this.client.mGet(serializedKeys);

    const results = new Map<K, V>();

    for (let i = 0; i < keys.length; i++) {
      const data = values[i];
      if (data !== null) {
        results.set(keys[i], this.serializer.deserialize(new Uint8Array(Buffer.from(data))));
      }
    }

    return results;
  }

  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    const pairs: [string, string][] = [];

    for (const [key, value] of entries) {
      const raw = this.serializer.serialize(value);
      pairs.push([this.serializeKey(key), Buffer.from(raw).toString()]);
    }

    await this.client.mSet(pairs);

    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());

    if (expiresAt !== undefined) {
      const multi = this.client.multi();
      for (const [key] of pairs) {
        multi.pExpireAt(key, expiresAt);
      }
      await multi.exec();
    }
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const serializedKeys = keys.map((key) => this.serializeKey(key));
    return (await this.client.del(serializedKeys)) as number;
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
