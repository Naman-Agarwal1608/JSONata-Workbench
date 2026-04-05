import type { CustomFunctionEntry, ParseResult } from '../types/workspace'
import { extractStackLineCol, formatErrorLocation } from './helpers'

export function parseCustomFunctions(raw: string): ParseResult<CustomFunctionEntry[]> {
  if (!raw.trim()) return { ok: true, value: [] }
  const src = raw.trim()
  const candidates: Array<{ code: string; lineOffset: number; colOffset: number }> = []
  if (src.startsWith('({') || src.startsWith('{')) candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 })
  if (src.startsWith('(')) candidates.push({ code: `return \n${src};`, lineOffset: 1, colOffset: 0 })
  candidates.push({ code: `return ({\n${src}\n});`, lineOffset: 1, colOffset: 0 })
  candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 })

  let defs: unknown
  let lastErr: unknown = null
  let lastLoc = null
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-new-func
      defs = (new Function(candidate.code))()
      lastErr = null; lastLoc = null
      break
    } catch (e) {
      lastErr = e
      const stackLoc = extractStackLineCol(e)
      lastLoc = stackLoc ? {
        line: Math.max(1, stackLoc.line - candidate.lineOffset),
        column: stackLoc.line - candidate.lineOffset <= 1
          ? Math.max(1, (stackLoc.column ?? 1) - candidate.colOffset)
          : (stackLoc.column ?? 1)
      } : null
    }
  }

  if (lastErr) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
    return { ok: false, message: `Custom functions: ${msg}${formatErrorLocation(lastLoc)}`, location: lastLoc ?? undefined }
  }
  if (!defs || typeof defs !== 'object' || Array.isArray(defs)) {
    return { ok: false, message: 'Custom functions must evaluate to an object.' }
  }

  const out: CustomFunctionEntry[] = []
  for (const [key, val] of Object.entries(defs as Record<string, unknown>)) {
    const regName = String(key).replace(/^\$/, '')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(regName)) {
      return { ok: false, message: `Custom functions: "${key}" is not a valid function name.` }
    }
    if (typeof val === 'function') {
      out.push({ name: regName, label: `$${regName}`, impl: val as (...args: unknown[]) => unknown, info: 'Custom workspace function' })
      continue
    }
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>
      if (typeof obj.implementation !== 'function') {
        return { ok: false, message: `Custom functions: "${key}" must be a function or { implementation, signature?, description? }.` }
      }
      if (obj.signature !== undefined && typeof obj.signature !== 'string') {
        return { ok: false, message: `Custom functions: "${key}" signature must be a string.` }
      }
      if (obj.description !== undefined && typeof obj.description !== 'string') {
        return { ok: false, message: `Custom functions: "${key}" description must be a string.` }
      }
      out.push({
        name: regName, label: `$${regName}`,
        impl: obj.implementation as (...args: unknown[]) => unknown,
        signature: obj.signature as string | undefined,
        info: (obj.description as string | undefined) ?? 'Custom workspace function',
      })
      continue
    }
    return { ok: false, message: `Custom functions: "${key}" must be a function or { implementation, signature?, description? }.` }
  }
  return { ok: true, value: out }
}

export function registerCustomFunctions(
  compiled: { assign: (name: string, fn: unknown) => void; registerFunction: (name: string, fn: unknown, sig: string) => void },
  fns: CustomFunctionEntry[]
): void {
  fns.forEach(fn => {
    compiled.assign(fn.name, fn.impl)
    if (fn.signature) compiled.registerFunction(fn.name, fn.impl, fn.signature)
  })
}
