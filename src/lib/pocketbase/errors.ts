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
 * Detecta falhas de rede/conexão (ex.: "Failed to fetch", backend reiniciando),
 * para que a UI possa retentar ou não tratá-las como credenciais inválidas.
 * Considera TypeError do fetch, status 0 do SDK PocketBase e mensagens típicas
 * de falha de conexão/rede.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return true
    const msg = (error.message || '').toLowerCase()
    const respMsg = (
      (error.response as { message?: string } | undefined)?.message || ''
    ).toLowerCase()
    const padroes = [
      'failed to fetch',
      'networkerror',
      'network error',
      'network request failed',
      'load failed',
      'fetch failed',
      'falha de conex',
      'connection',
      'timed out',
      'timeout',
      'erro ao tentar conectar',
    ]
    return padroes.some((p) => msg.includes(p) || respMsg.includes(p))
  }
  if (error instanceof Error) {
    const msg = (error.message || '').toLowerCase()
    const padroes = [
      'failed to fetch',
      'networkerror',
      'network error',
      'fetch failed',
      'load failed',
    ]
    return padroes.some((p) => msg.includes(p))
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
