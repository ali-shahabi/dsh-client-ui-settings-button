#!/usr/bin/env node
/**
 * Build harness fixtures for the sidebar menu: a static page that mirrors the
 * sidebar DOM shape the shell renders, plus the real `lib/client.js` and stubs
 * for the module loader, React and the plugin context.
 *
 * Two variants matter, because the shell's brand row differs per platform:
 * - `desktop`: macOS Electron puts the collapse toggle in a separate window-chrome
 *   strip above the brand row (the row the menu trigger must join).
 * - `browser`: everywhere else the toggle sits inside the brand row.
 *
 * Usage: node scripts/build-fixture.js [outDir]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outDir = process.argv[2] ?? '/tmp/dsh-settings-button-fixtures'

const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/**
 * Sidebar skeleton in the shell's shape.
 * @param {'desktop'|'browser'} variant - which brand-row structure to render.
 * @returns the markup.
 */
function markup(variant) {
  const toggle = '<button type="button" data-sidebar-toggle aria-label="Collapse sidebar">▣</button>'
  const brand = `<div data-window-drag><span class="brand" aria-hidden="true"><span class="brand-mark">🐳</span><span class="brand-name">deepseek HARNESS</span></span>${variant === 'browser' ? toggle : ''}</div>`
  const strip = variant === 'desktop' ? `<div data-window-drag class="strip">${toggle}</div>` : ''
  return `
  <div class="column">
    ${strip}
    ${brand}
    <div class="new-session">New Session</div>
    <div class="scroll-region">
      <div data-sidebar-scrollport class="scroll-area">
        <nav aria-label="Global panels">
          <button type="button" aria-label="Plugins">Plugins</button>
          <button type="button" aria-label="Automation tasks">Automation tasks</button>
          <button type="button" aria-haspopup="menu" aria-label="More">More</button>
        </nav>
        <div class="region-area">workspaces</div>
      </div>
    </div>
    <div class="foot-area"></div>
  </div>`
}

/** Loader + React + context stubs, installed before the bundle registers itself. */
const harnessBase = `
  window.__results = {}
  window.__loaded = []
  window.__ModuleLoader__ = { load: (entry) => window.__loaded.push(entry) }
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } }),
    cloneElement: (element, extra) => ({ ...element, props: { ...element.props, ...extra } }),
    useCallback: (fn) => fn,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
  }
  const settings = []
  const ctx = {
    locale: {
      register: (ns) => { ctx.__dictionary = ns },
      bind: () => (key) => (key === 'trigger' ? 'Settings' : 'Menu'),
    },
    slots: {
      inject: (seat, callback) => callback(),
      register: (options, component) => { settings.push({ options, component }); return () => {} },
    },
    get: (key) => (key === 'slots' ? ctx.slots : key === 'locale' ? ctx.locale : undefined),
    effect: () => ({ dispose() {} }),
  }
`

/** Runs after the bundle: materialize it, apply it, then report the DOM result. */
const harnessRun = `
  const loaded = window.__loaded
  const entry = loaded[0]
  const exports = entry.factory((specifier) => {
    if (specifier === 'react') return React
    throw new Error('unexpected require: ' + specifier)
  })
  exports.apply(ctx)
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ;(async () => {
    await wait(400)
    const brandRow = document.querySelectorAll('[data-window-drag]')[document.querySelectorAll('[data-window-drag]').length - 1]
    const trigger = document.querySelector('[data-dsh-sidebar-menu]')
    const popover = document.querySelector('[data-dsh-sidebar-menu-popover]')
    const checks = {
      triggerPlaced: trigger !== null && trigger.parentElement === brandRow,
      triggerAfterBrand: trigger !== null && trigger.previousElementSibling?.tagName === 'SPAN',
      navMoved: popover !== null && popover.querySelector('nav') !== null,
      navGoneFromSidebar: document.querySelector('[data-sidebar-scrollport] > nav') === null,
      popoverInRoot: popover !== null && popover.parentElement.id === 'root',
      popoverGroup: popover?.getAttribute('role') === 'group',
      registered: settings.length === 1 && settings[0]?.options?.priority === -1,
    }
    window.__results = {
      variant: document.title.split(': ').pop(),
      ok: Object.values(checks).every(Boolean),
      checks,
      id: entry.id,
      triggerPlaced: trigger !== null && trigger.parentElement === brandRow,
      triggerSiblings: trigger === null ? [] : [...trigger.parentElement.children].map((el) => el.tagName + (el.hasAttribute('data-dsh-sidebar-menu') ? '#menu' : '')),
      navMoved: popover !== null && popover.querySelector('nav') !== null,
      navGoneFromSidebar: document.querySelector('[data-sidebar-scrollport] > nav') === null,
      popoverInRoot: popover !== null && popover.parentElement.id === 'root',
      popoverRole: popover?.getAttribute('role') ?? null,
      ariaExpanded: trigger?.getAttribute('aria-expanded') ?? null,
      rowCount: popover === null ? 0 : popover.querySelectorAll('button').length,
      settingsRegistered: settings.length,
      settingsPriority: settings[0]?.options?.priority ?? null,
      dictionary: ctx.__dictionary ?? null,
    }
    document.getElementById('out').textContent = (window.__results.ok ? 'PASS ' : 'FAIL ') + JSON.stringify(window.__results)
    window.__done = true
  })()
`

for (const variant of ['desktop', 'browser']) {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>sidebar menu fixture: ${variant}</title>
<style>
  body { margin: 0; background: #111; color: #eee; font: 14px system-ui; }
  #root { display: flex; }
  .column { width: 264px; display: flex; flex-direction: column; }
  .strip, [data-window-drag] { display: flex; align-items: center; gap: 8px; justify-content: flex-end; height: 60px; }
  .scroll-area { display: grid; grid-template-columns: 4px minmax(0, 1fr); }
  nav { display: flex; flex-direction: column; gap: 2px; }
  nav button { min-height: 32px; text-align: left; }
  #out { white-space: pre-wrap; padding: 12px; }
</style>
</head>
<body>
<div id="root">${markup(variant)}</div>
<div id="out">pending</div>
<script>${harnessBase}</script>
<script>${bundle}</script>
<script>${harnessRun}</script>
</body>
</html>`
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `${variant}.html`)
  writeFileSync(file, html)
  console.log('wrote', file)
}
