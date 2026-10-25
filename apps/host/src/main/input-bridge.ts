import { keyCodeToVk, type InputMessage } from '@pilotpane/protocol';
import type { InputInjector } from './platform/input-injector.js';

/** A viewer cannot flood the helper: moves above this rate are dropped. */
export const MAX_MOVES_PER_SECOND = 250;

/**
 * Turns the viewer's mouse and key messages into InputCommands for the injector.
 * Buttons, keys and wheel always go through (dropping a "button up" or "key up" would leave it
 * stuck); only a flood of moves is thinned out.
 */
export class InputBridge {
  private windowStart = 0;
  private moves = 0;

  constructor(
    private readonly injector: InputInjector,
    private readonly now: () => number = Date.now
  ) {}

  get available(): boolean {
    return this.injector.available;
  }

  handle(msg: InputMessage): void {
    switch (msg.type) {
      case 'mouse-move':
        if (this.allowMove()) this.injector.inject({ kind: 'move', x: msg.x, y: msg.y });
        return;
      case 'mouse-button':
        this.injector.inject({ kind: 'button', button: msg.button, down: msg.down });
        return;
      case 'mouse-wheel':
        this.injector.inject({ kind: 'wheel', dx: msg.dx, dy: msg.dy });
        return;
      case 'key': {
        const vk = keyCodeToVk(msg.code);
        if (vk !== null) this.injector.inject({ kind: 'key', vk, down: msg.down });
        return;
      }
    }
  }

  /** Control ended (viewer left or the connection dropped): let go of anything held. */
  end(): void {
    this.injector.releaseAll();
  }

  private allowMove(): boolean {
    const t = this.now();
    if (t - this.windowStart >= 1000) {
      this.windowStart = t;
      this.moves = 0;
    }
    this.moves += 1;
    return this.moves <= MAX_MOVES_PER_SECOND;
  }
}
