import type { CacheExpiration } from "./CacheExpiration";

/**
 * Options that control how a value is written to the cache.
 */
export interface CacheSetOptions {
  /**
   * The expiration policy for the cached entry.
   *
   * This determines when the entry becomes expired and is no longer
   * considered valid. The exact behavior depends on the configured
   * {@link CacheExpiration} strategy.
   */
  expiration?: CacheExpiration;

  /**
   * Whether an existing value should be replaced if the key already exists.
   *
   * @defaultValue true
   */
  overwrite?: boolean;

  /**
   * Optional tags associated with the cached entry.
   *
   * Tags can be used to invalidate or remove groups of related entries
   * without knowing their individual keys.
   */
  tags?: readonly string[];

  /**
   * Arbitrary implementation-specific metadata associated with the entry.
   *
   * Cache implementations may use this information for custom behaviors
   * such as prioritization, diagnostics, or application-specific features.
   */
  metadata?: Readonly<Record<string, unknown>>;

  /**
   * Optional region name for region-specific cache partitioning.
   */
  region?: string;
}

/**
 * Options that control how a cache entry is retrieved.
 */
export interface CacheGetOptions {
  /**
   * Optional region name for region-specific cache partitioning.
   */
  region?: string;
}

/**
 * Options that control the behavior of loading a value into the cache.
 *
 * In addition to the standard cache write options inherited from
 * {@link CacheSetOptions}, these options determine how the cache
 * should behave when retrieving or refreshing entries.
 */
export interface CacheLoadOptions extends CacheGetOptions, CacheSetOptions {
  /**
   * Whether to bypass the cache and always invoke the loader.
   *
   * When set to `true`, the cache ignores any existing cached value,
   * executes the loader, and stores the newly loaded value using the
   * provided cache set options.
   *
   * @defaultValue false
   */
  forceRefresh?: boolean;
}
