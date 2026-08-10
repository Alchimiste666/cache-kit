import type { CacheSerializer } from "../types/CacheSerializer";

/**
 * Serializes values to and from JSON-encoded UTF-8 byte arrays.
 *
 * @typeParam T - The type of value to serialize.
 */
export class JsonSerializer<T> implements CacheSerializer<T> {
  private readonly encoder: InstanceType<typeof TextEncoder>;
  private readonly decoder: InstanceType<typeof TextDecoder>;

  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  serialize(value: T): Uint8Array {
    return this.encoder.encode(JSON.stringify(value));
  }

  deserialize(data: Uint8Array): T {
    return JSON.parse(this.decoder.decode(data)) as T;
  }
}
