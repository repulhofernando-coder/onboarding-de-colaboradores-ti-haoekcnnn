import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  Plus,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  BookOpen,
  Calendar,
  UserCheck,
  Ban,
  Loader2,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { avaliacaoColaboradorService } from '@/services/onboarding'
import { formatDateTime, formatShortDate } from '@/lib/dateUtils'
import type { Onboarding, AvaliacaoColaborador } from '@/types/onboarding'
import { ModalAplicarAvaliacao } from './ModalAplicarAvaliacao'

export interface SecaoAvaliacoesColaboradorProps {
  onboarding: Onboarding
  onAvaliacaoAdicionada?: () => void
}

export function SecaoAvaliacoesColaborador({
  onboarding,
  onAvaliacaoAdicionada,
}: SecaoAvaliacoesColaboradorProps) {
  const { user } = useAuth()
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoColaborador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAplicarOpen, setModalAplicarOpen] = useState(false)
  const [copiandoId, setCopiandoId] = useState<string | null>(null)

  // Permissões:
  // RH e Admin podem aplicar avaliação e cancelar pendentes
  // Gestão pode ver os resultados em leitura
  const podeAplicar = user?.role === 'admin' || user?.role === 'rh'

  async function carregarAvaliacoes() {
    setCarregando(true)
    try {
      const lista = await avaliacaoColaboradorService.listByColaborador(onboarding.id)
      setAvaliacoes(lista)
    } catch (err) {
      console.error('[SecaoAvaliacoesColaborador] Erro ao carregar avaliações:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (onboarding?.id) {
      carregarAvaliacoes()
    }
  }, [onboarding?.id])

  function handleCopiarLink(token: string, id: string) {
    const url = `${window.location.origin}/avaliacao/${token}`
    navigator.clipboard.writeText(url)
    setCopiandoId(id)
    toast({
      title: 'Link copiado!',
      description: 'Envie o link ao colaborador.',
    })
    setTimeout(() => setCopiandoId(null), 2500)
  }

  async function handleCancelar(id: string) {
    if (!confirm('Deseja realmente cancelar este link de avaliação?')) return
    try {
      await avaliacaoColaboradorService.cancelarAvaliacao(id)
      toast({
        title: 'Avaliação cancelada',
        description: 'O link de acesso não poderá mais ser respondido.',
      })
      carregarAvaliacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar',
        description: err?.message || 'Falha ao cancelar a avaliação.',
        variant: 'destructive',
      })
    }
  }

  const TIPO_LABEL: Record<string, string> = {
    reciclagem: 'Reciclagem',
    mudanca_area: 'Mudança de Área',
    avaliacao: 'Avaliação Periódica',
    contratacao: 'Contratação',
    onboarding: 'Onboarding',
  }

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-gray-900">
                  Avaliações do Colaborador
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs bg-white text-emerald-800 border-emerald-200"
                >
                  {avaliacoes.length} {avaliacoes.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Dossiê de reciclagens, mudanças de área e avaliações periódicas aplicadas
              </CardDescription>
            </div>
          </div>

          {podeAplicar && (
            <Button
              type="button"
              size="sm"
              onClick={() => setModalAplicarOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm h-8 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Aplicar Avaliação
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {carregando ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            Carregando histórico de avaliações...
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg p-6 bg-gray-50/50">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-700">
              Nenhuma avaliação avulsa registrada ainda
            </p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
              {podeAplicar
                ? 'Clique em "Aplicar Avaliação" acima para aplicar provas de reciclagem, mudança de área ou avaliações de desempenho sem alterar o status do onboarding.'
                : 'Nenhuma avaliação de reciclagem ou mudança de área foi aplicada a este colaborador até o momento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {avaliacoes.map((item) => {
              const qNome = item.expand?.questionario_id?.nome || 'Questionário Técnico'
              const regua =
                item.regua_aprovacao ?? item.expand?.questionario_id?.percentual_aprovacao ?? 80
              const statusPendente = item.status === 'pendente'
              const statusCancelada = item.status === 'cancelada'
              const statusConcluida = item.status === 'concluida'

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{qNome}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold uppercase bg-gray-50 text-gray-700 border-gray-200"
                          >
                            {TIPO_LABEL[item.tipo_avaliacao || ''] ||
                              item.tipo_avaliacao ||
                              'Avaliação'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Aplicada em: {formatShortDate(item.data_aplicacao || item.created)}
                          </span>
                          {item.expand?.aplicada_por?.name && (
                            <span>• por {item.expand.aplicada_por.name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Badge de Status / Resultado */}
                    <div>
                      {statusPendente && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          Aguardando respostas
                        </span>
                      )}
                      {statusCancelada && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                          <Ban className="w-3.5 h-3.5 text-gray-500" />
                          Cancelada
                        </span>
                      )}
                      {statusConcluida && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            item.aprovado
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          {item.aprovado ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          )}
                          {item.aprovado ? 'Aprovado na Régua' : 'Reprovado na Régua'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informações detalhadas do resultado quando concluída */}
                  {statusConcluida && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-medium">
                            Nota Obtida
                          </span>
                          <span className="font-bold text-gray-800 text-sm">
                            {item.nota ?? 0} / {item.total_questoes ?? 0} acertos
                          </span>
                        </div>
                        <div className="border-l border-gray-200 pl-4">
                          <span className="text-[10px] text-gray-400 block font-medium">
                            Aproveitamento
                          </span>
                          <span
                            className={`font-bold text-sm ${item.aprovado ? 'text-emerald-700' : 'text-red-700'}`}
                          >
                            {item.percentual ?? 0}%
                          </span>
                        </div>
                        <div className="border-l border-gray-200 pl-4">
                          <span className="text-[10px] text-gray-400 block font-medium">
                            Régua Desta Prova
                          </span>
                          <span className="font-semibold text-gray-700 text-xs">
                            ≥ {regua}% para aprovação
                          </span>
                        </div>
                        {item.data_conclusao && (
                          <div className="border-l border-gray-200 pl-4">
                            <span className="text-[10px] text-gray-400 block font-medium">
                              Conclusão
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatDateTime(item.data_conclusao)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ações para avaliação pendente */}
                  {statusPendente && (
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          Token: {item.token}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarLink(item.token, item.id)}
                          className="h-7 text-xs font-semibold text-gray-700"
                        >
                          {copiandoId === item.id ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copiar Link
                            </>
                          )}
                        </Button>

                        {podeAplicar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelar(item.id)}
                            className="h-7 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            Cancelar Link
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {item.observacoes && (
                    <p className="text-[11px] text-gray-500 italic bg-gray-50/50 p-2 rounded">
                      Obs: {item.observacoes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal para aplicar nova avaliação */}
      <ModalAplicarAvaliacao
        open={modalAplicarOpen}
        onOpenChange={setModalAplicarOpen}
        onboarding={onboarding}
        onSucesso={() => {
          carregarAvaliacoes()
          if (onAvaliacaoAdicionada) onAvaliacaoAdicionada()
        }}
      />
    </Card>
  )
}
