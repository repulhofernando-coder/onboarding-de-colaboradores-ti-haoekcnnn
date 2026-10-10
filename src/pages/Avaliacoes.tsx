import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  onboardingService,
  avaliacaoService,
  setorService,
  faseService,
  auditoriaService,
} from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding, AvaliacaoDecisao, SetorModel, FaseModelo } from '@/types/onboarding'
import { SETORES_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import {
  ClipboardCheck,
  Flame,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function Avaliacoes() {
  const { user, role, isAdmin } = useAuth()
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [filtroSetor, setFiltroSetor] = useState<string>('todos')
  const [loading, setLoading] = useState(true)

  // Modal de avaliação
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedOnboarding, setSelectedOnboarding] = useState<Onboarding | null>(null)
  const [decisao, setDecisao] = useState<AvaliacaoDecisao | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Estado para fluxo Não Apto
  const [fasesDoSetor, setFasesDoSetor] = useState<FaseModelo[]>([])
  const [faseRetornoId, setFaseRetornoId] = useState<string>('')
  const [prazoSuplementarDias, setPrazoSuplementarDias] = useState<number>(5)
  const [naoAptoDefinitivo, setNaoAptoDefinitivo] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<'pendentes' | 'em_acompanhamento' | 'todos'>(
    'pendentes',
  )

  const fetchData = async () => {
    try {
      const [data, setores] = await Promise.all([onboardingService.list(), setorService.listAll()])
      setOnboardings(data)
      setSetoresList(setores)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar onboardings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useRealtime<Onboarding>('onboardings', () => {
    fetchData()
  })

  // Colaboradores aguardando avaliação final filtrados por setor
  const pendentes = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    return onboardings
      .filter((o) => {
        const matchStatus =
          statusFiltro === 'pendentes'
            ? o.status === 'avaliacao_pendente'
            : statusFiltro === 'em_acompanhamento'
              ? o.status === 'em_acompanhamento'
              : o.status === 'avaliacao_pendente' || o.status === 'em_acompanhamento'
        const setorStr = setorToString(o.setor)
        const matchSetor =
          filtroSetor === 'todos' ||
          setorStr === filtroSetor ||
          o.setor_ref === filtroSetor ||
          (o.expand?.setor_ref &&
            (o.expand.setor_ref.id === filtroSetor ||
              o.expand.setor_ref.chave === filtroSetor ||
              o.expand.setor_ref.nome === filtroSetor))
        return matchStatus && matchSetor
      })
      .map((o) => {
        const [ano, mes, dia] = o.data_fim.split('-').map(Number)
        const dataFim = new Date(ano, mes - 1, dia)
        dataFim.setHours(0, 0, 0, 0)

        const diffTime = dataFim.getTime() - hoje.getTime()
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const isAtrasado = diasRestantes < 0

        return {
          ...o,
          diasRestantes,
          isAtrasado,
        }
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [onboardings, filtroSetor, statusFiltro])

  // Colaboradores que excederam o prazo de 15 dias
  const atrasados = useMemo(() => {
    return pendentes.filter((p) => p.isAtrasado)
  }, [pendentes])

  // Histórico de avaliações concluídas
  const concluidosRecentes = useMemo(() => {
    return onboardings
      .filter((o) => o.status === 'concluido' || o.status === 'nao_apto')
      .slice(0, 8)
  }, [onboardings])

  const openAvaliarModal = (item: Onboarding) => {
    setSelectedOnboarding(item)
    setDecisao(null)
    setObservacoes('')
    setFaseRetornoId('')
    setPrazoSuplementarDias(5)
    setNaoAptoDefinitivo(false)
    setModalOpen(true)

    // Carregar fases do setor do colaborador
    faseService
      .listBySetor(item.setor, typeof item.setor_ref === 'string' ? item.setor_ref : undefined)
      .then((fases) => {
        setFasesDoSetor(fases)
        if (fases.length > 0) {
          setFaseRetornoId(fases[0].id)
        }
      })
      .catch((err) => console.error(err))
  }

  const handleSalvarAvaliacao = async () => {
    if (!selectedOnboarding || !user) return
    if (!decisao) {
      toast.error('A decisão (Apto ou Não Apto) é obrigatória.')
      return
    }

    const reavaliacoesCount = selectedOnboarding.reavaliacoes_count || 0
    const atingiuTeto = reavaliacoesCount >= 2

    if (decisao === 'nao_apto' && !atingiuTeto && !naoAptoDefinitivo && !faseRetornoId) {
      toast.error('Selecione a fase de retorno para o colaborador.')
      return
    }

    try {
      setSubmitting(true)
      await avaliacaoService.registrarDecisao({
        onboardingId: selectedOnboarding.id,
        avaliadorId: user.id,
        decisao,
        observacoes: observacoes.trim(),
        faseRetornoId: decisao === 'nao_apto' ? faseRetornoId : undefined,
        prazoSuplementarDias: decisao === 'nao_apto' ? prazoSuplementarDias : undefined,
        definitivo: decisao === 'nao_apto' ? atingiuTeto || naoAptoDefinitivo : false,
      })

      const faseRetornoObj = fasesDoSetor.find((f) => f.id === faseRetornoId)

      // Registrar auditoria
      await auditoriaService.registrar({
        onboardingId: selectedOnboarding.id,
        colaboradorNome: selectedOnboarding.colaborador_nome,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: selectedOnboarding.expand?.gestor_id?.name || '',
        acao:
          decisao === 'apto'
            ? 'Avaliação: Aprovado (Apto)'
            : atingiuTeto || naoAptoDefinitivo
              ? 'Avaliação: Não Apto Definitivo'
              : `Avaliação: Não Apto (Retorno à fase ${faseRetornoObj?.titulo || 'técnica'})`,
        detalhes:
          decisao === 'apto'
            ? `Colaborador aprovado como APTO. Parecer: ${observacoes.trim() || 'Sem observações'}`
            : atingiuTeto || naoAptoDefinitivo
              ? `Reprovado em caráter definitivo após ${reavaliacoesCount + 1} ciclos. Parecer: ${observacoes.trim() || 'Sem observações'}`
              : `Retorno para a fase "${faseRetornoObj?.titulo || 'selecionada'}" com +${prazoSuplementarDias} dias de prazo suplementar. Status: Em acompanhamento. Parecer: ${observacoes.trim() || 'Sem observações'}`,
        foraPrazo: false,
      })

      if (decisao === 'apto') {
        toast.success(
          `Decisão registrada! ${selectedOnboarding.colaborador_nome} marcado como Apto. E-mail de notificação enviado para o RH e Administração.`,
        )
      } else if (atingiuTeto || naoAptoDefinitivo) {
        toast.error(
          `Decisão registrada! ${selectedOnboarding.colaborador_nome} reprovado em definitivo.`,
        )
      } else {
        toast.info(
          `Decisão registrada! ${selectedOnboarding.colaborador_nome} retornou para acompanhamento na fase "${faseRetornoObj?.titulo || 'selecionada'}" com +${prazoSuplementarDias} dias suplementares.`,
        )
      }

      setModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatShortDate = (ymd?: string) => {
    if (!ymd) return '-'
    const [ano, mes, dia] = ymd.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const formatDate = (iso?: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  // Somente Admin ou o Gestor Responsável atribuído ao onboarding podem avaliar
  const podeAvaliarItem = (item: Onboarding) => {
    if (isAdmin) return true
    if (role === 'gestao' && item.gestor_id === user?.id) return true
    // Se gestao mas gestor_id não definido no item, permite para não travar legado
    if (role === 'gestao' && !item.gestor_id) return true
    return false
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Atraso se houver colaboradores que excederam 15 dias */}
      {atrasados.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 animate-fade-in shadow-xs">
          <Flame className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-red-800 text-sm block">
              Aviso: Prazo de 15 dias excedido para {atrasados.length} colaborador(es)
            </span>
            <p className="mt-0.5 text-red-700 leading-relaxed">
              Os colaboradores{' '}
              <strong>{atrasados.map((a) => a.colaborador_nome).join(', ')}</strong> já concluíram a
              vivência técnica e ultrapassaram o limite previsto de treinamento. É prioritário
              registrar a avaliação final.
            </p>
          </div>
        </div>
      )}

      {/* Filtro de Visão: Pendentes / Em Acompanhamento / Todos */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFiltro('pendentes')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            statusFiltro === 'pendentes'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Aguardando Avaliação Regular
        </button>
        <button
          type="button"
          onClick={() => setStatusFiltro('em_acompanhamento')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            statusFiltro === 'em_acompanhamento'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Em Acompanhamento (Reavaliação)</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFiltro('todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            statusFiltro === 'todos'
              ? 'bg-gray-800 text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Todos os Pendentes
        </button>
      </div>

      {/* Painel em Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {' '}
        {/* Total Pendente */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Aguardando Decisão do Gestor
            </span>
            <div className="mt-2 text-3xl font-extrabold text-[#1A2233]">{pendentes.length}</div>
            <span className="text-xs text-gray-400 mt-1 block">Vivência técnica concluída</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>
        {/* Em Prazo */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Dentro do Prazo Regular
            </span>
            <div className="mt-2 text-3xl font-extrabold text-emerald-700">
              {pendentes.length - atrasados.length}
            </div>
            <span className="text-xs text-gray-400 mt-1 block">Menos de 15 dias corridos</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
        {/* Excederam Prazo */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Prazo Excedido (Atrasados)
            </span>
            <div className="mt-2 text-3xl font-extrabold text-red-600">{atrasados.length}</div>
            <span className="text-xs text-gray-400 mt-1 block">Mais de 15 dias desde o início</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Lista de Avaliações Pendentes */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Colaboradores Prontos para Avaliação Final
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Etapa 1 (RH) e Etapa 2 (Vivência Técnica) concluídas. Apenas usuários do setor
              "Gestão" registram a decisão oficial.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{pendentes.length} pendentes</span>
        </div>

        {/* Filtro por Setor Dinâmico */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5 flex-wrap bg-gray-50/50">
          <span className="text-xs font-semibold text-gray-500 mr-1">Filtrar por Área:</span>
          <button
            type="button"
            onClick={() => setFiltroSetor('todos')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtroSetor === 'todos'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todas as Áreas ({onboardings.length})
          </button>{' '}
          {(setoresList.length > 0
            ? setoresList.filter((s) => s.ativo !== false)
            : Object.keys(SETORES_INFO).map((k) => ({
                id: k,
                chave: k,
                nome: SETORES_INFO[k].nome,
                cor: SETORES_INFO[k].cor,
              }))
          ).map((s) => {
            const val = s.chave || s.nome
            const active = filtroSetor === val || filtroSetor === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setFiltroSetor(val)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.cor || '#008D96' }}
                />
                <span>{s.nome}</span>
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Colaborador</th>
                <th className="py-3.5 px-4">Setor</th>
                <th className="py-3.5 px-4">Conclusão Etapa 2</th>
                <th className="py-3.5 px-4">Prazo (15 dias)</th>
                <th className="py-3.5 px-4">Status de Prazo</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {pendentes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    {loading
                      ? 'Carregando pendências...'
                      : 'Nenhum colaborador aguardando avaliação no momento.'}
                  </td>
                </tr>
              ) : (
                pendentes.map((item) => {
                  const setor = getSetorVisual(item.setor, item.expand?.setor_ref)

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/colaboradores/${item.id}`}
                          className="font-bold text-gray-900 hover:text-brand-600 block"
                        >
                          {item.colaborador_nome}
                        </Link>
                        <span className="text-xs text-gray-400">
                          {item.cargo || item.colaborador_email}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-brand-50 text-brand-700 border-brand-200">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: setor.cor }}
                          />
                          {setor.nome}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {formatDate(item.data_conclusao_etapa2)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-gray-800">
                        {formatShortDate(item.data_fim)}
                      </td>

                      <td className="py-3.5 px-4">
                        {item.isAtrasado ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-xs font-bold flex items-center gap-1 w-fit">
                            <Flame className="w-3 h-3 text-red-600" />
                            Atrasado ({Math.abs(item.diasRestantes)}d)
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 text-xs font-medium w-fit">
                            {item.diasRestantes} dias restantes
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-gray-600"
                          >
                            <Link to={`/colaboradores/${item.id}`}>Detalhes</Link>
                          </Button>

                          {podeAvaliarItem(item) ? (
                            <Button
                              size="sm"
                              onClick={() => openAvaliarModal(item)}
                              className="h-8 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm"
                            >
                              Avaliar
                            </Button>
                          ) : role === 'rh' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs text-gray-400 border-gray-200"
                              title="O RH não avalia. Avaliação exclusiva do Gestor Responsável ou Administrador."
                            >
                              Apenas Leitura (RH)
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs text-gray-400 border-gray-200"
                              title="Apenas o gestor responsável ou o Administrador podem avaliar."
                            >
                              Outro Gestor
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico Recente de Avaliações */}
      {concluidosRecentes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">
            Últimas Decisões de Avaliação Concluídas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {concluidosRecentes.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 truncate">
                    {item.colaborador_nome}
                  </span>
                  {item.status === 'concluido' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Apto
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 text-[10px] font-bold">
                      Não Apto
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">
                  Setor: {getSetorVisual(item.setor, item.expand?.setor_ref).nome}
                </div>
                <div className="text-[11px] text-gray-400">
                  Data: {formatShortDate(item.data_conclusao_etapa3)}
                </div>
                <Link
                  to={`/colaboradores/${item.id}`}
                  className="text-[11px] text-brand-600 font-semibold hover:underline block pt-1"
                >
                  Ver parecer &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Avaliação do Gestor */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Avaliação Final de Treinamento
            </DialogTitle>
          </DialogHeader>

          {selectedOnboarding && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                <div className="font-bold text-sm text-gray-900">
                  {selectedOnboarding.colaborador_nome}
                </div>
                <div className="text-gray-500 mt-0.5">
                  Setor{' '}
                  {
                    getSetorVisual(selectedOnboarding.setor, selectedOnboarding.expand?.setor_ref)
                      .nome
                  }{' '}
                  • Início: {formatShortDate(selectedOnboarding.data_inicio)} • Prazo:{' '}
                  {formatShortDate(selectedOnboarding.data_fim)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Decisão do Gestor (Obrigatória) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisao('apto')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 font-bold text-sm transition-all ${
                      decisao === 'apto'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm scale-[1.01]'
                        : 'border-gray-200 hover:border-emerald-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-6 h-6 ${
                        decisao === 'apto' ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    />
                    <span>Apto (Liberar)</span>
                    <span className="text-[11px] font-normal text-gray-500">
                      Apto para atendimento solo
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecisao('nao_apto')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 font-bold text-sm transition-all ${
                      decisao === 'nao_apto'
                        ? 'border-red-600 bg-red-50 text-red-800 shadow-sm scale-[1.01]'
                        : 'border-gray-200 hover:border-red-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <XCircle
                      className={`w-6 h-6 ${
                        decisao === 'nao_apto' ? 'text-red-600' : 'text-gray-400'
                      }`}
                    />
                    <span>Não Apto</span>
                    <span className="text-[11px] font-normal text-gray-500">
                      Retorna à fase ou reprovação
                    </span>
                  </button>
                </div>
              </div>

              {/* Se Não Apto: formulário de retorno e prazo suplementar */}
              {decisao === 'nao_apto' && (
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Retorno para Acompanhamento
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                      Ciclos já realizados: {selectedOnboarding.reavaliacoes_count || 0}/2
                    </span>
                  </div>

                  {(selectedOnboarding.reavaliacoes_count || 0) >= 2 ? (
                    <div className="p-2.5 bg-red-100 border border-red-300 rounded text-red-900 text-xs">
                      <strong>Teto de 2 reavaliações atingido:</strong> este colaborador será
                      encerrado como <strong>Não Apto Definitivo</strong>.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Fase de Retorno *
                          </label>
                          <select
                            value={faseRetornoId}
                            onChange={(e) => setFaseRetornoId(e.target.value)}
                            disabled={naoAptoDefinitivo}
                            className="w-full text-xs border border-gray-300 rounded-md p-1.5 bg-white"
                          >
                            {fasesDoSetor.length > 0 ? (
                              fasesDoSetor.map((f, idx) => (
                                <option key={f.id} value={f.id}>
                                  Fase {idx + 1}: {f.titulo} ({f.dias_previstos || 2}d)
                                </option>
                              ))
                            ) : (
                              <option value="">Nenhuma fase encontrada</option>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Prazo Suplementar (dias) *
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={prazoSuplementarDias}
                            onChange={(e) =>
                              setPrazoSuplementarDias(Math.max(1, Number(e.target.value) || 1))
                            }
                            disabled={naoAptoDefinitivo}
                            className="h-8 text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-red-200/60 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chkDefinitivoModal"
                          checked={naoAptoDefinitivo}
                          onChange={(e) => setNaoAptoDefinitivo(e.target.checked)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <label
                          htmlFor="chkDefinitivoModal"
                          className="text-xs text-red-800 font-medium cursor-pointer"
                        >
                          Encerrar como Não Apto Definitivo (sem ciclo suplementar)
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Observações e Feedback do Gestor (Opcional)
                </label>
                <Textarea
                  rows={3}
                  placeholder="Registre pontos fortes, observações sobre a conduta em atendimento ou recomendações futuras..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="text-xs border-gray-300"
                  disabled={submitting}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvarAvaliacao}
                  disabled={!decisao || submitting}
                  className={`font-semibold text-white ${
                    decisao === 'apto'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : decisao === 'nao_apto'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-brand-600'
                  }`}
                >
                  {submitting ? 'Registrando...' : 'Confirmar Avaliação'}
                </Button>{' '}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
