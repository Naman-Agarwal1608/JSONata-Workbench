import { openAddModal } from '../lib/runtimeBridge'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onMouseEnter, onMouseLeave }: SidebarProps) {
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
        <button className="sibtn" title="New Collection" onClick={() => openAddModal('folder', null)}>📁</button>
        <button className="sibtn" title="New Script" onClick={() => openAddModal('script', null)}>＋</button>
      </div>
      <div className="tscroll" id="tscroll" />
    </div>
  )
}
