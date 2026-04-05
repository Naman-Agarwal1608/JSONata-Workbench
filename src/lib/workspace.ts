import type { WorkspaceDB, WorkspaceNode, WorkspaceSettings } from '../types/workspace'

export function normalizeDB(raw?: unknown): WorkspaceDB {
  const base = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}
  const settings = (base.settings && typeof base.settings === 'object')
    ? (base.settings as Record<string, unknown>)
    : {}
  return {
    nodes: Array.isArray(base.nodes) ? (base.nodes as WorkspaceNode[]) : [],
    settings: {
      globalContext: typeof settings.globalContext === 'string' ? settings.globalContext : '',
      bindings: typeof settings.bindings === 'string' ? settings.bindings : '',
      customFunctions: typeof settings.customFunctions === 'string' ? settings.customFunctions : '',
    },
  }
}

export function getSettings(db: WorkspaceDB): WorkspaceSettings {
  return db.settings
}

export function hasWorkspaceContent(db: WorkspaceDB): boolean {
  return !!(db && Array.isArray(db.nodes) && db.nodes.length)
}

export function kids(db: WorkspaceDB, pid: string | null): WorkspaceNode[] {
  return db.nodes
    .filter(n => (n.parentId ?? null) === (pid ?? null))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

export function findNode(db: WorkspaceDB, id: string): WorkspaceNode | undefined {
  return db.nodes.find(n => n.id === id)
}

export function allDescIds(db: WorkspaceDB, id: string): string[] {
  const out: string[] = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()!
    db.nodes
      .filter(n => n.parentId === current)
      .forEach(child => { out.push(child.id); queue.push(child.id) })
  }
  return out
}

export function folderColor(db: WorkspaceDB, id: string): string {
  const node = db.nodes.find(n => n.id === id)
  if (!node) return 'var(--tx3)'
  if (node.color) return node.color
  if (node.parentId) return folderColor(db, node.parentId)
  return 'var(--tx3)'
}

export function breadcrumb(db: WorkspaceDB, id: string): string {
  const parts: string[] = []
  let node = db.nodes.find(n => n.id === id)
  while (node?.parentId) {
    node = db.nodes.find(n => n.id === (node as WorkspaceNode).parentId)
    if (node) parts.unshift(node.name)
  }
  const self = db.nodes.find(n => n.id === id)
  if (self) parts.push(self.name)
  return parts.join(' › ')
}
