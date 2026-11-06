/**
 * Serviço de medição do espaço de armazenamento utilizado no backend.
 *
 * Consome a rota customizada do PocketBase:
 *   GET /backend/v1/espaco-utilizado  (apenas Admin e RH)
 *
 * Retorna o total em bytes, a contagem de arquivos e o detalhamento por origem
 * (materiais, certificados, tarefas de onboarding, modelos e avatares).
 */
import pb from '@/lib/pocketbase/client'

export interface EspacoOrigem {
  chave: string
  rotulo: string
  bytes: number
  arquivos: number
}

export interface EspacoUtilizado {
  total_bytes: number
  total_arquivos: number
  por_origem: EspacoOrigem[]
  gerado_em: string
}

/** Formata bytes em MB/GB legível (pt-BR). */
export const formatarBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${gb >= 10 ? gb.toFixed(1) : gb.toFixed(2)} GB`
  }
  if (mb >= 10) return `${mb.toFixed(1)} MB`
  if (mb >= 0.1) return `${mb.toFixed(2)} MB`
  // Abaixo de 0,1 MB mostra em KB para não virar "0,00 MB"
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export const espacoService = {
  async obter(): Promise<EspacoUtilizado> {
    const res = await fetch(`${pb.baseUrl}/backend/v1/espaco-utilizado`, {
      headers: {
        Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
      },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao calcular o espaço utilizado.')
    }
    return json as EspacoUtilizado
  },
}
