import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { onboardingService, setorService } from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding, SetorModel } from '@/types/onboarding'
import { SETORES_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import { calcularDiasRestantes, formatShortDate, formatDateTime } from '@/lib/dateUtils'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import { AvisoSetorGestor } from '@/components/AvisoSetorGestor'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Plus,
  Calendar,
  AlertCircle,
  Flame,
  Activity,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export default function Index() {
  const { user, role, isGestao } = useAuth()
  const navigate = useNavigate()
  const [todosOnboardings, setTodosOnboardings] = useState<Onboarding[]>([])
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOnboardings = async () => {
    try {
      const [data, setores] = await Promise.all([onboardingService.list(), setorService.listAll()])
      setTodosOnboardings(data)
      setSetoresList(setores)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtro de visibilidade por departamento para o papel Gestão
  const onboardings = useMemo(() => {
    if (!isGestao) return todosOnboardings
    return todosOnboardings.filter((o) =>
      podeVisualizarSetor({
        role,
        userSetor: user?.setor,
        itemSetor: setorToString(o.setor),
        itemSetorRef: typeof o.setor_ref === 'string' ? o.setor_ref : o.setor_ref?.id,
        setoresCadastrados: setoresList,
      }),
    )
  }, [todosOnboardings, isGestao, role, user?.setor, setoresList])

  useEffect(() => {
    fetchOnboardings()
  }, [])

  // Inscrição Realtime para atualizar instantaneamente ao mudar de etapa/status
  useRealtime<Onboarding>('onboardings', () => {
    fetchOnboardings()
  })

  // Saudação por horário
  const greeting = useMemo(() => {
    const hora = new Date().getHours()
    if (hora < 12) return 'Bom dia'
    if (hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const firstName = (user?.name || user?.email || 'Usuário').split(' ')[0]

  // Métricas
  const emAndamento = onboardings.filter((o) => o.status === 'em_andamento').length
  const emAcompanhamento = onboardings.filter((o) => o.status === 'em_acompanhamento').length
  const concluidos = onboardings.filter((o) => o.status === 'concluido').length
  const aguardandoAvaliacao = onboardings.filter((o) => o.status === 'avaliacao_pendente').length
  const naoAptos = onboardings.filter((o) => o.status === 'nao_apto').length

  // Lista unificada de setores para o gráfico (da coleção com fallback, filtrada se Gestão)
  const setoresAtivosGrafico = useMemo(() => {
    let base =
      setoresList.length > 0
        ? setoresList.filter((s) => s.ativo !== false)
        : Object.keys(SETORES_INFO).map((k) => ({
            id: k,
            chave: k,
            nome: SETORES_INFO[k].nome,
            cor: SETORES_INFO[k].cor,
            descricao: SETORES_INFO[k].descricao,
            ativo: true,
          }))

    if (isGestao) {
      base = base.filter((s) =>
        podeVisualizarSetor({
          role,
          userSetor: user?.setor,
          itemSetor: s.chave || s.nome,
          itemSetorRef: s.id,
          setoresCadastrados: setoresList,
        }),
      )
    }

    return base
  }, [setoresList, isGestao, role, user?.setor])

  // Contagem dinâmica por setor
  const setorCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of setoresAtivosGrafico) {
      const key = s.chave || s.nome
      counts[key] = 0
      counts[s.id] = 0
    }

    for (const o of onboardings) {
      const setorStr = setorToString(o.setor)
      const setorRefStr = typeof o.setor_ref === 'string' ? o.setor_ref : ''
      const setorLower = setorStr.toLowerCase()

      const matching = setoresAtivosGrafico.find(
        (s) =>
          (setorRefStr && s.id === setorRefStr) ||
          (setorStr && s.id === setorStr) ||
          (setorStr && s.chave === setorStr) ||
          (setorLower && (s.chave || '').toLowerCase() === setorLower) ||
          (setorLower && (s.nome || '').toLowerCase() === setorLower),
      )
      if (matching) {
        const key = matching.chave || matching.nome
        counts[key] = (counts[key] || 0) + 1
      } else if (setorStr) {
        counts[setorStr] = (counts[setorStr] || 0) + 1
      }
    }
    return counts
  }, [onboardings, setoresAtivosGrafico])

  const maxSetorCount = Math.max(
    ...setoresAtivosGrafico.map((s) => setorCounts[s.chave || s.nome] || 0),
    1,
  )

  // Próximos vencimentos (< 3 dias do prazo de 15 dias e não finalizados)
  const proximosVencimentos = useMemo(() => {
    return onboardings
      .filter((o) => o.status !== 'concluido' && o.status !== 'nao_apto')
      .map((o) => {
        const prazo = calcularDiasRestantes(o.data_fim)

        // Progresso estimado por etapa concluída (1 = 33%, 2 = 66%, 3 = 100%)
        let progresso = 0
        if (o.etapa1_concluida) progresso += 33
        if (o.etapa2_concluida) progresso += 33
        if (o.etapa3_concluida) progresso += 34

        return {
          ...o,
          diasRestantes: prazo.diasRestantes ?? 0,
          prazoInfo: prazo,
          progresso,
          isAtrasado: prazo.isVencido,
          isCritico: prazo.isCritico,
        }
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 6)
  }, [onboardings])

  // Feed de atividade recente (últimas ações inferidas do created/updated e status)
  const atividadesRecentes = useMemo(() => {
    const list: Array<{
      id: string
      onboardingId: string
      texto: string
      data: string
      cor: string
      tipo: string
    }> = []

    for (const o of onboardings) {
      if (o.status === 'concluido') {
        list.push({
          id: `${o.id}-concluido`,
          onboardingId: o.id,
          texto: `Avaliação final: Apto — ${o.colaborador_nome} liberado para atendimento`,
          data: o.data_conclusao_etapa3 || o.updated,
          cor: 'bg-emerald-500',
          tipo: 'Conclusão',
        })
      }
      if (o.status === 'nao_apto') {
        list.push({
          id: `${o.id}-nao_apto`,
          onboardingId: o.id,
          texto: `Avaliação final: Não Apto — ${o.colaborador_nome}`,
          data: o.data_conclusao_etapa3 || o.updated,
          cor: 'bg-red-500',
          tipo: 'Avaliação',
        })
      }
      if (o.etapa2_concluida) {
        const setorNome = getSetorVisual(o.setor, o.expand?.setor_ref).nome
        list.push({
          id: `${o.id}-etapa2`,
          onboardingId: o.id,
          texto: `Etapa 2 (Vivência Técnica) concluída — ${o.colaborador_nome} (${setorNome})`,
          data: o.data_conclusao_etapa2 || o.updated,
          cor: 'bg-brand-600',
          tipo: 'Etapa 2',
        })
      }
      if (o.etapa1_concluida) {
        list.push({
          id: `${o.id}-etapa1`,
          onboardingId: o.id,
          texto: `Etapa 1 (Apresentação RH) concluída para ${o.colaborador_nome}`,
          data: o.data_conclusao_etapa1 || o.updated,
          cor: 'bg-indigo-500',
          tipo: 'Etapa 1',
        })
      }
      const setorNomeCriado = getSetorVisual(o.setor, o.expand?.setor_ref).nome
      list.push({
        id: `${o.id}-criado`,
        onboardingId: o.id,
        texto: `Novo onboarding iniciado: ${o.colaborador_nome} no setor ${setorNomeCriado}`,
        data: o.created,
        cor: 'bg-slate-400',
        tipo: 'Início',
      })
    }

    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5)
  }, [onboardings])

  const formatDate = (iso: string) => {
    return formatDateTime(iso)
  }

  return (
    <div className="space-y-7">
      {/* Aviso de setor para papel Gestão */}
      <AvisoSetorGestor setoresList={setoresList} moduloNome="onboardings" />

      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2233]">
            {greeting}, {firstName}!
          </h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xl">
            Acompanhe a formação e integração dos novos colaboradores em todas as áreas da empresa.
            O prazo máximo para conclusão é de 15 dias.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            asChild
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
          >
            <Link to="/onboardings/nova" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Novo Onboarding</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 5 Cards de Resumo Clicáveis (incluindo Em Acompanhamento) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Em andamento */}
        <div
          onClick={() => navigate('/onboardings?status=em_andamento')}
          className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Em andamento
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1A2233]">{emAndamento}</span>
            <span className="text-xs text-gray-400 font-medium">técnicos</span>
          </div>
          <div className="mt-1.5 text-xs text-blue-600 font-medium flex items-center gap-1 group-hover:underline">
            <span>Ver lista</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Em acompanhamento (Âmbar) */}
        <div
          onClick={() => navigate('/onboardings?status=em_acompanhamento')}
          className="bg-white p-4 rounded-xl border border-amber-200/90 bg-amber-50/20 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Acompanhamento
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1A2233]">{emAcompanhamento}</span>
            <span className="text-xs text-amber-600 font-medium">reavaliação</span>
          </div>
          <div className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1 group-hover:underline">
            <span>Ver pendentes</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Concluídos */}
        <div
          onClick={() => navigate('/onboardings?status=concluido')}
          className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Concluídos (Aptos)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1A2233]">{concluidos}</span>
            <span className="text-xs text-gray-400 font-medium">liberados</span>
          </div>
          <div className="mt-1.5 text-xs text-emerald-600 font-medium flex items-center gap-1 group-hover:underline">
            <span>Ver aprovados</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Aguardando avaliação */}
        <div
          onClick={() => navigate('/onboardings?status=avaliacao_pendente')}
          className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Aguardando Avaliação
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1A2233]">{aguardandoAvaliacao}</span>
            <span className="text-xs text-gray-400 font-medium">etapa 3</span>
          </div>
          <div className="mt-1.5 text-xs text-purple-600 font-medium flex items-center gap-1 group-hover:underline">
            <span>Avaliar agora</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Não aptos */}
        <div
          onClick={() => navigate('/onboardings?status=nao_apto')}
          className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Não Aptos
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1A2233]">{naoAptos}</span>
            <span className="text-xs text-gray-400 font-medium">reprovados</span>
          </div>
          <div className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 group-hover:underline">
            <span>Ver detalhes</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Gráfico de Barras por Setor */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-[#1A2233]">
              Distribuição de Onboardings por Setor
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Total registrado: {onboardings.length}
          </span>
        </div>
        {/* Barras Desktop / Lista Mobile */}
        <div className="hidden sm:flex flex-wrap gap-4 pt-4 pb-2 items-end justify-between min-h-[190px]">
          {setoresAtivosGrafico.map((setor) => {
            const key = setor.chave || setor.nome
            const count = setorCounts[key] || 0
            const cor = setor.cor || '#2563EB'
            const barHeight = Math.max(Math.round((count / maxSetorCount) * 120), 12)

            return (
              <div
                key={setor.id}
                className="flex-1 min-w-[70px] max-w-[120px] flex flex-col items-center gap-2"
              >
                <span className="text-xs font-bold text-gray-700">{count}</span>
                <div className="w-full flex justify-center items-end h-[120px]">
                  <div
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: cor,
                    }}
                    className="w-10 rounded-t-md transition-all duration-500 hover:opacity-90 shadow-xs"
                    title={`${setor.nome}: ${count} onboardings`}
                  />
                </div>
                <div className="text-center mt-1">
                  <span
                    className="text-xs font-semibold text-gray-800 block truncate max-w-[90px]"
                    title={setor.nome}
                  >
                    {setor.nome}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        {/* Versão Mobile (lista simples) */}
        <div className="sm:hidden space-y-3">
          {setoresAtivosGrafico.map((setor) => {
            const key = setor.chave || setor.nome
            const count = setorCounts[key] || 0
            const cor = setor.cor || '#2563EB'
            const pct = Math.round((count / (onboardings.length || 1)) * 100)

            return (
              <div key={setor.id} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="font-semibold text-gray-800">{setor.nome}</span>
                  <span className="text-gray-500">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%`, backgroundColor: cor }}
                    className="h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            )
          })}
        </div>{' '}
      </div>

      {/* Grid: Próximos Vencimentos + Atividade Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos vencimentos (2 colunas em desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-[#1A2233]">Próximos Vencimentos do Prazo</h3>
            </div>
            <Link
              to="/onboardings"
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Acompanhamento prioritário: colaboradores com prazo final de 15 dias próximo ou vencido.
          </p>

          {proximosVencimentos.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm flex-1 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-gray-300 mb-2" />
              <p>Nenhum onboarding pendente de prazo no momento.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 flex-1">
              {proximosVencimentos.map((item) => {
                const setor = getSetorVisual(item.setor, item.expand?.setor_ref)

                return (
                  <div
                    key={item.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/colaboradores/${item.id}`}
                          className="font-bold text-sm text-[#1A2233] hover:text-brand-600 truncate"
                        >
                          {item.colaborador_nome}
                        </Link>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${setor.corBg}`}
                        >
                          {setor.nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span>Prazo: {formatShortDate(item.data_fim)}</span>
                        <span>•</span>
                        <span>Etapa {item.etapa_atual} de 3</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:w-48 shrink-0 justify-between sm:justify-end">
                      {/* Dias restantes */}
                      <div>
                        {item.prazoInfo.isVencido ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-xs font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-red-600" />
                            Vencido
                          </Badge>
                        ) : item.prazoInfo.isHoje ? (
                          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300 text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Hoje
                          </Badge>
                        ) : item.prazoInfo.isCritico ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            {item.prazoInfo.labelBadge}
                          </Badge>
                        ) : (
                          <Badge className="bg-brand-50 text-brand-700 hover:bg-brand-50 border-brand-200 text-xs font-medium">
                            {item.prazoInfo.labelBadge}
                          </Badge>
                        )}
                      </div>

                      {/* Progresso visual */}
                      <div className="w-20 hidden sm:block">
                        <Progress value={item.progresso} className="h-2" />
                      </div>

                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 text-brand-600 hover:text-brand-700 px-2"
                      >
                        <Link to={`/colaboradores/${item.id}`}>Ver</Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Atividade Recente (1 coluna em desktop) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-[#1A2233]">Atividade Recente</h3>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Últimas movimentações registradas no sistema.
          </p>

          {atividadesRecentes.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm flex-1 flex items-center justify-center">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div className="relative pl-5 space-y-5 border-l-2 border-gray-200 my-2 flex-1">
              {atividadesRecentes.map((act) => (
                <div key={act.id} className="relative group">
                  <div
                    className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${act.cor}`}
                  />
                  <div>
                    <Link
                      to={`/colaboradores/${act.onboardingId}`}
                      className="text-xs font-semibold text-gray-800 hover:text-brand-600 line-clamp-2 block"
                    >
                      {act.texto}
                    </Link>
                    <span className="text-[11px] text-gray-400 font-medium block mt-0.5">
                      {formatDate(act.data)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <Link
              to="/onboardings"
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              Acompanhar todos os onboardings &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
