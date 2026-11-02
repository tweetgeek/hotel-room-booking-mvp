import type { Tx, UnitOfWork } from '../../../src/shared/application/ports/unit-of-work';

/**
 * Adapters validate immediately but stage their writes on the transaction;
 * the writes run only when the work completes, mirroring commit/rollback.
 */
export class InMemoryTx {
  private readonly writes: Array<() => void> = [];

  stage(write: () => void): void {
    this.writes.push(write);
  }

  commit(): void {
    for (const write of this.writes) write();
  }
}

export function asInMemoryTx(tx: Tx): InMemoryTx {
  if (!(tx instanceof InMemoryTx)) throw new Error('Expected an InMemoryTx');
  return tx;
}

export class InMemoryUnitOfWork implements UnitOfWork {
  async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const tx = new InMemoryTx();
    const result = await work(tx);
    tx.commit();
    return result;
  }
}
