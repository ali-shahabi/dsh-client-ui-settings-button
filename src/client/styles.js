/**
 * Styles for the replacement sidebar launcher and the sidebar menu it can hand
 * the navigation over to.
 *
 * The footer row the plugin replaces is the settings shell's `.triggerRow`
 * content (SettingsRoot.module.css): a 42px-high, full-width row when the
 * sidebar is expanded, and a 36 x 36 control in the collapsed rail. The brand-row
 * trigger and the popover restate the sidebar's own icon-button and menu-surface
 * geometry. Everything is expressed with the shell's design tokens, so the
 * controls follow the active skin and theme.
 */

const STYLE_ID = 'dsh-settings-button-styles'

export const SETTINGS_BUTTON_CSS = `
[data-dsh-settings-button] {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--dsh-sidebar-label-gap, 8px);
  width: auto;
  height: 42px;
  margin: 0;
  padding: 0 calc(var(--dsh-sidebar-row-padding, 10px) - var(--dsh-sidebar-paint-inset, 0px));
  box-sizing: border-box;
  border: 0;
  border-inline: var(--dsh-sidebar-paint-inset, 0px) solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  background-clip: padding-box;
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
}

@media (hover: hover) {
  [data-dsh-settings-button]:hover {
    background-color: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  }
}

[data-dsh-settings-button]:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-border-focus, currentColor);
  outline-offset: 1px;
}

[data-dsh-settings-button] > svg {
  flex: none;
}

[data-dsh-settings-button][data-rail='true'] {
  flex: none;
  width: 36px;
  height: 36px;
  justify-content: center;
  gap: 0;
  padding: 0;
  border-inline: 0;
  background-clip: border-box;
}

[data-dsh-settings-button] .dsb-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* --- brand-row trigger ---------------------------------------------------- */

.dsb-trigger {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  cursor: pointer;
}

@media (hover: hover) {
  .dsb-trigger:hover {
    background-color: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  }
}

.dsb-trigger[aria-expanded='true'] {
  background-color: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--dsw-alias-label-primary, inherit);
}

.dsb-trigger:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, currentColor));
  outline-offset: -2px;
}

/* --- popover -------------------------------------------------------------- */

.dsb-menu {
  position: fixed;
  z-index: 900;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-width: 248px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  padding: 6px;
  box-sizing: border-box;
  overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.08));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-2, #242424);
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.42));
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
}

.dsb-menu[hidden] {
  display: none;
}

/* The shipped panel list keeps its own classes; this only neutralises the
   sidebar grid offsets it carries while it lived in the scroll area. */
.dsb-menu-nav > nav {
  grid-column: auto;
  grid-row: auto;
  margin: 0;
}

.dsb-menu-nav:empty + .dsb-menu-separator {
  display: none;
}

.dsb-menu-separator {
  height: 1px;
  margin: 6px 4px;
  background: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
}

/* Settings row: the panel rows' geometry, so the popover reads as one list. */
.dsb-menu-row {
  display: flex;
  align-items: center;
  gap: var(--dsh-sidebar-label-gap, 8px);
  width: 100%;
  min-height: 32px;
  padding: 5px calc(var(--dsh-sidebar-row-padding, 10px) - var(--dsh-sidebar-paint-inset, 0px));
  box-sizing: border-box;
  border: 0;
  border-inline: var(--dsh-sidebar-paint-inset, 0px) solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  background-clip: padding-box;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  line-height: 22px;
  text-align: start;
  cursor: pointer;
}

@media (hover: hover) {
  .dsb-menu-row:hover {
    background-color: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  }
}

.dsb-menu-row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, currentColor));
  outline-offset: -2px;
}

.dsb-menu-row > svg {
  flex: none;
}

.dsb-menu-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`

/** Inject the stylesheet once per page load. */
export function ensureSettingsButtonStyles() {
  if (typeof document === 'undefined') return
  const head = document.head ?? document.documentElement
  if (head === null || head === undefined) return
  if (head.querySelector(`style[data-dsh-settings-button-styles]`) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.setAttribute('data-dsh-settings-button-styles', '')
  style.textContent = SETTINGS_BUTTON_CSS
  head.appendChild(style)
}
