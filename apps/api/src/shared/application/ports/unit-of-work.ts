export const UNIT_OF_WORK = Symbol('UnitOfWork');

/** Opaque transaction handle passed to every adapter that must commit together. */
export type Tx = object;

export interface UnitOfWork {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
