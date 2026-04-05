import { useWorkbenchRuntime } from '../hooks/useWorkbenchRuntime'
import { useSidebar } from '../hooks/useSidebar'
import { openAddModal } from '../lib/runtimeBridge'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { ContextMenu } from './ContextMenu'
import { Modals } from './Modals'
import '../workbench/styles.css'

export default function WorkbenchApp() {
  useWorkbenchRuntime()
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, onSidebarEnter, onSidebarLeave, toggleCollapse } = useSidebar()

  return (
    <div className={`workbench-host${sidebarOpen ? ' sidebar-auto-open' : ''}`}>
      <Header />

      <div className="ws">
        {!sidebarOpen && (
          <button
            className="sb-peek"
            type="button"
            aria-label="Open collections sidebar"
            onMouseEnter={() => setSidebarOpen(true)}
          >
            <span className="sb-peek-arrow">›</span>
          </button>
        )}

        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
          onMouseEnter={onSidebarEnter}
          onMouseLeave={onSidebarLeave}
        />

        <div className="main" id="main">
          <div className="empty-s">
            <div className="eg">◈</div>
            <h2>Nothing open</h2>
            <p>Create a collection then add scripts inside it.</p>
            <button className="hbtn prim" onClick={() => openAddModal('folder', null)}>
              New Collection
            </button>
          </div>
        </div>
      </div>

      <ContextMenu />
      <Modals />
    </div>
  )
}
