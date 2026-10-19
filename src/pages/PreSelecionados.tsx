import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  candidatoService,
  candidatoProvaPublicaService,
  questionarioService,
  setorService,
  userService,
} from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  CandidatoModel,
  CandidatoStatus,
  QuestionarioModel,
  SetorModel,
  User,
} from '@/types/onboarding'
import { CANDIDATO_STATUS_INFO, getSetorVisual } from '@/types/onboarding'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import { AvisoSetorGestor } from '@/components/AvisoSetorGestor'
import { formatShortDate, formatDateTime } from '@/lib/dateUtils'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  Briefcase,
  Mail,
  Calendar,
  Layers,
  FileText,
  Trash2,
  X,
  AlertTriangle,
  Eye,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function PreSelecionados() {
  const { user, role, isAdmin, isRH, isGestao } = useAuth()

  const [candidatos, setCandidatos] = useState<CandidatoModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroSetor, setFiltroSetor] = useState<string>('todos')

  const [setores, setSetores] = useState<SetorModel[]>([])
  const [questionarios, setQuestionarios] = useState<QuestionarioModel[]>([])
  const [gestores, setGestores] = useState<User[]>([])

  // Modal Novo Candidato
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoCargo, setNovoCargo] = useState('')
  const [novoSetor, setNovoSetor] = useState('windows')
  const [novoQuestionarioId, setNovoQuestionarioId] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [novoErrors, setNovoErrors] = useState<Record<string, string>>({})

  // Modal Decisão do Gestor (Aprovar / Reprovar)
  const [modalDecisaoOpen, setModalDecisaoOpen] = useState(false)
  const [candidatoDecisao, setCandidatoDecisao] = useState<CandidatoModel | null>(null)
  const [tipoDecisao, setTipoDecisao] = useState<'aprovado' | 'reprovado'>('aprovado')
  const [motivoReprovacao, setMotivoReprovacao] = useState('')
  const [salvandoDecisao, setSalvandoDecisao] = useState(false)

  // Modal Desistência do Candidato (RH / Admin)
  const [modalDesistenciaOpen, setModalDesistenciaOpen] = useState(false)
  const [candidatoDesistencia, setCandidatoDesistencia] = useState<CandidatoModel | null>(null)
  const [motivoDesistencia, setMotivoDesistencia] = useState('')
  const [salvandoDesistencia, setSalvandoDesistencia] = useState(false)

  // Modal Reprovação pelo RH (critério próprio / contato)
  const [modalReprovarRhOpen, setModalReprovarRhOpen] = useState(false)
  const [candidatoReprovarRh, setCandidatoReprovarRh] = useState<CandidatoModel | null>(null)
  const [motivoReprovacaoRh, setMotivoReprovacaoRh] = useState('')
  const [salvandoReprovacaoRh, setSalvandoReprovacaoRh] = useState(false)

  // Modal Formalização de Contratação + Onboarding (RH / Admin)
  const [modalConverterOpen, setModalConverterOpen] = useState(false)
  const [candidatoConverter, setCandidatoConverter] = useState<CandidatoModel | null>(null)
  const [dataInicioOnboarding, setDataInicioOnboarding] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [gestorResponsavelId, setGestorResponsavelId] = useState('')
  const [convertendo, setConvertendo] = useState(false)

  // Feedback de cópia do link
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  // Modal Excluir Candidato
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [candidatoParaExcluir, setCandidatoParaExcluir] = useState<CandidatoModel | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Modal Ver Gabarito (Admin, Gestor e RH)
  const [modalGabaritoOpen, setModalGabaritoOpen] = useState(false)
  const [candidatoGabarito, setCandidatoGabarito] = useState<CandidatoModel | null>(null)
  const [tentativaGabarito, setTentativaGabarito] = useState<
    import('@/types/onboarding').TesteTentativa | null
  >(null)
  const [carregandoGabarito, setCarregandoGabarito] = useState(false)

  // Abrir Gabarito (Admin, Gestor, RH)
  const abrirGabarito = async (candidato: CandidatoModel) => {
    setCandidatoGabarito(candidato)
    setTentativaGabarito(null)
    setModalGabaritoOpen(true)
    setCarregandoGabarito(true)

    try {
      const res = await candidatoProvaPublicaService.getTentativaGabarito(candidato.id)
      setTentativaGabarito(res.tentativa)
    } catch (err: unknown) {
      console.error('Erro ao carregar gabarito do candidato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao buscar gabarito da tentativa.'
      toast.error(msg)
    } finally {
      setCarregandoGabarito(false)
    }
  }

  // Carregar dados principais
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      const [candList, setList, questList, gestList] = await Promise.all([
        candidatoService.listAll(),
        setorService.listAtivos(),
        questionarioService.listAll({ ativo: true }),
        userService.getGestores(),
      ])

      setCandidatos(candList)
      setSetores(setList)
      setQuestionarios(questList)
      setGestores(gestList)
      if (gestList.length > 0 && !gestorResponsavelId) {
        setGestorResponsavelId(gestList[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar pré-selecionados:', err)
      toast.error('Erro ao carregar lista de pré-selecionados.')
    } finally {
      setLoading(false)
    }
  }, [gestorResponsavelId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime da coleção candidatos
  useRealtime<CandidatoModel>('candidatos', () => {
    carregarDados()
  })

  // Auto-selecionar questionário no formulário de Novo Pré-selecionado:
  // Regra do Usuário:
  // "preferindo tipo_de_uso 'contratacao'; se não houver do tipo contratação, usar o questionário de onboarding do setor;
  // se o setor não tiver nenhum, avisar no formulário e bloquear salvar até escolher um manualmente"
  useEffect(() => {
    if (!novoSetor || questionarios.length === 0) return

    const setorNorm = novoSetor.trim().toLowerCase()
    const foundModel = setores.find(
      (s) => s.chave === novoSetor || s.nome === novoSetor || s.id === novoSetor,
    )
    const chaveModel = (foundModel?.chave || '').toLowerCase()
    const nomeModel = (foundModel?.nome || '').toLowerCase()

    const matchSetor = (q: QuestionarioModel) => {
      const qs = (q.setor || '').toLowerCase()
      return qs === setorNorm || qs === chaveModel || qs === nomeModel
    }

    // 1. Preferindo tipo_de_uso 'contratacao' para o setor
    const qContratacao = questionarios.find((q) => q.tipo_de_uso === 'contratacao' && matchSetor(q))
    if (qContratacao) {
      setNovoQuestionarioId(qContratacao.id)
      return
    }

    // 2. Se não houver do tipo contratação, usar questionário de onboarding do setor
    const qOnboarding = questionarios.find((q) => q.tipo_de_uso === 'onboarding' && matchSetor(q))
    if (qOnboarding) {
      setNovoQuestionarioId(qOnboarding.id)
      return
    }

    // 3. Qualquer questionário do setor
    const qQualquerSetor = questionarios.find(matchSetor)
    if (qQualquerSetor) {
      setNovoQuestionarioId(qQualquerSetor.id)
      return
    }

    // Se o setor não tiver nenhum, limpa para avisar no form
    setNovoQuestionarioId('')
  }, [novoSetor, questionarios, setores])

  // Copiar link público da prova
  const handleCopiarLink = async (cand: CandidatoModel) => {
    if (!cand.token_publico) {
      toast.error('Candidato não possui token de acesso gerado.')
      return
    }

    const host = window.location.origin
    const urlProva = `${host}/candidato/prova/${cand.token_publico}`

    try {
      await navigator.clipboard.writeText(urlProva)
      setCopiadoId(cand.id)
      setTimeout(() => setCopiadoId(null), 3000)

      // Atualiza status para 'prova_enviada' caso estivesse em 'pre_selecionado'
      if (cand.status === 'pre_selecionado') {
        await candidatoService.marcarProvaEnviada(cand.id)
        setCandidatos((prev) =>
          prev.map((c) =>
            c.id === cand.id
              ? {
                  ...c,
                  status: 'prova_enviada',
                  data_envio_prova: new Date().toISOString(),
                }
              : c,
          ),
        )
      }

      toast.success('Link da prova copiado para a área de transferência!')
    } catch (err) {
      console.error('Erro ao copiar link:', err)
      toast.error('Não foi possível copiar o link.')
    }
  }

  // Validação e Criação de Novo Pré-selecionado
  const validateNovo = () => {
    const errs: Record<string, string> = {}
    if (!novoNome.trim()) {
      errs.nome = 'Nome do candidato é obrigatório.'
    }
    if (!novoEmail.trim()) {
      errs.email = 'E-mail do candidato é obrigatório.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim())) {
      errs.email = 'Formato de e-mail inválido.'
    }
    if (!novoSetor) {
      errs.setor = 'Selecione a área pretendida.'
    }
    if (!novoQuestionarioId) {
      errs.questionario =
        'Este setor não possui questionário automático. Selecione uma prova manualmente para prosseguir.'
    }
    setNovoErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSalvarNovo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateNovo()) {
      toast.error('Preencha os campos obrigatórios corretamente.')
      return
    }

    try {
      setSalvandoNovo(true)
      const criado = await candidatoService.create({
        nome: novoNome,
        email: novoEmail,
        cargo_pretendido: novoCargo,
        setor: novoSetor,
        questionario_id: novoQuestionarioId,
      })

      setCandidatos((prev) => [criado, ...prev])
      toast.success(`Candidato ${criado.nome} cadastrado com sucesso!`)
      setModalNovoOpen(false)

      // Reset
      setNovoNome('')
      setNovoEmail('')
      setNovoCargo('')
      setNovoErrors({})
    } catch (err) {
      console.error('Erro ao cadastrar candidato:', err)
      toast.error('Falha ao cadastrar pré-selecionado.')
    } finally {
      setSalvandoNovo(false)
    }
  }

  // Abertura do Modal de Decisão (Aprovado / Reprovado)
  const abrirModalDecisao = (candidato: CandidatoModel, decisao: 'aprovado' | 'reprovado') => {
    // Defesa em profundidade: Gestão só pode aprovar/reprovar candidatos do próprio setor
    if (
      isGestao &&
      !podeVisualizarSetor({
        role,
        userSetor: user?.setor as string | undefined,
        itemSetor: candidato.setor,
        setoresCadastrados: setores,
      })
    ) {
      toast.error('Você só pode avaliar candidatos do seu próprio departamento.')
      return
    }

    setCandidatoDecisao(candidato)
    setTipoDecisao(decisao)
    setMotivoReprovacao('')
    setModalDecisaoOpen(true)
  }

  const handleConfirmarDecisao = async () => {
    if (!candidatoDecisao) return

    try {
      setSalvandoDecisao(true)
      const res = await candidatoService.decidir({
        candidatoId: candidatoDecisao.id,
        decisao: tipoDecisao,
        motivo: motivoReprovacao,
      })

      setCandidatos((prev) => prev.map((c) => (c.id === candidatoDecisao.id ? res.candidato : c)))
      toast.success(res.message)
      setModalDecisaoOpen(false)
      setCandidatoDecisao(null)
    } catch (err: unknown) {
      console.error('Erro ao registrar decisão:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar decisão.'
      toast.error(msg)
    } finally {
      setSalvandoDecisao(false)
    }
  }

  // Abertura do Modal de Desistência (RH / Admin)
  const abrirModalDesistencia = (candidato: CandidatoModel) => {
    setCandidatoDesistencia(candidato)
    setMotivoDesistencia('')
    setModalDesistenciaOpen(true)
  }

  const handleConfirmarDesistencia = async () => {
    if (!candidatoDesistencia) return

    try {
      setSalvandoDesistencia(true)
      const res = await candidatoService.registrarDesistencia({
        candidatoId: candidatoDesistencia.id,
        motivo: motivoDesistencia,
      })

      setCandidatos((prev) =>
        prev.map((c) => (c.id === candidatoDesistencia.id ? res.candidato : c)),
      )
      toast.success(res.message || 'Desistência registrada com sucesso.')
      setModalDesistenciaOpen(false)
      setCandidatoDesistencia(null)
    } catch (err: unknown) {
      console.error('Erro ao registrar desistência:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar desistência.'
      toast.error(msg)
    } finally {
      setSalvandoDesistencia(false)
    }
  }

  // Abertura do Modal de Reprovação pelo RH (RH / Admin)
  const abrirModalReprovarRh = (candidato: CandidatoModel) => {
    setCandidatoReprovarRh(candidato)
    setMotivoReprovacaoRh('')
    setModalReprovarRhOpen(true)
  }

  const handleConfirmarReprovarRh = async () => {
    if (!candidatoReprovarRh) return

    try {
      setSalvandoReprovacaoRh(true)
      const res = await candidatoService.reprovarPeloRH({
        candidatoId: candidatoReprovarRh.id,
        motivo: motivoReprovacaoRh,
      })

      setCandidatos((prev) =>
        prev.map((c) => (c.id === candidatoReprovarRh.id ? res.candidato : c)),
      )
      toast.success(res.message || 'Candidato reprovado pelo RH com sucesso.')
      setModalReprovarRhOpen(false)
      setCandidatoReprovarRh(null)
    } catch (err: unknown) {
      console.error('Erro ao reprovar candidato pelo RH:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao reprovar candidato.'
      toast.error(msg)
    } finally {
      setSalvandoReprovacaoRh(false)
    }
  }

  // Abertura do Modal de Conversão (Formalização RH / Admin)
  const abrirModalConversao = (candidato: CandidatoModel) => {
    setCandidatoConverter(candidato)
    setDataInicioOnboarding(new Date().toISOString().split('T')[0])
    if (gestores.length > 0) {
      setGestorResponsavelId(gestores[0].id)
    }
    setModalConverterOpen(true)
  }

  const handleConfirmarConversao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidatoConverter) return
    if (!dataInicioOnboarding) {
      toast.error('Informe a data de início do colaborador.')
      return
    }
    if (!gestorResponsavelId) {
      toast.error('Selecione o gestor de TI responsável.')
      return
    }

    try {
      setConvertendo(true)
      const res = await candidatoService.converterEmColaborador({
        candidatoId: candidatoConverter.id,
        dataInicio: dataInicioOnboarding,
        gestorId: gestorResponsavelId,
      })

      setCandidatos((prev) => prev.map((c) => (c.id === candidatoConverter.id ? res.candidato : c)))
      toast.success('Contratação formalizada e Onboarding iniciado com sucesso!')
      setModalConverterOpen(false)
      setCandidatoConverter(null)
    } catch (err: unknown) {
      console.error('Erro ao converter candidato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao converter candidato.'
      toast.error(msg)
    } finally {
      setConvertendo(false)
    }
  }

  // Exclusão de candidato
  const handleConfirmarExclusao = async () => {
    if (!candidatoParaExcluir) return
    try {
      setExcluindo(true)
      await candidatoService.excluir(candidatoParaExcluir.id)
      setCandidatos((prev) => prev.filter((c) => c.id !== candidatoParaExcluir.id))
      toast.success(`Candidato ${candidatoParaExcluir.nome} excluído com sucesso.`)
      setModalExcluirOpen(false)
      setCandidatoParaExcluir(null)
    } catch (err) {
      console.error('Erro ao excluir candidato:', err)
      toast.error('Falha ao excluir candidato.')
    } finally {
      setExcluindo(false)
    }
  }

  // Filtro de visibilidade por departamento para o papel Gestão
  const candidatosVisiveis = useMemo(() => {
    if (!isGestao) return candidatos
    return candidatos.filter((c) =>
      podeVisualizarSetor({
        role,
        userSetor: user?.setor as string | undefined,
        itemSetor: c.setor,
        setoresCadastrados: setores,
      }),
    )
  }, [candidatos, isGestao, role, user?.setor, setores])

  // Filtros em memória
  const candidatosFiltrados = useMemo(() => {
    return candidatosVisiveis.filter((c) => {
      // Busca textual
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cargo_pretendido && c.cargo_pretendido.toLowerCase().includes(q))

      // Filtro status
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus

      // Filtro setor
      const matchSetor =
        filtroSetor === 'todos' || (c.setor && c.setor.toLowerCase() === filtroSetor.toLowerCase())

      return matchSearch && matchStatus && matchSetor
    })
  }, [candidatosVisiveis, search, filtroStatus, filtroSetor])

  // Setores exibidos no filtro (filtrados para papel Gestão)
  const setoresFiltro = useMemo(() => {
    if (!isGestao) return setores
    return setores.filter((s) =>
      podeVisualizarSetor({
        role,
        userSetor: user?.setor as string | undefined,
        itemSetor: s.chave || s.nome,
        itemSetorRef: s.id,
        setoresCadastrados: setores,
      }),
    )
  }, [setores, isGestao, role, user?.setor])

  return (
    <div className="space-y-6">
      {/* Aviso de setor para papel Gestão */}
      <AvisoSetorGestor setoresList={setores} moduloNome="candidatos pré-selecionados" />

      {/* Top Banner Informativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1A2233]">
              Candidatos Pré-selecionados & Contratação
            </h2>
            <Badge
              variant="outline"
              className="text-xs bg-brand-50 text-brand-700 border-brand-200"
            >
              Módulo de Seleção
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de candidatos aprovados na 1ª fase de entrevista, aplicação de prova técnica por
            link público, avaliação do Gestor da Área e conversão direta no Onboarding.
          </p>
        </div>

        {(isAdmin || isRH) && (
          <Button
            onClick={() => {
              setNovoNome('')
              setNovoEmail('')
              setNovoCargo('')
              setNovoErrors({})
              setModalNovoOpen(true)
            }}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm shrink-0"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            <span>Novo Pré-selecionado</span>
          </Button>
        )}
      </div>

      {/* Abas Rápidas de Fila para o RH & Barra de Filtros */}
      <div className="space-y-3">
        {/* Pílulas de Atalho / Fila */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              filtroStatus === 'todos'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({candidatosVisiveis.length})
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('aprovado_aguardando_rh')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'aprovado_aguardando_rh'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100/70'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Aguardando RH</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'aprovado_aguardando_rh'
                  ? 'bg-sky-800 text-white'
                  : 'bg-sky-200 text-sky-900'
              }`}
            >
              {
                candidatosVisiveis.filter(
                  (c) => c.status === 'aprovado_aguardando_rh' || c.status === 'aprovado',
                ).length
              }
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('prova_concluida')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'prova_concluida'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Avaliação do Gestor</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'prova_concluida'
                  ? 'bg-amber-800 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {candidatosVisiveis.filter((c) => c.status === 'prova_concluida').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('prova_enviada')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'prova_enviada'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Prova em Andamento</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'prova_enviada'
                  ? 'bg-blue-800 text-white'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {candidatosVisiveis.filter((c) => c.status === 'prova_enviada').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('convertido')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'convertido'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Convertidos</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'convertido'
                  ? 'bg-purple-800 text-white'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {candidatosVisiveis.filter((c) => c.status === 'convertido').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('desistiu')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'desistiu'
                ? 'bg-stone-700 text-white border-stone-700 shadow-xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-stone-500" />
            <span>Desistências</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'desistiu'
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {candidatosVisiveis.filter((c) => c.status === 'desistiu').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroStatus('reprovado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              filtroStatus === 'reprovado'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Reprovados</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filtroStatus === 'reprovado' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-800'
              }`}
            >
              {candidatosVisiveis.filter((c) => c.status === 'reprovado').length}
            </span>
          </button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, e-mail ou cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 border-gray-300 text-sm focus-visible:ring-brand-500"
              />
            </div>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-10 border-gray-300 text-xs w-full sm:w-60 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pre_selecionado">Pré-selecionado</SelectItem>
                <SelectItem value="prova_enviada">Prova enviada</SelectItem>
                <SelectItem value="prova_concluida">Prova concluída (Aval. Gestor)</SelectItem>
                <SelectItem value="aprovado_aguardando_rh">
                  Aprovado pelo Gestor — Aguardando RH
                </SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
                <SelectItem value="desistiu">Desistência registrada</SelectItem>
                <SelectItem value="convertido">Convertido em colaborador</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger className="h-10 border-gray-300 text-xs w-full sm:w-48 bg-white">
                <SelectValue placeholder="Área / Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setoresFiltro.map((s) => (
                  <SelectItem key={s.id} value={s.chave || s.nome}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-gray-500 font-medium shrink-0 text-right">
            Total: {candidatosFiltrados.length} candidato(s)
          </span>
        </div>
      </div>

      {/* Grid de Cartões de Pré-selecionados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {candidatosFiltrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                <span>Carregando candidatos pré-selecionados...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Users className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-600">Nenhum pré-selecionado encontrado.</p>
                <p className="text-xs text-gray-400">
                  Cadastre candidatos aprovados na 1ª fase de entrevista para enviar o link da
                  prova.
                </p>
              </div>
            )}
          </div>
        ) : (
          candidatosFiltrados.map((item) => {
            const setorVisual = getSetorVisual(item.setor)
            const statusInfo = CANDIDATO_STATUS_INFO[item.status] || {
              nome: item.status,
              corBg: 'bg-gray-100 text-gray-700 border-gray-200',
              corDot: 'bg-gray-400',
            }

            const provaRespondida =
              item.status === 'prova_concluida' ||
              item.status === 'aprovado_aguardando_rh' ||
              item.status === 'aprovado' ||
              item.status === 'reprovado' ||
              item.status === 'desistiu' ||
              item.status === 'convertido' ||
              Boolean(item.data_conclusao_prova)

            const questModel = item.expand?.questionario_id
            const regua = questModel?.percentual_aprovacao || 80
            const percentual = item.percentual_obtido ?? 0
            const passouRegua = percentual >= regua

            // 1. Gestor da área e Admin avaliam a prova técnica (aprovado -> vai para 'aprovado_aguardando_rh')
            // Defesa em profundidade: papel Gestão só pode avaliar se pertencer ao mesmo setor
            const pertenceAoSetorDoGestor = podeVisualizarSetor({
              role,
              userSetor: user?.setor as string | undefined,
              itemSetor: item.setor,
              setoresCadastrados: setores,
            })
            const podeDecidir =
              (isAdmin || (isGestao && pertenceAoSetorDoGestor)) &&
              item.status === 'prova_concluida'

            // 2. Fase intermediária: Apenas RH e Admin podem agir em candidatos aprovados pelo gestor
            const estaAguardandoRH =
              item.status === 'aprovado_aguardando_rh' || item.status === 'aprovado'
            const podeFormalizarRH = (isAdmin || isRH) && estaAguardandoRH

            // Gestor NÃO pode formalizar contratação (ação exclusiva de RH/Admin)
            const podeExcluir = isAdmin || isRH

            const cardDestacadoRH = (isRH || isAdmin) && item.status === 'aprovado_aguardando_rh'

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-5 flex flex-col justify-between hover:shadow-md transition-all group relative ${
                  cardDestacadoRH
                    ? 'bg-gradient-to-b from-sky-50/50 to-white border-sky-300 ring-2 ring-sky-400/20 shadow-sm'
                    : 'bg-white border-gray-200/90 shadow-sm'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Topo do Card: Nome, Cargo e Badge do Setor */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                        {item.nome}
                      </h3>
                      <span className="text-xs font-medium text-gray-600 block truncate">
                        {item.cargo_pretendido || 'Cargo não especificado'}
                      </span>
                    </div>

                    <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 bg-brand-50 text-brand-700 border-brand-200 inline-flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: setorVisual.cor }}
                      />
                      {setorVisual.nome}
                    </span>
                  </div>

                  {/* Informações de Contato e Prova Fixada */}
                  <div className="space-y-1.5 text-xs text-gray-600 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">
                        Prova:{' '}
                        <strong>{item.expand?.questionario_id?.nome || 'Prova Técnica'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>Cadastrado em: {formatShortDate(item.created)}</span>
                    </div>
                  </div>

                  {/* Bloco de Resultado da Prova */}
                  {provaRespondida ? (
                    <div
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        passouRegua
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-red-50/70 border-red-200 text-red-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          {passouRegua ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span>
                            {item.nota_acertos ?? 0}/{item.total_questoes ?? 0} acertos •{' '}
                            {percentual}%
                          </span>
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            passouRegua ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                          }`}
                        >
                          {passouRegua ? 'Atingiu régua' : 'Reprovado no teste'}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-600 flex items-center justify-between pt-1 border-t border-gray-200/60">
                        <span>Régua: {regua}%</span>
                        <span>
                          Concluída em:{' '}
                          {item.data_conclusao_prova
                            ? formatShortDate(item.data_conclusao_prova)
                            : '-'}
                        </span>
                      </div>

                      {/* Botão Ver Gabarito no Bloco de Resultado (Admin, Gestor e RH) */}
                      {(isAdmin || isGestao || isRH) && (
                        <div className="pt-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => abrirGabarito(item)}
                            className="w-full h-7 text-[11px] font-semibold bg-white hover:bg-purple-50 text-purple-700 border-purple-200 flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Gabarito & Respostas</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : item.status === 'prova_enviada' ? (
                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Aguardando resposta do candidato no link da prova...</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Link pronto para envio ao candidato.</span>
                    </div>
                  )}

                  {/* Informações de Status e Rastreio */}
                  {(item.status === 'aprovado_aguardando_rh' || item.status === 'aprovado') && (
                    <div className="p-2.5 rounded-lg bg-sky-50 text-xs text-sky-900 border border-sky-200 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1 text-sky-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                          Aprovado na Avaliação Técnica
                        </span>
                        {item.data_decisao && (
                          <span className="text-[10px] text-sky-600 font-normal">
                            {formatShortDate(item.data_decisao)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-sky-700">
                        {isRH || isAdmin
                          ? 'Pendente de contato e formalização pelo RH antes da contratação.'
                          : 'Aguardando formalização e contato pelo Recursos Humanos (RH).'}
                      </p>
                    </div>
                  )}

                  {item.status === 'desistiu' && (
                    <div className="p-2.5 rounded-lg bg-stone-50 text-xs text-stone-800 border border-stone-200 space-y-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1 text-stone-700">
                          <X className="w-3.5 h-3.5 text-stone-500" />
                          Desistência Registrada
                        </span>
                        {item.data_formalizacao_rh && (
                          <span className="text-[10px] text-stone-500 font-normal">
                            {formatShortDate(item.data_formalizacao_rh)}
                          </span>
                        )}
                      </div>
                      {item.motivo_desistencia ? (
                        <p className="text-[11px] text-stone-600 italic">
                          &quot;{item.motivo_desistencia}&quot;
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-500">
                          Candidato declinou a vaga ou desistiu do processo.
                        </p>
                      )}
                    </div>
                  )}

                  {item.status === 'reprovado' && (
                    <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-800 border border-red-200 space-y-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Reprovado</span>
                        {(item.data_formalizacao_rh || item.data_decisao) && (
                          <span className="text-[10px] font-normal text-red-600">
                            em {formatShortDate(item.data_formalizacao_rh || item.data_decisao)}
                          </span>
                        )}
                      </div>
                      {item.motivo_reprovacao && (
                        <p className="text-[11px] text-red-700 italic">
                          &quot;{item.motivo_reprovacao}&quot;
                        </p>
                      )}
                    </div>
                  )}

                  {item.status === 'convertido' && (
                    <div className="p-2.5 rounded-lg bg-purple-50 text-xs text-purple-900 border border-purple-200 space-y-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Contratação Formalizada</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-purple-700">Colaborador ativo</span>
                        {item.colaborador_id && (
                          <Link
                            to={`/colaboradores/${item.colaborador_id}`}
                            className="text-[11px] text-purple-700 font-bold hover:underline inline-flex items-center gap-1"
                          >
                            <span>Acessar Onboarding</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Ações Dinâmicas */}
                <div className="pt-4 mt-3 border-t border-gray-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.corBg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.corDot}`} />
                      {statusInfo.nome}
                    </span>

                    {/* Botão Copiar Link da Prova */}
                    {item.status !== 'reprovado' &&
                      item.status !== 'desistiu' &&
                      item.status !== 'convertido' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarLink(item)}
                          className="h-8 px-2.5 text-xs font-medium border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 text-gray-700"
                          title="Copiar link público da prova técnica para o candidato"
                        >
                          {copiadoId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </Button>
                      )}

                    {podeExcluir && item.status !== 'convertido' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCandidatoParaExcluir(item)
                          setModalExcluirOpen(true)
                        }}
                        className="h-8 px-2 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Excluir pré-selecionado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* 1. Botões de Decisão Técnica do Gestor da Área */}
                  {podeDecidir && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => abrirModalDecisao(item, 'aprovado')}
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Aprovar Perfil
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => abrirModalDecisao(item, 'reprovado')}
                        className="h-8 text-xs font-bold text-red-600 hover:bg-red-50 border-red-200 rounded-lg"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reprovar
                      </Button>
                    </div>
                  )}

                  {/* Informação visual para o RH quando prova concluída aguardando parecer do gestor */}
                  {item.status === 'prova_concluida' && !podeDecidir && (
                    <div className="text-[11px] text-gray-500 text-center py-1.5 bg-gray-50 rounded-lg border border-gray-200 font-medium">
                      Aguardando parecer técnico do Gestor da Área
                    </div>
                  )}

                  {/* 2. Ações exclusivas de RH / Admin na fase intermediária: "Aprovado — Aguardando RH" */}
                  {podeFormalizarRH && (
                    <div className="pt-2 border-t border-sky-200/80 space-y-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => abrirModalConversao(item)}
                        className="w-full h-8.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Formalizar Contratação</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModalDesistencia(item)}
                          className="h-7.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 border-stone-300 rounded-lg"
                          title="Registrar que o candidato desistiu da vaga após a aprovação técnica"
                        >
                          <X className="w-3 h-3 mr-1 text-stone-500" />
                          Desistência
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModalReprovarRh(item)}
                          className="h-7.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 border-red-200 rounded-lg"
                          title="Reprovar por critério do RH (pretensão salarial, contato, etc.)"
                        >
                          <XCircle className="w-3 h-3 mr-1 text-red-500" />
                          Reprovar RH
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Visualização para Gestores durante a fase de validação do RH: Gestor NÃO pode formalizar */}
                  {isGestao && !isAdmin && estaAguardandoRH && (
                    <div className="text-[11px] text-sky-800 text-center py-2 bg-sky-50 rounded-lg border border-sky-200 font-medium">
                      Aprovado por você. Contato e formalização em andamento pelo RH.
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Novo Pré-selecionado (RH / Admin)                                 */}
      {/* ========================================================================= */}
      <Dialog open={modalNovoOpen} onOpenChange={setModalNovoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" />
              <span>Cadastrar Candidato Pré-selecionado</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvarNovo} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Nome Completo do Candidato *
              </label>
              <Input
                placeholder="Ex.: Lucas Gabriel da Silva"
                value={novoNome}
                onChange={(e) => {
                  setNovoNome(e.target.value)
                  if (novoErrors.nome) setNovoErrors((p) => ({ ...p, nome: '' }))
                }}
                className={`h-10 text-sm ${novoErrors.nome ? 'border-red-500' : ''}`}
                disabled={salvandoNovo}
              />
              {novoErrors.nome && <p className="text-xs text-red-600 mt-1">{novoErrors.nome}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  E-mail do Candidato *
                </label>
                <Input
                  type="email"
                  placeholder="candidato@email.com"
                  value={novoEmail}
                  onChange={(e) => {
                    setNovoEmail(e.target.value)
                    if (novoErrors.email) setNovoErrors((p) => ({ ...p, email: '' }))
                  }}
                  className={`h-10 text-sm ${novoErrors.email ? 'border-red-500' : ''}`}
                  disabled={salvandoNovo}
                />
                {novoErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{novoErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Cargo Pretendido
                </label>
                <Input
                  placeholder="Ex.: Técnico de Suporte N1"
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  className="h-10 text-sm"
                  disabled={salvandoNovo}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Área / Setor *
              </label>
              <Select
                value={novoSetor}
                onValueChange={(val) => setNovoSetor(val)}
                disabled={salvandoNovo}
              >
                <SelectTrigger className="h-10 text-sm bg-white">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={s.chave || s.nome}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: s.cor || '#2563EB' }}
                        />
                        <span>{s.nome}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Questionário Vinculado */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Questionário da Prova Técnica *
                </label>
                {novoQuestionarioId ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Vinculado
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Requer seleção
                  </span>
                )}
              </div>

              <Select
                value={novoQuestionarioId}
                onValueChange={(val) => {
                  setNovoQuestionarioId(val)
                  if (novoErrors.questionario) {
                    setNovoErrors((p) => ({ ...p, questionario: '' }))
                  }
                }}
                disabled={salvandoNovo}
              >
                <SelectTrigger className="h-10 text-sm bg-white">
                  <SelectValue placeholder="Selecione um questionário para a prova" />
                </SelectTrigger>
                <SelectContent>
                  {questionarios.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{q.nome}</span>
                        <span className="text-gray-400 text-xs">
                          ({q.setor?.toUpperCase() || 'TODOS'} — {q.tipo_de_uso} — mín.{' '}
                          {q.percentual_aprovacao || 80}%)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!novoQuestionarioId ? (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Aviso:</strong> Não há questionário cadastrado para o setor escolhido.
                    Selecione um questionário manualmente acima para liberar o cadastro.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500">
                  Pré-selecionado automaticamente (preferência para tipo &quot;contratação&quot; ou
                  onboarding do setor). O link público com as questões será gerado imediatamente.
                </p>
              )}
              {novoErrors.questionario && (
                <p className="text-xs text-red-600 mt-1">{novoErrors.questionario}</p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoOpen(false)}
                disabled={salvandoNovo}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoNovo || !novoQuestionarioId}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {salvandoNovo ? 'Salvando...' : 'Cadastrar Pré-selecionado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: Decisão do Gestor da Área (Aprovado / Reprovado)                   */}
      {/* ========================================================================= */}
      <Dialog open={modalDecisaoOpen} onOpenChange={setModalDecisaoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              {tipoDecisao === 'aprovado' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span>
                {tipoDecisao === 'aprovado'
                  ? 'Aprovar Candidato na 2ª Etapa'
                  : 'Reprovar Candidato'}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Você está definindo o parecer final de <strong>{candidatoDecisao?.nome}</strong> (
              {candidatoDecisao?.cargo_pretendido} — Setor:{' '}
              {getSetorVisual(candidatoDecisao?.setor).nome}).
            </p>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Desempenho no teste:</span>
                <span className="font-bold text-gray-800">
                  {candidatoDecisao?.nota_acertos}/{candidatoDecisao?.total_questoes} (
                  {candidatoDecisao?.percentual_obtido}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Decisão atribuída por:</span>
                <span className="font-semibold text-gray-800">
                  {user?.name || user?.email} (Gestor da Área)
                </span>
              </div>

              {/* Botão Ver Gabarito no Modal de Decisão do Gestor */}
              {candidatoDecisao && (
                <div className="pt-1 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => abrirGabarito(candidatoDecisao)}
                    className="w-full h-7 text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Consultar Gabarito e Respostas Dissertativas</span>
                  </Button>
                </div>
              )}
            </div>

            {tipoDecisao === 'reprovado' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Motivo da Reprovação (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex.: Pontuação abaixo do perfil desejado na avaliação prática..."
                  value={motivoReprovacao}
                  onChange={(e) => setMotivoReprovacao(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  O candidato permanecerá no histórico de seleção para rastro e o link da prova será
                  encerrado.
                </p>
              </div>
            )}

            {tipoDecisao === 'aprovado' && (
              <div className="text-sky-900 bg-sky-50 p-3 rounded-lg border border-sky-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  Próxima etapa: Validação e Contato pelo RH
                </p>
                <p className="text-[11px] text-sky-700 leading-relaxed">
                  Ao aprovar o perfil técnico, o status do candidato mudará para{' '}
                  <strong>&quot;Aprovado — Aguardando RH&quot;</strong>. O Recursos Humanos
                  realizará o contato para formalização da proposta e coleta de dados antes do
                  onboarding oficial.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalDecisaoOpen(false)}
              disabled={salvandoDecisao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarDecisao}
              disabled={salvandoDecisao}
              className={`font-semibold ${
                tipoDecisao === 'aprovado'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {salvandoDecisao
                ? 'Gravando...'
                : tipoDecisao === 'aprovado'
                  ? 'Confirmar Aprovação Técnica'
                  : 'Confirmar Reprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2.1: Registrar Desistência do Candidato (RH / Admin)                  */}
      {/* ========================================================================= */}
      <Dialog open={modalDesistenciaOpen} onOpenChange={setModalDesistenciaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <X className="w-5 h-5 text-stone-600" />
              <span>Registrar Desistência do Candidato</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Você está registrando que <strong>{candidatoDesistencia?.nome}</strong> (
              {candidatoDesistencia?.cargo_pretendido}) desistiu ou recusou a proposta da vaga.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Motivo da Desistência (Opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Ex.: Candidato aceitou outra proposta de emprego, indisponibilidade de horário, etc."
                value={motivoDesistencia}
                onChange={(e) => setMotivoDesistencia(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2.5 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-stone-700 space-y-1">
              <p className="font-semibold">Consequências do registro:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-stone-600">
                <li>O link público da prova é invalidado imediatamente.</li>
                <li>
                  O cartão é movido para o histórico de seleção (status &quot;Desistência&quot;).
                </li>
                <li>Um evento de auditoria com autor e data/hora é registrado.</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalDesistenciaOpen(false)}
              disabled={salvandoDesistencia}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarDesistencia}
              disabled={salvandoDesistencia}
              className="bg-stone-700 hover:bg-stone-800 text-white font-semibold"
            >
              {salvandoDesistencia ? 'Registrando...' : 'Confirmar Desistência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2.2: Reprovação pelo RH (Critério de Formalização)                    */}
      {/* ========================================================================= */}
      <Dialog open={modalReprovarRhOpen} onOpenChange={setModalReprovarRhOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Reprovação pelo Recursos Humanos</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Registrar reprovação do candidato <strong>{candidatoReprovarRh?.nome}</strong> por
              critério próprio do RH mesmo após a aprovação técnica (ex.: pretensão salarial,
              contato sem retorno ou documentação).
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Motivo da Reprovação pelo RH *
              </label>
              <textarea
                rows={3}
                placeholder="Ex.: Pretensão salarial incompatível com a faixa da vaga..."
                value={motivoReprovacaoRh}
                onChange={(e) => setMotivoReprovacaoRh(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2.5 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-800 text-[11px] leading-relaxed">
              O link público da prova será encerrado imediatamente e a decisão será documentada no
              Histórico & Auditoria com seu usuário e motivo.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReprovarRhOpen(false)}
              disabled={salvandoReprovacaoRh}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarReprovarRh}
              disabled={salvandoReprovacaoRh}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {salvandoReprovacaoRh ? 'Gravando...' : 'Confirmar Reprovação RH'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: Conversão Aprovado -> Colaborador + Onboarding                     */}
      {/* ========================================================================= */}
      <Dialog open={modalConverterOpen} onOpenChange={setModalConverterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>Formalizar Contratação & Iniciar Onboarding</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmarConversao} className="space-y-4 py-2">
            <p className="text-xs text-gray-600 leading-relaxed">
              A contratação de <strong>{candidatoConverter?.nome}</strong> foi formalizada pelo RH.
              Ao confirmar, o candidato passará para o quadro oficial de colaboradores e o processo
              de Onboarding de TI será iniciado.
            </p>

            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Nome:</span>
                <span className="font-semibold text-gray-900">{candidatoConverter?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">E-mail:</span>
                <span className="font-semibold text-gray-900">{candidatoConverter?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cargo:</span>
                <span className="font-semibold text-gray-900">
                  {candidatoConverter?.cargo_pretendido || 'Técnico TI'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Setor:</span>
                <span className="font-semibold text-gray-900">
                  {getSetorVisual(candidatoConverter?.setor).nome}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Data de Início do Onboarding *
                </label>
                <Input
                  type="date"
                  value={dataInicioOnboarding}
                  onChange={(e) => setDataInicioOnboarding(e.target.value)}
                  className="h-10 text-sm"
                  disabled={convertendo}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Gestor Responsável de TI *
                </label>
                <Select
                  value={gestorResponsavelId}
                  onValueChange={(val) => setGestorResponsavelId(val)}
                  disabled={convertendo}
                >
                  <SelectTrigger className="h-10 text-sm bg-white">
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {gestores.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Ao confirmar, o onboarding será criado com as tarefas do setor, questionário de
              onboarding vinculado e o cartão mudará para &quot;Convertido em colaborador&quot;.
            </p>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalConverterOpen(false)}
                disabled={convertendo}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={convertendo || !dataInicioOnboarding || !gestorResponsavelId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {convertendo ? 'Formalizando...' : 'Formalizar e Iniciar Onboarding'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: Excluir Pré-selecionado                                           */}
      {/* ========================================================================= */}
      <Dialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Excluir Candidato Pré-selecionado</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-gray-600 space-y-3">
            <p>
              Tem certeza que deseja remover o candidato{' '}
              <strong>{candidatoParaExcluir?.nome}</strong> ({candidatoParaExcluir?.email})?
            </p>
            <p className="text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
              Esta ação removerá o registro e invalidará o link público da prova técnica. A operação
              será gravada nos logs de auditoria.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalExcluirOpen(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarExclusao}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {excluindo ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: Gabarito e Auditoria de Respostas (Admin, Gestor e RH)             */}
      {/* ========================================================================= */}
      <Dialog open={modalGabaritoOpen} onOpenChange={setModalGabaritoOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <span>Auditoria de Gabarito — Prova Técnica do Pré-selecionado</span>
            </DialogTitle>
          </DialogHeader>

          {carregandoGabarito ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <span className="text-xs font-medium">
                Buscando gabarito e respostas do candidato...
              </span>
            </div>
          ) : tentativaGabarito ? (
            <div className="py-2 space-y-4">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-purple-950 block">
                    Candidato: {candidatoGabarito?.nome}
                  </span>
                  <span className="text-purple-800">
                    Cargo: {candidatoGabarito?.cargo_pretendido || 'TI'} • Setor:{' '}
                    {getSetorVisual(candidatoGabarito?.setor).nome}
                  </span>
                  <span className="text-purple-700 text-[11px] block mt-0.5">
                    Data:{' '}
                    {formatDateTime(tentativaGabarito.data_submissao || tentativaGabarito.created)}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-purple-950">
                    {tentativaGabarito.acertos}/{tentativaGabarito.total_questoes} (
                    {tentativaGabarito.percentual}%)
                  </div>
                  <Badge
                    className={
                      tentativaGabarito.aprovado
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {tentativaGabarito.aprovado ? 'Atingiu a Régua' : 'Abaixo da Régua'}
                  </Badge>
                </div>
              </div>

              {/* Informação sobre critério de avaliação das dissertativas */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                <strong>Atenção do Gestor / RH:</strong> As questões dissertativas não compõem a
                nota automática. Elas constituem critério qualitativo do Gestor da Área para a
                tomada de decisão final sobre o perfil.
              </div>

              {/* Detalhe de cada questão */}
              <div className="space-y-4">
                {tentativaGabarito.respostas_detalhe &&
                tentativaGabarito.respostas_detalhe.length > 0 ? (
                  tentativaGabarito.respostas_detalhe.map((item, idx) => {
                    const isDissertativa = item.tipo === 'dissertativa'
                    const acertou = item.correta
                    const letras = ['A', 'B', 'C', 'D']

                    if (isDissertativa) {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 text-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 bg-purple-600 text-white">
                                {item.ordem || idx + 1}
                              </span>
                              <span className="font-bold text-slate-900">
                                Questão {item.ordem || idx + 1} (Dissertativa)
                                {item.tema ? ` • ${item.tema}` : ''}
                              </span>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                              Avaliação Qualitativa
                            </Badge>
                          </div>

                          <p className="text-slate-800 font-medium leading-relaxed">
                            {item.enunciado}
                          </p>

                          {/* Resposta do candidato */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                              Resposta do Candidato:
                            </label>
                            <div className="p-3 bg-white rounded-md border border-slate-300 text-slate-900 text-xs whitespace-pre-wrap leading-relaxed shadow-2xs font-mono">
                              {item.texto_respondido || (
                                <span className="italic text-slate-400">
                                  (Nenhuma resposta preenchida)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expectativa do gabarito / Comentário */}
                          {item.gabarito_comentario && (
                            <div className="p-2.5 rounded-lg bg-purple-100/70 border border-purple-300 text-[11px] text-purple-950 leading-relaxed">
                              <strong>Expectativa do Gabarito:</strong> {item.gabarito_comentario}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Questão Objetiva
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          acertou
                            ? 'bg-emerald-50/20 border-emerald-200'
                            : 'bg-red-50/20 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 ${
                                acertou ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                              }`}
                            >
                              {item.ordem || idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">
                              Questão {item.ordem || idx + 1}
                              {item.tema ? ` • ${item.tema}` : ''}
                            </span>
                          </div>
                          <Badge
                            className={
                              acertou
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]'
                                : 'bg-red-100 text-red-800 border-red-200 text-[10px]'
                            }
                          >
                            {acertou ? 'Correta' : 'Incorreta'}
                          </Badge>
                        </div>

                        <p className="text-slate-800 font-medium leading-relaxed">
                          {item.enunciado}
                        </p>

                        {/* Comparativo de alternativas */}
                        <div className="space-y-1.5 pt-1">
                          {item.alternativas?.map((alt, aIdx) => {
                            const l = letras[aIdx]
                            const foiEscolhida = item.resposta_escolhida === aIdx
                            const eCorreta = item.correta_index === aIdx

                            return (
                              <div
                                key={aIdx}
                                className={`p-2 rounded border text-[11px] flex items-start gap-2 ${
                                  eCorreta
                                    ? 'bg-emerald-100/70 border-emerald-300 font-bold text-emerald-950'
                                    : foiEscolhida
                                      ? 'bg-red-100/70 border-red-300 font-bold text-red-950'
                                      : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <span className="shrink-0">{l})</span>
                                <span className="flex-1">{alt}</span>
                                {foiEscolhida && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-white shrink-0">
                                    Marcada pelo Candidato
                                  </span>
                                )}
                                {eCorreta && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-700 text-white shrink-0">
                                    Gabarito Correto
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Comentário explicativo do gabarito */}
                        {item.gabarito_comentario && (
                          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
                            <strong>Comentário do Gabarito:</strong> {item.gabarito_comentario}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Mapa de respostas detalhado não disponível para esta tentativa.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhuma tentativa registrada para este candidato.
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalGabaritoOpen(false)}
            >
              Fechar Gabarito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
