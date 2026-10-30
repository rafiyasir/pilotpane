/** What to do when the host window is asked to close. */
export type CloseDecision = 'quit' | 'hide' | 'hold';

/**
 * Closing the window only hides it, so sharing carries on from the tray.
 * The first time, the close is held and a card explains this (spec 035).
 * A second close while that card is showing counts as "Keep in tray".
 */
export function closeDecision(opts: { quitting: boolean; noticeSeen: boolean; noticeShowing: boolean }): CloseDecision {
  if (opts.quitting) return 'quit';
  if (opts.noticeSeen || opts.noticeShowing) return 'hide';
  return 'hold';
}
