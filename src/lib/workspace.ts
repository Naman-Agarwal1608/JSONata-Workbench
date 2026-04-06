import type { WorkspaceDB, WorkspaceNode, WorkspaceSettings } from '../types/workspace'

interface WorkspaceIndex {
  byId: Map<string, WorkspaceNode>
  childrenByParent: Map<string | null, WorkspaceNode[]>
}

const workspaceIndexCache = new WeakMap<WorkspaceDB, WorkspaceIndex>()

function sortNodes(a: WorkspaceNode, b: WorkspaceNode): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
}

function buildWorkspaceIndex(db: WorkspaceDB): WorkspaceIndex {
  const byId = new Map<string, WorkspaceNode>()
  const childrenByParent = new Map<string | null, WorkspaceNode[]>()

  for (const node of db.nodes) {
    byId.set(node.id, node)
    const parentId = node.parentId ?? null
    const siblings = childrenByParent.get(parentId)
    if (siblings) siblings.push(node)
    else childrenByParent.set(parentId, [node])
  }

  for (const siblings of childrenByParent.values()) siblings.sort(sortNodes)

  return { byId, childrenByParent }
}

export function getWorkspaceIndex(db: WorkspaceDB): WorkspaceIndex {
  const cached = workspaceIndexCache.get(db)
  if (cached) return cached
  const built = buildWorkspaceIndex(db)
  workspaceIndexCache.set(db, built)
  return built
}

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
  return getWorkspaceIndex(db).childrenByParent.get(pid ?? null) ?? []
}

export function findNode(db: WorkspaceDB, id: string): WorkspaceNode | undefined {
  return getWorkspaceIndex(db).byId.get(id)
}

export function allDescIds(db: WorkspaceDB, id: string): string[] {
  const index = getWorkspaceIndex(db)
  const out: string[] = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()!
    const children = index.childrenByParent.get(current) ?? []
    children.forEach(child => {
      out.push(child.id)
      queue.push(child.id)
    })
  }
  return out
}

export function folderColor(db: WorkspaceDB, id: string): string {
  const index = getWorkspaceIndex(db)
  let node = index.byId.get(id)
  while (node) {
    if (node.color) return node.color
    node = node.parentId ? index.byId.get(node.parentId) : undefined
  }
  return 'var(--tx3)'
}

export function breadcrumb(db: WorkspaceDB, id: string): string {
  const index = getWorkspaceIndex(db)
  const parts: string[] = []
  let node = index.byId.get(id)
  while (node?.parentId) {
    node = index.byId.get(node.parentId)
    if (node) parts.unshift(node.name)
  }
  const self = index.byId.get(id)
  if (self) parts.push(self.name)
  return parts.join(' › ')
}
