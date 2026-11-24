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

/**
 * Detecta falhas de conexão/rede (backend fora do ar, "Failed to fetch",
 * backend reiniciando em implantação). Usado para retry automático no login.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    // status 0 = requisição não completou ( rede / CORS / abort )
    if (error.status === 0) return true
    const msg = (error.message || '').toLowerCase()
    const respMsg = String(
      (error.response as { message?: string } | undefined)?.message || '',
    ).toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('fetch failed') ||
      msg.includes('connection') ||
      respMsg.includes('network') ||
      respMsg.includes('failed to fetch') ||
      respMsg.includes('connection')
    )
  }
  if (error instanceof TypeError) return true // fetch lança TypeError em falha de rede
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('fetch failed') ||
      msg.includes('connection')
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
