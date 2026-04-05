import { useEffect, useRef } from 'react'

export function useWorkbenchRuntime(): void {
  const disposeRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    let cancelled = false

    import('../workbench/runtime.js').then(({ initWorkbench }) => {
      if (cancelled) return
      disposeRef.current = initWorkbench()
    })

    return () => {
      cancelled = true
      disposeRef.current?.()
      disposeRef.current = null
    }
  }, [])
}
