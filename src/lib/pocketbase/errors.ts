import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

/**
 * Detecta falha de REDE (a requisição nunca obteve resposta HTTP do servidor):
 * "Failed to fetch", backend reiniciando em implantação, timeout, DNS.
 *
 * ATENÇÃO — REGRESSÃO JÁ OCORRIDA 3x: NÃO REMOVER este export em nenhuma limpeza.
 * Dependem dele:
 *  - src/contexts/AuthContext.tsx (retentativa automática de login em erro de rede)
 *  - src/pages/Login.tsx (erro de rede NÃO deve ser registrado como "Falha de login" na auditoria)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    // status 0 = o pedido não chegou a obter resposta do servidor
    if (error.status === 0) return true
    const msg = String(error.message || '').toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    )
  }
  // fetch() lança TypeError("Failed to fetch") quando a rede falha fora do SDK
  return error instanceof TypeError
}
