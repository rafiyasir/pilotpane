/** Keeps the host display from sleeping while a viewer is watching. */
export interface KeepAwake {
  /** Safe to call more than once. */
  start(): void;
  stop(): void;
}
