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

export function isNetworkError(error: unknown): boolean {
  if (!error) return false

  // ClientResponseError do PocketBase com status 0 ou response status 0 / NaN
  if (error instanceof ClientResponseError) {
    if (error.status === 0 || !error.status) return true
    if (error.originalError && isNetworkError(error.originalError)) return true
    const msg = String(error.message || '').toLowerCase()
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('connection refused') ||
      msg.includes('load failed') ||
      msg.includes('the network connection was lost')
    ) {
      return true
    }
  }

  // Erros comuns de fetch no browser (TypeError: Failed to fetch)
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase()
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
      return true
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      error.name === 'NetworkError' ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('net::err_') ||
      msg.includes('econnrefused') ||
      msg.includes('load failed') ||
      msg.includes('servidor indisponível') ||
      msg.includes('falha de conexão')
    ) {
      return true
    }
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
