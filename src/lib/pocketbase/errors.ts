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
 * Identifica falhas de conexão de rede ou indisponibilidade do backend PocketBase.
 * Trata erros do ClientResponseError com status 0 (conexão recusada / sem rede / CORS / timeout),
 * exceções de fetch ('Failed to fetch', 'NetworkError', 'Load failed', 'ECONNREFUSED'),
 * e navegadores offline (navigator.onLine === false).
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true
  }

  if (error instanceof ClientResponseError) {
    // PocketBase seta status 0 quando a requisição falha antes de obter resposta HTTP
    if (error.status === 0) return true
    const orig = error.originalError
    if (orig && typeof orig === 'object' && 'name' in orig) {
      const name = String((orig as { name?: unknown }).name || '').toLowerCase()
      if (name.includes('network') || name.includes('aborterror')) return true
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    const name = error.name.toLowerCase()
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network error') ||
      msg.includes('connection refused') ||
      msg.includes('econnrefused') ||
      msg.includes('load failed') ||
      msg.includes('net::err') ||
      name.includes('networkerror') ||
      (name.includes('typeerror') && msg.includes('fetch'))
    ) {
      return true
    }
  }

  return false
}
