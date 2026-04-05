export interface WorkspaceSettings {
  globalContext: string
  bindings: string
  customFunctions: string
}

export interface WorkspaceNode {
  id: string
  type: 'folder' | 'script'
  name: string
  parentId: string | null
  color?: string
  open?: boolean
  expr?: string
  input?: string
  order?: number
}

export interface WorkspaceFile {
  nodes: WorkspaceNode[]
  settings: WorkspaceSettings
}
