export function normalizeDB(raw) {
  const base = (raw && typeof raw === 'object') ? raw : {}
  return {
    nodes: Array.isArray(base.nodes) ? base.nodes : [],
    settings: {
      globalContext: typeof base.settings?.globalContext === 'string' ? base.settings.globalContext : '',
      bindings: typeof base.settings?.bindings === 'string' ? base.settings.bindings : '',
      customFunctions: typeof base.settings?.customFunctions === 'string' ? base.settings.customFunctions : ''
    }
  }
}

export function createWorkspaceHelpers({ getDb }) {
  function getSettings() {
    const db = getDb()
    return db.settings || (db.settings = { globalContext: '', bindings: '', customFunctions: '' })
  }

  function hasWorkspaceContent(candidate = getDb()) {
    return !!(candidate && Array.isArray(candidate.nodes) && candidate.nodes.length)
  }

  function kids(pid) {
    return getDb().nodes
      .filter(n => (n.parentId || null) === (pid || null))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name))
  }

  function findNode(id) {
    return getDb().nodes.find(node => node.id === id)
  }

  function allDesc(id) {
    const db = getDb()
    const out = []
    const queue = [id]
    while (queue.length) {
      const current = queue.shift()
      db.nodes
        .filter(n => n.parentId === current)
        .forEach(child => {
          out.push(child.id)
          queue.push(child.id)
        })
    }
    return out
  }

  function folderColor(id) {
    const db = getDb()
    const node = db.nodes.find(x => x.id === id)
    if (!node) return 'var(--tx3)'
    if (node.color) return node.color
    if (node.parentId) return folderColor(node.parentId)
    return 'var(--tx3)'
  }

  function breadcrumb(id) {
    const db = getDb()
    const parts = []
    let node = db.nodes.find(x => x.id === id)
    while (node && node.parentId) {
      node = db.nodes.find(x => x.id === node.parentId)
      if (node) parts.unshift(node.name)
    }
    const self = db.nodes.find(x => x.id === id)
    if (self) parts.push(self.name)
    return parts.join(' › ')
  }

  return {
    getSettings,
    hasWorkspaceContent,
    kids,
    findNode,
    allDesc,
    folderColor,
    breadcrumb
  }
}
