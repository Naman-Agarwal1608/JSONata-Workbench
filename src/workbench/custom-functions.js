export function createCustomFunctionsController({
  extractStackLineCol,
  formatErrorLocation,
  getSettings
}) {
  function parseCustomFunctions(raw) {
    if (!raw.trim()) return { ok: true, value: [] }
    const src = raw.trim()
    const candidates = []
    if (src.startsWith('({') || src.startsWith('{')) candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 })
    if (src.startsWith('(')) candidates.push({ code: `return \n${src};`, lineOffset: 1, colOffset: 0 })
    candidates.push({ code: `return ({\n${src}\n});`, lineOffset: 1, colOffset: 0 })
    candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 })

    let defs
    let lastErr = null
    let lastLoc = null
    for (const candidate of candidates) {
      try {
        defs = (new Function(candidate.code))()
        lastErr = null
        lastLoc = null
        break
      } catch (e) {
        lastErr = e
        const stackLoc = extractStackLineCol(e)
        lastLoc = stackLoc ? {
          line: Math.max(1, stackLoc.line - candidate.lineOffset),
          column: stackLoc.line - candidate.lineOffset <= 1
            ? Math.max(1, stackLoc.column - candidate.colOffset)
            : stackLoc.column
        } : null
      }
    }

    if (lastErr) {
      return { ok: false, message: `Custom functions: ${lastErr.message}${formatErrorLocation(lastLoc)}`, location: lastLoc }
    }
    if (!defs || typeof defs !== 'object' || Array.isArray(defs)) {
      return { ok: false, message: 'Custom functions must evaluate to an object.' }
    }

    const out = []
    for (const [key, val] of Object.entries(defs)) {
      const regName = String(key).replace(/^\$/, '')
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(regName)) {
        return { ok: false, message: `Custom functions: "${key}" is not a valid function name.` }
      }
      if (typeof val === 'function') {
        out.push({ name: regName, label: `$${regName}`, impl: val, signature: undefined, info: 'Custom workspace function' })
        continue
      }
      if (val && typeof val === 'object' && typeof val.implementation === 'function') {
        if (val.signature !== undefined && typeof val.signature !== 'string') {
          return { ok: false, message: `Custom functions: "${key}" signature must be a string.` }
        }
        if (val.description !== undefined && typeof val.description !== 'string') {
          return { ok: false, message: `Custom functions: "${key}" description must be a string.` }
        }
        out.push({
          name: regName,
          label: `$${regName}`,
          impl: val.implementation,
          signature: val.signature,
          info: val.description || 'Custom workspace function'
        })
        continue
      }
      return { ok: false, message: `Custom functions: "${key}" must be a function or { implementation, signature?, description? }.` }
    }

    return { ok: true, value: out }
  }

  function getCustomFunctionEntries() {
    const parsed = parseCustomFunctions(getSettings().customFunctions || '')
    return parsed.ok ? parsed.value : []
  }

  function registerCustomFunctions(compiled, fns) {
    fns.forEach(fn => {
      compiled.assign(fn.name, fn.impl)
      if (fn.signature) compiled.registerFunction(fn.name, fn.impl, fn.signature)
    })
  }

  return {
    parseCustomFunctions,
    getCustomFunctionEntries,
    registerCustomFunctions
  }
}
