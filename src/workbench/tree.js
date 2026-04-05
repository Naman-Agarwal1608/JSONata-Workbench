export function createTreeController({
  esc,
  kids,
  folderColor,
  renderMain,
  renderTree: rerenderTree,
  schedSave,
  getActiveId,
  setActiveId,
  getTabs,
  setTabs,
  openAddModal,
  openRename,
  openDeleteModal,
  onNodeOpen
}) {
  function mkAct(ico, title, fn) {
    const b = document.createElement('button')
    b.className = 'tact'
    b.title = title
    b.textContent = ico
    b.addEventListener('click', e => {
      e.stopPropagation()
      fn()
    })
    return b
  }

  function buildNode(node, depth) {
    const wrap = document.createElement('div')
    wrap.className = 'tnode'

    const row = document.createElement('div')
    row.className = 'trow' + (node.id === getActiveId() ? ' active' : '')
    row.style.paddingLeft = (depth * 13 + 4) + 'px'

    const caret = document.createElement('div')
    caret.className = 'tcaret' + (node.type === 'script' ? ' invis' : (node.open ? ' open' : ''))
    caret.textContent = '▶'

    const icon = document.createElement('div')
    if (node.type === 'folder') {
      icon.className = 'tfoldericon'
      icon.style.setProperty('--fc', node.color || folderColor(node.id))
    } else {
      icon.className = 'tscripticon'
      icon.textContent = '◈'
    }

    const lbl = document.createElement('div')
    lbl.className = 'tlabel'
    lbl.textContent = node.name

    const acts = document.createElement('div')
    acts.className = 'tacts'
    if (node.type === 'folder') {
      acts.appendChild(mkAct('📁', 'New subfolder', () => openAddModal('folder', node.id)))
      acts.appendChild(mkAct('＋', 'New script', () => openAddModal('script', node.id)))
    }
    acts.appendChild(mkAct('✎', 'Rename', () => openRename(node.id)))
    const del = mkAct('✕', 'Delete', () => openDeleteModal(node.id))
    del.classList.add('del')
    acts.appendChild(del)

    row.append(caret, icon, lbl, acts)
    row.addEventListener('click', e => {
      if (e.target.closest('.tacts')) return
      if (node.type === 'folder') toggleFolder(node.id)
      else openScript(node.id)
    })
    row.addEventListener('contextmenu', e => {
      e.preventDefault()
      onNodeOpen(e, node.id)
    })
    wrap.appendChild(row)

    if (node.type === 'folder') {
      const ch = document.createElement('div')
      ch.className = 'tchildren' + (node.open ? ' open' : '')
      const children = kids(node.id)
      if (children.length) {
        children.forEach(c => ch.appendChild(buildNode(c, depth + 1)))
      } else {
        const dz = document.createElement('div')
        dz.className = 'tempty'
        dz.style.paddingLeft = ((depth + 1) * 13 + 20) + 'px'
        dz.textContent = '+ New Script'
        dz.onclick = () => openAddModal('script', node.id)
        ch.appendChild(dz)
      }
      wrap.appendChild(ch)
    }

    return wrap
  }

  function renderTree() {
    const sc = document.getElementById('tscroll')
    const roots = kids(null)
    if (!roots.length) {
      sc.innerHTML = '<div style="padding:18px 14px;font-size:11px;color:var(--tx3);line-height:2">No collections yet.<br>Click 📁 above to create one.</div>'
      return
    }
    sc.innerHTML = ''
    roots.forEach(n => sc.appendChild(buildNode(n, 0)))
  }

  function toggleFolder(id) {
    const node = kids(null).flat ? null : null
    const target = findNodeById(id)
    if (target) {
      target.open = !target.open
      rerenderTree()
      schedSave()
    }
  }

  function findNodeById(id) {
    const all = []
    const walk = parentId => {
      const group = kids(parentId)
      group.forEach(node => {
        all.push(node)
        if (node.type === 'folder') walk(node.id)
      })
    }
    walk(null)
    return all.find(node => node.id === id) || null
  }

  function openScript(id) {
    setActiveId(id)
    const tabs = getTabs()
    if (!tabs.includes(id)) setTabs([...tabs, id])
    rerenderTree()
    renderMain()
  }

  function closeTab(id, e) {
    if (e) e.stopPropagation()
    const nextTabs = getTabs().filter(t => t !== id)
    setTabs(nextTabs)
    if (getActiveId() === id) setActiveId(nextTabs[nextTabs.length - 1] || null)
    renderMain()
    rerenderTree()
  }

  function renderTabs() {
    const bar = document.getElementById('tabbar')
    if (!bar) return
    bar.innerHTML = ''
    getTabs().forEach(id => {
      const node = findNodeById(id)
      if (!node) return
      const tab = document.createElement('div')
      tab.className = 'tab' + (id === getActiveId() ? ' active' : '')
      tab.innerHTML = `<span>${esc(node.name)}</span><button class="tabx">✕</button>`
      tab.addEventListener('click', () => {
        if (getActiveId() !== id) {
          setActiveId(id)
          rerenderTree()
          renderMain()
        }
      })
      tab.querySelector('.tabx').addEventListener('click', e => closeTab(id, e))
      bar.appendChild(tab)
    })
  }

  return {
    renderTree,
    renderTabs,
    openScript,
    closeTab
  }
}
