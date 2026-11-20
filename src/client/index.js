/**
 * Browser half: declutter the sidebar.
 *
 * Two parts work together:
 * - `settings.launcher` is claimed at priority -1 so the shipped account menu
 *   ("Signed in to DeepSeek" + its Settings / Contact us / Sign out popup) stops
 *   occupying the sidebar foot;
 * - {@link startSidebarMenu} puts one menu trigger next to the brand, and moves
 *   the shipped panel navigation (Plugins, Automation tasks, More with its
 *   fly-out) and the Settings action into the popover it opens.
 *
 * The sidebar keeps its New Session row, the workspace/session list and, in the
 * collapsed rail, its own compact navigation. Nothing is replaced by a copy: the
 * panel list is the shipped one, moved, so panel switching, active state and the
 * More fly-out behave exactly as before.
 */
import { claimSettingsButtonApply, releaseSettingsButtonApply } from './apply-guard.js'
import { ensureSettingsButtonStyles } from './styles.js'
import { SettingsLauncher } from './launcher.js'
import { getLauncher, publishLauncher, setMenuActive, startSidebarMenu } from './menu.js'

export const inject = ['slots', 'locale']

/**
 * Handles for the bundle's own tests: ownership and the launcher facts the
 * popover reads. Not part of the plugin API and ignored by the shell.
 */
export const __test = { setMenuActive, getLauncher, publishLauncher }

/** The settings shell's sidebar-foot launcher cell. */
export const SETTINGS_LAUNCHER_SEAT = 'settings.launcher'

/** Ascending priority: lower renders, so -1 shadows the shipped account menu. */
const LAUNCHER_PRIORITY = -1

/** Dictionary namespace owned by this plugin (chrome labels only). */
const NAMESPACE = 'settings-button'

const DICTIONARY = {
  en: { menu: 'Menu' },
  zh: { menu: '菜单' },
}

/**
 * Resolve the slots service through ctx.get first (what other client plugins
 * here do) and fall back to the direct service property.
 * @param ctx - client plugin context.
 * @returns the slots service, or undefined before it is available.
 */
function slotsOf(ctx) {
  try {
    return ctx.get('slots') ?? ctx.slots
  } catch {
    return ctx.slots
  }
}

/**
 * Register the Settings launcher into the settings shell's footer cell.
 * @param ctx - client plugin context.
 * @returns a disposer; a no-op when the seat is not (yet) available.
 */
export function registerSettingsLauncher(ctx) {
  const slots = slotsOf(ctx)
  if (slots === undefined || typeof slots.inject !== 'function') return () => {}

  return slots.inject(SETTINGS_LAUNCHER_SEAT, () => {
    const live = slotsOf(ctx)
    const register = live?.register?.bind(live)
    if (typeof register !== 'function') return () => {}
    try {
      return register({
        name: SETTINGS_LAUNCHER_SEAT,
        priority: LAUNCHER_PRIORITY,
        // The shell owns this dictionary; borrowing the namespace keeps the
        // label ("Settings") in the app's language instead of hard-coding it.
        locale: 'settings',
        registrant: 'dsh-client-ui-settings-button',
      }, SettingsLauncher)
    } catch (error) {
      console.error('[settings-button] launcher registration failed:', error)
      return () => {}
    }
  })
}

/**
 * Bind our own namespace for the menu trigger's label.
 * @param ctx - client plugin context.
 * @returns lookup that never throws.
 */
function menuTranslate(ctx) {
  try {
    const claimed = '__dshSettingsButtonDictionary'
    if (globalThis[claimed] !== true) {
      globalThis[claimed] = true
      ctx.locale.register(NAMESPACE, DICTIONARY)
    }
    const bound = ctx.locale.bind(NAMESPACE)
    return (key) => {
      try {
        const value = bound(key)
        return typeof value === 'string' && value !== '' ? value : key
      } catch {
        return key
      }
    }
  } catch (error) {
    // The namespace is already present when another instance (or a remount of
    // this one) registered it first; the bound lookup still works, and the
    // fallback below keeps a sane English label either way.
    if (!/already has locale/.test(String(error?.message ?? error))) {
      console.error('[settings-button] menu dictionary registration failed:', error)
    }
    return (key) => (key === 'menu' ? 'Menu' : key)
  }
}

/**
 * Plugins mount, unmount and remount with the profile; the first claim owns the
 * seat and a later one must not add a second footer row or a second trigger.
 * @param ctx - client plugin context.
 */
export function apply(ctx) {
  if (!claimSettingsButtonApply()) return
  ctx.effect(() => releaseSettingsButtonApply, 'settings-button: apply claim')

  const injectStyles = () => {
    try {
      ensureSettingsButtonStyles()
    } catch (error) {
      console.error('[settings-button] style injection failed:', error)
    }
  }

  injectStyles()
  try {
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyles, { once: true })
    }
    // A theme switch or shell rebuild can drop the injected sheet; re-assert it.
    if (typeof MutationObserver !== 'undefined' && document.head) {
      const observer = new MutationObserver(() => {
        try {
          if (document.querySelector('style[data-dsh-settings-button-styles]') === null) injectStyles()
        } catch {}
      })
      observer.observe(document.head, { childList: true })
      ctx.effect(() => () => {
        try {
          observer.disconnect()
        } catch {}
      }, 'settings-button: style observer')
    }
  } catch {}

  try {
    const dispose = registerSettingsLauncher(ctx)
    if (typeof dispose === 'function' && typeof ctx.effect === 'function') {
      ctx.effect(() => dispose, 'settings-button: sidebar launcher entry')
    }
  } catch (error) {
    // A launcher that cannot mount must leave the shipped account row in place.
    console.error('[settings-button] launcher mount failed:', error)
  }

  try {
    const disposeMenu = startSidebarMenu({ translate: menuTranslate(ctx) })
    if (typeof disposeMenu === 'function' && typeof ctx.effect === 'function') {
      ctx.effect(() => disposeMenu, 'settings-button: sidebar menu')
    }
  } catch (error) {
    // Without the menu the footer launcher above still works.
    console.error('[settings-button] sidebar menu mount failed:', error)
  }
}
