window.JOURNAL.push({
  number: '014',
  title: 'Capture mode and shortcut bar',
  version: 'v0.3',
  mergedDate: '2026-10-23',
  technologies: ['Pointer Lock API', 'Pointer Events', 'KeyboardEvent.code', 'CSS transform', 'localStorage', 'node:test'],
  oneLine:
    'Alt+Tab, Win, Alt+F4 and Ctrl+W now reach the host from a small bar you can drag, resize and fade.',

  what: {
    summary:
      'On plain HTTP the browser keeps a few key combinations for itself, so typing them never reached the host. This spec adds a shortcut bar with four buttons that send those combinations as ordinary key messages. The bar shows only while controlling, can be dragged by a grip, resized from a corner and faded with a slider, and remembers its place. Because a locked mouse is hidden and cannot click anything, the Ctrl+Alt+Shift chord now frees the pointer (control continues) and locks it again on the next press. No new network message was needed.',
    partsTouched: [
      {
        path: 'packages/protocol/src/shortcuts.ts',
        note: 'New: the four shortcuts and `comboMessages`, a pure function with tests',
        changed: true,
      },
      {
        path: 'apps/viewer/src/shortcut-bar.ts',
        note: 'New: builds the bar, drag, resize, opacity and the saved layout',
        changed: true,
      },
      {
        path: 'apps/viewer/src/pointer.ts',
        note: 'Lock control (`suspendLock`, `resumeLock`, `toggleLock`) and clicks on `data-no-control` elements are not sent to the host',
        changed: true,
      },
      {
        path: 'apps/viewer/src/control.ts',
        note: 'First-time card "Some keys stay with this browser." and the new pill text',
        changed: true,
      },
      {
        path: 'apps/viewer/src/main.ts',
        note: 'Wires the bar, and the chord now follows the pointer lock',
        changed: true,
      },
      {
        path: 'apps/host',
        note: 'No change: the shortcuts are normal `key` messages the host already types',
        changed: false,
      },
      {
        path: 'DESIGN.md and docs',
        note: 'The "Shortcut bar" screen is now designed and confirmed; architecture note updated',
        changed: true,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Send each shortcut as normal `key` messages (modifier down, key down, key up, modifier up)',
        insteadOf: 'A new `shortcut` message',
        reason:
          'The host already types keys, so nothing changes on its side and the protocol version stays the same. Alt+Tab is just four key events in the right order.',
      },
      {
        chose: 'Four chips only: Alt+Tab, Win, Alt+F4, Ctrl+W',
        insteadOf: 'An Esc chip and Ctrl+Alt+Del',
        reason:
          'Esc always lets go of control, so a second Esc button would be confusing. Windows blocks Ctrl+Alt+Del from software, so a button would not work.',
      },
      {
        chose: 'Put `comboMessages` in the protocol package',
        insteadOf: 'The viewer folder next to the bar',
        reason: 'The viewer has no test runner. A pure function in the shared package gets real tests under `node --test`.',
      },
      {
        chose: 'Free the locked pointer with the existing Ctrl+Alt+Shift chord and keep control',
        insteadOf: 'Ending control, or opening the bar on the chord directly',
        reason:
          'A locked mouse is hidden, so the bar could not be clicked. With the pointer free the plain mouse position is used (ADR-013), so the host mouse keeps working. The chord opens the toolbar, and the bar stays one click away.',
      },
      {
        chose: 'A `data-no-control` marker on viewer UI',
        insteadOf: 'Listing every button in the pointer code',
        reason:
          'Any element with the marker (toolbar, tab, bar, hint card) is ignored by the mouse controller, so a click on it is never sent to the host.',
      },
      {
        chose: 'Save the bar layout as fractions of the free room in the stream',
        insteadOf: 'Pixel positions',
        reason:
          'Fractions survive resizing the window and going fullscreen, and the bar can never be saved off screen.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '011', note: 'pointer lock, the Controlling state and the input data channel' },
      { spec: '013', note: 'key messages, the key table and held-key tracking' },
    ],
    unlocks: [{ spec: '018', note: 'optional HTTPS, where Keyboard Lock could replace some of these buttons' }],
  },

  how: {
    steps: [
      {
        title: 'Take control',
        explanation:
          'Click the picture. The badge says Controlling and the pill reads "Esc to let go · Ctrl+Alt+Shift for toolbar". The "Shortcuts" button in the toolbar becomes usable.',
      },
      {
        title: 'Free the mouse',
        explanation:
          'Ctrl+Alt+Shift calls `toggleLock`. The pointer lock is released, control continues with the plain mouse, and the toolbar opens.',
      },
      {
        title: 'Open the bar',
        explanation:
          'Clicking "Shortcuts" shows the four chips. Clicks on the bar are marked `data-no-control`, so they never turn into clicks on the host.',
      },
      {
        title: 'Send a combination',
        explanation:
          '`comboMessages` lists the key down events in order and then the key up events in reverse. They go over the `input` data channel one by one, so the modifier is lifted last and nothing stays held.',
      },
      {
        title: 'Arrange the bar',
        explanation:
          'The grip moves the bar, the corner handle scales it from 75% to 200%, and the slider fades it down to 40%. The result is saved in `localStorage`, wrapped so the page works when storage is blocked.',
      },
      {
        title: 'Lock the mouse again',
        explanation:
          'The chord a second time locks the pointer, hides the toolbar and the host pointer carries on from where it was.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/shortcuts.ts',
      excerpt: `export const SHORTCUTS: readonly Shortcut[] = [
  { label: 'Alt+Tab', codes: ['AltLeft', 'Tab'] },
  { label: 'Win', codes: ['MetaLeft'] },
  { label: 'Alt+F4', codes: ['AltLeft', 'F4'] },
  { label: 'Ctrl+W', codes: ['ControlLeft', 'KeyW'] }
];

/** Keys down in order, then up in reverse, so the modifier is lifted last. */
export function comboMessages(codes: readonly string[]): InputMessage[] {
  const down: InputMessage[] = codes.map((code) => ({ type: 'key', code, down: true }));
  const up: InputMessage[] = [...codes].reverse().map((code) => ({ type: 'key', code, down: false }));
  return [...down, ...up];
}`,
      explanation: 'The whole idea in a few lines. A combination is only an ordered list of key events.',
    },
    {
      file: 'apps/viewer/src/pointer.ts',
      excerpt: `  /** Frees the pointer if it is locked, locks it if control is on without the lock. */
  toggleLock(): void {
    if (this.locked) this.suspendLock();
    else this.resumeLock();
  }

  /** Clicks on the shortcut bar are for the viewer, not the host. */
  private isViewerUi(e: Event): boolean {
    return e.target instanceof Element && e.target.closest('[data-no-control]') !== null;
  }`,
      explanation:
        'Control can continue without the lock. Any element inside a `data-no-control` parent is left alone by the mouse code.',
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `    if (pointer.isControlling) {
      // A locked pointer cannot click the toolbar or the shortcut bar: free it and show the
      // toolbar, keeping control. The chord again locks the pointer and hides the toolbar.
      const freeing = pointer.isLocked;
      pointer.toggleLock();
      setToolbarOpen(freeing);
    } else {
      toggleBar();
    }`,
      explanation:
        'The toolbar follows the lock state instead of toggling on its own, so the two can never get out of step.',
    },
    {
      file: 'apps/viewer/src/shortcut-bar.ts',
      excerpt: `    const { width: w, height: h } = this.size();
    const roomX = Math.max(0, this.stage.clientWidth - w);
    const roomY = Math.max(0, this.stage.clientHeight - h);
    const left = this.layout.fx === null ? roomX / 2 : this.layout.fx * roomX;
    const top = this.layout.fy === null ? Math.max(0, roomY - BOTTOM_GAP) : this.layout.fy * roomY;
    this.bar.style.transform = \`scale(\${this.layout.scale})\`;`,
      explanation:
        'A saved position is a fraction of the free room, so the bar stays inside the stream at any window size. With no saved position it sits at the bottom centre.',
    },
  ],

  concepts: [
    {
      name: 'Pointer Lock API',
      level: 'Core',
      explanation:
        'A locked pointer is hidden and reports movement only, so nothing can be clicked until the lock is released. That is why the viewer needs a way to free it without ending control.',
      resources: [
        {
          title: 'MDN: Pointer Lock API',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API',
        },
        { title: 'W3C: Pointer Lock 2.0', url: 'https://www.w3.org/TR/pointerlock-2/' },
      ],
    },
    {
      name: 'Pointer Events and capture',
      level: 'Concept',
      explanation:
        'Dragging the grip uses `pointerdown`, `pointermove` and `setPointerCapture`, so the drag keeps working when the pointer leaves the small handle.',
      resources: [
        {
          title: 'MDN: Pointer events',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events',
        },
        {
          title: 'MDN: Element.setPointerCapture()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
        },
      ],
    },
    {
      name: 'Keys the browser keeps',
      level: 'Concept',
      explanation:
        'Alt+Tab, the Windows key and Ctrl+W belong to the system or browser, so a page cannot catch them. The Keyboard Lock API can, but only in a secure context, which plain HTTP is not (ADR-004).',
      resources: [
        {
          title: 'MDN: Keyboard API (Keyboard Lock)',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Keyboard_API',
        },
        {
          title: 'MDN: Secure contexts',
          url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts',
        },
      ],
    },
    {
      name: 'CSS transform and transform-origin',
      level: 'Pattern',
      explanation:
        'The bar is resized with `transform: scale()` from its top left corner, so growing it does not move it. Layout size (`offsetWidth`) is not affected by a transform, so the code multiplies by the scale.',
      resources: [
        { title: 'MDN: transform', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/transform' },
        {
          title: 'MDN: transform-origin',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin',
        },
      ],
    },
    {
      name: 'Web Storage that can fail',
      level: 'Pattern',
      explanation:
        'The saved layout is read and written through helpers that catch errors, and a bad saved value is checked field by field, so private mode or edited storage never breaks the page.',
      resources: [
        { title: 'MDN: Web Storage API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API' },
      ],
    },
  ],

  bugs: [
    {
      symptom: 'After taking control, the toolbar could not be clicked, so the Shortcuts button was out of reach.',
      cause:
        'While the pointer is locked the mouse is hidden and cannot click anything. The only way to the toolbar was a key chord that nothing on screen mentioned.',
      fix: 'The Ctrl+Alt+Shift chord frees the pointer and keeps control, and the "Esc to let go" pill now also says "Ctrl+Alt+Shift for toolbar".',
    },
    {
      symptom: 'Clicking the toolbar arrow also clicked on the host.',
      cause:
        'The mouse code ignored the toolbar and the bar, but the arrow is a separate element outside the toolbar, so it was missed. The "Got it" card had the same gap.',
      fix: 'The `data-no-control` marker was added to the arrow and the card, and the check is in one place in `pointer.ts`.',
    },
    {
      symptom: 'With the viewer pointer showing, there was no way to hide it again short of pressing Esc and starting control over.',
      cause: 'The chord could free the lock, but nothing could take it back.',
      fix: 'Added `resumeLock` and `toggleLock`, and the pointer remembers its last position so the host pointer does not jump.',
    },
    {
      symptom: 'Pressing the chord to hide the viewer pointer opened the toolbar instead of closing it.',
      cause:
        'The chord toggled the toolbar on its own. Clicking the picture or a chip had already closed it, so the toggle opened it again.',
      fix: 'While controlling, the chord sets the toolbar from the lock state: freeing opens it, locking closes it.',
    },
  ],

  quiz: [
    {
      question: 'Why can a page not catch Alt+Tab or Ctrl+W on plain HTTP?',
      answer:
        'The system and browser take those keys first. Keyboard Lock could ask for them, but it needs a secure context, and plain HTTP is not one.',
    },
    {
      question: 'Why does `comboMessages` lift the keys in reverse order?',
      answer: 'So the modifier is the last key released. That matches how a person presses it, and no key is left held.',
    },
    {
      question: 'Why can the locked mouse not click the shortcut bar?',
      answer: 'A locked pointer is hidden and only reports movement. The viewer frees the lock first and keeps control with the plain mouse.',
    },
    {
      question: 'Why is the bar position saved as fractions?',
      answer:
        'A fraction of the free room works at any window size and in fullscreen, and the bar can never end up outside the stream.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
