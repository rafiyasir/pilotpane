/**
 * The update state machine: check, download, verify, ready. It never starts on
 * its own; every step begins with a call from a user click. No Electron here:
 * network, disk and time come in through the options so tests use fakes.
 */
import {
  MAX_MANIFEST_BYTES,
  parseUpdateManifest,
  type UpdateFailure,
  type UpdateManifest,
  type UpdateState
} from '@pilotpane/protocol';
import { createLogger } from '../log.js';
import { compareVersions, verifyManifest, type FileFacts } from './verify.js';

const log = createLogger('updater');

export interface UpdaterOptions {
  currentVersion: string;
  manifestUrl: string;
  /** Ed25519 public key, PEM. */
  publicKey: string;
  /** Folder for the downloaded installer. */
  downloadDir: string;
  fetchText(url: string, maxBytes: number): Promise<string>;
  /** Saves `url` to `dest`. Throws if the body is longer than `maxBytes`. */
  download(url: string, dest: string, maxBytes: number, onProgress: (receivedBytes: number) => void): Promise<void>;
  inspect(path: string): Promise<FileFacts>;
  remove(path: string): Promise<void>;
  onState(state: UpdateState): void;
}

export class Updater {
  private current: UpdateState = { phase: 'idle' };
  private manifest: UpdateManifest | null = null;
  private installer: string | null = null;

  constructor(private readonly opts: UpdaterOptions) {}

  get state(): UpdateState {
    return this.current;
  }

  /** Path of the verified installer, once the state is `ready`. */
  get readyInstaller(): string | null {
    return this.current.phase === 'ready' ? this.installer : null;
  }

  private set(state: UpdateState): void {
    this.current = state;
    this.opts.onState(state);
  }

  private fail(reason: UpdateFailure): void {
    this.set({ phase: 'failed', reason });
  }

  /** Marks a failure that happened outside the updater, such as the installer not starting. */
  markFailed(reason: UpdateFailure): void {
    this.fail(reason);
  }

  private get busy(): boolean {
    const p = this.current.phase;
    return p === 'checking' || p === 'downloading' || p === 'verifying';
  }

  async check(): Promise<void> {
    if (this.busy) return;
    this.manifest = null;
    this.set({ phase: 'checking' });

    let text: string;
    try {
      text = await this.opts.fetchText(this.opts.manifestUrl, MAX_MANIFEST_BYTES);
    } catch (err) {
      log.warn('could not fetch the update manifest', err);
      return this.fail('offline');
    }

    const parsed = parseUpdateManifest(text);
    if (!parsed.ok) {
      log.warn(`update manifest rejected: ${parsed.reason}`);
      return this.fail('bad-manifest');
    }
    if (!verifyManifest(parsed.manifest, this.opts.publicKey)) {
      log.warn('update manifest signature did not verify');
      return this.fail('bad-signature');
    }

    const m = parsed.manifest;
    if (compareVersions(m.version, this.opts.currentVersion) <= 0) {
      return this.set({ phase: 'up-to-date' });
    }
    this.manifest = m;
    this.set({ phase: 'available', version: m.version, notes: m.notes });
  }

  async download(): Promise<void> {
    const m = this.manifest;
    if (!m || this.current.phase !== 'available') return;
    const dest = `${this.opts.downloadDir}/PilotPane-Setup-${m.version}.exe`;
    this.installer = null;

    let lastPercent = -1;
    const progress = (receivedBytes: number): void => {
      const percent = Math.floor((receivedBytes / m.size) * 100);
      if (percent === lastPercent) return;
      lastPercent = percent;
      this.set({ phase: 'downloading', version: m.version, receivedBytes, totalBytes: m.size });
    };
    progress(0);

    try {
      await this.opts.download(m.url, dest, m.size, progress);
    } catch (err) {
      log.warn('download failed', err);
      await this.discard(dest);
      return this.fail('download-failed');
    }

    this.set({ phase: 'verifying', version: m.version });
    try {
      const facts = await this.opts.inspect(dest);
      if (facts.size !== m.size || facts.sha256 !== m.sha256) {
        log.warn('downloaded file does not match the signed manifest');
        await this.discard(dest);
        return this.fail('bad-download');
      }
    } catch (err) {
      log.warn('could not read the downloaded file', err);
      await this.discard(dest);
      return this.fail('download-failed');
    }

    this.installer = dest;
    this.set({ phase: 'ready', version: m.version });
  }

  /** "Later" and "Keep this version". Ignored while a check or download is running. */
  dismiss(): void {
    if (this.busy) return;
    this.set({ phase: 'idle' });
  }

  private async discard(path: string): Promise<void> {
    try {
      await this.opts.remove(path);
    } catch {
      /* already gone */
    }
  }
}
