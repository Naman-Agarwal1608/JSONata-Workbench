import { useEffect, useRef, useState } from 'react'

export function useResizablePanels(initialLeft = 50, initialTop = 60) {
  const [rszLeft, setRszLeft] = useState(initialLeft)
  const [rszTop, setRszTop] = useState(initialTop)

  const hRszRef = useRef<HTMLDivElement>(null)
  const vRszRef = useRef<HTMLDivElement>(null)
  const panelsTopRef = useRef<HTMLDivElement>(null)
  const panelsRef = useRef<HTMLDivElement>(null)

  // Keep latest values accessible in closures
  const rszLeftRef = useRef(rszLeft)
  const rszTopRef = useRef(rszTop)
  useEffect(() => { rszLeftRef.current = rszLeft }, [rszLeft])
  useEffect(() => { rszTopRef.current = rszTop }, [rszTop])

  useEffect(() => {
    const hEl = hRszRef.current
    const vEl = vRszRef.current
    if (!hEl || !vEl) return

    function onHDown(e: MouseEvent) {
      e.preventDefault()
      const startX = e.clientX
      const startW = rszLeftRef.current
      const totalW = panelsTopRef.current?.getBoundingClientRect().width ?? 1
      hEl!.classList.add('dragging')
      function onMove(ev: MouseEvent) {
        setRszLeft(Math.max(15, Math.min(85, startW + (ev.clientX - startX) / totalW * 100)))
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        hEl!.classList.remove('dragging')
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    function onVDown(e: MouseEvent) {
      e.preventDefault()
      const startY = e.clientY
      const startH = rszTopRef.current
      const totalH = panelsRef.current?.getBoundingClientRect().height ?? 1
      vEl!.classList.add('dragging')
      function onMove(ev: MouseEvent) {
        setRszTop(Math.max(20, Math.min(80, startH + (ev.clientY - startY) / totalH * 100)))
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        vEl!.classList.remove('dragging')
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    hEl.addEventListener('mousedown', onHDown)
    vEl.addEventListener('mousedown', onVDown)
    return () => {
      hEl.removeEventListener('mousedown', onHDown)
      vEl.removeEventListener('mousedown', onVDown)
    }
  }, [])

  return { rszLeft, rszTop, hRszRef, vRszRef, panelsTopRef, panelsRef }
}
