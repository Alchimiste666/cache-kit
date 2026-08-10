import {
  type BatchCacheStore,
  type CacheSerializer,
  type CacheSetOptions,
  JsonSerializer,
  resolveExpiresAt,
} from "@alchemist-software/cache-kit-core";
import Valkey, { type Redis } from "iovalkey";

/**
 * Configuration options for {@link ValkeyCacheStore}.
 *
 * @typeParam V - The cache value type.
 */
export interface ValkeyCacheOptions<V> {
  /** Existing Valkey (iovalkey) client instance. If omitted, a default client connecting to localhost:6379 is created. */
  client?: Redis;
  /** Serializer for converting values to and from byte arrays. Defaults to JSON serialization. */
  serializer?: CacheSerializer<V>;
}

/**
 * Cache store backed by Valkey (Redis-compatible), supporting batch operations via MGET/MSET.
 *
 * Values are serialized before storage using a pluggable {@link CacheSerializer}.
 *
 * @typeParam K - The cache key type (converted to string via {@link String}).
 * @typeParam V - The cache value type.
 */
export class ValkeyCacheStore<K, V> implements BatchCacheStore<K, V> {
  private readonly client: Redis;
  private readonly serializer: CacheSerializer<V>;

  /**
   * @param options - Valkey client and serializer configuration.
   */
  constructor(options: ValkeyCacheOptions<V>) {
    const { client, serializer } = options;

    this.client = client ?? new Valkey(6379, "localhost");

    this.serializer = serializer ?? new JsonSerializer();

    this.client.on("error", (error: unknown) => {
      console.error("Valkey error:", error);
    });
  }

  async has(key: K): Promise<boolean> {
    return (await this.client.exists(this.serializeKey(key))) > 0;
  }

  async get(key: K): Promise<V | undefined> {
    const data = await this.client.getBuffer(this.serializeKey(key));

    if (data == null) {
      return undefined;
    }

    return this.serializer.deserialize(new Uint8Array(data));
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    const valkeyKey = this.serializeKey(key);
    const buffer = Buffer.from(this.serializer.serialize(value));

    const overwrite = options?.overwrite !== false;

    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());

    if (expiresAt === undefined) {
      if (overwrite) {
        await this.client.set(valkeyKey, buffer);
      } else {
        await this.client.set(valkeyKey, buffer, "NX");
      }

      return;
    }

    if (overwrite) {
      await this.client.set(valkeyKey, buffer, "PXAT", expiresAt);
    } else {
      await this.client.set(valkeyKey, buffer, "PXAT", expiresAt, "NX");
    }
  }

  async delete(key: K): Promise<boolean> {
    return (await this.client.del(this.serializeKey(key))) > 0;
  }

  async clear(): Promise<void> {
    await this.client.flushall();
  }

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
    if (keys.length === 0) {
      return new Map();
    }

    const serializedKeys = keys.map((key) => this.serializeKey(key));
    const values = await this.client.mgetBuffer(...serializedKeys);

    const results = new Map<K, V>();

    for (let i = 0; i < keys.length; i++) {
      const data = values[i];
      if (data != null) {
        results.set(keys[i], this.serializer.deserialize(new Uint8Array(data)));
      }
    }

    return results;
  }

  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    const pairs: (string | Buffer)[] = [];

    for (const [key, value] of entries) {
      pairs.push(this.serializeKey(key), Buffer.from(this.serializer.serialize(value)));
    }

    await this.client.mset(...(pairs as [string, string | Buffer, ...Array<string | Buffer>]));

    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());

    if (expiresAt !== undefined) {
      const pipeline = this.client.pipeline();
      for (const [key] of entries) {
        pipeline.pexpireat(this.serializeKey(key), expiresAt);
      }
      await pipeline.exec();
    }
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const serializedKeys = keys.map((key) => this.serializeKey(key));
    return await this.client.del(...serializedKeys);
  }

  protected serializeKey(key: K): string {
    return String(key);
  }

  async connect(): Promise<void> {
    if (this.client.status === "ready") {
      return;
    }

    if (this.client.status === "wait" || this.client.status === "close") {
      await this.client.connect();
      return;
    }

    if (this.client.status === "connecting" || this.client.status === "connect") {
      await new Promise<void>((resolve, reject) => {
        this.client.once("ready", resolve);
        this.client.once("error", reject);
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.status === "end" || this.client.status === "close") {
      return;
    }

    await this.client.quit();
  }
}
