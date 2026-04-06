import { useEffect, useReducer, useRef } from 'react'
import { AppProvider, createInitialState, reducer, THEME_KEY } from '../store/appContext'
import { usePersistence } from '../hooks/usePersistence'
import { useSidebar } from '../hooks/useSidebar'
import { normalizeDB, hasWorkspaceContent } from '../lib/workspace'
import { Header } from './layout/Header'
import { Sidebar } from './layout/Sidebar'
import { ContextMenu } from './layout/ContextMenu'
import { Modals } from './modals'
import { LandingView } from './landing/LandingView'
import { WorkspaceView } from './editor/WorkspaceView'
import '../styles/global.css'
import '../styles/shell.css'
import '../styles/ui.css'

function WorkbenchInner() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const dbRef = useRef(state.db)
  dbRef.current = state.db

  const persistence = usePersistence({
    getDb: () => dbRef.current,
    dispatch,
    onLoadDefault: async () => {
      try {
        const response = await fetch('./jsonata-demo-workspace.json')
        if (!response.ok) return false
        const parsed = normalizeDB(await response.json())
        if (!hasWorkspaceContent(parsed)) return false
        dispatch({ type: 'SET_DB', db: parsed })
        dispatch({ type: 'RESET_VIEW_STATE' })
        dispatch({ type: 'SET_STATUS', label: 'Demo workspace loaded' })
        return true
      } catch { return false }
    },
  })

  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, onSidebarEnter, onSidebarLeave, toggleCollapse } = useSidebar()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
    try { localStorage.setItem(THEME_KEY, state.theme) } catch { /* ignore */ }
  }, [state.theme])

  // Boot persistence on mount
  useEffect(() => {
    persistence.bootPersistence()
    return () => persistence.clearPendingSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); persistence.saveNow(true) }
      if (e.key === 'Escape') dispatch({ type: 'CLOSE_MODAL' })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppProvider state={state} dispatch={dispatch} persistence={persistence}>
      <div className={`workbench-host${sidebarOpen ? ' sidebar-auto-open' : ''}${!state.activeId ? ' landing-mode' : ''}`}>
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

          <div className={`main${!state.activeId ? ' main-landing' : ' main-workspace'}`} id="main">
            {state.activeId ? (
              <WorkspaceView key={state.activeId} />
            ) : (
              <LandingView />
            )}
          </div>
        </div>

        <ContextMenu />
        <Modals />
      </div>
    </AppProvider>
  )
}

export default function WorkbenchApp() {
  return <WorkbenchInner />
}
