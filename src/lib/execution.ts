import type { CustomFunctionEntry, ParseResult } from '../types/workspace'
import { parseCustomFunctions } from './customFunctions'
import { parseExecutionData, parseJSONText } from './helpers'

export interface ExecutionEnvironment {
  data: unknown
  bindings: Record<string, unknown>
  customFns: CustomFunctionEntry[]
  functionsResult: ParseResult<CustomFunctionEntry[]>
}

export function buildExecutionEnvironment(
  rawInput: string,
  rawGlobal: string,
  rawBindings: string,
  rawCustomFunctions: string,
): ParseResult<ExecutionEnvironment> {
  const bindingsResult = parseJSONText(rawBindings || '', 'Bindings', { requireObject: true })
  if (!bindingsResult.ok) return { ok: false, message: bindingsResult.message }

  const dataResult = parseExecutionData(rawInput, rawGlobal)
  if (!dataResult.ok) return { ok: false, message: dataResult.message }

  const functionsResult = parseCustomFunctions(rawCustomFunctions || '')
  const customFns = functionsResult.ok ? (functionsResult.value ?? []) : []

  return {
    ok: true,
    value: {
      data: dataResult.value,
      bindings: (bindingsResult.value ?? {}) as Record<string, unknown>,
      customFns,
      functionsResult,
    },
  }
}
