import { useEffect } from 'react'
import { useAppContext } from '../store/appContext'
import { findNode } from '../lib/workspace'

export function ContextMenu() {
  const { state, dispatch } = useAppContext()
  const { ctxMenu, db } = state

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
    dispatch({ type: 'CLOSE_CTX_MENU' })
    if (!ctxMenu) return
    if (action === 'af') dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'folder', parentId: ctxMenu.id })
    else if (action === 'as') dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'script', parentId: ctxMenu.id })
    else if (action === 'rn') dispatch({ type: 'OPEN_RENAME_MODAL', id: ctxMenu.id })
    else if (action === 'del') dispatch({ type: 'OPEN_DELETE_MODAL', id: ctxMenu.id })
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
