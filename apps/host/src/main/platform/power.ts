/** Tells the host when the computer is about to sleep and when it wakes. */
export interface PowerEvents {
  onSuspend(cb: () => void): void;
  onResume(cb: () => void): void;
}

/** For hosts without power events and for tests. */
export class NullPowerEvents implements PowerEvents {
  onSuspend(): void {}
  onResume(): void {}
}
