export function createModalController({
  uid,
  closeInspectValue,
  allDesc,
  renderTree,
  renderMain,
  renderTabs,
  schedSave,
  getDb,
  setDb,
  getActiveId,
  setActiveId,
  getTabs,
  setTabs,
  getPickedCol,
  setPickedCol,
  getAddCtx,
  setAddCtx,
  getCtxId,
  setCtxId,
  getRnId,
  setRnId,
  getDelId,
  setDelId,
  getColors
}) {
  function openAddModal(type, parentId) {
    setAddCtx({ type, parentId })
    setPickedCol(getColors()[0])
    document.getElementById('addTitle').textContent =
      type === 'folder' ? (parentId ? 'New Subfolder' : 'New Collection') : 'New Script'
    document.getElementById('addName').value = ''
    document.getElementById('colorField').style.display = type === 'folder' ? '' : 'none'
    renderSwatches()
    document.getElementById('addOv').classList.add('open')
    setTimeout(() => document.getElementById('addName').focus(), 60)
  }

  function confirmAdd() {
    const name = document.getElementById('addName').value.trim()
    if (!name) return
    const addCtx = getAddCtx()
    const db = getDb()
    const node = {
      id: uid(),
      type: addCtx.type,
      name,
      parentId: addCtx.parentId || null,
      color: addCtx.type === 'folder' ? getPickedCol() : undefined,
      open: true,
      expr: '',
      input: '',
      order: db.nodes.filter(n => n.parentId === (addCtx.parentId || null)).length
    }
    let pid = addCtx.parentId
    while (pid) {
      const parent = db.nodes.find(n => n.id === pid)
      if (!parent) break
      parent.open = true
      pid = parent.parentId
    }
    db.nodes.push(node)
    schedSave()
    closeOv()
    renderTree()
    if (node.type === 'script') {
      setActiveId(node.id)
      const tabs = getTabs()
      if (!tabs.includes(node.id)) setTabs([...tabs, node.id])
      renderTree()
      renderMain()
    }
  }

  function openRename(id) {
    setRnId(id)
    const node = getDb().nodes.find(x => x.id === id)
    document.getElementById('rnName').value = node?.name || ''
    document.getElementById('rnOv').classList.add('open')
    setTimeout(() => document.getElementById('rnName').focus(), 60)
  }

  function openDeleteModal(id) {
    setDelId(id)
    const node = getDb().nodes.find(x => x.id === id)
    if (!node) return
    const desc = allDesc(id).length
    document.getElementById('delMsg').textContent =
      desc ? `Delete "${node.name}" and ${desc} item(s) inside it? This cannot be undone.` : `Delete "${node.name}"? This cannot be undone.`
    document.getElementById('delOv').classList.add('open')
  }

  function confirmRename() {
    const name = document.getElementById('rnName').value.trim()
    if (!name) return
    const rnId = getRnId()
    const node = getDb().nodes.find(x => x.id === rnId)
    if (node) {
      node.name = name
      schedSave()
      renderTree()
    }
    if (rnId === getActiveId()) {
      const input = document.getElementById('ename')
      if (input) input.value = name
      renderTabs()
    }
    closeOv()
  }

  function confirmDelete() {
    const delId = getDelId()
    const node = getDb().nodes.find(x => x.id === delId)
    if (!node) {
      closeOv()
      return
    }
    const desc = allDesc(delId)
    const kill = new Set([delId, ...desc])
    const db = getDb()
    db.nodes = db.nodes.filter(n => !kill.has(n.id))
    const nextTabs = getTabs().filter(t => !kill.has(t))
    setTabs(nextTabs)
    if (kill.has(getActiveId())) setActiveId(nextTabs[nextTabs.length - 1] || null)
    closeOv()
    schedSave()
    renderTree()
    renderMain()
  }

  function closeOv() {
    setDelId(null)
    closeInspectValue()
    document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'))
  }

  function renderSwatches() {
    document.getElementById('swatches').innerHTML = getColors().map(c =>
      `<div class="sw${c === getPickedCol() ? ' sel' : ''}" style="background:${c}" onclick="pickC('${c}')"></div>`
    ).join('')
  }

  function pickC(c) {
    setPickedCol(c)
    renderSwatches()
  }

  function showCtx(e, id) {
    setCtxId(id)
    const node = getDb().nodes.find(x => x.id === id)
    const isFolder = node?.type === 'folder'
    document.getElementById('ctx-af').style.display = isFolder ? '' : 'none'
    document.getElementById('ctx-as').style.display = isFolder ? '' : 'none'
    const menu = document.getElementById('ctxm')
    menu.classList.add('open')
    let x = e.clientX
    let y = e.clientY
    if (x + 180 > window.innerWidth) x = window.innerWidth - 184
    if (y + 160 > window.innerHeight) y = window.innerHeight - 164
    menu.style.left = x + 'px'
    menu.style.top = y + 'px'
  }

  function ctxDo(action) {
    document.getElementById('ctxm').classList.remove('open')
    const ctxId = getCtxId()
    const node = getDb().nodes.find(x => x.id === ctxId)
    if (!node) return
    if (action === 'af') openAddModal('folder', ctxId)
    else if (action === 'as') openAddModal('script', ctxId)
    else if (action === 'rn') openRename(ctxId)
    else if (action === 'del') openDeleteModal(ctxId)
  }

  return {
    openAddModal,
    confirmAdd,
    openRename,
    openDeleteModal,
    confirmRename,
    confirmDelete,
    closeOv,
    renderSwatches,
    pickC,
    showCtx,
    ctxDo
  }
}
