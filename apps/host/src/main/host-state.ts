/**
 * Holds the host's state and tells subscribers when it changes. No Electron
 * here, so it runs under plain `node --test`.
 */
import type { HostState } from '@pilotpane/protocol';

export type StateListener = (state: HostState) => void;

export class HostStateStore {
  private readonly listeners = new Set<StateListener>();

  constructor(private current: HostState) {}

  get state(): HostState {
    return this.current;
  }

  /** Merges `partial` into the state and notifies every subscriber. */
  patch(partial: Partial<HostState>): void {
    this.current = { ...this.current, ...partial };
    for (const listener of this.listeners) listener(this.current);
  }

  /** Returns a function that removes the subscription. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
