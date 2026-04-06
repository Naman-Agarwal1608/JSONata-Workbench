import { useUIState, useWorkspaceState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { kids, folderColor } from '../../lib/workspace'
import type { WorkspaceNode } from '../../types/workspace'
import './SidebarTree.css'

export function SidebarTree() {
  const { db } = useWorkspaceState()
  const roots = kids(db, null)

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
  const { db } = useWorkspaceState()
  const { activeId } = useUIState()
  const actions = useWorkspaceActions()
  const isActive = node.id === activeId
  const children = node.type === 'folder' ? kids(db, node.id) : []

  function handleRowClick(e: React.MouseEvent) {
    if ((e.target as Element).closest('.tacts')) return
    if (node.type === 'folder') {
      actions.toggleFolder(node.id)
    } else {
      actions.openScript(node.id)
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    let x = e.clientX, y = e.clientY
    if (x + 180 > window.innerWidth) x = window.innerWidth - 184
    if (y + 160 > window.innerHeight) y = window.innerHeight - 164
    actions.openContextMenu(node.id, x, y)
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
            style={{ '--fc': node.color || folderColor(db, node.id) } as React.CSSProperties}
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
                onClick={e => { e.stopPropagation(); actions.openAddModal('folder', node.id) }}
              >📁</button>
              <button
                className="tact"
                title="New script"
                onClick={e => { e.stopPropagation(); actions.openAddModal('script', node.id) }}
              >＋</button>
            </>
          )}
          <button
            className="tact"
            title="Rename"
            onClick={e => { e.stopPropagation(); actions.openRenameModal(node.id) }}
          >✎</button>
          <button
            className="tact del"
            title="Delete"
            onClick={e => { e.stopPropagation(); actions.openDeleteModal(node.id) }}
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
              onClick={() => actions.openAddModal('script', node.id)}
            >
              + New Script
            </div>
          )}
        </div>
      )}
    </div>
  )
}
