export function createLayoutController({
  getLeftSize,
  setLeftSize,
  getTopSize,
  setTopSize
}) {
  function applyPanelSizes() {
    const inputP = document.getElementById('panelInput')
    const exprP = document.getElementById('panelExpr')
    const topRow = document.getElementById('panelsTop')
    const outRow = document.getElementById('panelOut')
    if (inputP) { inputP.style.flexGrow = getLeftSize(); inputP.style.flexShrink = '1'; inputP.style.flexBasis = '0' }
    if (exprP) { exprP.style.flexGrow = 100 - getLeftSize(); exprP.style.flexShrink = '1'; exprP.style.flexBasis = '0' }
    if (topRow) { topRow.style.flexGrow = getTopSize(); topRow.style.flexShrink = '1'; topRow.style.flexBasis = '0' }
    if (outRow) { outRow.style.flexGrow = 100 - getTopSize(); outRow.style.flexShrink = '1'; outRow.style.flexBasis = '0' }
  }

  function initResizers() {
    applyPanelSizes()
    const hRsz = document.getElementById('hrsz')
    const vRsz = document.getElementById('vrsz')
    if (hRsz) {
      hRsz.addEventListener('mousedown', e => {
        e.preventDefault()
        const startX = e.clientX
        const startW = getLeftSize()
        const totalW = document.getElementById('panelsTop').getBoundingClientRect().width
        hRsz.classList.add('dragging')
        function onMove(ev) {
          setLeftSize(Math.max(15, Math.min(85, startW + (ev.clientX - startX) / totalW * 100)))
          applyPanelSizes()
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          hRsz.classList.remove('dragging')
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
    }
    if (vRsz) {
      vRsz.addEventListener('mousedown', e => {
        e.preventDefault()
        const startY = e.clientY
        const startH = getTopSize()
        const totalH = document.querySelector('.panels').getBoundingClientRect().height
        vRsz.classList.add('dragging')
        function onMove(ev) {
          setTopSize(Math.max(20, Math.min(80, startH + (ev.clientY - startY) / totalH * 100)))
          applyPanelSizes()
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          vRsz.classList.remove('dragging')
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
    }
  }

  return {
    applyPanelSizes,
    initResizers
  }
}
