import { desktopCapturer, screen, session } from 'electron';
import type { CaptureSource, ScreenCapturer } from './screen-capturer.js';

export class ElectronScreenCapturer implements ScreenCapturer {
  async pickPrimary(): Promise<CaptureSource | null> {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const primaryId = String(screen.getPrimaryDisplay().id);
    const found = sources.find((s) => s.display_id === primaryId) ?? sources[0];
    return found ? { id: found.id, name: found.name } : null;
  }

  /** Answers getDisplayMedia() from the engine (the fallback capture route). */
  serveDisplayRequests(isAllowed: (frameUrl: string) => boolean): void {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      if (!isAllowed(request.frame?.url ?? '')) {
        callback({});
        return;
      }
      this.pickPrimary()
        .then((source) => callback(source ? { video: source } : {}))
        .catch(() => callback({}));
    });
  }
}
