export const READ_MODEL_CACHE = Symbol('ReadModelCache');

export interface ReadModelCache {
  /** Cache-aside read: hit, or one loader run per key protected by a lock (ADR-005). */
  getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  invalidate(keys: readonly string[]): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}
