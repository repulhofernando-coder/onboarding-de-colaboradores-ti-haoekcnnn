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

// Detecta erro de rede/fetch (sem resposta HTTP do backend): ex. "Failed to fetch",
// backend indisponível ou reiniciando durante implantação. Usado para retentativa
// automática de login e para NÃO registrar "Falha de login" na auditoria.
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    // Erro HTTP de verdade (4xx/5xx com resposta do servidor) não é erro de rede.
    if (error.status > 0) return false
    return true
  }
  if (error instanceof TypeError) return true // fetch lança TypeError ("Failed to fetch")
  if (error instanceof Error) {
    const msg = (error.message || '').toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed') ||
      msg.includes('fetch failed')
    )
  }
  return false
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
