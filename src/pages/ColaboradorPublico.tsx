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
  Flame,
  Lock,
  Building2,
  UserCheck,
  CheckSquare,
  Mail,
  User as UserIcon,
} from 'lucide-react'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
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
  faseService,
  testeConhecimentoService,
} from '@/services/onboarding'
import type {
  Onboarding,
  TarefaOnboarding,
  ConfirmacaoColaborador,
  TarefaTipo,
  FaseModelo,
  TesteQuestaoPublica,
} from '@/types/onboarding'
import { getSetorVisual } from '@/types/onboarding'
import { calcularDiasRestantes, formatShortDate, formatDateTime } from '@/lib/dateUtils'
import { Layers } from 'lucide-react'

export default function ColaboradorPublico() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [tarefas, setTarefas] = useState<TarefaOnboarding[]>([])
  const [fasesSetor, setFasesSetor] = useState<FaseModelo[]>([])
  const [confirmacoes, setConfirmacoes] = useState<Record<string, ConfirmacaoColaborador>>({})
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [sinalizandoFaseId, setSinalizandoFaseId] = useState<string | null>(null)

  // Modal de Sinalização com Relato Dissertativo Obrigatório (Etapa 2)
  const [modalRelatoOpen, setModalRelatoOpen] = useState(false)
  const [faseParaSinalizar, setFaseParaSinalizar] = useState<{
    faseId: string
    faseTitulo: string
    etapa: number
    isRefacao?: boolean
    motivoRefacao?: string
    cicloRefacao?: number
  } | null>(null)
  const [relatoTexto, setRelatoTexto] = useState('')
  const [relatoErro, setRelatoErro] = useState<string | null>(null)

  // Estados do Teste de Conhecimento (Etapa 3)
  const [testeDados, setTesteDados] = useState<{
    liberado: boolean
    jaSubmetido?: boolean
    reteste?: boolean
    dataSubmissao?: string
    tentativaNumero?: number
    totalQuestoes?: number
    questoes?: TesteQuestaoPublica[]
    mensagem?: string
    motivo?: string
  } | null>(null)
  const [testeRespostas, setTesteRespostas] = useState<Record<string, number>>({})
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [testeSucessoMsg, setTesteSucessoMsg] = useState<string | null>(null)

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

      // Carregar tarefas do onboarding e fases do setor
      const [items, confs, fasesList, testeInfo] = await Promise.all([
        tarefaService.listByOnboarding(onb.id),
        confirmacaoColaboradorService.listByOnboarding(onb.id),
        onb.setor ? faseService.listBySetor(onb.setor, onb.setor_ref) : Promise.resolve([]),
        testeConhecimentoService.getPublico(token).catch((err) => {
          console.warn('Teste de conhecimento não carregado:', err)
          return null
        }),
      ])
      setTarefas(items)
      setFasesSetor(fasesList)
      if (testeInfo) {
        setTesteDados(testeInfo)
      }

      // Carregar confirmações do colaborador
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

  // Conjunto de IDs das fases já concluídas pelo Gestor/Admin
  const fasesConcluidasPeloGestor = useMemo(() => {
    const raw = onboarding?.fases_concluidas
    if (!raw) return new Set<string>()
    if (Array.isArray(raw)) {
      return new Set<string>(
        raw
          .map((item) => {
            if (!item) return ''
            if (typeof item === 'string') return item
            return item.fase_id || ''
          })
          .filter(Boolean),
      )
    }
    return new Set<string>()
  }, [onboarding?.fases_concluidas])

  // Estado das fases da Etapa 2 para o colaborador (FONTE DA VERDADE UNIFICADA):
  // Uma fase N só libera para o colaborador após a CONCLUSÃO PELO GESTOR da fase anterior (N-1)
  // A primeira fase (index 0) é liberada assim que a Etapa 2 é liberada pelo RH.
  const fasesStatusColaborador = useMemo(() => {
    if (fasesSetor.length === 0) return []

    return fasesSetor.map((fase, index) => {
      const itensDaFase = tarefasEtapa2.filter((t) => t.fase === fase.id)
      const totalItens = itensDaFase.length
      const confirmados = itensDaFase.filter((t) => Boolean(confirmacoes[t.id])).length

      // Sinalização e relato do colaborador nesta fase
      const sinalizacao = onboarding?.fases_sinalizadas?.find((s) => s.fase_id === fase.id)
      const temRelatoValido = Boolean(
        sinalizacao &&
        sinalizacao.status_sinalizacao !== 'refacao_solicitada' &&
        sinalizacao.relato &&
        sinalizacao.relato.trim().length >= 10,
      )

      // O colaborador cumpriu os requisitos do seu lado na fase quando:
      // Se há itens: confirmou todos e enviou relato válido
      // Se não há itens: enviou relato válido
      const estaCompleta =
        totalItens > 0 ? confirmados === totalItens && temRelatoValido : temRelatoValido

      // Fase anterior concluída pelo GESTOR (ou é a primeira fase)
      const faseAnterior = index > 0 ? fasesSetor[index - 1] : null
      const estaDesbloqueada =
        index === 0 || (faseAnterior ? fasesConcluidasPeloGestor.has(faseAnterior.id) : true)

      // Se a própria fase já foi concluída pelo gestor
      const concluidaPeloGestor = fasesConcluidasPeloGestor.has(fase.id)

      return {
        fase,
        index,
        itens: itensDaFase,
        totalItens,
        confirmados,
        estaCompleta,
        estaDesbloqueada,
        concluidaPeloGestor,
      }
    })
  }, [
    fasesSetor,
    tarefasEtapa2,
    confirmacoes,
    fasesConcluidasPeloGestor,
    onboarding?.fases_sinalizadas,
  ])

  // Fase em andamento do colaborador para badge
  const faseAtualColabInfo = useMemo(() => {
    if (fasesStatusColaborador.length === 0) return null
    if (onboarding?.etapa2_concluida) {
      return 'Todas as fases concluídas'
    }
    const atual = fasesStatusColaborador.find((f) => !f.estaCompleta && f.estaDesbloqueada)
    if (atual) {
      return `Fase ${atual.index + 1} de ${fasesStatusColaborador.length} — ${atual.fase.titulo}`
    }
    const todasCompletas = fasesStatusColaborador.every((f) => f.estaCompleta)
    if (todasCompletas) {
      return `Fase ${fasesStatusColaborador.length} de ${fasesStatusColaborador.length} — Concluída`
    }
    return `Fase 1 de ${fasesStatusColaborador.length} — ${fasesStatusColaborador[0]?.fase.titulo}`
  }, [fasesStatusColaborador, onboarding?.etapa2_concluida])

  // Itens avulsos da Etapa 2
  const tarefasEtapa2SemFase = useMemo(() => {
    return tarefasEtapa2.filter((t) => !t.fase || !fasesSetor.some((f) => f.id === t.fase))
  }, [tarefasEtapa2, fasesSetor])

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
    if (!onboarding?.data_fim)
      return {
        diasRestantes: 0,
        isAtrasado: false,
        isHoje: false,
        isVencido: false,
        labelBadge: '—',
      }
    const prazo = calcularDiasRestantes(onboarding.data_fim)
    return {
      diasRestantes: prazo.diasRestantes ?? 0,
      isAtrasado: prazo.isVencido,
      isVencido: prazo.isVencido,
      isHoje: prazo.isHoje,
      labelBadge: prazo.labelBadge,
    }
  }, [onboarding?.data_fim])

  // Confirmar que assistiu/leu
  const handleConfirmar = async (tarefaId: string) => {
    if (!onboarding) return
    if (confirmacoes[tarefaId]) {
      toast.info('Você já confirmou a visualização deste documento!')
      return
    }

    // Trava de segurança no colaborador: verificar se a fase está desbloqueada
    const tarefaAlvo = tarefas.find((t) => t.id === tarefaId)
    if (tarefaAlvo?.fase) {
      const statusFase = fasesStatusColaborador.find((f) => f.fase.id === tarefaAlvo.fase)
      if (statusFase && !statusFase.estaDesbloqueada) {
        toast.error('Esta fase ainda está bloqueada. Conclua os itens da fase anterior primeiro.')
        return
      }
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

  const formatDateTimeLocal = (iso?: string) => {
    return formatDateTime(iso)
  }

  // Ações do Teste de Conhecimento
  const handleSelecionarAlternativa = (questaoId: string, alternativaIndex: number) => {
    setTesteRespostas((prev) => ({
      ...prev,
      [questaoId]: alternativaIndex,
    }))
  }

  const handleSubmeterTeste = async () => {
    if (!testeDados?.questoes || testeDados.questoes.length === 0) return

    // Validação de todas respondidas
    const total = testeDados.questoes.length
    const respondidas = Object.keys(testeRespostas).length
    const faltam = total - respondidas

    if (faltam > 0) {
      toast.error(
        `Faltam ${faltam} questão(ões) para responder. Responda todas as ${total} questões antes de enviar.`,
      )
      return
    }

    try {
      setEnviandoTeste(true)
      const res = await testeConhecimentoService.submeterPublico(token || '', testeRespostas)
      setTesteSucessoMsg(
        res.mensagem || 'Teste enviado com sucesso. Aguarde o retorno do seu gestor.',
      )
      toast.success('Teste de conhecimento enviado com sucesso!')

      // Atualizar dados locais
      const novoTesteDados = await testeConhecimentoService
        .getPublico(token || '')
        .catch(() => null)
      if (novoTesteDados) {
        setTesteDados(novoTesteDados)
      }
    } catch (err: unknown) {
      console.error('Erro ao submeter teste:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao submeter teste. Tente novamente.'
      toast.error(msg)
    } finally {
      setEnviandoTeste(false)
    }
  }

  // Formato compacto para sinalização: dd/mm hh:mm
  const formatSinalizacaoDate = (iso?: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const horas = String(d.getHours()).padStart(2, '0')
      const minutos = String(d.getMinutes()).padStart(2, '0')
      return `${dia}/${mes} ${horas}:${minutos}`
    } catch {
      return iso
    }
  }

  // Abrir modal de sinalização da fase (Etapa 1 e Etapa 2 agora requerem relato dissertativo obrigatório)
  const iniciarSinalizacaoFase = (params: {
    faseId: string
    faseTitulo: string
    etapa: number
  }) => {
    if (!onboarding) return

    // Checa se a fase já teve sinalização / refação solicitada
    const sinalizacaoFase = onboarding.fases_sinalizadas?.find(
      (s) =>
        s.fase_id === params.faseId ||
        (params.etapa === 1 && (s.fase_id === 'etapa1' || s.etapa === 1)),
    )
    const isRefacao = sinalizacaoFase?.status_sinalizacao === 'refacao_solicitada'
    const motivoRefacao = sinalizacaoFase?.motivo_refacao_atual || ''
    const cicloRefacao = sinalizacaoFase?.refacoes_count || 0

    setFaseParaSinalizar({
      ...params,
      isRefacao,
      motivoRefacao,
      cicloRefacao,
    })
    setRelatoTexto(sinalizacaoFase?.relato || '')
    setRelatoErro(null)
    setModalRelatoOpen(true)
  }

  // Execução do envio do relato e sinalização
  const executarSinalizacaoFase = async (params: {
    faseId: string
    faseTitulo: string
    etapa: number
    relato?: string
  }) => {
    if (!onboarding) return

    try {
      setSinalizandoFaseId(params.faseId)
      const { onboarding: updated } = await onboardingService.sinalizarConclusaoFase({
        onboardingId: onboarding.id,
        token: onboarding.token_acesso_colaborador || token || '',
        faseId: params.faseId,
        faseTitulo: params.faseTitulo,
        etapa: params.etapa,
        relato: params.relato,
        colaboradorNome: onboarding.colaborador_nome,
        colaboradorEmail: onboarding.colaborador_email,
      })

      setOnboarding(updated)
      setModalRelatoOpen(false)
      setFaseParaSinalizar(null)
      setRelatoTexto('')
      setRelatoErro(null)

      const avisoResponsavel =
        params.etapa === 1
          ? 'Responsável notificado. Aguarde a validação da fase pela equipe de RH.'
          : 'Relato registrado com sucesso! Seu gestor foi notificado para validar e concluir a fase.'
      toast.success(avisoResponsavel)
    } catch (err: unknown) {
      console.error('Erro ao sinalizar conclusão da fase:', err)
      const msg =
        err instanceof Error ? err.message : 'Erro ao sinalizar conclusão da fase. Tente novamente.'
      toast.error(msg)
    } finally {
      setSinalizandoFaseId(null)
    }
  }

  const handleConfirmarRelatoESinalizar = () => {
    if (!faseParaSinalizar) return
    const textoLimpo = relatoTexto.trim()
    if (!textoLimpo || textoLimpo.length < 10) {
      setRelatoErro(
        'Por favor, descreva detalhadamente (pelo menos 10 caracteres) o que você entendeu e aprendeu nesta fase.',
      )
      return
    }

    executarSinalizacaoFase({
      faseId: faseParaSinalizar.faseId,
      faseTitulo: faseParaSinalizar.faseTitulo,
      etapa: faseParaSinalizar.etapa,
      relato: textoLimpo,
    })
  }

  // Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
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
            <div className="bg-white px-2.5 py-1 rounded-xl shadow-xs">
              <MundoOpenLogo variant="full" size="sm" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider block">
                Portal do Colaborador
              </span>
              <h1 className="text-sm font-bold text-white leading-tight">
                Integração & Treinamento Técnico
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1.5">
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
                ) : prazoInfo.isHoje ? (
                  <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300 text-xs font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Vence hoje
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-xs font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {prazoInfo.labelBadge} restante(s)
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
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
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
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Seu Progresso de Confirmações
              </span>
              <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
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
              <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                1
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Etapa 1 — Apresentação da Empresa
                </h3>
                <p className="text-xs text-slate-500">
                  Cultura institucional Mundo Open, estrutura dos setores e boas práticas de
                  atendimento.
                </p>
              </div>
            </div>

            {onboarding.etapa1_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Etapa Validada pelo RH
              </Badge>
            ) : (
              <Badge className="bg-brand-50 text-brand-700 border-brand-200 text-xs font-semibold">
                Em andamento
              </Badge>
            )}
          </div>

          {/* Checklist de Integração da Etapa 1 (Entrega de Equipamentos & Apresentações pelo RH) */}
          {Array.isArray(onboarding.checklist_integracao) &&
            onboarding.checklist_integracao.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Checklist de Integração (RH)
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            onboarding.checklist_integracao.every((i) => i.entregue)
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          {onboarding.checklist_integracao.filter((i) => i.entregue).length} de{' '}
                          {onboarding.checklist_integracao.length} entregues
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Entrega física de equipamentos (notebook, periféricos, headset, cartão
                        Flash) e apresentações institucionais.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 italic">
                    (Conferência e entrega conduzidas pelo RH)
                  </span>
                </div>

                <div className="divide-y divide-slate-200/80 border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {onboarding.checklist_integracao.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 flex items-start justify-between gap-3 ${
                        item.entregue ? 'bg-emerald-50/20' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {item.entregue ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span
                            className={`text-xs font-semibold ${
                              item.entregue ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {item.titulo}
                          </span>
                          {item.entregue ? (
                            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                              Entregue
                              {item.entregue_em
                                ? ` em ${formatDateTimeLocal(item.entregue_em)}`
                                : ''}
                              {item.entregue_por_nome ? ` por ${item.entregue_por_nome}` : ''}
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                              Pendente de entrega pelo RH
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 font-medium ${
                          item.entregue
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item.entregue ? 'Entregue' : 'Pendente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Materiais & Documentos da Etapa 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Materiais, Vídeos e Manuais da Etapa 1
              </span>
            </div>

            {tarefasEtapa1.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhum documento ou vídeo cadastrado nesta etapa.
              </div>
            ) : (
              <>
                {tarefasEtapa1.map((item) => {
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
                                : 'bg-brand-50 text-brand-600'
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
                                  Confirmado em{' '}
                                  {formatDateTimeLocal(conf.confirmado_em || conf.created)}
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
                            className="h-9 text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
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
                })}

                {/* Botão de Sinalização de Conclusão da Etapa 1 */}
                {(() => {
                  const totalItensEtapa1 = tarefasEtapa1.length
                  const totalConfirmadosEtapa1 = tarefasEtapa1.filter((t) =>
                    Boolean(confirmacoes[t.id]),
                  ).length
                  const todosItensConfirmadosEtapa1 =
                    totalItensEtapa1 > 0 && totalConfirmadosEtapa1 === totalItensEtapa1
                  const sinalizacaoEtapa1 = onboarding.fases_sinalizadas?.find(
                    (s) => s.fase_id === 'etapa1' || (s.etapa === 1 && !s.fase_id),
                  )
                  const isSinalizando = sinalizandoFaseId === 'etapa1'

                  if (!todosItensConfirmadosEtapa1) return null

                  return (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-50/40 p-4 rounded-xl border border-brand-100">
                      <div className="text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">
                          Você confirmou todos os {totalItensEtapa1} materiais da Etapa 1!
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {sinalizacaoEtapa1
                            ? 'Sinalização enviada. O RH foi notificado para validar e concluir a etapa.'
                            : 'Sinalize que finalizou suas atividades para que a equipe de RH valide sua integração.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sinalizacaoEtapa1 ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled
                              className="h-9 text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 cursor-default"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                              Atividades sinalizadas em{' '}
                              {formatSinalizacaoDate(sinalizacaoEtapa1.sinalizado_em)}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSinalizando}
                              onClick={() =>
                                iniciarSinalizacaoFase({
                                  faseId: 'etapa1',
                                  faseTitulo: 'Apresentação da Empresa',
                                  etapa: 1,
                                })
                              }
                              className="h-9 text-xs text-brand-700 hover:text-brand-900 hover:bg-brand-100/50"
                              title="Atualizar registro de sinalização e reenviar aviso ao RH"
                            >
                              {isSinalizando ? 'Atualizando...' : 'Atualizar sinal'}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSinalizando}
                            onClick={() =>
                              iniciarSinalizacaoFase({
                                faseId: 'etapa1',
                                faseTitulo: 'Apresentação da Empresa',
                                etapa: 1,
                              })
                            }
                            className="h-9 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {isSinalizando
                              ? 'Sinalizando...'
                              : 'Finalizei minhas atividades desta fase'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* ETAPA 2 — VIVÊNCIA TÉCNICA (SETOR ESPECÍFICO)            */}
        {/* ======================================================== */}
        <section
          className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm space-y-5 transition-all ${
            !etapa2Liberada ? 'border-slate-200/60 opacity-90' : 'border-slate-200/90'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm text-white ${
                  etapa2Liberada ? 'bg-brand-600' : 'bg-slate-400'
                }`}
              >
                {!etapa2Liberada ? <Lock className="w-4 h-4" /> : 2}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Etapa 2 — Vivência Técnica ({setorInfo.nome})
                  </h3>
                  {faseAtualColabInfo && etapa2Liberada && (
                    <span className="text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Layers className="w-3 h-3 text-brand-600" />
                      {faseAtualColabInfo}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {fasesSetor.length > 0
                    ? 'Progressão em fases sequenciais. Conclua cada fase para destravar a seguinte.'
                    : 'Procedimentos operacionais, manuais técnicos e sistemas de suporte (Movidesk, Passportal).'}
                </p>
              </div>
            </div>

            {onboarding.etapa2_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Etapa Validada pelo Gestor
              </Badge>
            ) : etapa2Liberada ? (
              <Badge className="bg-brand-50 text-brand-700 border-brand-200 text-xs font-semibold">
                Em andamento
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-slate-400 border-slate-200 text-xs font-medium"
              >
                Bloqueada (Aguardando RH)
              </Badge>
            )}
          </div>

          {/* Destaque do Técnico Responsável pelo Acompanhamento */}
          {etapa2Liberada && onboarding.tecnico_responsavel_nome && (
            <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/40 flex items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-800 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-brand-700" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-brand-800 uppercase tracking-wider block">
                    Seu acompanhamento inicial:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      {onboarding.tecnico_responsavel_nome}
                    </span>
                    {onboarding.tecnico_responsavel_email && (
                      <a
                        href={`mailto:${onboarding.tecnico_responsavel_email}`}
                        className="text-xs text-brand-700 hover:text-brand-800 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {onboarding.tecnico_responsavel_email}
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Técnico de referência para tirar dúvidas sobre ferramentas, chamados e
                    procedimentos.
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] bg-white border-brand-300 text-brand-800 font-semibold shrink-0"
              >
                Ponto Focal
              </Badge>
            </div>
          )}

          {!etapa2Liberada ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Esta etapa ainda não está liberada.</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Assim que a equipe de RH concluir a Etapa 1, os materiais e procedimentos técnicos
                da sua área estarão disponíveis aqui.
              </p>
            </div>
          ) : fasesSetor.length > 0 ? (
            /* PROGRESSÃO DE FASES ORDENADAS COM TRAVA SEQUENCIAL PARA O COLABORADOR */
            <div className="space-y-5">
              {fasesStatusColaborador.map((faseStatus) => {
                const {
                  fase,
                  index,
                  itens,
                  totalItens,
                  confirmados,
                  estaCompleta,
                  estaDesbloqueada,
                } = faseStatus

                return (
                  <div
                    key={fase.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      !estaDesbloqueada
                        ? 'bg-slate-50/70 border-slate-200 opacity-80'
                        : estaCompleta
                          ? 'bg-emerald-50/20 border-emerald-200 shadow-xs'
                          : 'bg-white border-brand-200 shadow-sm'
                    }`}
                  >
                    {/* Header da Fase */}
                    <div
                      className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        !estaDesbloqueada
                          ? 'bg-slate-100/70 border-slate-200 text-slate-500'
                          : estaCompleta
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                            : 'bg-gradient-to-r from-brand-50/70 to-white border-brand-100 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                            !estaDesbloqueada
                              ? 'bg-slate-300 text-slate-600'
                              : estaCompleta
                                ? 'bg-emerald-600 text-white'
                                : 'bg-brand-600 text-white'
                          }`}
                        >
                          {!estaDesbloqueada ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : estaCompleta ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            index + 1
                          )}
                        </span>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm">
                              Fase {index + 1}: {fase.titulo}
                            </h4>
                            {!estaDesbloqueada ? (
                              <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Aguardando Conclusão da Fase Anterior
                                pelo Gestor
                              </span>
                            ) : faseStatus.concluidaPeloGestor ? (
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Concluída e Validada pelo
                                Gestor
                              </span>
                            ) : estaCompleta ? (
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />{' '}
                                {totalItens > 0
                                  ? `Itens Confirmados (${confirmados}/${totalItens}) — Aguardando Gestor`
                                  : 'Atividades Sinalizadas — Aguardando Gestor'}
                              </span>
                            ) : totalItens === 0 ? (
                              <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                Vivência Prática (Aguardando Sinalização)
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                Em Andamento ({confirmados}/{totalItens} confirmados)
                              </span>
                            )}{' '}
                          </div>
                          {fase.descricao && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {fase.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Exibição dos Clientes Indicados para Estudo na Fase 2 (Mapeamento de Ambientes) */}
                    {(index === 1 ||
                      fase.ordem === 2 ||
                      fase.titulo.toLowerCase().includes('mapeamento')) && (
                      <div className="p-4 border-b bg-amber-50/40 border-amber-200/80 space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              Clientes de Referência no Passportal para Estudo
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-100/60 border-amber-300 text-amber-900 font-medium"
                              >
                                Indicação da Gestão
                              </Badge>
                            </h5>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              O Gestor indicou estes 3 clientes para você estudar a documentação
                              técnica no Passportal (topologia, faixas de IP e particularidades):
                            </p>
                          </div>
                        </div>

                        {onboarding.clientes_mapeamento &&
                        onboarding.clientes_mapeamento.filter(Boolean).length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            {onboarding.clientes_mapeamento.filter(Boolean).map((cliente, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-amber-200/90 rounded-lg px-3 py-2 flex items-center gap-2 shadow-2xs"
                              >
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span
                                  className="text-xs font-semibold text-slate-900 truncate"
                                  title={cliente}
                                >
                                  {cliente}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white/80 border border-dashed border-amber-200 rounded-lg p-2.5 text-xs text-amber-800/90 italic">
                            O Gestor Responsável ainda está selecionando os 3 clientes de
                            referência. Em breve eles serão exibidos aqui.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conteúdo / Itens da Fase */}
                    {!estaDesbloqueada ? (
                      <div className="p-4 bg-slate-50/70 flex items-center gap-2 text-xs text-slate-500 italic">
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          Esta fase será liberada automaticamente assim que o seu Gestor Responsável
                          concluir e aprovar a fase anterior.
                        </span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white">
                        {itens.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Nenhum item adicionado nesta fase.
                          </div>
                        ) : (
                          itens.map((item) => {
                            const conf = confirmacoes[item.id]
                            const fileUrl = tarefaService.getFileUrl(item)
                            const isConfirmando = confirmandoId === item.id

                            return (
                              <div
                                key={item.id}
                                className={`p-4 transition-all ${
                                  conf ? 'bg-emerald-50/15' : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                        item.tipo === 'video'
                                          ? 'bg-purple-50 text-purple-600'
                                          : 'bg-brand-50 text-brand-600'
                                      }`}
                                    >
                                      {item.tipo === 'video' ? (
                                        <Video className="w-5 h-5" />
                                      ) : (
                                        <FileText className="w-5 h-5" />
                                      )}
                                    </div>

                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-900 truncate">
                                          {item.titulo}
                                        </span>
                                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                          {item.tipo === 'video'
                                            ? 'Vídeo Técnico'
                                            : 'Manual de Procedimento'}
                                        </span>
                                      </div>

                                      {item.descricao && (
                                        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                                          {item.descricao}
                                        </p>
                                      )}

                                      <div className="pt-1 flex items-center gap-2">
                                        {conf ? (
                                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            Confirmado em{' '}
                                            {formatDateTime(conf.confirmado_em || conf.created)}
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
                                      className="h-9 text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
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
                                        {isConfirmando
                                          ? 'Registrando...'
                                          : 'Confirmo que assisti/li'}
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

                    {/* Botão de Sinalização de Conclusão da Fase (Etapa 2) */}
                    {(() => {
                      // Regra unificada:
                      // - Em fase bloqueada, o botão não aparece.
                      // - Em fase já concluída formalmente pelo gestor, a fase já está finalizada.
                      // - Quando a fase tem itens (totalItens > 0): exige confirmação de todos os itens pelo colaborador.
                      // - Quando a fase NÃO tem itens (totalItens === 0): o colaborador pode sinalizar diretamente com o relato dissertativo.
                      if (!estaDesbloqueada || faseStatus.concluidaPeloGestor) {
                        return null
                      }

                      const todosItensConfirmados = totalItens === 0 || confirmados === totalItens
                      if (!todosItensConfirmados) {
                        return null
                      }

                      const sinalizacaoFase = onboarding.fases_sinalizadas?.find(
                        (s) => s.fase_id === fase.id,
                      )
                      const isSinalizando = sinalizandoFaseId === fase.id

                      return (
                        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            {totalItens > 0 ? (
                              <span className="font-semibold text-slate-800 block">
                                Você confirmou todos os {totalItens} itens desta fase!
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-800 block">
                                Esta fase não possui materiais para assistir — relate o que você
                                vivenciou/aprendeu nela.
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              {sinalizacaoFase
                                ? 'Responsável notificado. Aguarde a validação e conclusão da fase pelo seu gestor.'
                                : 'Sinalize que finalizou as atividades para avisar seu gestor de que a fase está pronta para ser concluída.'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {sinalizacaoFase ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="h-9 text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 cursor-default"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                                  Atividades sinalizadas em{' '}
                                  {formatSinalizacaoDate(sinalizacaoFase.sinalizado_em)}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSinalizando}
                                  onClick={() =>
                                    iniciarSinalizacaoFase({
                                      faseId: fase.id,
                                      faseTitulo: fase.titulo,
                                      etapa: 2,
                                    })
                                  }
                                  className="h-9 text-xs text-brand-700 hover:text-brand-900 hover:bg-brand-100/50"
                                  title="Atualizar registro de sinalização e reenviar aviso ao gestor"
                                >
                                  {isSinalizando ? 'Atualizando...' : 'Atualizar sinal'}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isSinalizando}
                                onClick={() =>
                                  iniciarSinalizacaoFase({
                                    faseId: fase.id,
                                    faseTitulo: fase.titulo,
                                    etapa: 2,
                                  })
                                }
                                className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                {isSinalizando
                                  ? 'Sinalizando...'
                                  : 'Finalizei minhas atividades desta fase'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}

              {/* Itens avulsos da Etapa 2 se existirem */}
              {tarefasEtapa2SemFase.length > 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4 space-y-3">
                  <div className="border-b border-slate-200 pb-2">
                    <h4 className="font-bold text-xs text-slate-700">
                      Atividades Complementares da Área
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Itens gerais de vivência técnica disponíveis para confirmação
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {tarefasEtapa2SemFase.map((item) => {
                      const conf = confirmacoes[item.id]
                      const fileUrl = tarefaService.getFileUrl(item)
                      const isConfirmando = confirmandoId === item.id

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-900 block truncate">
                                {item.titulo}
                              </span>
                              {conf ? (
                                <span className="text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Confirmado
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 inline-flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" /> Pendente
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
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
                              className="h-8 text-xs text-brand-700"
                            >
                              Ver
                            </Button>
                            {!conf ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isConfirmando}
                                onClick={() => handleConfirmar(item.id)}
                                className="h-8 text-xs bg-emerald-600 text-white font-semibold"
                              >
                                Confirmar
                              </Button>
                            ) : (
                              <span className="text-xs text-emerald-700 font-semibold px-2">
                                OK
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Modo plano para áreas sem fases (ex: RH, Comercial) */
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
                                : 'bg-brand-50 text-brand-600'
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
                            className="h-9 text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
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
        {/* ======================================================== */}
        {/* ETAPA 3 — TESTE DE CONHECIMENTO & AVALIAÇÃO FINAL        */}
        {/* ======================================================== */}
        <section
          className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm space-y-5 transition-all ${
            !onboarding.etapa2_concluida
              ? 'border-slate-200/60 opacity-90'
              : 'border-brand-200 ring-1 ring-brand-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm text-white ${
                  onboarding.etapa2_concluida ? 'bg-brand-600' : 'bg-slate-400'
                }`}
              >
                {!onboarding.etapa2_concluida ? <Lock className="w-4 h-4" /> : 3}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Etapa 3 — Teste de Conhecimento Técnico
                  </h3>
                  {testeDados?.reteste && (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-semibold">
                      Reteste Liberado pelo Gestor
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Avaliação teórica com 20 questões sobre normas de atendimento, segurança e boas
                  práticas de TI.
                </p>
              </div>
            </div>

            {onboarding.etapa3_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Etapa 3 Concluída
              </Badge>
            ) : testeDados?.jaSubmetido || testeSucessoMsg ? (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                Teste Enviado — Aguardando Gestor
              </Badge>
            ) : onboarding.etapa2_concluida ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Liberado para Resposta
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-slate-400 border-slate-200 text-xs font-medium"
              >
                Bloqueada (Aguardando Etapa 2)
              </Badge>
            )}
          </div>

          {!onboarding.etapa2_concluida ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Etapa 3 Bloqueada</p>
              <p className="text-slate-400 max-w-md mx-auto">
                O Teste de Conhecimento será liberado automaticamente assim que o seu Gestor
                Responsável validar a conclusão de todas as fases da Etapa 2 (Vivência Técnica).
              </p>
            </div>
          ) : testeSucessoMsg || (testeDados?.jaSubmetido && !testeDados?.reteste) ? (
            /* Confirmação de envio (SEM NOTA E SEM GABARITO) */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-emerald-950">Teste enviado com sucesso!</h4>
                <p className="text-xs sm:text-sm text-emerald-800 max-w-lg mx-auto leading-relaxed">
                  {testeSucessoMsg ||
                    testeDados?.mensagem ||
                    'Suas respostas foram gravadas e computadas de forma segura. Seu Gestor Responsável foi notificado e agendará a reunião de avaliação final com você.'}
                </p>
              </div>
              {testeDados?.dataSubmissao && (
                <div className="text-[11px] text-emerald-700 font-medium">
                  Submissão registrada em: {formatDateTime(testeDados.dataSubmissao)}
                </div>
              )}
            </div>
          ) : testeDados?.questoes && testeDados.questoes.length > 0 ? (
            /* FORMULÁRIO DO TESTE: 20 QUESTÕES EM TELA ÚNICA COM SCROLL E ALTERNATIVA ÚNICA */
            <div className="space-y-6 pt-2">
              {/* Barra de Progresso de Respostas */}
              {(() => {
                const total = testeDados.questoes.length
                const respondidas = Object.keys(testeRespostas).length
                const faltam = total - respondidas
                const pct = Math.round((respondidas / total) * 100)

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 sticky top-20 z-20 shadow-xs backdrop-blur-md bg-white/95">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-brand-600" />
                        Progresso do Teste: {respondidas} de {total} questões respondidas ({pct}%)
                      </span>
                      {faltam > 0 ? (
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold">
                          Faltam {faltam} questão(ões)
                        </span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tudo respondido! Pronto para enviar.
                        </span>
                      )}
                    </div>
                    <Progress value={pct} className="h-2 rounded-full" />
                  </div>
                )
              })()}

              {/* Lista das 20 questões */}
              <div className="space-y-5">
                {testeDados.questoes.map((q, idx) => {
                  const respostaSelecionada = testeRespostas[q.id]
                  const respondida = respostaSelecionada !== undefined

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-xl border transition-all ${
                        respondida
                          ? 'bg-white border-slate-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            respondida
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="space-y-3 flex-1 min-w-0">
                          <div>
                            {q.tema && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 inline-block mb-1.5">
                                {q.tema}
                              </span>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {q.enunciado}
                            </h4>
                          </div>

                          {/* Alternativas (A, B, C, D) */}
                          <div className="space-y-2 pt-1">
                            {q.alternativas.map((altText, altIdx) => {
                              const letra = ['A', 'B', 'C', 'D'][altIdx] || String(altIdx + 1)
                              const isChecked = respostaSelecionada === altIdx

                              return (
                                <label
                                  key={altIdx}
                                  onClick={() => handleSelecionarAlternativa(q.id, altIdx)}
                                  className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-brand-50/70 border-brand-500 text-brand-950 font-medium ring-1 ring-brand-300'
                                      : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`questao_${q.id}`}
                                    checked={isChecked}
                                    onChange={() => handleSelecionarAlternativa(q.id, altIdx)}
                                    className="mt-0.5 w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                                  />
                                  <span className="font-bold text-slate-900 shrink-0">
                                    {letra})
                                  </span>
                                  <span className="flex-1 leading-relaxed">{altText}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bloco de Submissão Única com Validação */}
              {(() => {
                const total = testeDados.questoes.length
                const respondidas = Object.keys(testeRespostas).length
                const faltam = total - respondidas
                const tudoPreenchido = faltam === 0

                return (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-900">
                        {tudoPreenchido
                          ? 'Todas as 20 questões foram preenchidas!'
                          : `Atenção: faltam ${faltam} questão(ões) para você concluir.`}
                      </div>
                      <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                        Ao enviar, suas respostas serão corrigidas automaticamente pelo sistema e
                        seu gestor receberá a notificação da conclusão.
                      </p>
                    </div>

                    <Button
                      type="button"
                      disabled={!tudoPreenchido || enviandoTeste}
                      onClick={handleSubmeterTeste}
                      className={`h-11 px-6 font-bold text-sm shadow-sm transition-all ${
                        tudoPreenchido
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {enviandoTeste ? (
                        'Processando envio...'
                      ) : tudoPreenchido ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Finalizar e Enviar Teste
                        </>
                      ) : (
                        `Faltam ${faltam} questão(ões)`
                      )}
                    </Button>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              Nenhuma questão disponível no momento. Contate o suporte ou seu gestor.
            </div>
          )}
        </section>

        {/* Rodapé informativo */}
        <div className="text-center text-xs text-slate-400 py-4 space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-slate-500 font-semibold">Mundo Open Tecnologia</span>
            <span>•</span>
            <span>Onboarding de Colaboradores</span>
          </div>
          <p>Dúvidas sobre o processo? Procure o setor de Recursos Humanos ou seu Gestor.</p>
          <p className="text-[11px] text-slate-400">
            Link exclusivo do colaborador. Suas confirmações ficam salvas de forma segura e
            automática em tempo real.
          </p>
        </div>
      </main>

      {/* Modal de Sinalização com Relato da Fase (Etapa 2) */}
      <Dialog open={modalRelatoOpen} onOpenChange={setModalRelatoOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>Sinalizar Conclusão — {faseParaSinalizar?.faseTitulo}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4 text-xs">
            {/* Aviso se a fase estiver em refação */}
            {faseParaSinalizar?.isRefacao ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Atenção: Esta fase foi reaberta para refação (Ciclo{' '}
                    {faseParaSinalizar.cicloRefacao}/2)
                  </span>
                </div>
                {faseParaSinalizar.motivoRefacao && (
                  <div className="p-2.5 bg-white/80 rounded border border-amber-200">
                    <span className="font-semibold block text-[11px] text-amber-800 uppercase tracking-wider">
                      Motivo apontado pelo seu Gestor:
                    </span>
                    <p className="mt-0.5 text-slate-800 leading-relaxed italic">
                      "{faseParaSinalizar.motivoRefacao}"
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Por favor, revise os materiais solicitados e descreva detalhadamente abaixo o que
                  você praticou e compreendeu nesta nova rodada.
                </p>
              </div>
            ) : (
              <p className="text-slate-600 leading-relaxed">
                {faseParaSinalizar?.etapa === 1
                  ? 'Parabéns por completar os materiais da Apresentação da Empresa (Etapa 1)! Para que a equipe de RH valide sua integração, é obrigatório registrar o que você compreendeu.'
                  : 'Parabéns por completar as leituras e atividades desta fase! Para que seu gestor possa validar sua vivência prática, é obrigatório registrar o que você aprendeu.'}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>
                  {faseParaSinalizar?.etapa === 1
                    ? 'Relato da Etapa 1 (Obrigatório) *'
                    : 'Relato da Fase (Obrigatório) *'}
                </span>
                <span className="text-[11px] font-normal text-slate-500">Mínimo 10 caracteres</span>
              </label>
              <Textarea
                rows={5}
                placeholder={
                  faseParaSinalizar?.etapa === 1
                    ? 'Descreva com suas palavras o que você entendeu sobre a empresa, cultura, missão, valores e regras apresentadas...'
                    : 'Descreva com suas palavras o que você entendeu/aprendeu nesta fase, quais procedimentos praticou e quais dúvidas sanou...'
                }
                value={relatoTexto}
                onChange={(e) => {
                  setRelatoTexto(e.target.value)
                  if (relatoErro) setRelatoErro(null)
                }}
                className="text-xs resize-none"
              />
              {relatoErro && <p className="text-[11px] text-red-600 font-semibold">{relatoErro}</p>}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[11px] leading-relaxed">
              <strong>Importante:</strong> Este relato será registrado no seu histórico e
              disponibilizado para{' '}
              {faseParaSinalizar?.etapa === 1 ? 'o RH e a Gestão' : 'o seu gestor'} avaliar seu
              aprendizado antes da conclusão formal.
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(sinalizandoFaseId)}
              onClick={() => setModalRelatoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(sinalizandoFaseId)}
              onClick={handleConfirmarRelatoESinalizar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{sinalizandoFaseId ? 'Registrando...' : 'Confirmar e Enviar Relato'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Player de Vídeo e Leitor de Documentos */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              {previewItem?.tipo === 'video' ? (
                <Video className="w-5 h-5 text-purple-600" />
              ) : (
                <FileText className="w-5 h-5 text-brand-600" />
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
                  <FileCheck2 className="w-14 h-14 text-brand-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Documento disponível para leitura
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Clique no botão abaixo para abrir o documento na íntegra em uma nova guia do
                      seu navegador.
                    </p>
                  </div>
                  <Button asChild size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
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
