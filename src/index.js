import { mountOnce } from './mount-once.js'

export const name = 'dsh-client-ui-settings-button'

/**
 * Host half: this plugin owns no Host state, tools or routes. It exists so the
 * package is a real roster entry — the Web shell serves `lib/client.js` for every
 * roster row that declares `dsh.client`, and that browser half does all the work.
 */
export const apply = mountOnce('dsh-client-ui-settings-button', applyImpl)

function applyImpl(ctx) {
  try {
    ctx.logger?.info?.('[settings-button] sidebar launcher replacement loaded')
  } catch {
    // Logging is optional; the browser half renders regardless.
  }
}
