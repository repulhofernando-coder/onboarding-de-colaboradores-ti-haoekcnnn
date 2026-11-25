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
  if (!(error instanceof ClientResponseError)) {
    return error instanceof TypeError
  }
  // Erro HTTP real (o servidor respondeu) NÃO é erro de rede.
  if (error.status > 0) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.status === 0 ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  )
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
