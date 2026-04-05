export function createPersistenceController({
  normalizeDB,
  hasWorkspaceContent,
  loadDefaultWorkspace,
  resetWorkspaceViewState,
  renderAll,
  slabel,
  sdot,
  getDb,
  setDb,
  getStorageKey,
  getThemeKey,
  isCurrent
}) {
  const SK = getStorageKey()
  const THEME_KEY = getThemeKey()
  const FHDB = 'jsonataCollectionsMeta'
  const FHSTORE = 'handles'
  const FHKEY = 'workspaceFile'

  let fh = null
  let saveTimer = null
  let savePromptDismissed = false

  function openMetaDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(FHDB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(FHSTORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function idbSet(key, value) {
    const dbi = await openMetaDB()
    return new Promise((resolve, reject) => {
      const tx = dbi.transaction(FHSTORE, 'readwrite')
      tx.objectStore(FHSTORE).put(value, key)
      tx.oncomplete = () => { dbi.close(); resolve() }
      tx.onerror = () => { dbi.close(); reject(tx.error) }
    })
  }

  async function idbGet(key) {
    const dbi = await openMetaDB()
    return new Promise((resolve, reject) => {
      const tx = dbi.transaction(FHSTORE, 'readonly')
      const req = tx.objectStore(FHSTORE).get(key)
      req.onsuccess = () => { dbi.close(); resolve(req.result) }
      req.onerror = () => { dbi.close(); reject(req.error) }
    })
  }

  async function idbDelete(key) {
    const dbi = await openMetaDB()
    return new Promise((resolve, reject) => {
      const tx = dbi.transaction(FHSTORE, 'readwrite')
      tx.objectStore(FHSTORE).delete(key)
      tx.oncomplete = () => { dbi.close(); resolve() }
      tx.onerror = () => { dbi.close(); reject(tx.error) }
    })
  }

  async function saveHandleMeta() {
    if (!fh) return
    try {
      await idbSet(FHKEY, fh)
      localStorage.setItem(SK, JSON.stringify({ linkedFileName: fh.name || '' }))
    } catch { }
  }

  async function clearHandleMeta() {
    try {
      await idbDelete(FHKEY)
      localStorage.removeItem(SK)
    } catch { }
  }

  async function loadSavedHandle() {
    if (!window.indexedDB) return null
    try {
      return await idbGet(FHKEY)
    } catch {
      return null
    }
  }

  async function ensureHandlePermission(mode = 'readwrite', { request = false } = {}) {
    if (!fh) return false
    try {
      let perm = await fh.queryPermission({ mode })
      if (perm === 'granted') return true
      if (request) {
        perm = await fh.requestPermission({ mode })
        return perm === 'granted'
      }
    } catch { }
    return false
  }

  async function readLinkedFile(handle = fh) {
    if (!handle) return false
    try {
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm === 'denied') return false
      const file = await handle.getFile()
      const parsed = normalizeDB(JSON.parse(await file.text()))
      if (!isCurrent()) return false
      fh = handle
      setDb(parsed)
      resetWorkspaceViewState()
      renderAll()
      savePromptDismissed = false
      slabel('Linked · ' + handle.name)
      return true
    } catch (e) {
      console.warn('Failed to read linked file:', e)
      return false
    }
  }

  async function ensureFileHandle(request = true) {
    if (fh) return fh
    if (!request && savePromptDismissed) return null
    if (!('showSaveFilePicker' in window)) {
      alert('File System Access API needs Chrome/Edge to auto-save to disk.')
      return null
    }
    try {
      fh = await window.showSaveFilePicker({
        suggestedName: 'jsonata-workbench.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      })
      await saveHandleMeta()
      savePromptDismissed = false
      slabel('Linked · ' + fh.name)
      return fh
    } catch (e) {
      if (e.name === 'AbortError') savePromptDismissed = true
      if (e.name !== 'AbortError') console.error(e)
      return null
    }
  }

  async function bootPersistence() {
    try {
      const meta = JSON.parse(localStorage.getItem(SK) || '{}')
      const savedHandle = await loadSavedHandle()
      if (!isCurrent()) return
      if (savedHandle) {
        if (await readLinkedFile(savedHandle)) {
          await saveHandleMeta()
          return
        }
        if (!isCurrent()) return
        fh = null
        await clearHandleMeta()
      }
      if (!isCurrent()) return
      if (!hasWorkspaceContent(getDb())) {
        const loadedDefault = await loadDefaultWorkspace()
        if (loadedDefault || !isCurrent()) return
      }
      if (meta?.linkedFileName) slabel('Unlinked · ' + meta.linkedFileName)
    } catch { }
  }

  function schedSave(saveNow) {
    sdot('busy')
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveNow(false), 800)
  }

  async function saveNow(requestHandle = true) {
    const handle = await ensureFileHandle(requestHandle)
    if (!handle) {
      sdot('')
      if (requestHandle) slabel('Save cancelled')
      else slabel('Unsaved · no file linked')
      return
    }
    if (!await ensureHandlePermission('readwrite', { request: true })) {
      sdot('')
      slabel('Save permission denied')
      return
    }
    try {
      const w = await handle.createWritable()
      await w.write(JSON.stringify(getDb(), null, 2))
      await w.close()
      await saveHandleMeta()
      slabel('Saved · ' + handle.name)
      sdot('ok')
      setTimeout(() => sdot(''), 2500)
    } catch (e) {
      console.error(e)
      sdot('')
      slabel('Disk save failed')
    }
  }

  async function pickFile() {
    if (!('showOpenFilePicker' in window)) {
      alert('File System Access API needs Chrome/Edge to link a workspace file.')
      return
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      })
      if (!handle) return
      if (await readLinkedFile(handle)) {
        await saveHandleMeta()
      } else {
        fh = null
        slabel('Link failed')
        alert('Could not read that workspace file.')
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e)
    }
  }

  async function exportFile() {
    if (!('showSaveFilePicker' in window)) {
      alert('File System Access API needs Chrome/Edge to export a workspace file.')
      return
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fh?.name || 'jsonata-workbench-export.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      })
      if (!handle) return
      const writable = await handle.createWritable()
      await writable.write(JSON.stringify(getDb(), null, 2))
      await writable.close()
      slabel('Exported · ' + handle.name)
      sdot('ok')
      setTimeout(() => sdot(''), 2500)
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e)
        slabel('Export failed')
      }
    }
  }

  function importFile() {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' })
    inp.onchange = async () => {
      try {
        const file = inp.files?.[0]
        if (!file) return
        const parsed = JSON.parse(await file.text())
        if (Array.isArray(parsed.nodes)) {
          setDb(normalizeDB(parsed))
          resetWorkspaceViewState()
          fh = null
          savePromptDismissed = false
          await clearHandleMeta()
          renderAll()
          slabel('Imported · unsaved')
          sdot('')
        } else {
          alert('Invalid format.')
        }
      } catch (e) {
        alert('Parse error: ' + e.message)
      }
    }
    inp.click()
  }

  function clearPendingSave() {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  return {
    bootPersistence,
    saveNow,
    schedSave: () => schedSave(saveNow),
    pickFile,
    exportFile,
    importFile,
    clearPendingSave,
    getLinkedHandle: () => fh,
    clearHandleMeta,
    saveHandleMeta
  }
}
