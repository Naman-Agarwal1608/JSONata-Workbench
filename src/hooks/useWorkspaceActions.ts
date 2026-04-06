import { useMemo } from 'react'
import type { InspectEntry } from '../types/workspace'
import { useAppDispatch, usePersistenceContext } from '../store/appContext'

export function useWorkspaceActions() {
  const dispatch = useAppDispatch()
  const { schedSave } = usePersistenceContext()

  return useMemo(() => ({
    goHome() {
      dispatch({ type: 'GO_HOME' })
    },
    toggleTheme() {
      dispatch({ type: 'TOGGLE_THEME' })
    },
    openScript(id: string) {
      dispatch({ type: 'OPEN_SCRIPT', id })
    },
    closeTab(id: string) {
      dispatch({ type: 'CLOSE_TAB', id })
    },
    toggleFolder(id: string) {
      dispatch({ type: 'TOGGLE_FOLDER', id })
      schedSave()
    },
    updateNodeField(id: string, field: 'input' | 'expr' | 'name', value: string) {
      dispatch({ type: 'UPDATE_NODE_FIELD', id, field, value })
    },
    updateSettings(key: 'globalContext' | 'bindings' | 'customFunctions', value: string) {
      dispatch({ type: 'UPDATE_SETTINGS', key, value })
    },
    openAddModal(modalType: 'folder' | 'script', parentId: string | null) {
      dispatch({ type: 'OPEN_ADD_MODAL', modalType, parentId })
    },
    openRenameModal(id: string) {
      dispatch({ type: 'OPEN_RENAME_MODAL', id })
    },
    openDeleteModal(id: string) {
      dispatch({ type: 'OPEN_DELETE_MODAL', id })
    },
    closeModal() {
      dispatch({ type: 'CLOSE_MODAL' })
    },
    addNode(nodeType: 'folder' | 'script', name: string, parentId: string | null, color?: string) {
      dispatch({ type: 'ADD_NODE', nodeType, name, parentId, color })
    },
    renameNode(id: string, name: string) {
      dispatch({ type: 'RENAME_NODE', id, name })
    },
    deleteNode(id: string) {
      dispatch({ type: 'DELETE_NODE', id })
    },
    setPickedColor(color: string) {
      dispatch({ type: 'SET_PICKED_COLOR', color })
    },
    openContextMenu(id: string, x: number, y: number) {
      dispatch({ type: 'OPEN_CTX_MENU', id, x, y })
    },
    closeContextMenu() {
      dispatch({ type: 'CLOSE_CTX_MENU' })
    },
    openValueInspector(entry: InspectEntry) {
      dispatch({ type: 'OPEN_VALUE_INSPECTOR', entry })
    },
  }), [dispatch, schedSave])
}
