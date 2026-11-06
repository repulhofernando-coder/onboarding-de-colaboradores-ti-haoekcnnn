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
  if (error instanceof TypeError) return true
  const err = error as { status?: number; message?: string; response?: unknown }
  if (err && typeof err === 'object') {
    // status 0 = o SDK do PocketBase não obteve resposta do servidor (offline/DNS/CORS)
    if (err.status === 0) return true
    const msg = (err.message || '').toLowerCase()
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('connection') ||
      msg.includes('dns') ||
      msg.includes('offline')
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
