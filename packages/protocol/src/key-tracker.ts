import { keyCodeToVk } from './keys.js';
import type { InputMessage } from './input.js';

/**
 * Decides which key events the viewer forwards and remembers which keys are
 * held, so they can all be lifted when control ends. Pure: no DOM.
 */
export class KeyTracker {
  private readonly held = new Set<string>();

  /** The message to send for a key event, or null to ignore it. */
  press(code: string, down: boolean, repeat: boolean): InputMessage | null {
    // Esc is how the viewer lets go of control, so it is never typed on the host.
    if (code === 'Escape' || keyCodeToVk(code) === null) return null;
    if (down) {
      // The host's own OS repeats a held key; sending repeats would only flood the channel.
      if (repeat || this.held.has(code)) return null;
      this.held.add(code);
      return { type: 'key', code, down: true };
    }
    // A key up for something we never sent down must not reach the host.
    return this.held.delete(code) ? { type: 'key', code, down: false } : null;
  }

  /** Key-up messages for everything still held; empties the set. */
  releaseAll(): InputMessage[] {
    const out: InputMessage[] = [...this.held].map((code) => ({ type: 'key', code, down: false }));
    this.held.clear();
    return out;
  }
}
