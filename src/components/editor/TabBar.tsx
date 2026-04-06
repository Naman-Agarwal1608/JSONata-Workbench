import { useUIState, useWorkspaceState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { findNode } from '../../lib/workspace'
import './TabBar.css'

export function TabBar() {
  const { db } = useWorkspaceState()
  const { tabs, activeId } = useUIState()
  const actions = useWorkspaceActions()

  return (
    <div className="tabbar">
      {tabs.map(id => {
        const node = findNode(db, id)
        if (!node) return null
        return (
          <div
            key={id}
            className={`tab${id === activeId ? ' active' : ''}`}
            onClick={() => { if (activeId !== id) actions.openScript(id) }}
          >
            <span>{node.name}</span>
            <button
              className="tabx"
              onClick={e => {
                e.stopPropagation()
                actions.closeTab(id)
              }}
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}
