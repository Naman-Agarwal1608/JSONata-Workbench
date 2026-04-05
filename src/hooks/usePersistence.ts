import { useRef, type Dispatch } from 'react'
import { normalizeDB, hasWorkspaceContent } from '../lib/workspace'
import type { WorkspaceDB } from '../types/workspace'
import type { AppAction } from '../store/appContext'

const FHDB = 'jsonataCollectionsMeta'
const FHSTORE = 'handles'
const FHKEY = 'workspaceFile'
const SK = 'jcv5'

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FHDB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(FHSTORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const dbi = await openMetaDB()
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(FHSTORE, 'readwrite')
    tx.objectStore(FHSTORE).put(value, key)
    tx.oncomplete = () => { dbi.close(); resolve() }
    tx.onerror = () => { dbi.close(); reject(tx.error) }
  })
}

async function idbGet(key: string): Promise<unknown> {
  const dbi = await openMetaDB()
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(FHSTORE, 'readonly')
    const req = tx.objectStore(FHSTORE).get(key)
    req.onsuccess = () => { dbi.close(); resolve(req.result) }
    req.onerror = () => { dbi.close(); reject(req.error) }
  })
}

async function idbDelete(key: string): Promise<void> {
  const dbi = await openMetaDB()
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(FHSTORE, 'readwrite')
    tx.objectStore(FHSTORE).delete(key)
    tx.oncomplete = () => { dbi.close(); resolve() }
    tx.onerror = () => { dbi.close(); reject(tx.error) }
  })
}

interface PersistenceOptions {
  getDb: () => WorkspaceDB
  dispatch: Dispatch<AppAction>
  onLoadDefault: () => Promise<boolean>
}

export function usePersistence({ getDb, dispatch, onLoadDefault }: PersistenceOptions) {
  const fhRef = useRef<FileSystemFileHandle | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePromptDismissedRef = useRef(false)

  function setStatus(label: string, dot?: '' | 'busy' | 'ok') {
    dispatch({ type: 'SET_STATUS', label, dot })
  }

  async function saveHandleMeta(): Promise<void> {
    if (!fhRef.current) return
    try {
      await idbSet(FHKEY, fhRef.current)
      localStorage.setItem(SK, JSON.stringify({ linkedFileName: fhRef.current.name ?? '' }))
    } catch { /* ignore */ }
  }

  async function clearHandleMeta(): Promise<void> {
    try { await idbDelete(FHKEY); localStorage.removeItem(SK) } catch { /* ignore */ }
  }

  async function ensureHandlePermission(mode: FileSystemPermissionMode, request = false): Promise<boolean> {
    if (!fhRef.current) return false
    try {
      let perm = await (fhRef.current as FileSystemFileHandle & { queryPermission: (opts: { mode: string }) => Promise<string>; requestPermission: (opts: { mode: string }) => Promise<string> }).queryPermission({ mode })
      if (perm === 'granted') return true
      if (request) { perm = await (fhRef.current as FileSystemFileHandle & { requestPermission: (opts: { mode: string }) => Promise<string> }).requestPermission({ mode }); return perm === 'granted' }
    } catch { /* ignore */ }
    return false
  }

  async function readLinkedFile(handle: FileSystemFileHandle): Promise<boolean> {
    try {
      const perm = await (handle as FileSystemFileHandle & { queryPermission: (opts: { mode: string }) => Promise<string> }).queryPermission({ mode: 'read' })
      if (perm === 'denied') return false
      const file = await handle.getFile()
      const parsed = normalizeDB(JSON.parse(await file.text()))
      fhRef.current = handle
      dispatch({ type: 'SET_DB', db: parsed })
      dispatch({ type: 'RESET_VIEW_STATE' })
      savePromptDismissedRef.current = false
      setStatus('Linked · ' + handle.name)
      return true
    } catch (e) {
      console.warn('Failed to read linked file:', e)
      return false
    }
  }

  async function ensureFileHandle(request = true): Promise<FileSystemFileHandle | null> {
    if (fhRef.current) return fhRef.current
    if (!request && savePromptDismissedRef.current) return null
    if (!('showSaveFilePicker' in window)) {
      alert('File System Access API needs Chrome/Edge to auto-save to disk.')
      return null
    }
    try {
      fhRef.current = await (window as Window & { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: 'jsonata-workbench.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      await saveHandleMeta()
      savePromptDismissedRef.current = false
      setStatus('Linked · ' + fhRef.current!.name)
      return fhRef.current
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') savePromptDismissedRef.current = true
      else console.error(e)
      return null
    }
  }

  async function saveNow(requestHandle = true): Promise<void> {
    const handle = await ensureFileHandle(requestHandle)
    if (!handle) {
      dispatch({ type: 'SET_STATUS', label: requestHandle ? 'Save cancelled' : 'Unsaved · no file linked', dot: '' })
      return
    }
    if (!await ensureHandlePermission('readwrite', true)) {
      dispatch({ type: 'SET_STATUS', label: 'Save permission denied', dot: '' })
      return
    }
    try {
      const w = await handle.createWritable()
      await w.write(JSON.stringify(getDb(), null, 2))
      await w.close()
      await saveHandleMeta()
      dispatch({ type: 'SET_STATUS', label: 'Saved · ' + handle.name, dot: 'ok' })
      setTimeout(() => dispatch({ type: 'SET_STATUS', label: 'Saved · ' + handle.name, dot: '' }), 2500)
    } catch (e) {
      console.error(e)
      dispatch({ type: 'SET_STATUS', label: 'Disk save failed', dot: '' })
    }
  }

  function schedSave(): void {
    dispatch({ type: 'SET_STATUS', label: '', dot: 'busy' })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNow(false), 800)
  }

  function clearPendingSave(): void {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
  }

  async function pickFile(): Promise<void> {
    if (!('showOpenFilePicker' in window)) { alert('File System Access API needs Chrome/Edge to link a workspace file.'); return }
    try {
      const [handle] = await (window as Window & { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      if (!handle) return
      if (await readLinkedFile(handle)) { await saveHandleMeta() }
      else { fhRef.current = null; setStatus('Link failed') ; alert('Could not read that workspace file.') }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') console.error(e)
    }
  }

  async function exportFile(): Promise<void> {
    if (!('showSaveFilePicker' in window)) { alert('File System Access API needs Chrome/Edge to export.'); return }
    try {
      const handle = await (window as Window & { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: fhRef.current?.name ?? 'jsonata-workbench-export.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(JSON.stringify(getDb(), null, 2))
      await writable.close()
      dispatch({ type: 'SET_STATUS', label: 'Exported · ' + handle.name, dot: 'ok' })
      setTimeout(() => dispatch({ type: 'SET_STATUS', label: 'Exported · ' + handle.name, dot: '' }), 2500)
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') { console.error(e); setStatus('Export failed') }
    }
  }

  function importFile(): void {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' })
    inp.onchange = async () => {
      try {
        const file = inp.files?.[0]
        if (!file) return
        const parsed = JSON.parse(await file.text())
        if (Array.isArray(parsed.nodes)) {
          dispatch({ type: 'SET_DB', db: normalizeDB(parsed) })
          dispatch({ type: 'RESET_VIEW_STATE' })
          fhRef.current = null
          savePromptDismissedRef.current = false
          await clearHandleMeta()
          dispatch({ type: 'SET_STATUS', label: 'Imported · unsaved', dot: '' })
        } else { alert('Invalid format.') }
      } catch (e) { alert('Parse error: ' + (e instanceof Error ? e.message : e)) }
    }
    inp.click()
  }

  async function bootPersistence(): Promise<void> {
    try {
      const meta = JSON.parse(localStorage.getItem(SK) ?? '{}')
      const savedHandle = await idbGet(FHKEY) as FileSystemFileHandle | undefined
      if (savedHandle) {
        if (await readLinkedFile(savedHandle)) { await saveHandleMeta(); return }
        fhRef.current = null
        await clearHandleMeta()
      }
      if (!hasWorkspaceContent(getDb())) {
        const loaded = await onLoadDefault()
        if (loaded) return
      }
      if (meta?.linkedFileName) setStatus('Unlinked · ' + meta.linkedFileName)
    } catch { /* ignore */ }
  }

  return { schedSave, clearPendingSave, pickFile, saveNow, exportFile, importFile, bootPersistence }
}
