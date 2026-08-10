export interface CacheSerializer<V> {
  serialize(value: V): Uint8Array;

  deserialize(data: Uint8Array): V;
}
