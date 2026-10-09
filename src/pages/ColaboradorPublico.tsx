import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  FileText,
  Video,
  Clock,
  Calendar,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  ShieldCheck,
  FileCheck2,
  Laptop,
  Flame,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  onboardingService,
  tarefaService,
  confirmacaoColaboradorService,
} from '@/services/onboarding'
import type {
  Onboarding,
  TarefaOnboarding,
  ConfirmacaoColaborador,
  TarefaTipo,
} from '@/types/onboarding'
import { getSetorVisual } from '@/types/onboarding'

export default function ColaboradorPublico() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [tarefas, setTarefas] = useState<TarefaOnboarding[]>([])
  const [confirmacoes, setConfirmacoes] = useState<Record<string, ConfirmacaoColaborador>>({})
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  // Modal de preview/player
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
    descricao?: string
    tarefaId?: string
  } | null>(null)

  const carregarDados = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const onb = await onboardingService.getByTokenColaborador(token)
      if (!onb) {
        setOnboarding(null)
        setLoading(false)
        return
      }

      setOnboarding(onb)

      // Carregar tarefas do onboarding
      const items = await tarefaService.listByOnboarding(onb.id)
      setTarefas(items)

      // Carregar confirmações do colaborador
      const confs = await confirmacaoColaboradorService.listByOnboarding(onb.id)
      const mapConfs: Record<string, ConfirmacaoColaborador> = {}
      for (const c of confs) {
        mapConfs[c.tarefa] = c
      }
      setConfirmacoes(mapConfs)
    } catch (err) {
      console.error('Erro ao carregar dados do colaborador:', err)
      toast.error('Não foi possível carregar os dados do seu onboarding.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Separar tarefas por etapa
  const tarefasEtapa1 = useMemo(() => tarefas.filter((t) => t.etapa === 1), [tarefas])

  const tarefasEtapa2 = useMemo(
    () => tarefas.filter((t) => t.etapa === 2 || !t.etapa || t.etapa === 0),
    [tarefas],
  )

  // Itens liberados para o colaborador (Etapa 1 sempre liberada; Etapa 2 liberada se etapa1_concluida for true ou etapa_atual >= 2)
  const etapa2Liberada = Boolean(
    onboarding?.etapa1_concluida || (onboarding && onboarding.etapa_atual >= 2),
  )

  // Itens visíveis no cômputo do progresso do colaborador
  const tarefasVisiveis = useMemo(() => {
    if (!etapa2Liberada) return tarefasEtapa1
    return [...tarefasEtapa1, ...tarefasEtapa2]
  }, [etapa2Liberada, tarefasEtapa1, tarefasEtapa2])

  // Estatísticas de confirmação
  const totalVisivel = tarefasVisiveis.length
  const totalConfirmadas = useMemo(() => {
    return tarefasVisiveis.filter((t) => Boolean(confirmacoes[t.id])).length
  }, [tarefasVisiveis, confirmacoes])

  const progressoPercent =
    totalVisivel > 0 ? Math.round((totalConfirmadas / totalVisivel) * 100) : 0

  // Cálculo de prazo
  const prazoInfo = useMemo(() => {
    if (!onboarding?.data_fim) return { diasRestantes: 0, isAtrasado: false }
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const [ano, mes, dia] = onboarding.data_fim.split('-').map(Number)
    const fim = new Date(ano, mes - 1, dia)
    fim.setHours(0, 0, 0, 0)
    const diffMs = fim.getTime() - hoje.getTime()
    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return {
      diasRestantes: dias,
      isAtrasado: dias < 0,
    }
  }, [onboarding?.data_fim])

  // Confirmar que assistiu/leu
  const handleConfirmar = async (tarefaId: string) => {
    if (!onboarding) return
    if (confirmacoes[tarefaId]) {
      toast.info('Você já confirmou a visualização deste documento!')
      return
    }

    try {
      setConfirmandoId(tarefaId)
      const novaConf = await confirmacaoColaboradorService.confirmarItem({
        onboardingId: onboarding.id,
        tarefaId,
      })

      setConfirmacoes((prev) => ({
        ...prev,
        [tarefaId]: novaConf,
      }))

      toast.success('Confirmação registrada com sucesso! Obrigado pela leitura/visualização.')
    } catch (err) {
      console.error('Erro ao registrar confirmação:', err)
      toast.error('Erro ao registrar sua confirmação. Tente novamente.')
    } finally {
      setConfirmandoId(null)
    }
  }

  const openPreview = (item: {
    titulo: string
    tipo: TarefaTipo
    url: string
    descricao?: string
    tarefaId: string
  }) => {
    setPreviewItem(item)
    setPreviewModalOpen(true)
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const formatShortDate = (ymd?: string) => {
    if (!ymd) return '-'
    const parts = ymd.split('T')[0].split('-')
    if (parts.length === 3) {
      const [ano, mes, dia] = parts
      return `${dia}/${mes}/${ano}`
    }
    return ymd
  }

  // Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">
            Carregando sua jornada de onboarding...
          </p>
        </div>
      </div>
    )
  }

  // Link Inválido ou Não Encontrado
  if (!onboarding) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Link não encontrado ou expirado</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              O link de acesso ao onboarding que você utilizou é inválido ou não está mais ativo.
              Por favor, solicite um novo link ao responsável do RH ou ao seu Gestor de TI.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Acessar Área Administrativa</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const setorInfo = getSetorVisual(onboarding.setor, onboarding.expand?.setor_ref)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Bar da Empresa / Identificação */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
                Portal do Colaborador TI
              </span>
              <h1 className="text-sm font-bold text-white leading-tight">
                Onboarding & Integração Técnica
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Acesso Público Seguro</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </header>

      {/* Container Principal */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner de Boas-vindas e Identificação do Colaborador */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: setorInfo.cor }}
                  />
                  Área: {setorInfo.nome}
                </span>
                {prazoInfo.isAtrasado ? (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-xs font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    Prazo excedido
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-xs font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {prazoInfo.diasRestantes} dia(s) restante(s)
                  </Badge>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Olá, {onboarding.colaborador_nome}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                Seja bem-vindo(a) à nossa equipe técnica. Assista aos vídeos e leia os manuais
                abaixo. Ao finalizar cada item, clique no botão de confirmação para registrar seu
                progresso.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs shrink-0 sm:text-right space-y-1">
              <span className="text-slate-500 font-medium block">
                Prazo de Integração (15 dias):
              </span>
              <div className="flex items-center sm:justify-end gap-1.5 font-bold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Até {formatShortDate(onboarding.data_fim)}</span>
              </div>
              {onboarding.expand?.gestor_id?.name && (
                <div className="pt-1 text-[11px] text-slate-500">
                  Gestor responsável: <strong>{onboarding.expand.gestor_id.name}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Progresso do Colaborador */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Seu Progresso de Confirmações
              </span>
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {totalConfirmadas} de {totalVisivel} materiais confirmados ({progressoPercent}%)
              </span>
            </div>
            <Progress value={progressoPercent} className="h-2.5 rounded-full" />
          </div>

          {/* Mensagem de resultado final se concluído */}
          {onboarding.status === 'concluido' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Parabéns! Você foi liberado para o suporte autônomo.
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Sua avaliação final foi concluída com sucesso pelo seu gestor. Você agora está
                  100% apto a atender os chamados da empresa.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* ETAPA 1 — APRESENTAÇÃO DA EMPRESA (RH)                   */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                1
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Etapa 1 — Apresentação da Empresa
                </h3>
                <p className="text-xs text-slate-500">
                  Cultura institucional, estrutura dos setores e boas práticas gerais de
                  atendimento.
                </p>
              </div>
            </div>

            {onboarding.etapa1_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Etapa Validada pelo RH
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                Em andamento
              </Badge>
            )}
          </div>

          {/* Lista de Itens da Etapa 1 */}
          <div className="space-y-3">
            {tarefasEtapa1.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhum documento ou vídeo cadastrado nesta etapa.
              </div>
            ) : (
              tarefasEtapa1.map((item) => {
                const conf = confirmacoes[item.id]
                const fileUrl = tarefaService.getFileUrl(item)
                const isConfirmando = confirmandoId === item.id

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition-all ${
                      conf
                        ? 'bg-emerald-50/20 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Título & Descrição */}
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.tipo === 'video'
                              ? 'bg-purple-50 text-purple-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {item.tipo === 'video' ? (
                            <Video className="w-5 h-5" />
                          ) : (
                            <FileText className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">{item.titulo}</span>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.tipo === 'video' ? 'Vídeo Aula' : 'Manual / Documento'}
                            </span>
                          </div>

                          {item.descricao && (
                            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                              {item.descricao}
                            </p>
                          )}

                          {/* Estado de Confirmação do Colaborador */}
                          <div className="pt-1 flex items-center gap-2">
                            {conf ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Confirmado em {formatDateTime(conf.confirmado_em || conf.created)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
                                <Clock className="w-3.5 h-3.5" />
                                Aguardando sua visualização e confirmação
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPreview({
                              titulo: item.titulo,
                              tipo: item.tipo,
                              url: fileUrl,
                              descricao: item.descricao,
                              tarefaId: item.id,
                            })
                          }
                          className="h-9 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          {item.tipo === 'video' ? 'Assistir' : 'Abrir/Ler'}
                        </Button>

                        {!conf ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isConfirmando}
                            onClick={() => handleConfirmar(item.id)}
                            className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {isConfirmando ? 'Registrando...' : 'Confirmo que assisti/li'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-9 text-xs text-emerald-700 font-semibold bg-emerald-50 cursor-default"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Já Confirmado
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* ETAPA 2 — VIVÊNCIA TÉCNICA (POR SETOR)                  */}
        {/* ======================================================== */}
        <section
          className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm space-y-5 transition-all ${
            !etapa2Liberada ? 'border-slate-200 bg-slate-50/70 opacity-70' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${
                  !etapa2Liberada ? 'bg-slate-300 text-slate-600' : 'bg-blue-600 text-white'
                }`}
              >
                {!etapa2Liberada ? <Lock className="w-4 h-4" /> : '2'}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Etapa 2 — Vivência Técnica ({setorInfo.nome})
                </h3>
                <p className="text-xs text-slate-500">
                  Movidesk (chamados), Passportal (documentação) e ferramentas específicas da sua
                  área.
                </p>
              </div>
            </div>

            {!etapa2Liberada ? (
              <Badge variant="outline" className="text-slate-400 text-xs">
                Bloqueada (Aguardando RH)
              </Badge>
            ) : onboarding.etapa2_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Etapa Concluída pelo Gestor
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                Liberada para Estudo
              </Badge>
            )}
          </div>

          {!etapa2Liberada ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Esta etapa ainda não está liberada.</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Assim que a equipe de RH concluir a Etapa 1, os materiais e procedimentos técnicos
                da sua área estarão disponíveis aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tarefasEtapa2.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Nenhum procedimento específico cadastrado para seu setor até o momento.
                </div>
              ) : (
                tarefasEtapa2.map((item) => {
                  const conf = confirmacoes[item.id]
                  const fileUrl = tarefaService.getFileUrl(item)
                  const isConfirmando = confirmandoId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 transition-all ${
                        conf
                          ? 'bg-emerald-50/20 border-emerald-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Título & Descrição */}
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              item.tipo === 'video'
                                ? 'bg-purple-50 text-purple-600'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {item.tipo === 'video' ? (
                              <Video className="w-5 h-5" />
                            ) : (
                              <FileText className="w-5 h-5" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">
                                {item.titulo}
                              </span>
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {item.tipo === 'video' ? 'Vídeo Técnico' : 'Manual de Procedimento'}
                              </span>
                            </div>

                            {item.descricao && (
                              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                                {item.descricao}
                              </p>
                            )}

                            {/* Estado de Confirmação */}
                            <div className="pt-1 flex items-center gap-2">
                              {conf ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Confirmado em {formatDateTime(conf.confirmado_em || conf.created)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  Aguardando sua visualização e confirmação
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openPreview({
                                titulo: item.titulo,
                                tipo: item.tipo,
                                url: fileUrl,
                                descricao: item.descricao,
                                tarefaId: item.id,
                              })
                            }
                            className="h-9 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            {item.tipo === 'video' ? 'Assistir' : 'Abrir/Ler'}
                          </Button>

                          {!conf ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isConfirmando}
                              onClick={() => handleConfirmar(item.id)}
                              className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {isConfirmando ? 'Registrando...' : 'Confirmo que assisti/li'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-9 text-xs text-emerald-700 font-semibold bg-emerald-50 cursor-default"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Já Confirmado
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </section>

        {/* Rodapé informativo */}
        <div className="text-center text-xs text-slate-400 py-4 space-y-1">
          <p>Sistema de Gestão de Onboarding TI • Dúvidas? Procure o setor de Recursos Humanos.</p>
          <p className="text-[11px] text-slate-400">
            Link exclusivo do colaborador. Suas confirmações ficam salvas de forma segura e
            automática.
          </p>
        </div>
      </main>

      {/* Modal: Player de Vídeo e Leitor de Documentos */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              {previewItem?.tipo === 'video' ? (
                <Video className="w-5 h-5 text-purple-600" />
              ) : (
                <FileText className="w-5 h-5 text-blue-600" />
              )}
              <span>{previewItem?.titulo}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {previewItem?.descricao && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                {previewItem.descricao}
              </p>
            )}

            {previewItem?.url ? (
              previewItem.tipo === 'video' ? (
                <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video controls autoPlay className="w-full max-h-[440px]" src={previewItem.url}>
                    Seu navegador não suporta reprodução de vídeo HTML5.
                  </video>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-4">
                  <FileCheck2 className="w-14 h-14 text-blue-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Documento disponível para leitura
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Clique no botão abaixo para abrir o documento na íntegra em uma nova guia do
                      seu navegador.
                    </p>
                  </div>
                  <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Documento Completo</span>
                    </a>
                  </Button>
                </div>
              )
            ) : (
              <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <Info className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">
                  Manual / Instrução do Onboarding
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  O material didático deste tópico foi repassado presencialmente ou em sessão com o
                  gestor. Após o alinhamento, confirme abaixo.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
            <div>
              {previewItem?.tarefaId && !confirmacoes[previewItem.tarefaId] ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    handleConfirmar(previewItem.tarefaId!)
                    setPreviewModalOpen(false)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Já assisti/li, confirmar agora
                </Button>
              ) : (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Item já confirmado por você!
                </span>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => setPreviewModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
