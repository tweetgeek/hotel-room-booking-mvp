import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import type { Tx, UnitOfWork } from '../../application/ports/unit-of-work';
import { KNEX } from './knex.token';

// Both codes mean "roll back and run the transaction again" in MariaDB's documentation
const RETRYABLE_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_CHECKREAD']);
const MAX_ATTEMPTS = 5;

/**
 * InnoDB may choose one of several concurrent inserters as a deadlock victim and roll it back, and
 * MariaDB's snapshot isolation refuses updates of rows changed after the snapshot; the documented
 * remedy for both is to run the whole transaction again (ADR-003, ADR-004). Work passed here must
 * therefore be repeatable: it only talks to the database through `tx`.
 */
@Injectable()
export class KnexUnitOfWork implements UnitOfWork {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.db.transaction((trx) => work(trx));
      } catch (error) {
        if (isRetryable(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }
}

function isRetryable(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
  return code !== undefined && RETRYABLE_CODES.has(code);
}

export function asKnexTx(tx: Tx): Knex.Transaction {
  return tx as Knex.Transaction;
}
