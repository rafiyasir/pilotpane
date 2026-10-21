/** Finds the screen to capture. A macOS or Linux host replaces only the implementation. */
export interface CaptureSource {
  id: string;
  name: string;
}

export interface ScreenCapturer {
  /** The primary screen, or null when there is none (multi-monitor choice comes later). */
  pickPrimary(): Promise<CaptureSource | null>;
  /** Answers the capture engine's own screen requests when `isAllowed(frameUrl)` is true. */
  serveDisplayRequests(isAllowed: (frameUrl: string) => boolean): void;
}
