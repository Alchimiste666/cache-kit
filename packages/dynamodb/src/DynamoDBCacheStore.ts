import {
  type BatchCacheStore,
  type CacheSerializer,
  type CacheSetOptions,
  JsonSerializer,
  resolveExpiresAt,
} from "@alchemist-software/cache-kit-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

/** Maximum items per DynamoDB BatchWriteItem request. */
const BATCH_WRITE_LIMIT = 25;

/** Maximum keys per DynamoDB BatchGetItem request. */
const BATCH_GET_LIMIT = 100;

/**
 * Configuration options for {@link DynamoDBCacheStore}.
 *
 * @typeParam V - The cache value type.
 */
export interface DynamoDBCacheStoreOptions<V> {
  /**
   * Pre-configured DynamoDB client instance.
   *
   * To use DAX, pass a client configured with the DAX endpoint — the store
   * is agnostic to whether the underlying client is backed by DynamoDB or DAX.
   *
   * If omitted, a default client using the AWS SDK default credential chain is created.
   */
  client?: DynamoDBClient;

  /** DynamoDB table name. */
  tableName: string;

  /**
   * Partition key attribute name.
   * @default "pk"
   */
  partitionKey?: string;

  /**
   * Value attribute name.
   * @default "value"
   */
  valueAttribute?: string;

  /**
   * TTL attribute name. Must match the TTL attribute configured on the DynamoDB table.
   * @default "expiresAt"
   */
  ttlAttribute?: string;

  /**
   * Serializer for converting values to and from byte arrays.
   * @default JsonSerializer
   */
  serializer?: CacheSerializer<V>;

  /**
   * Whether to use strongly consistent reads.
   * Ignored when using DAX (DAX manages its own consistency model).
   * @default false
   */
  consistentRead?: boolean;
}

/**
 * Cache store backed by Amazon DynamoDB, supporting batch operations.
 *
 * Values are serialized before storage using a pluggable {@link CacheSerializer}.
 * Expiration is handled via DynamoDB TTL — items are marked with an `expiresAt`
 * epoch-seconds attribute and filtered on read to ensure strict consistency.
 *
 * To use DAX acceleration, simply provide a {@link DynamoDBClient} configured
 * with your DAX cluster endpoint. The store is transparent to whether the
 * underlying transport is direct DynamoDB or DAX.
 *
 * @typeParam K - The cache key type (converted to string via {@link String}).
 * @typeParam V - The cache value type.
 */
export class DynamoDBCacheStore<K, V> implements BatchCacheStore<K, V> {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly rawClient: DynamoDBClient;
  private readonly serializer: CacheSerializer<V>;
  private readonly tableName: string;
  private readonly partitionKey: string;
  private readonly valueAttribute: string;
  private readonly ttlAttribute: string;
  private readonly consistentRead: boolean;

  constructor(options: DynamoDBCacheStoreOptions<V>) {
    const {
      client,
      tableName,
      partitionKey = "pk",
      valueAttribute = "value",
      ttlAttribute = "expiresAt",
      serializer,
      consistentRead = false,
    } = options;

    this.rawClient = client ?? new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(this.rawClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.serializer = serializer ?? new JsonSerializer();
    this.tableName = tableName;
    this.partitionKey = partitionKey;
    this.valueAttribute = valueAttribute;
    this.ttlAttribute = ttlAttribute;
    this.consistentRead = consistentRead;
  }

  protected serializeKey(key: K): string {
    return String(key);
  }

  /** Returns true if the item exists and is not expired. */
  async has(key: K): Promise<boolean> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [this.partitionKey]: this.serializeKey(key) },
        ProjectionExpression: this.ttlAttribute,
        ConsistentRead: this.consistentRead,
      }),
    );

    if (!result.Item) {
      return false;
    }

    return !this.isExpired(result.Item);
  }

  async get(key: K): Promise<V | undefined> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [this.partitionKey]: this.serializeKey(key) },
        ConsistentRead: this.consistentRead,
      }),
    );

    if (!result.Item || this.isExpired(result.Item)) {
      return undefined;
    }

    const raw = result.Item[this.valueAttribute] as Uint8Array;
    return this.serializer.deserialize(raw);
  }

  async set(key: K, value: V, options?: CacheSetOptions): Promise<void> {
    const serializedKey = this.serializeKey(key);
    const serializedValue = this.serializer.serialize(value);
    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());

    const item: Record<string, unknown> = {
      [this.partitionKey]: serializedKey,
      [this.valueAttribute]: serializedValue,
    };

    if (expiresAt !== undefined) {
      // DynamoDB TTL uses epoch seconds
      item[this.ttlAttribute] = Math.ceil(expiresAt / 1000);
    }

    const conditionExpression =
      options?.overwrite === false ? `attribute_not_exists(${this.partitionKey})` : undefined;

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: conditionExpression,
        }),
      );
    } catch (error: unknown) {
      // ConditionalCheckFailedException means key already exists — expected for overwrite=false
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        return;
      }
      throw error;
    }
  }

  async delete(key: K): Promise<boolean> {
    const result = await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { [this.partitionKey]: this.serializeKey(key) },
        ReturnValues: "ALL_OLD",
      }),
    );

    return result.Attributes !== undefined;
  }

  /**
   * Removes all items from the table via scan + batch delete.
   *
   * Note: This is an expensive operation for large tables.
   * Consider using a separate table per cache region or implementing
   * a key-prefix strategy if frequent clears are needed.
   */
  async clear(): Promise<void> {
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const scan = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: this.partitionKey,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      const items = scan.Items ?? [];
      lastEvaluatedKey = scan.LastEvaluatedKey;

      // Batch delete in chunks of 25
      for (let i = 0; i < items.length; i += BATCH_WRITE_LIMIT) {
        const chunk = items.slice(i, i + BATCH_WRITE_LIMIT);
        await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: chunk.map((item) => ({
                DeleteRequest: { Key: { [this.partitionKey]: item[this.partitionKey] } },
              })),
            },
          }),
        );
      }
    } while (lastEvaluatedKey);
  }

  async getMany(keys: readonly K[]): Promise<Map<K, V>> {
    if (keys.length === 0) {
      return new Map();
    }

    const results = new Map<K, V>();
    const keyMap = new Map<string, K>();

    for (const key of keys) {
      keyMap.set(this.serializeKey(key), key);
    }

    const serializedKeys = [...keyMap.keys()];

    // Process in chunks of BATCH_GET_LIMIT
    for (let i = 0; i < serializedKeys.length; i += BATCH_GET_LIMIT) {
      const chunk = serializedKeys.slice(i, i + BATCH_GET_LIMIT);

      let unprocessedKeys: Record<string, unknown>[] | undefined = chunk.map((k) => ({
        [this.partitionKey]: k,
      }));

      // Retry unprocessed keys (DynamoDB may return partial results)
      while (unprocessedKeys && unprocessedKeys.length > 0) {
        const response = await this.docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [this.tableName]: {
                Keys: unprocessedKeys,
                ConsistentRead: this.consistentRead,
              },
            },
          }),
        );

        const items = response.Responses?.[this.tableName] ?? [];

        for (const item of items) {
          if (this.isExpired(item)) {
            continue;
          }

          const pk = item[this.partitionKey] as string;
          const originalKey = keyMap.get(pk);

          if (originalKey !== undefined) {
            const raw = item[this.valueAttribute] as Uint8Array;
            results.set(originalKey, this.serializer.deserialize(raw));
          }
        }

        const unprocessed = response.UnprocessedKeys?.[this.tableName]?.Keys;
        unprocessedKeys = unprocessed as Record<string, unknown>[] | undefined;
      }
    }

    return results;
  }

  async setMany(entries: ReadonlyMap<K, V>, options?: CacheSetOptions): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    const expiresAt = resolveExpiresAt(options?.expiration, Date.now());
    const items: Record<string, unknown>[] = [];

    for (const [key, value] of entries) {
      const item: Record<string, unknown> = {
        [this.partitionKey]: this.serializeKey(key),
        [this.valueAttribute]: this.serializer.serialize(value),
      };

      if (expiresAt !== undefined) {
        item[this.ttlAttribute] = Math.ceil(expiresAt / 1000);
      }

      items.push(item);
    }

    // Process in chunks of BATCH_WRITE_LIMIT
    for (let i = 0; i < items.length; i += BATCH_WRITE_LIMIT) {
      const chunk = items.slice(i, i + BATCH_WRITE_LIMIT);

      let unprocessedItems: Record<string, unknown>[] | undefined = chunk;

      while (unprocessedItems && unprocessedItems.length > 0) {
        const currentBatch = unprocessedItems;
        const response = await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: currentBatch.map((item) => ({
                PutRequest: { Item: item },
              })),
            },
          }),
        );

        const remaining = response.UnprocessedItems?.[this.tableName] as
          | Array<{ PutRequest?: { Item?: Record<string, unknown> } }>
          | undefined;

        if (remaining && remaining.length > 0) {
          unprocessedItems = remaining.map(
            (req) => req.PutRequest!.Item as Record<string, unknown>,
          );
        } else {
          unprocessedItems = undefined;
        }
      }
    }
  }

  async deleteMany(keys: readonly K[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    const serializedKeys = keys.map((key) => this.serializeKey(key));

    for (let i = 0; i < serializedKeys.length; i += BATCH_WRITE_LIMIT) {
      const chunk = serializedKeys.slice(i, i + BATCH_WRITE_LIMIT);

      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((key) => ({
              DeleteRequest: { Key: { [this.partitionKey]: key } },
            })),
          },
        }),
      );

      // BatchWriteItem doesn't return info about which deletes succeeded,
      // so we count the requested keys (best effort)
      deletedCount += chunk.length;
    }

    return deletedCount;
  }

  async connect(): Promise<void> {
    // DynamoDB client is ready to use immediately — no connection step needed.
    // This method exists to satisfy the CacheStore interface contract.
  }

  async disconnect(): Promise<void> {
    this.rawClient.destroy();
  }

  /** Checks whether an item's TTL has passed. */
  private isExpired(item: Record<string, unknown>): boolean {
    const ttl = item[this.ttlAttribute] as number | undefined;

    if (ttl === undefined) {
      return false;
    }

    // TTL is stored in epoch seconds
    return Date.now() >= ttl * 1000;
  }
}
