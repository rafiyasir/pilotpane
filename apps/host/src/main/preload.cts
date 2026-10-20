/**
 * Preload for every PilotPane window. Exposes a small, typed API as
 * window.pilotpane. Renderers get no Node access and no raw ipcRenderer.
 * (CommonJS because Electron's sandboxed preloads must be CommonJS.)
 */
import { contextBridge, ipcRenderer } from 'electron';
import type {
  EngineCommand,
  EngineEvent,
  HostAction,
  HostState,
  PilotpaneBridge
} from '@pilotpane/protocol' with { 'resolution-mode': 'import' };

const bridge: PilotpaneBridge = {
  getState: () => ipcRenderer.invoke('pp:get-state') as Promise<HostState>,
  onState: (cb) => {
    ipcRenderer.on('pp:state', (_e, state: HostState) => cb(state));
  },
  act: (action: HostAction) => ipcRenderer.send('pp:act', action),
  onEngineCommand: (cb) => {
    ipcRenderer.on('pp:engine-cmd', (_e, command: EngineCommand) => cb(command));
  },
  sendEngineEvent: (event: EngineEvent) => ipcRenderer.send('pp:engine-evt', event)
};

contextBridge.exposeInMainWorld('pilotpane', bridge);
