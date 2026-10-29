// Versions and specs from docs/ROADMAP.md, with short titles for the timeline.
// Status is not stored here: a spec is done when it has a page in specs/.
// Update this file only when the roadmap itself changes.
window.JOURNAL_ROADMAP = {
  versions: [
    {
      id: 'v0.1',
      name: 'See the screen',
      note: 'Pair with a PIN and watch the host live',
      specs: [
        ['001', 'Monorepo scaffold'],
        ['002', 'Typed protocol'],
        ['003', 'HTTP and WebSocket server'],
        ['004', 'PIN pairing'],
        ['005', 'Capture and WebRTC'],
        ['006', 'Viewer page'],
        ['007', 'Host window and tray'],
        ['008', 'Stats overlay']
      ]
    },
    {
      id: 'v0.2',
      name: 'Mouse and low bandwidth',
      note: 'Click from the viewer',
      specs: [
        ['009', 'Host interfaces'],
        ['010', 'SendInput helper'],
        ['011', 'Mouse and pointer lock'],
        ['012', 'Low-bandwidth preset']
      ]
    },
    {
      id: 'v0.3',
      name: 'Keyboard',
      note: 'Type from the viewer',
      specs: [
        ['013', 'Keyboard events'],
        ['014', 'Capture mode and shortcut bar']
      ]
    },
    {
      id: 'v0.4',
      name: 'Quality and reliability',
      note: 'Presets, reconnect, stay awake',
      specs: [
        ['015', 'Quality presets'],
        ['016', 'Auto-reconnect'],
        ['017', 'Keep host awake'],
        ['031', 'Performance and sharpness'],
        ['034', 'Pause that both sides understand'],
        ['037', 'Automatic codec']
      ]
    },
    {
      id: 'v0.5',
      name: 'Daily-use comfort',
      note: 'HTTPS, clipboard, trusted devices',
      specs: [
        ['018', 'Optional HTTPS'],
        ['019', 'Clipboard sync'],
        ['020', 'Start on login'],
        ['021', 'Trusted devices']
      ]
    },
    {
      id: 'v0.6',
      name: 'Host screen off',
      note: 'Virtual display',
      specs: [
        ['022', 'Virtual display'],
        ['023', 'Safe panel restore']
      ]
    },
    {
      id: 'dist',
      name: 'Distribution',
      note: 'Download, install, update',
      specs: [
        ['024', 'Packaging'],
        ['025', 'Windows installer'],
        ['026', 'In-app updates'],
        ['027', 'Release pipeline and site'],
        ['028', 'Secret scan'],
        ['030', 'First releases']
      ]
    }
  ]
};
