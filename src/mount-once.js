const MOUNTED = Symbol.for('dsh-web.mounted-plugins')
const WAITERS = Symbol.for('dsh-web.mounted-plugins.waiters')

function mountedSet() {
  const registry = globalThis
  const existing = registry[MOUNTED]
  if (existing instanceof Set) return existing
  const created = new Set()
  registry[MOUNTED] = created
  return created
}

function mountWaiters() {
  const registry = globalThis
  return (registry[WAITERS] ??= new Map())
}

export function mountOnce(packageName, fn) {
  const mount = (...args) => {
    const mounted = mountedSet()
    const ctx = args[0]
    if (mounted.has(packageName)) {
      const waiters = mountWaiters()
      const queue = waiters.get(packageName) ?? []
      let alive = true
      const pending = { run: () => { if (alive) mount(...args) } }
      ctx?.effect?.(() => () => {
        alive = false
        const index = queue.indexOf(pending)
        if (index >= 0) queue.splice(index, 1)
      })
      queue.push(pending)
      waiters.set(packageName, queue)
      return
    }
    mounted.add(packageName)
    ctx?.effect?.(() => () => {
      mounted.delete(packageName)
      const waiters = mountWaiters()
      const queue = waiters.get(packageName)
      if (queue === undefined) return
      waiters.delete(packageName)
      for (const waiter of queue.splice(0)) queueMicrotask(() => { waiter.run() })
    })
    return fn(...args)
  }
  return mount
}
