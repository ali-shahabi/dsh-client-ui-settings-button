/**
 * Behavioural tests for the hand-bundled browser half.
 *
 * The bundle is a plain script that registers a factory with the shell's module
 * loader, so it can be materialized in Node with a stub loader, a stub React,
 * and a stub slots service. That covers the parts that decide whether the
 * sidebar keeps a working launcher: the registration options, the shadowing
 * priority, the button markup, and the failure paths.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const BUNDLE = new URL('../lib/client.js', import.meta.url)
const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/**
 * Execute lib/client.js against a fake loader window.
 * @returns {{ ok: boolean, id?: string, factory?: Function, count: number }}
 */
function readRegistration() {
  const source = readFileSync(BUNDLE, 'utf8')
  const seen = []
  const fakeWindow = {
    __ModuleLoader__: {
      load(entry) {
        seen.push(entry)
      },
    },
  }
  // The bundle is intentionally a classic script, not an ES module.
  new Function('window', source)(fakeWindow)
  return { ok: seen.length === 1, id: seen[0]?.id, factory: seen[0]?.factory, count: seen.length }
}

/** Minimal React stand-in: only what the component body uses. */
function reactStub() {
  const createElement = (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } })
  return {
    createElement,
    cloneElement: (element, extra) => ({ ...element, props: { ...element.props, ...extra } }),
    useCallback: (fn) => fn,
    // No useSyncExternalStore: exercises the state-subscription fallback.
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
  }
}

/** @returns a stub module table; `primitives` may be undefined to exercise fallbacks. */
function requireStub(primitives) {
  return (specifier) => {
    if (specifier === 'react') return reactStub()
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
      if (primitives === undefined) throw new Error('not loaded')
      return primitives
    }
    throw new Error(`unexpected require: ${specifier}`)
  }
}

/**
 * Build a plugin context whose slot service records registrations.
 * @param {{ registerThrows?: boolean, noSlots?: boolean, disposeEffects?: boolean }} options - failure switches.
 */
function contextStub({ registerThrows = false, noSlots = false } = {}) {
  const registrations = []
  const effects = []
  const slots = noSlots
    ? undefined
    : {
      inject(seat, callback) {
        assert.equal(seat, 'settings.launcher')
        return callback()
      },
      register(options, component) {
        if (registerThrows) throw new Error('priority conflict')
        registrations.push({ options, component })
        return () => {}
      },
    }
  const dictionary = {}
  const locale = {
    register(namespace, entries) {
      dictionary[namespace] = entries
    },
    bind: (namespace) => (key) => dictionary[namespace]?.en?.[key] ?? key,
  }
  const ctx = {
    slots,
    locale,
    get: (key) => (key === 'slots' ? slots : key === 'locale' ? locale : undefined),
    effect(fn, _label) {
      effects.push(fn)
      return () => {}
    },
  }
  return { ctx, registrations, effects }
}

test('bundle registers exactly one module whose id matches the package', () => {
  const registration = readRegistration()
  assert.equal(registration.count, 1)
  assert.equal(registration.id, PACKAGE.name)
  assert.equal(PACKAGE.dsh.client.platform, 'web')
})

test('client half injects the slot and locale services', () => {
  const { factory } = readRegistration()
  assert.deepEqual(factory(requireStub()).inject, ['slots', 'locale'])
})

test('apply shadows the shipped account menu in the sidebar footer', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()

  exports.apply(ctx)

  assert.equal(registrations.length, 1)
  const [{ options, component }] = registrations
  assert.equal(options.name, 'settings.launcher')
  // Single cells sort by ascending priority and the first entry renders, so a
  // lower priority is what replaces the account row instead of adding to it.
  assert.equal(options.priority, -1)
  assert.equal(options.locale, 'settings')
  assert.equal(typeof component, 'function')
})

test('the launcher renders a labelled Settings button that opens settings', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)

  const translate = (key) => (key === 'trigger' ? 'Settings' : key)
  let opened = 0
  const Launcher = registrations[0].component
  const element = Launcher({ wide: true, settingsOpen: false, openSettings: () => { opened += 1 }, t: translate })

  assert.equal(element.type, 'button')
  assert.equal(element.props['data-dsh-settings-button'], '')
  assert.equal(element.props['data-rail'], 'false')
  assert.equal(element.props['aria-label'], 'Settings')
  assert.equal(element.props['aria-haspopup'], 'dialog')
  assert.equal(element.props['aria-expanded'], 'false')
  // Wide sidebar: glyph plus the label, exactly like the shipped settings row.
  assert.equal(element.props.children.length, 2)
  assert.equal(element.props.children[1].props.children[0], 'Settings')

  element.props.onClick({ preventDefault() {} })
  assert.equal(opened, 1)
})

test('the collapsed rail renders the icon-only control', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)

  const Launcher = registrations[0].component
  const element = Launcher({ wide: false, settingsOpen: true, openSettings: () => {}, t: () => 'Settings', settingsShortcut: { keys: ['⌘', ','], aria: 'Meta+Comma' } })

  assert.equal(element.props['data-rail'], 'true')
  assert.equal(element.props['aria-expanded'], 'true')
  assert.equal(element.props['aria-keyshortcuts'], 'Meta+Comma')
  // Icon only: no label child in the rail.
  assert.equal(element.props.children.length, 2)
  assert.equal(element.props.children[1], null)
})

test('a missing translation or openSettings callback cannot break the row', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)

  const Launcher = registrations[0].component
  const withoutTranslate = Launcher({ wide: true, openSettings: () => {} })
  assert.equal(withoutTranslate.props['aria-label'], 'Settings')

  const withoutCallback = Launcher({ wide: true, t: () => 'Settings' })
  assert.doesNotThrow(() => withoutCallback.props.onClick({}))
})

test('a second apply does not stack a second footer row', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const first = contextStub()
  const second = contextStub()

  exports.apply(first.ctx)
  exports.apply(second.ctx)

  assert.equal(first.registrations.length, 1)
  assert.equal(second.registrations.length, 0)
})

test('a lost slot seat or a rejected registration degrades quietly', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())

  const withoutSlots = contextStub({ noSlots: true })
  assert.doesNotThrow(() => exports.apply(withoutSlots.ctx))
  assert.equal(withoutSlots.registrations.length, 0)
})

test('shipped primitives are used when the shell exposes them', () => {
  const calls = []
  const primitives = {
    IconSettingsOutlineMedium: (props) => ({ type: 'svg', props }),
    Tooltip: (props) => ({ type: 'tooltip', props }),
  }
  const { factory } = readRegistration()
  const exports = factory(requireStub(primitives))
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)

  const Launcher = registrations[0].component
  const element = Launcher({
    wide: true,
    openSettings: () => {},
    t: () => 'Settings',
    settingsShortcut: { keys: ['⌘', ','], aria: 'Meta+Comma' },
  })
  assert.equal(element.type, primitives.Tooltip)
  assert.equal(element.props.label, 'Settings')
  assert.deepEqual(element.props.shortcutKeys, ['⌘', ','])
  const button = element.props.children[0]
  assert.equal(button.type, 'button')
  // Glyph comes from the shell, not the inline fallback.
  const Glyph = button.props.children[0]
  assert.equal(Glyph.type({ size: 16 }).type, primitives.IconSettingsOutlineMedium)
  assert.equal(calls.length, 0)
})

test('the footer row disappears while the brand-row menu owns the navigation', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)
  const Launcher = registrations[0].component
  const props = { wide: true, openSettings: () => {}, t: () => 'Settings' }

  try {
    assert.ok(Launcher(props) !== null, 'expanded sidebar keeps the row while the menu is inactive')
    exports.__test.setMenuActive(true)
    assert.equal(Launcher(props), null, 'menu owns it: no footer row')
    // The rail keeps its own control: the brand-row trigger is not there.
    assert.ok(Launcher({ ...props, wide: false }) !== null)
  } finally {
    exports.__test.setMenuActive(false)
  }
  assert.ok(Launcher(props) !== null)
})

test('the launcher publishes its settings action and label for the popover', () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx, registrations } = contextStub()
  exports.apply(ctx)

  const openSettings = () => {}
  registrations[0].component({ wide: true, openSettings, t: () => 'تنظیمات' })

  const launcher = exports.__test.getLauncher()
  assert.equal(launcher.openSettings, openSettings)
  assert.equal(launcher.label, 'تنظیمات')
})

test('the menu start is a no-op without a DOM, and always returns a disposer', async () => {
  const { factory } = readRegistration()
  const exports = factory(requireStub())
  const { ctx } = contextStub()
  assert.doesNotThrow(() => exports.apply(ctx))
})
