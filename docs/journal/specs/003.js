window.JOURNAL.push({
  number: '003',
  title: 'Own HTTP and WebSocket server',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['Node http', 'WebSocket (RFC 6455)', 'Private IPv4 ranges', 'Host and Origin checks'],
  oneLine:
    'The host can now serve the viewer page and speak WebSocket on private LAN addresses only, using nothing but Node built-ins.',

  what: {
    summary:
      'A static file server with security headers, a WebSocket server written from RFC 6455, and a finder for private LAN addresses. Eight tests cover the RFC example key, split frames, bad frames, path safety, a wrong host, a wrong origin and an echo.',
    partsTouched: [
      {
        path: 'apps/host',
        note: '`net/http-server.ts`, `net/ws.ts`, `net/lan.ts`, `log.ts`, the package manifest, two tsconfigs and 8 tests',
        changed: true,
      },
      {
        path: 'packages/protocol',
        note: 'Provides `WS_PATH` and the LAN address types',
        changed: false,
      },
      { path: 'apps/viewer', note: 'Will be served by this server in 006', changed: false },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Write the HTTP server and WebSocket ourselves',
        insteadOf: '`express` and `ws`',
        reason:
          'The dependency policy allows only the platform at runtime, and RFC 6455 is small enough to read end to end (ADR-002).',
      },
      {
        chose: 'Plain HTTP on the LAN',
        insteadOf: 'HTTPS only',
        reason:
          'Old browsers show certificate warnings and nothing needs installing on the viewer. WebRTC encrypts the video anyway (ADR-004).',
      },
      {
        chose: 'Bind only to private addresses and `127.0.0.1`',
        insteadOf: '`0.0.0.0`',
        reason: 'The screen of a PC must never be reachable from a public network.',
      },
      {
        chose: 'Check `Host` and `Origin` on every request and upgrade',
        insteadOf: 'Trusting any local client',
        reason:
          'It blocks DNS rebinding and other websites opening a socket to the host.',
      },
    ],
  },

  when: {
    dependsOn: [
      {
        spec: '002',
        note: 'gave us `WS_PATH` and the message types that travel over this socket',
      },
    ],
    unlocks: [
      { spec: '004', note: 'runs pairing on top of `WebSocketConnection`' },
      { spec: '006', note: 'the viewer page is served by `http-server.ts`' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Find private addresses',
        explanation:
          '`lan.ts` lists the machine\'s IPv4 addresses and keeps only private ones (10.x, 172.16 to 172.31, 192.168.x, and link-local for direct cables). The list is refreshed every 3 seconds.',
      },
      {
        title: 'Serve and check the Host',
        explanation:
          '`http-server.ts` listens on those addresses and serves files from the viewer folder. Every request must carry a `Host` header that matches one of our own addresses.',
      },
      {
        title: 'Validate the upgrade',
        explanation:
          'An upgrade request goes through `acceptUpgrade`: method, headers, version 13, a 16-byte key, the `Host` and the `Origin` are all checked before the `101` answer is sent.',
      },
      {
        title: 'Parse frames',
        explanation:
          '`WebSocketConnection` parses masked client frames, joins fragments, answers pings and closes on any protocol error.',
      },
      {
        title: 'Drop dead peers',
        explanation:
          'A ping timer closes connections that stop answering, and an `end` handler closes connections whose peer just went away.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/net/ws.ts',
      excerpt: `  // Only our own LAN addresses, and only pages we served ourselves.
  // This blocks DNS rebinding and other websites opening a socket to us.
  if (!check.allowedHosts.has(host)) return reject(socket, '421 Misdirected Request');
  if (h.origin !== \`http://\${host}\`) return reject(socket, '403 Forbidden');`,
      explanation:
        '`Host` shows which address was typed. `Origin` shows which page opened the socket. A malicious page in another tab fails the second check even if it knows our address.',
    },
    {
      file: 'apps/host/src/main/net/ws.ts',
      excerpt: `    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    // The HTTP server keeps sockets half-open, so a peer that just goes away
    // only sends 'end'. Close our side too, or the viewer would look connected.
    socket.on('end', () => {
      socket.end();
      this.finish(CLOSE.GOING_AWAY, 'peer ended');
    });
    socket.on('close', () => this.finish(CLOSE.GOING_AWAY, 'socket closed'));
    socket.on('error', () => this.finish(CLOSE.GOING_AWAY, 'socket error'));`,
      explanation:
        'Every way a connection can end funnels into one `finish` call, so the rest of the host hears about a closed viewer exactly once.',
    },
  ],

  concepts: [
    {
      name: 'The WebSocket protocol',
      level: 'Core',
      explanation:
        'A handshake over HTTP, then framed messages. Client frames are always masked; the server must refuse one that is not.',
      resources: [{ title: 'RFC 6455', url: 'https://www.rfc-editor.org/rfc/rfc6455' }],
    },
    {
      name: 'HTTP upgrade in Node',
      level: 'Core',
      explanation:
        'When a request asks to upgrade, Node hands the raw socket to the `upgrade` event and the server takes over from there.',
      resources: [
        {
          title: 'Node.js: http upgrade event',
          url: 'https://nodejs.org/api/http.html#event-upgrade_1',
        },
      ],
    },
    {
      name: 'Half-open sockets',
      level: 'Concept',
      explanation:
        'A peer can end its side and keep the connection open for reading. The `end` event is the only sign, so the server has to close its side too.',
      resources: [
        { title: 'Node.js: net end event', url: 'https://nodejs.org/api/net.html#event-end' },
      ],
    },
    {
      name: 'Private address ranges',
      level: 'Concept',
      explanation:
        'Blocks of IPv4 addresses that never leave a local network, plus link-local addresses for direct cables.',
      resources: [
        { title: 'RFC 1918', url: 'https://www.rfc-editor.org/rfc/rfc1918' },
        { title: 'RFC 3927', url: 'https://www.rfc-editor.org/rfc/rfc3927' },
        {
          title: 'Node.js: os.networkInterfaces',
          url: 'https://nodejs.org/api/os.html#osnetworkinterfaces',
        },
      ],
    },
    {
      name: 'The Host and Origin headers',
      level: 'Pattern',
      explanation:
        'Two headers a browser sets itself. Checking both is the standard defence against DNS rebinding and cross-site WebSocket hijacking.',
      resources: [
        {
          title: 'MDN: Host',
          url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host',
        },
        {
          title: 'MDN: Origin',
          url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin',
        },
      ],
    },
  ],

  bugs: [
    {
      symptom: 'A viewer that went away still looked connected on the host.',
      cause:
        'The HTTP server keeps sockets half-open, so a peer that simply disappeared only sent `end`. Nothing on our side closed the socket, so the connection never reported `close`.',
      fix: 'Handle `end` in `WebSocketConnection`: end our side of the socket and finish the connection. See the second code excerpt above.',
    },
  ],

  quiz: [
    {
      question: 'Why must client frames be masked, and what does the server do with an unmasked one?',
      answer:
        'Masking is required by RFC 6455 for browser-to-server frames. Our parser rejects an unmasked client frame as a protocol error and closes the connection.',
    },
    {
      question: 'What does checking `Origin` protect against that checking `Host` does not?',
      answer:
        '`Host` shows which address was typed. `Origin` shows which page opened the socket, so a malicious website in another tab is refused even if it knows our address.',
    },
    {
      question: 'Why is `192.168.137.x` treated as a hotspot address in `lan.ts`?',
      answer:
        'That is the range Windows uses for its Mobile hotspot, so a viewer connected through the hotspot is likely to be reachable there.',
    },
  ],

  commits: [
    'chore(host): add host package manifest and tsconfigs',
    'feat(host): add scoped logger',
    'feat(host): add private lan address discovery',
    'feat(host): add own http server with host and origin checks',
    'feat(host): add own websocket server (rfc 6455)',
    'test(host): add websocket server tests',
  ],
});
