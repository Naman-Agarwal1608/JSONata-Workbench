import { useAppContext } from '../store/appContext'
import { kids, folderColor } from '../lib/workspace'
import type { WorkspaceNode } from '../types/workspace'

export function SidebarTree() {
  const { state } = useAppContext()
  const roots = kids(state.db, null)

  if (!roots.length) {
    return (
      <div style={{ padding: '18px 14px', fontSize: '11px', color: 'var(--tx3)', lineHeight: 2 }}>
        No collections yet.<br />Click 📁 above to create one.
      </div>
    )
  }

  return (
    <>
      {roots.map(node => <TreeNode key={node.id} node={node} depth={0} />)}
    </>
  )
}

function TreeNode({ node, depth }: { node: WorkspaceNode; depth: number }) {
  const { state, dispatch, schedSave } = useAppContext()
  const isActive = node.id === state.activeId
  const children = node.type === 'folder' ? kids(state.db, node.id) : []

  function handleRowClick(e: React.MouseEvent) {
    if ((e.target as Element).closest('.tacts')) return
    if (node.type === 'folder') {
      dispatch({ type: 'TOGGLE_FOLDER', id: node.id })
      schedSave()
    } else {
      dispatch({ type: 'OPEN_SCRIPT', id: node.id })
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    let x = e.clientX, y = e.clientY
    if (x + 180 > window.innerWidth) x = window.innerWidth - 184
    if (y + 160 > window.innerHeight) y = window.innerHeight - 164
    dispatch({ type: 'OPEN_CTX_MENU', id: node.id, x, y })
  }

  return (
    <div className="tnode">
      <div
        className={`trow${isActive ? ' active' : ''}`}
        style={{ paddingLeft: depth * 13 + 4 }}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'folder' ? (
          <div className={`tcaret${node.open ? ' open' : ''}`}>▶</div>
        ) : (
          <div className="tcaret invis">▶</div>
        )}

        {node.type === 'folder' ? (
          <div
            className="tfoldericon"
            style={{ '--fc': node.color || folderColor(state.db, node.id) } as React.CSSProperties}
          />
        ) : (
          <div className="tscripticon">◈</div>
        )}

        <div className="tlabel">{node.name}</div>

        <div className="tacts">
          {node.type === 'folder' && (
            <>
              <button
                className="tact"
                title="New subfolder"
                onClick={e => { e.stopPropagation(); dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'folder', parentId: node.id }) }}
              >📁</button>
              <button
                className="tact"
                title="New script"
                onClick={e => { e.stopPropagation(); dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'script', parentId: node.id }) }}
              >＋</button>
            </>
          )}
          <button
            className="tact"
            title="Rename"
            onClick={e => { e.stopPropagation(); dispatch({ type: 'OPEN_RENAME_MODAL', id: node.id }) }}
          >✎</button>
          <button
            className="tact del"
            title="Delete"
            onClick={e => { e.stopPropagation(); dispatch({ type: 'OPEN_DELETE_MODAL', id: node.id }) }}
          >✕</button>
        </div>
      </div>

      {node.type === 'folder' && (
        <div className={`tchildren${node.open ? ' open' : ''}`}>
          {children.length > 0 ? (
            children.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)
          ) : (
            <div
              className="tempty"
              style={{ paddingLeft: (depth + 1) * 13 + 20 }}
              onClick={() => dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'script', parentId: node.id })}
            >
              + New Script
            </div>
          )}
        </div>
      )}
    </div>
  )
}
