/** ISO UTC instant -> `YYYY-MM-DD HH:MM:SS.mmm`, the shape DATETIME(3) columns take in a UTC session. */
export function toSqlDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '');
}

/** The reverse mapping for values Knex returns with `dateStrings: true`. */
export function fromSqlDateTime(sql: string): string {
  return `${sql.replace(' ', 'T')}Z`;
}
