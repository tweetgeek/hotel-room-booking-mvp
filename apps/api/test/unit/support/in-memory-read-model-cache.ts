import type { ReadModelCache } from '../../../src/booking/application/ports/read-model-cache';

interface Entry {
  value: unknown;
  ttlSeconds: number;
}

export class InMemoryReadModelCache implements ReadModelCache {
  readonly entries = new Map<string, Entry>();
  readonly loads: string[] = [];

  async getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit) return hit.value as T;
    this.loads.push(key);
    const value = await loader();
    this.entries.set(key, { value, ttlSeconds });
    return value;
  }

  async invalidate(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.entries.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    for (const key of [...this.entries.keys()]) {
      if (regex.test(key)) this.entries.delete(key);
    }
  }

  ttlOf(key: string): number | undefined {
    return this.entries.get(key)?.ttlSeconds;
  }
}
