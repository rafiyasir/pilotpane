/**
 * Sends the viewer's key presses to the host while it is being controlled.
 * Keys are physical (KeyboardEvent.code); the host's layout makes the characters.
 * Browser shortcuts such as Alt+Tab or Ctrl+W cannot be caught on plain HTTP (spec 014).
 */
import type { InputMessage } from '/protocol/index.js';
import { KeyTracker } from '/protocol/index.js';

export interface KeyboardHooks {
  send(msg: InputMessage): boolean;
  /** True only while the viewer is controlling the host. */
  isControlling(): boolean;
}

export class KeyboardController {
  private readonly tracker = new KeyTracker();

  constructor(private readonly hooks: KeyboardHooks) {
    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.release();
    });
  }

  /** Lifts every held key on the host. Safe to call at any time. */
  release(): void {
    for (const msg of this.tracker.releaseAll()) this.hooks.send(msg);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // The toolbar's own Ctrl+Alt+Shift chord stays with the viewer.
    if (e.ctrlKey && e.altKey && e.shiftKey) return;
    if (!this.hooks.isControlling()) {
      // Control ended while keys were down: lift them.
      this.release();
      return;
    }
    // A toolbar button that kept focus would treat Enter or Space as a click
    // (Enter on "Exit fullscreen" leaves fullscreen). Typing belongs to the host.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    if (e.code !== 'Escape') e.preventDefault();
    const msg = this.tracker.press(e.code, down, e.repeat);
    if (msg) this.hooks.send(msg);
  }
}
