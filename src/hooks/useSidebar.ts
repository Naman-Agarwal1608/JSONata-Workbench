import { useEffect, useRef, useState } from 'react'

interface SidebarControls {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  onSidebarEnter: () => void
  onSidebarLeave: () => void
  toggleCollapse: () => void
}

export function useSidebar(): SidebarControls {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Refs so the mousemove listener (registered once) always reads current values
  const collapsedRef = useRef(false)
  const hoverRef = useRef(false)
  const lastMouseXRef = useRef(Number.POSITIVE_INFINITY)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      lastMouseXRef.current = e.clientX
      if (!collapsedRef.current) {
        setSidebarOpen(true)
        return
      }
      if (hoverRef.current) {
        setSidebarOpen(true)
        return
      }
      setSidebarOpen(e.clientX <= 18)
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  function onSidebarEnter() {
    hoverRef.current = true
    setSidebarOpen(true)
  }

  function onSidebarLeave() {
    hoverRef.current = false
    setSidebarOpen(lastMouseXRef.current <= 18)
  }

  function toggleCollapse() {
    setSidebarCollapsed(prev => {
      const next = !prev
      collapsedRef.current = next
      setSidebarOpen(!next)
      return next
    })
  }

  return { sidebarOpen, setSidebarOpen, sidebarCollapsed, onSidebarEnter, onSidebarLeave, toggleCollapse }
}
