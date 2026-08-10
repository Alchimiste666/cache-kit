import { JsonSerializer } from "./JsonSerializer";

describe("JsonSerializer", () => {
  const serializer = new JsonSerializer<{ name: string; count: number }>();

  it("should serialize and deserialize an object", () => {
    const value = { name: "test", count: 5 };
    const bytes = serializer.serialize(value);
    const result = serializer.deserialize(bytes);
    expect(result).toEqual(value);
  });

  it("should produce valid UTF-8 bytes", () => {
    const value = { name: "hello", count: 1 };
    const bytes = serializer.serialize(value);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("should handle unicode characters", () => {
    const s = new JsonSerializer<string>();
    const value = "héllo wörld 🌍";
    const bytes = s.serialize(value);
    expect(s.deserialize(bytes)).toBe(value);
  });

  it("should handle null values", () => {
    const s = new JsonSerializer<null>();
    const bytes = s.serialize(null);
    expect(s.deserialize(bytes)).toBeNull();
  });

  it("should handle arrays", () => {
    const s = new JsonSerializer<number[]>();
    const value = [1, 2, 3];
    const bytes = s.serialize(value);
    expect(s.deserialize(bytes)).toEqual(value);
  });

  it("should handle nested objects", () => {
    const s = new JsonSerializer<{ a: { b: number } }>();
    const value = { a: { b: 42 } };
    const bytes = s.serialize(value);
    expect(s.deserialize(bytes)).toEqual(value);
  });
});
