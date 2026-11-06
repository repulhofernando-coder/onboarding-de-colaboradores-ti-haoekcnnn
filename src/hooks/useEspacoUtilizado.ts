import { useCallback, useEffect, useState } from 'react'
import { espacoService } from '@/services/espaco'
import type { EspacoUtilizado } from '@/services/espaco'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook do contador de espaço utilizado no storage do backend.
 *
 * Carrega os números do endpoint `/backend/v1/espaco-utilizado` para Admin e RH
 * (o papel Gestão não carrega nem renderiza nada) e expõe `recarregar()` para
 * atualizar os números após envio/exclusão de arquivos (ex.: materiais da
 * biblioteca).
 */
export function useEspacoUtilizado() {
  const { role } = useAuth()
  const podeVer = role === 'admin' || role === 'rh'

  const [dados, setDados] = useState<EspacoUtilizado | null>(null)
  const [loading, setLoading] = useState(podeVer)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!podeVer) return
    setLoading(true)
    setError(null)
    try {
      const res = await espacoService.obter()
      setDados(res)
    } catch (err) {
      console.error('Erro ao carregar espaço utilizado:', err)
      setError(err instanceof Error ? err.message : 'Erro ao calcular o espaço utilizado.')
    } finally {
      setLoading(false)
    }
  }, [podeVer])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dados, loading, error, recarregar: carregar, podeVer }
}
