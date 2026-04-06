import { useAppContext } from '../../store/appContext'
import { SidebarTree } from './SidebarTree'
import './Sidebar.css'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onMouseEnter, onMouseLeave }: SidebarProps) {
  const { dispatch } = useAppContext()

  return (
    <div className="sb" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="sbhd">
        <span className="sbtitle">Collections</span>
        <button
          className="sibtn"
          title={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
        >
          {collapsed ? '⇥' : '⇤'}
        </button>
        <button
          className="sibtn"
          title="New Collection"
          onClick={() => dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'folder', parentId: null })}
        >📁</button>
        <button
          className="sibtn"
          title="New Script"
          onClick={() => dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'script', parentId: null })}
        >＋</button>
      </div>
      <div className="tscroll">
        <SidebarTree />
      </div>
    </div>
  )
}
