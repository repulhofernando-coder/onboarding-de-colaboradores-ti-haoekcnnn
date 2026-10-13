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
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return true
    const msg = (error.message || '').toLowerCase()
    if (
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('conexão') ||
      msg.includes('failed to fetch') ||
      msg.includes('aborted')
    ) {
      return true
    }
  }

  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    ) {
      return true
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network error') ||
      msg.includes('falha de conexão') ||
      msg.includes('falha na conexão') ||
      msg.includes('connection refused') ||
      msg.includes('err_connection')
    ) {
      return true
    }
  }

  return false
}

export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Falha de conexão com o servidor. Tente novamente em instantes.'
  }

  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
