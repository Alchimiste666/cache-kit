import { CacheExpirationType, resolveExpiresAt } from "./CacheExpiration";

describe("resolveExpiresAt", () => {
  const now = 1000;

  it("should return undefined for Never expiration", () => {
    expect(resolveExpiresAt({ type: CacheExpirationType.Never }, now)).toBeUndefined();
  });

  it("should return undefined when expiration is undefined", () => {
    expect(resolveExpiresAt(undefined, now)).toBeUndefined();
  });

  it("should return the timestamp for Timestamp expiration", () => {
    expect(resolveExpiresAt({ type: CacheExpirationType.Timestamp, timestamp: 5000 }, now)).toBe(
      5000,
    );
  });

  it("should return now + milliSeconds for TimeToLive expiration", () => {
    expect(resolveExpiresAt({ type: CacheExpirationType.TimeToLive, milliSeconds: 300 }, now)).toBe(
      1300,
    );
  });

  it("should delegate to policy for Custom expiration", () => {
    const policy = { getExpiresAt: (n: number) => n + 999 };
    expect(resolveExpiresAt({ type: CacheExpirationType.Custom, policy }, now)).toBe(1999);
  });

  it("should return undefined when custom policy returns undefined", () => {
    const policy = { getExpiresAt: () => undefined };
    expect(resolveExpiresAt({ type: CacheExpirationType.Custom, policy }, now)).toBeUndefined();
  });
});
