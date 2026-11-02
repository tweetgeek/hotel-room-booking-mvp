export const APP_LOGGER = Symbol('AppLogger');

export interface AppLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
