import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { InspectEntry, WorkspaceDB, WorkspaceNode } from '../types/workspace'
import { normalizeDB, allDescIds } from '../lib/workspace'
import { uid } from '../lib/helpers'

export const FOLDER_COLORS = ['#e8b84b', '#e07b40', '#4db887', '#5b9cf6', '#b07ef8', '#e05252', '#38c4c4', '#f07090', '#a0d060']
const THEME_KEY = 'jcv5:theme'

// ── MODAL STATE ───────────────────────────────────────────────────
export type ModalState =
  | { kind: 'none' }
  | { kind: 'add'; type: 'folder' | 'script'; parentId: string | null }
  | { kind: 'rename'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'value-inspector'; entry: InspectEntry }

export type CtxMenu = { id: string; x: number; y: number } | null

// ── APP STATE ────────────────────────────────────────────────────
export interface AppState {
  db: WorkspaceDB
  activeId: string | null
  tabs: string[]
  theme: 'dark' | 'light'
  statusLabel: string
  statusDot: '' | 'busy' | 'ok'
  modal: ModalState
  pickedColor: string
  ctxMenu: CtxMenu
}

// ── ACTIONS ──────────────────────────────────────────────────────
export type AppAction =
  | { type: 'SET_DB'; db: WorkspaceDB }
  | { type: 'RESET_VIEW_STATE' }
  | { type: 'OPEN_SCRIPT'; id: string }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'GO_HOME' }
  | { type: 'TOGGLE_FOLDER'; id: string }
  | { type: 'ADD_NODE'; nodeType: 'folder' | 'script'; name: string; parentId: string | null; color?: string }
  | { type: 'RENAME_NODE'; id: string; name: string }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'UPDATE_NODE_FIELD'; id: string; field: 'input' | 'expr' | 'name'; value: string }
  | { type: 'UPDATE_SETTINGS'; key: 'globalContext' | 'bindings' | 'customFunctions'; value: string }
  | { type: 'OPEN_ADD_MODAL'; modalType: 'folder' | 'script'; parentId: string | null }
  | { type: 'OPEN_RENAME_MODAL'; id: string }
  | { type: 'OPEN_DELETE_MODAL'; id: string }
  | { type: 'OPEN_VALUE_INSPECTOR'; entry: InspectEntry }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_PICKED_COLOR'; color: string }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'SET_STATUS'; label: string; dot?: '' | 'busy' | 'ok' }
  | { type: 'OPEN_CTX_MENU'; id: string; x: number; y: number }
  | { type: 'CLOSE_CTX_MENU' }

// ── REDUCER ──────────────────────────────────────────────────────
function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {

    case 'SET_DB':
      return { ...state, db: action.db }

    case 'RESET_VIEW_STATE':
      return { ...state, activeId: null, tabs: [], modal: { kind: 'none' }, ctxMenu: null }

    case 'OPEN_SCRIPT': {
      const tabs = state.tabs.includes(action.id) ? state.tabs : [...state.tabs, action.id]
      return { ...state, activeId: action.id, tabs }
    }

    case 'CLOSE_TAB': {
      const tabs = state.tabs.filter(t => t !== action.id)
      const activeId = state.activeId === action.id ? (tabs[tabs.length - 1] ?? null) : state.activeId
      return { ...state, tabs, activeId }
    }

    case 'GO_HOME':
      return { ...state, activeId: null }

    case 'TOGGLE_FOLDER': {
      const nodes = state.db.nodes.map(n => n.id === action.id ? { ...n, open: !n.open } : n)
      return { ...state, db: { ...state.db, nodes } }
    }

    case 'ADD_NODE': {
      const newNode: WorkspaceNode = {
        id: uid(),
        type: action.nodeType,
        name: action.name,
        parentId: action.parentId,
        color: action.nodeType === 'folder' ? action.color : undefined,
        open: true,
        expr: '',
        input: '',
        order: state.db.nodes.filter(n => (n.parentId ?? null) === (action.parentId ?? null)).length,
      }
      // auto-open parent folders
      let pid = action.parentId
      const nodes = state.db.nodes.map(n => {
        if (n.id === pid) { pid = n.parentId; return { ...n, open: true } }
        return n
      })
      nodes.push(newNode)
      const nextState = { ...state, db: { ...state.db, nodes }, modal: { kind: 'none' } as ModalState }
      if (action.nodeType === 'script') {
        return { ...nextState, activeId: newNode.id, tabs: [...state.tabs, newNode.id] }
      }
      return nextState
    }

    case 'RENAME_NODE': {
      const nodes = state.db.nodes.map(n => n.id === action.id ? { ...n, name: action.name } : n)
      return { ...state, db: { ...state.db, nodes }, modal: { kind: 'none' } }
    }

    case 'DELETE_NODE': {
      const toDelete = new Set([action.id, ...allDescIds(state.db, action.id)])
      const nodes = state.db.nodes.filter(n => !toDelete.has(n.id))
      const tabs = state.tabs.filter(t => !toDelete.has(t))
      const activeId = toDelete.has(state.activeId ?? '') ? (tabs[tabs.length - 1] ?? null) : state.activeId
      return { ...state, db: { ...state.db, nodes }, tabs, activeId, modal: { kind: 'none' } }
    }

    case 'UPDATE_NODE_FIELD': {
      const nodes = state.db.nodes.map(n => n.id === action.id ? { ...n, [action.field]: action.value } : n)
      return { ...state, db: { ...state.db, nodes } }
    }

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.db.settings, [action.key]: action.value }
      return { ...state, db: { ...state.db, settings } }
    }

    case 'OPEN_ADD_MODAL':
      return { ...state, modal: { kind: 'add', type: action.modalType, parentId: action.parentId }, pickedColor: FOLDER_COLORS[0] }

    case 'OPEN_RENAME_MODAL':
      return { ...state, modal: { kind: 'rename', id: action.id } }

    case 'OPEN_DELETE_MODAL':
      return { ...state, modal: { kind: 'delete', id: action.id } }

    case 'OPEN_VALUE_INSPECTOR':
      return { ...state, modal: { kind: 'value-inspector', entry: action.entry } }

    case 'CLOSE_MODAL':
      return { ...state, modal: { kind: 'none' } }

    case 'SET_PICKED_COLOR':
      return { ...state, pickedColor: action.color }

    case 'TOGGLE_THEME': {
      const theme = state.theme === 'dark' ? 'light' : 'dark'
      return { ...state, theme }
    }

    case 'SET_THEME':
      return { ...state, theme: action.theme }

    case 'SET_STATUS':
      return { ...state, statusLabel: action.label, statusDot: action.dot ?? state.statusDot }

    case 'OPEN_CTX_MENU':
      return { ...state, ctxMenu: { id: action.id, x: action.x, y: action.y } }

    case 'CLOSE_CTX_MENU':
      return { ...state, ctxMenu: null }

    default:
      return state
  }
}

// ── CONTEXT ──────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
  schedSave: () => void
  pickFile: () => Promise<void>
  saveNow: (requestHandle?: boolean) => Promise<void>
  exportFile: () => Promise<void>
  importFile: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}

// ── PROVIDER ─────────────────────────────────────────────────────
interface AppProviderProps {
  children: ReactNode
  persistence: {
    schedSave: () => void
    pickFile: () => Promise<void>
    saveNow: (requestHandle?: boolean) => Promise<void>
    exportFile: () => Promise<void>
    importFile: () => void
  }
  initialState: AppState
  dispatch: Dispatch<AppAction>
  state: AppState
}

export function AppProvider({ children, persistence, state, dispatch }: AppProviderProps) {
  return (
    <AppContext.Provider value={{ state, dispatch, ...persistence }}>
      {children}
    </AppContext.Provider>
  )
}

// ── INITIAL STATE FACTORY ─────────────────────────────────────────
function getInitialTheme(): 'dark' | 'light' {
  try { return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark' } catch { return 'dark' }
}

export function createInitialState(): AppState {
  return {
    db: normalizeDB(),
    activeId: null,
    tabs: [],
    theme: getInitialTheme(),
    statusLabel: 'No file linked',
    statusDot: '',
    modal: { kind: 'none' },
    pickedColor: FOLDER_COLORS[0],
    ctxMenu: null,
  }
}

export { reducer, THEME_KEY }
