export enum CacheExpirationType {
  Never = "never",
  Timestamp = "timestamp",
  TimeToLive = "time-to-live",
  Custom = "custom",
}

/**
 * Defines a custom expiration policy for a cache entry.
 *
 * A policy resolves the current time into an absolute expiry timestamp,
 * allowing behaviors such as jitter, sliding windows, schedule-aligned
 * expiry, or any application-specific rule without changing the cache stores.
 */
export interface CacheExpirationPolicy {
  /**
   * Resolves the absolute expiry time for an entry being written.
   *
   * @param now - The current time in milliseconds since the Unix epoch.
   * @returns The absolute expiry time (ms since epoch), or `undefined` if the
   *          entry should never expire.
   */
  getExpiresAt(now: number): number | undefined;
}

export type CacheExpiration =
  | { type: CacheExpirationType.Never }
  | { type: CacheExpirationType.Timestamp; timestamp: number }
  | { type: CacheExpirationType.TimeToLive; milliSeconds: number }
  | { type: CacheExpirationType.Custom; policy: CacheExpirationPolicy };

/**
 * Resolves an expiration configuration into an absolute expiry timestamp.
 *
 * This centralizes the interpretation of every {@link CacheExpiration} variant
 * so that individual cache stores do not need to re-implement the logic. Stores
 * that support only absolute expiry (in-memory) or native TTL commands (Redis,
 * Valkey) can both rely on the returned timestamp.
 *
 * @param expiration - The expiration configuration, if any.
 * @param now - The current time in milliseconds since the Unix epoch.
 * @returns The absolute expiry time (ms since epoch), or `undefined` when the
 *          entry should never expire.
 */
export function resolveExpiresAt(
  expiration: CacheExpiration | undefined,
  now: number,
): number | undefined {
  switch (expiration?.type) {
    case CacheExpirationType.Timestamp:
      return expiration.timestamp;

    case CacheExpirationType.TimeToLive:
      return now + expiration.milliSeconds;

    case CacheExpirationType.Custom:
      return expiration.policy.getExpiresAt(now);

    default:
      return undefined;
  }
}
