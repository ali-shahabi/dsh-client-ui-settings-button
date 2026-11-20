/**
 * One-shot guard: the client `apply` may run again after a profile remount, and
 * a second `settings.launcher` registration would double the footer row.
 */
let claimed = false

export function claimSettingsButtonApply() {
  if (claimed) return false
  claimed = true
  return true
}

export function releaseSettingsButtonApply() {
  claimed = false
}
