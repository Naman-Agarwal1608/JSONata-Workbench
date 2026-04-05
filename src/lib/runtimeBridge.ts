type RuntimeAction =
  | 'goHome'
  | 'toggleTheme'
  | 'pickFile'
  | 'saveNow'
  | 'exportFile'
  | 'importFile'
  | 'closeOv'
  | 'confirmAdd'
  | 'confirmRename'
  | 'confirmDelete'
  | 'runExpr'
  | 'toggleExecContext'

type Win = Window & Record<string, unknown>

export function callRuntime(action: RuntimeAction): void {
  const fn = (window as Win)[action]
  if (typeof fn === 'function') (fn as () => void)()
}

export function openAddModal(type: 'folder' | 'script', parentId: string | null): void {
  const fn = (window as Win).openAddModal
  if (typeof fn === 'function')
    (fn as (kind: 'folder' | 'script', target: string | null) => void)(type, parentId)
}

export function ctxDo(action: 'af' | 'as' | 'rn' | 'del'): void {
  const fn = (window as Win).ctxDo
  if (typeof fn === 'function')
    (fn as (value: 'af' | 'as' | 'rn' | 'del') => void)(action)
}
