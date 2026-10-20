import type { HostMessage, ViewerMessage } from '/protocol/index.js';
import { WS_PATH, parseHostMessage } from '/protocol/index.js';

export interface SocketHandlers {
  onOpen(): void;
  onMessage(msg: HostMessage): void;
  /** wasOpen is false when the connection never opened at all. */
  onClose(wasOpen: boolean): void;
}

/** A thin wrapper around the browser WebSocket that only speaks our protocol. */
export class HostSocket {
  private ws: WebSocket | null = null;

  constructor(private readonly handlers: SocketHandlers) {}

  connect(): void {
    this.dispose();
    const ws = new WebSocket(`ws://${location.host}${WS_PATH}`);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.handlers.onOpen();
    };
    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      const msg = parseHostMessage(e.data);
      if (msg) this.handlers.onMessage(msg);
      else console.warn('[pilotpane] ignored a bad message from the host');
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.handlers.onClose(opened);
    };
    this.ws = ws;
  }

  send(msg: ViewerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Closes without triggering the onClose handler. */
  dispose(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.close();
    }
  }
}
