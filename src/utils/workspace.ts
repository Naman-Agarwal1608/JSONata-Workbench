import type { WorkspaceFile, WorkspaceNode } from '../types/workspace'

export function normalizeWorkspace(raw: unknown): WorkspaceFile {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceFile>

  return {
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    settings: {
      globalContext: typeof data.settings?.globalContext === 'string' ? data.settings.globalContext : '',
      bindings: typeof data.settings?.bindings === 'string' ? data.settings.bindings : '',
      customFunctions:
        typeof data.settings?.customFunctions === 'string' ? data.settings.customFunctions : ''
    }
  }
}

export function sortNodes(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return [...nodes].sort(
    (left, right) =>
      (left.order ?? 0) - (right.order ?? 0) || left.name.localeCompare(right.name)
  )
}

export function getChildren(nodes: WorkspaceNode[], parentId: string | null): WorkspaceNode[] {
  return sortNodes(nodes.filter(node => (node.parentId ?? null) === parentId))
}

export function countByType(nodes: WorkspaceNode[]) {
  return {
    folders: nodes.filter(node => node.type === 'folder').length,
    scripts: nodes.filter(node => node.type === 'script').length
  }
}
