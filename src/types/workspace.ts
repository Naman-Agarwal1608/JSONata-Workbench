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

export interface WorkspaceSettings {
  globalContext: string
  bindings: string
  customFunctions: string
}

export interface WorkspaceDB {
  nodes: WorkspaceNode[]
  settings: WorkspaceSettings
}

export interface ErrorLocation {
  line: number
  column?: number
}

export interface CustomFunctionEntry {
  name: string
  label: string
  impl: (...args: unknown[]) => unknown
  signature?: string
  info: string
}

export interface ParseResult<T = unknown> {
  ok: boolean
  value?: T
  message?: string
  location?: ErrorLocation
}

export interface StatementInfo {
  text: string
  startOffset: number
  endOffset: number
  startLine: number
  endLine: number
}

export interface ExecContext {
  status: 'ok' | 'error'
  message: string
  location: ErrorLocation | null
  snippet: string
  variableSnapshots: Array<{ name: string; value: unknown; line: number }>
  resultValue: unknown
  bindings: string[]
  customFunctions: Array<{ label: string; info: string }>
  functionsError: string
}

export interface InspectEntry {
  label: string
  value: unknown
  meta?: string
}

export type RunStatus =
  | { kind: 'idle' }
  | { kind: 'ok'; text: string }
  | { kind: 'err'; text: string }
