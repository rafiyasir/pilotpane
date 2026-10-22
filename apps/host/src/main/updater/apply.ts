/**
 * Hands a verified installer to Windows and quits. The silent installer
 * refuses to run while PilotPane is open (exit code 2), and it does not start
 * the app, so a small detached cmd script waits a few seconds, runs the
 * installer, then starts PilotPane again. If the installer fails, the old
 * version simply starts again.
 */

export interface ApplyOptions {
  installerPath: string;
  /** The exe to start once the installer is done. */
  relaunchPath: string;
  /** Starts a detached process. Injected so tests never run an installer. */
  spawn(command: string, args: string[]): void;
  quit(): void;
}

/** Characters that would change what cmd.exe runs. Our own paths never have them. */
const UNSAFE_IN_CMD = /["%^&|<>\r\n]/;

export function applyUpdate(o: ApplyOptions): void {
  if (UNSAFE_IN_CMD.test(o.installerPath) || UNSAFE_IN_CMD.test(o.relaunchPath)) {
    throw new Error('install path has characters that cannot be used');
  }
  const script = `ping -n 4 127.0.0.1 >nul & "${o.installerPath}" /S & start "" "${o.relaunchPath}"`;
  // With /s, cmd strips the outer quotes and runs the rest as written.
  o.spawn('cmd.exe', ['/d', '/s', '/c', `"${script}"`]);
  o.quit();
}
