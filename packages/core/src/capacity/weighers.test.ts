import type { CacheEntry } from "../types/CacheEntry";
import { EntryCountWeigher, FunctionWeigher, JsonSizeWeigher } from "./weighers";

function entry<V>(value: V): CacheEntry<string, V> {
  return {
    key: "key",
    value,
    createdAt: 0,
    updatedAt: 0,
    lastAccessedAt: 0,
  };
}

describe("weighers", () => {
  describe("EntryCountWeigher", () => {
    it("should weigh every entry as 1", () => {
      const weigher = new EntryCountWeigher<string, unknown>();

      expect(weigher.weigh()).toBe(1);
    });
  });

  describe("JsonSizeWeigher", () => {
    it("should return the UTF-8 byte length of the serialized value", () => {
      const weigher = new JsonSizeWeigher<string, { name: string }>();

      const value = { name: "abc" };
      const expected = Buffer.byteLength(JSON.stringify(value), "utf8");

      expect(weigher.weigh(entry(value))).toBe(expected);
    });

    it("should count multi-byte characters by their encoded size", () => {
      const weigher = new JsonSizeWeigher<string, string>();

      const asciiWeight = weigher.weigh(entry("ab"));
      const multiByteWeight = weigher.weigh(entry("é"));

      // A single accented character encodes to more bytes than it has characters.
      expect(multiByteWeight).toBeGreaterThan("é".length);
      expect(asciiWeight).toBeGreaterThan(0);
    });
  });

  describe("FunctionWeigher", () => {
    it("should delegate to the provided function", () => {
      const weigher = new FunctionWeigher<string, number[]>((e) => e.value.length);

      expect(weigher.weigh(entry([1, 2, 3]))).toBe(3);
    });
  });
});
