import { useEffect } from 'react'
import { useAppDispatch, useUIState, useWorkspaceState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { findNode } from '../../lib/workspace'
import './ContextMenu.css'

export function ContextMenu() {
  const { ctxMenu } = useUIState()
  const { db } = useWorkspaceState()
  const dispatch = useAppDispatch()
  const actions = useWorkspaceActions()

  // Close on any click outside
  useEffect(() => {
    if (!ctxMenu) return
    function onDocClick() { dispatch({ type: 'CLOSE_CTX_MENU' }) }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [ctxMenu, dispatch])

  if (!ctxMenu) return null

  const node = findNode(db, ctxMenu.id)
  const isFolder = node?.type === 'folder'

  function act(action: 'af' | 'as' | 'rn' | 'del') {
    actions.closeContextMenu()
    if (!ctxMenu) return
    if (action === 'af') actions.openAddModal('folder', ctxMenu.id)
    else if (action === 'as') actions.openAddModal('script', ctxMenu.id)
    else if (action === 'rn') actions.openRenameModal(ctxMenu.id)
    else if (action === 'del') actions.openDeleteModal(ctxMenu.id)
  }

  return (
    <div
      className="ctxm open"
      style={{ left: ctxMenu.x, top: ctxMenu.y }}
      onClick={e => e.stopPropagation()}
    >
      {isFolder && (
        <>
          <div className="citem" onClick={() => act('af')}><span className="ci">📁</span>New Subfolder</div>
          <div className="citem" onClick={() => act('as')}><span className="ci">＋</span>New Script</div>
          <div className="csep" />
        </>
      )}
      <div className="citem" onClick={() => act('rn')}><span className="ci">✎</span>Rename</div>
      <div className="citem danger" onClick={() => act('del')}><span className="ci">🗑</span>Delete</div>
    </div>
  )
}
