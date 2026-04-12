import type { ErrorLocation, ParseResult, StatementInfo } from '../types/workspace'

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2, 8) + Date.now().toString(36))
}

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function parseJSONText(
  raw: string,
  label: string,
  { requireObject = false } = {}
): ParseResult<unknown> {
  if (!raw.trim()) return { ok: true, value: {} }
  try {
    const value = JSON.parse(raw)
    if (requireObject && (value === null || Array.isArray(value) || typeof value !== 'object')) {
      return { ok: false, message: `${label} must be a JSON object.` }
    }
    return { ok: true, value }
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    return { ok: false, message: `${label}: ${msg}` }
  }
}

export function parseExecutionData(rawInput: string, rawGlobal: string): ParseResult<unknown> {
  const input = rawInput.trim()
  const global = rawGlobal.trim()
  if (!input && !global) return { ok: true, value: {} }
  if (input) {
    try { return { ok: true, value: JSON.parse(input) } } catch { /* fall back to global */ }
  }
  if (global) {
    try { return { ok: true, value: JSON.parse(global) } } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
      return { ok: false, message: `Global context error:\n${msg}` }
    }
  }
  try { return { ok: true, value: JSON.parse(input) } } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    return { ok: false, message: `JSON input error:\n${msg}` }
  }
}

export function getValueViewerConfig(value: unknown): { doc: string; mode: 'json' | 'plain' } {
  if (value === undefined) return { doc: '(undefined)', mode: 'plain' }
  if (typeof value === 'string') return { doc: value, mode: 'plain' }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return { doc: JSON.stringify(value, null, 2), mode: 'json' }
  }
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return { doc: String(value), mode: 'plain' }
  }
  if (value instanceof Error) {
    return { doc: value.stack || value.message || String(value), mode: 'plain' }
  }

  try {
    const seen = new WeakSet<object>()
    const doc = JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') return currentValue.toString()
      if (typeof currentValue === 'symbol') return String(currentValue)
      if (typeof currentValue === 'function') return `[Function ${currentValue.name || 'anonymous'}]`
      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        }
      }
      if (currentValue && typeof currentValue === 'object') {
        if (seen.has(currentValue as object)) return '[Circular]'
        seen.add(currentValue as object)
      }
      return currentValue
    }, 2)
    if (typeof doc === 'string') return { doc, mode: 'json' }
  } catch {
    // fall through
  }

  return { doc: String(value), mode: 'plain' }
}

export function getLineInfoFromOffset(text: string, offset: number): ErrorLocation & { offset: number } {
  const safe = Math.max(0, Math.min(text.length, offset ?? 0))
  let line = 1
  let col = 1
  for (let i = 0; i < safe; i++) {
    if (text[i] === '\n') { line++; col = 1 } else { col++ }
  }
  return { line, column: col, offset: safe }
}

export function getOffsetFromLineCol(text: string, line: number, column = 1): number {
  const targetLine = Math.max(1, line ?? 1)
  const targetCol = Math.max(1, column ?? 1)
  let curLine = 1
  let idx = 0
  while (curLine < targetLine && idx < text.length) {
    if (text[idx] === '\n') curLine++
    idx++
  }
  return Math.min(text.length, idx + targetCol - 1)
}

export function formatErrorLocation(loc: ErrorLocation | null | undefined): string {
  if (!loc?.line) return ''
  return ` (line ${loc.line}, col ${loc.column ?? 1})`
}

export function extractStackLineCol(err: unknown): ErrorLocation | null {
  const stack = String((err as { stack?: string })?.stack ?? '')
  const match = stack.match(/<anonymous>:(\d+):(\d+)/)
  if (!match) return null
  return { line: Number(match[1]), column: Number(match[2]) }
}

export function getJsonataErrorLocation(err: unknown, source: string): ErrorLocation | null {
  const e = err as { position?: number; message?: string }
  if (e && typeof e.position === 'number') {
    return getLineInfoFromOffset(source, Math.max(0, e.position - 1))
  }
  const msg = String(e?.message ?? '')
  const lineCol = msg.match(/\bline\s+(\d+)\b(?:\D+col(?:umn)?\s+(\d+))?/i)
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2] ?? 1) }
  return null
}

export function summariseValue(value: unknown): string {
  if (value === undefined) return '(undefined)'
  if (value === null) return 'null'
  if (typeof value === 'string') {
    return value.length > 88
      ? `${JSON.stringify(value.slice(0, 88))}…`
      : JSON.stringify(value)
  }
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
    return `Object(${keys.length} keys){${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''}}`
  }
  return JSON.stringify(value)
}

export function extractJsonKeys(val: unknown): string[] {
  if (!val || typeof val !== 'object') return []
  if (Array.isArray(val)) {
    const first = val[0]
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return Object.keys(first as Record<string, unknown>)
    }
    return []
  }
  return Object.keys(val as Record<string, unknown>)
}

export function getExpressionSnippet(expr: string, loc: ErrorLocation): string {
  const lines = expr.split('\n')
  const lineNo = Math.max(1, Math.min(lines.length, loc?.line ?? 1))
  const start = Math.max(1, lineNo - 1)
  const end = Math.min(lines.length, lineNo + 1)
  const block: string[] = []
  for (let i = start; i <= end; i++) block.push(`${String(i).padStart(3, ' ')} | ${lines[i - 1]}`)
  const caretPad = ' '.repeat(6 + Math.max(0, (loc?.column ?? 1) - 1))
  block.splice(lineNo - start + 1, 0, `${caretPad}^`)
  return block.join('\n')
}

function getExpressionBodyBounds(expr: string): { start: number; end: number } {
  const trimmed = expr.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return { start: 0, end: expr.length }
  const start = expr.indexOf('(')
  let depth = 0
  let quote: string | null = null
  let escape = false
  for (let i = start; i < expr.length; i++) {
    const ch = expr[i]
    if (quote) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) {
        if (!expr.slice(i + 1).trim()) return { start: start + 1, end: i }
        return { start: 0, end: expr.length }
      }
    }
  }
  return { start: 0, end: expr.length }
}

export function splitTopLevelStatements(expr: string): StatementInfo[] {
  const { start, end } = getExpressionBodyBounds(expr)
  const body = expr.slice(start, end)
  const out: StatementInfo[] = []
  let quote: string | null = null
  let escape = false
  let paren = 0, brace = 0, bracket = 0, last = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')' && paren > 0) paren--
    else if (ch === '{') brace++
    else if (ch === '}' && brace > 0) brace--
    else if (ch === '[') bracket++
    else if (ch === ']' && bracket > 0) bracket--
    else if (ch === ';' && paren === 0 && brace === 0 && bracket === 0) {
      const raw = body.slice(last, i)
      if (raw.trim()) {
        const startOffset = start + last
        const endOffset = start + i
        out.push({ text: raw.trim(), startOffset, endOffset, startLine: getLineInfoFromOffset(expr, startOffset).line, endLine: getLineInfoFromOffset(expr, endOffset).line })
      }
      last = i + 1
    }
  }
  const tail = body.slice(last)
  if (tail.trim()) {
    const startOffset = start + last
    const endOffset = start + body.length
    out.push({ text: tail.trim(), startOffset, endOffset, startLine: getLineInfoFromOffset(expr, startOffset).line, endLine: getLineInfoFromOffset(expr, endOffset).line })
  }
  return out
}

export function buildScopedExpression(expr: string, targetExpr: string, offset: number): string {
  const statements = splitTopLevelStatements(expr)
  const currentStmt = statements.find(stmt => stmt.startOffset <= offset && offset <= stmt.endOffset)
  const prefixStatements = statements
    .filter(stmt => {
      if (stmt.endOffset <= offset) return true
      if (stmt !== currentStmt) return false
      const assignMatch = stmt.text.match(/^\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s*:=/)
      return assignMatch?.[1] === targetExpr
    })
    .map(stmt => stmt.text)

  if (!prefixStatements.length) return targetExpr
  return `(\n${prefixStatements.join(';\n')};\n${targetExpr}\n)`
}
