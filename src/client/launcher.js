/**
 * The sidebar launcher occupant: a Settings button in the sidebar foot, or
 * nothing at all once the brand-row menu owns the navigation.
 *
 * Registered as a `settings.launcher` occupant at priority -1. That slot is a
 * `single` cell whose entries are sorted by ascending priority and whose first
 * entry renders, so a lower priority shadows the shipped account menu
 * (registered at the default 0) instead of sitting beside it. The shell passes
 * the owner props this component uses: `wide`, `settingsOpen`, `openSettings`
 * (optionally a section id) and `settingsShortcut`.
 *
 * Because the slot is the only place the shell exposes `openSettings`, the
 * occupant keeps publishing that callback (and the localized label) even while
 * it renders nothing, so the brand-row popover can run the same action.
 */

const h = React.createElement

/** The shell's own "Settings" glyph and tooltip, when the primitives module is loaded. */
let primitivesCache
function primitives() {
  if (primitivesCache !== undefined) return primitivesCache
  try {
    primitivesCache = require('@deepseek-ai/dsh-client-ui-primitives') ?? null
  } catch {
    primitivesCache = null
  }
  return primitivesCache
}

/** Inline 16px gear used when the primitives module does not expose one. */
function FallbackGear({ size }) {
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => h('line', {
    key: angle,
    x1: 8,
    y1: 2.2,
    x2: 8,
    y2: 3.9,
    transform: `rotate(${angle} 8 8)`,
  }))
  return h('svg', {
    viewBox: '0 0 16 16',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    'aria-hidden': true,
    focusable: false,
  },
  h('circle', { key: 'ring', cx: 8, cy: 8, r: 2.1 }),
  ...ticks)
}

/** Settings glyph: the shell's own icon, else the inline gear. */
function SettingsIcon({ size }) {
  const Icon = primitives()?.IconSettingsOutlineMedium
  if (Icon !== undefined) return h(Icon, { size })
  return h(FallbackGear, { size })
}

/**
 * Read the shell's localized trigger label ("Settings") out of its own
 * dictionary so the button keeps matching the app language.
 * @param translate - the `t` seat bound to the shell's `settings` namespace.
 * @returns the label, or the English fallback when the key is unavailable.
 */
function triggerLabel(translate) {
  if (typeof translate !== 'function') return 'Settings'
  try {
    const value = translate('trigger')
    return typeof value === 'string' && value !== '' && value !== 'trigger' ? value : 'Settings'
  } catch {
    return 'Settings'
  }
}

/**
 * Follow the sidebar menu's ownership; `useSyncExternalStore` when the host
 * React has it, a state subscription otherwise.
 * @returns whether the brand-row menu owns the navigation.
 */
function useMenuOwned() {
  if (typeof React.useSyncExternalStore === 'function') {
    return React.useSyncExternalStore(subscribeMenuActive, getMenuActive, () => false)
  }
  const [owned, setOwned] = React.useState(getMenuActive)
  React.useEffect(() => subscribeMenuActive(() => setOwned(getMenuActive())), [])
  return owned
}

/**
 * Wrap the button in the shell's tooltip (label + shortcut chip) when available.
 * A tooltip that cannot render must never cost the launcher: any failure falls
 * back to the plain button, since this entry shadows the account row entirely.
 * @param button - the trigger element.
 * @param label - accessible label.
 * @param shortcut - owner-supplied `{ keys, aria }`.
 * @returns button, tooltip-wrapped when the primitives module provides one.
 */
function withTooltip(button, label, shortcut) {
  const Tooltip = primitives()?.Tooltip
  const keys = Array.isArray(shortcut?.keys) ? shortcut.keys : []
  const title = shortcut?.aria === undefined ? label : `${label} (${shortcut.aria})`
  if (Tooltip === undefined) return React.cloneElement(button, { title })
  try {
    return h(Tooltip, keys.length === 0 ? { label } : { label, shortcutKeys: keys }, button)
  } catch {
    return React.cloneElement(button, { title })
  }
}

/**
 * Render the Settings launcher for the sidebar foot.
 * @param props - `settings.launcher` owner props plus the `t` locale seat.
 * @returns the footer launcher, or null when the brand-row menu owns it.
 */
export function SettingsLauncher(props) {
  const wide = props.wide !== false
  const owned = useMenuOwned()
  const label = triggerLabel(props.t)
  // Published during render: idempotent, and the popover may open before the
  // next commit. The store holds the callback, not a rendered value.
  publishLauncher({ openSettings: props.openSettings, label })
  const shortcut = props.settingsShortcut

  const activate = React.useCallback((event) => {
    if (typeof event?.preventDefault === 'function') event.preventDefault()
    const openSettings = props.openSettings
    if (typeof openSettings !== 'function') return
    try {
      openSettings()
    } catch (error) {
      console.error('[settings-button] could not open settings:', error)
    }
  }, [props.openSettings])

  // The expanded sidebar keeps no footer row: Settings lives in the brand-row
  // menu. The rail keeps this control, since the rail's menu trigger is absent.
  if (wide && owned) return null

  const button = h('button', {
    type: 'button',
    'data-dsh-settings-button': '',
    'data-rail': String(!wide),
    'aria-label': label,
    'aria-haspopup': 'dialog',
    'aria-expanded': props.settingsOpen === true ? 'true' : 'false',
    ...(shortcut?.aria === undefined ? {} : { 'aria-keyshortcuts': shortcut.aria }),
    onClick: activate,
  },
  h(SettingsIcon, { key: 'icon', size: wide ? 16 : 18 }),
  wide ? h('span', { key: 'label', className: 'dsb-label' }, label) : null)

  return withTooltip(button, label, shortcut)
}
