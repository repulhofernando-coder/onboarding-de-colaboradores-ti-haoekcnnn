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

// Detecta falha de conexão (sem resposta do servidor). Usado em login e
// carregamentos iniciais para exibir mensagens de rede ao usuário.
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    return (
      error.status === 0 ||
      /network|fetch|connection|failed|timeout|aborted/i.test(error.message || '')
    )
  }
  if (error instanceof TypeError) return true // fetch lança TypeError em falha de rede
  return false
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
