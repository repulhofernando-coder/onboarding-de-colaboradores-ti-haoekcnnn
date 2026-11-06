import { useEffect } from 'react'
import { useEspacoUtilizado } from '@/hooks/useEspacoUtilizado'
import { useRealtime } from '@/hooks/use-realtime'
import { formatarBytes } from '@/services/espaco'
import {
  HardDrive,
  Database,
  FileText,
  Award,
  Video,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react'

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  materiais: FileText,
  certificados: Award,
  tarefas_onboarding: Video,
  modelo_tarefas: Database,
  users: User,
}

const CORES: Record<string, string> = {
  materiais: 'bg-indigo-500',
  certificados: 'bg-amber-500',
  tarefas_onboarding: 'bg-purple-500',
  modelo_tarefas: 'bg-cyan-500',
  users: 'bg-slate-400',
}

/**
 * Card "Espaço utilizado" da Biblioteca: total de armazenamento ocupado pelos
 * arquivos enviados ao backend, com detalhamento por origem (materiais,
 * certificados, tarefas de onboarding, etc.) e contagem de arquivos.
 *
 * Visível somente para Admin e RH (o hook carrega apenas nesses papéis).
 * Sem cota/limite fixo — mostra o total usado e o breakdown por origem.
 */
export const CardEspacoUtilizado: React.FC = () => {
  const { dados, loading, error, recarregar, podeVer } = useEspacoUtilizado()

  // Recarrega automaticamente quando qualquer material é criado/atualizado/excluído
  useRealtime(
    'materiais',
    () => {
      recarregar()
    },
    podeVer,
  )

  useEffect(() => {
    if (podeVer) recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!podeVer) return null

  const origens = dados?.por_origem || []
  const total = dados?.total_bytes || 0

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Total */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Espaço utilizado no armazenamento
            </p>
            {loading && !dados ? (
              <div className="flex items-center gap-2 h-7">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Calculando...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-1.5 h-7">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-700">{error}</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{formatarBytes(total)}</span>
                {dados && (
                  <span className="text-xs text-gray-400">
                    ({dados.total_arquivos} {dados.total_arquivos === 1 ? 'arquivo' : 'arquivos'})
                  </span>
                )}
              </div>
            )}
            {dados && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Soma de todos os arquivos enviados ao sistema (biblioteca, onboarding e perfis).
              </p>
            )}
          </div>
        </div>

        {/* Botão de atualização manual */}
        <button
          type="button"
          onClick={() => recarregar()}
          disabled={loading}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 shrink-0"
        >
          {loading && dados ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Barra de proporção por origem */}
      {origens.length > 0 && total > 0 && (
        <div className="mt-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            {origens.map((o) =>
              o.bytes > 0 ? (
                <div
                  key={o.chave}
                  className={CORES[o.chave] || 'bg-gray-400'}
                  style={{ width: `${Math.max(1, (o.bytes / total) * 100)}%` }}
                  title={`${o.rotulo}: ${formatarBytes(o.bytes)}`}
                />
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Breakdown por origem */}
      {origens.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {origens.map((o) => {
            const Icone = ICONES[o.chave] || Database
            return (
              <div key={o.chave} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${CORES[o.chave] || 'bg-gray-400'}`}
                />
                <Icone className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600">
                  {o.rotulo}: <strong className="text-gray-900">{formatarBytes(o.bytes)}</strong>
                  <span className="text-gray-400">
                    {' '}
                    · {o.arquivos} {o.arquivos === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
