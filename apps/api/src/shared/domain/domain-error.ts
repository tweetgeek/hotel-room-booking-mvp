export type ErrorExtras = Record<string, string | number | boolean | null | undefined | object>;

/**
 * Base class for every error the API answers with a stable `code`.
 * The HTTP status and the English developer message travel with the error so the global filter
 * needs no mapping table (ADR-009); the UI translates `code` into Polish.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
    readonly extras: ErrorExtras = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidValueError extends DomainError {
  constructor(message: string) {
    super('INVALID_VALUE', 422, message);
  }
}
