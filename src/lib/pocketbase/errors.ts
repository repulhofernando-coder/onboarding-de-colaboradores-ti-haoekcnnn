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
 * Identifica falhas de rede/transporte (backend inacessível): "Failed to fetch",
 * timeout, erro de conexão, servidor indisponível. Usado no login para retentar
 * automaticamente uma vez e NÃO registrar falha de autenticação na auditoria
 * quando o problema é apenas de conectividade.
 *
 * Um ClientResponseError com status 0 também é rede: o SDK do PocketBase usa 0
 * quando a requisição nem chega a receber resposta HTTP.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false

  // Erros de rede nativos do fetch/broker
  if (error instanceof TypeError) return true

  const err = error as { name?: string; message?: string; status?: number; originalError?: unknown }
  const name = (err.name || '').toLowerCase()
  const message = (err.message || '').toLowerCase()

  if (
    name === 'typeerror' ||
    name === 'aborterror' ||
    name === 'networkerror' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror when attempting to fetch resource') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('connection refused') ||
    message.includes('connection reset') ||
    message.includes('econnrefused') ||
    message.includes('socket hang up')
  ) {
    return true
  }

  // ClientResponseError sem resposta HTTP (status 0) = falha de transporte
  if (typeof err.status === 'number' && err.status === 0) return true
  // Erro original encapsulado pelo SDK do PocketBase
  if (err.originalError && isNetworkError(err.originalError)) return true

  return false
}
