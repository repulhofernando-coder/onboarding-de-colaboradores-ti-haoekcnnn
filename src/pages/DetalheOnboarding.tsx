import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  onboardingService,
  tarefaService,
  avaliacaoService,
  confirmacaoColaboradorService,
  materialService,
  faseService,
  auditoriaService,
  testeConhecimentoService,
} from '@/services/onboarding'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  Onboarding,
  TarefaOnboarding,
  MaterialBiblioteca,
  Avaliacao,
  TarefaTipo,
  ConfirmacaoColaborador,
  FaseModelo,
  LogAuditoria,
  FaseConcluidaInfo,
  ItemChecklistIntegracao,
  TesteTentativa,
} from '@/types/onboarding'
import { itemIntegracaoModeloService } from '@/services/onboarding'
import { SETORES_INFO, STATUS_INFO, getSetorVisual } from '@/types/onboarding'
import { calcularDiasRestantes, formatShortDate, formatDateTime } from '@/lib/dateUtils'
import {
  ArrowLeft,
  Calendar,
  Lock,
  CheckCircle2,
  XCircle,
  FileText,
  Video,
  Upload,
  ExternalLink,
  Flame,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Clock,
  Play,
  FileCheck2,
  Trash2,
  CheckSquare,
  Square,
  Eye,
  Info,
  Copy,
  Check,
  Share2,
  Layers,
  Plus,
  Building2,
  Pencil,
  Save,
  UserCheck2,
  MessageSquare,
  Mail,
  User as UserIcon,
  RotateCcw,
  AlertTriangle,
  Award,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModalExcluirColaborador } from '@/components/ModalExcluirColaborador'
import { ModalEditarColaborador } from '@/components/ModalEditarColaborador'
import { ModalSugestaoMudancaArea } from '@/components/ModalSugestaoMudancaArea'
import { SecaoAvaliacoesColaborador } from '@/components/SecaoAvaliacoesColaborador'
import { SecaoTrajetoria } from '@/components/SecaoTrajetoria'
import { SecaoCertificados } from '@/components/SecaoCertificados'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { AvaliacaoColaborador, CertificadoColaborador } from '@/types/onboarding'
import { avaliacaoColaboradorService, certificadoService } from '@/services/onboarding'

export default function DetalheOnboarding() {
  const { id } = useParams<{ id: string }>()
  const { user, role, isAdmin, isRH } = useAuth()
  const navigate = useNavigate()

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [todosOnboardings, setTodosOnboardings] = useState<Onboarding[]>([])
  const [tarefas, setTarefas] = useState<TarefaOnboarding[]>([])
  const [fasesSetor, setFasesSetor] = useState<FaseModelo[]>([])
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [avaliacoesDossie, setAvaliacoesDossie] = useState<AvaliacaoColaborador[]>([])
  const [certificadosList, setCertificadosList] = useState<CertificadoColaborador[]>([])
  const [confirmacoes, setConfirmacoes] = useState<Record<string, ConfirmacaoColaborador>>({})
  const [linkColaborador, setLinkColaborador] = useState<string>('')
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Estados de ações
  const [concluindoEtapa1, setConcluindoEtapa1] = useState(false)
  const [concluindoEtapa2, setConcluindoEtapa2] = useState(false)
  const [concluindoFaseId, setConcluindoFaseId] = useState<string | null>(null)

  // Estado para edição dos 3 Clientes da Fase 2 (Mapeamento de Ambientes)
  const [editandoClientes, setEditandoClientes] = useState(false)
  const [cliente1, setCliente1] = useState('')
  const [cliente2, setCliente2] = useState('')
  const [cliente3, setCliente3] = useState('')
  const [salvandoClientes, setSalvandoClientes] = useState(false)

  // MELHORIA 1 — Técnico Responsável pelo Acompanhamento (topo Etapa 2)
  const [editandoTecnico, setEditandoTecnico] = useState(false)
  const [tecnicoNome, setTecnicoNome] = useState('')
  const [tecnicoEmail, setTecnicoEmail] = useState('')
  const [salvandoTecnico, setSalvandoTecnico] = useState(false)

  // MELHORIA 3 & 4 — Checklist de Integração da Etapa 1
  const [marcandoItemChecklistId, setMarcandoItemChecklistId] = useState<string | null>(null)
  const [editandoObsItemId, setEditandoObsItemId] = useState<string | null>(null)
  const [obsTemp, setObsTemp] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  // Abas do Perfil do Colaborador: 'trajetoria', 'onboarding', 'certificados', 'avaliacoes', 'auditoria'
  const [abaAtiva, setAbaAtiva] = useState<
    'trajetoria' | 'onboarding' | 'certificados' | 'avaliacoes' | 'auditoria'
  >('trajetoria')
  const [logsAuditoria, setLogsAuditoria] = useState<LogAuditoria[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [carregandoCertificadosAba, setCarregandoCertificadosAba] = useState(false)

  const recarregarCertificadosPerfil = async () => {
    if (!onboarding || (!isAdmin && !isRH)) return
    try {
      setCarregandoCertificadosAba(true)
      const certs = await certificadoService.listByColaborador(onboarding.id)
      setCertificadosList(certs)
      // Recarregar logs de auditoria para refletir os eventos atualizados imediatamente
      carregarLogs()
    } catch (e) {
      console.warn('Erro ao atualizar lista de certificados no perfil:', e)
    } finally {
      setCarregandoCertificadosAba(false)
    }
  }

  // Modal de exclusão do colaborador
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)

  // Modal de edição do colaborador (Cargo, Setor, Gestor) - RH e Admin
  const [modalEditarOpen, setModalEditarOpen] = useState(false)

  // Modal de sugestão de prova na mudança de área
  const [modalSugestaoOpen, setModalSugestaoOpen] = useState(false)
  const [dadosSugestao, setDadosSugestao] = useState<{
    onboarding: Onboarding
    setorAntigo: string
    setorNovo: string
    questionarioSugerido: any
  } | null>(null)

  // Estado para fluxo "Não Apto" na Avaliação
  const [faseRetornoId, setFaseRetornoId] = useState<string>('')
  const [prazoSuplementarDias, setPrazoSuplementarDias] = useState<number>(5)
  const [naoAptoDefinitivo, setNaoAptoDefinitivo] = useState(false)

  // Modal de Adicionar Item (Etapa 1 ou Etapa 2)
  const [modalItemOpen, setModalItemOpen] = useState(false)
  const [modalItemEtapa, setModalItemEtapa] = useState<1 | 2>(2)
  const [novoItemTitulo, setNovoItemTitulo] = useState('')
  const [novoItemDescricao, setNovoItemDescricao] = useState('')
  const [novoItemTipo, setNovoItemTipo] = useState<TarefaTipo>('manual')
  const [novoItemOrigem, setNovoItemOrigem] = useState<'upload' | 'biblioteca'>('upload')
  const [novoItemMaterialId, setNovoItemMaterialId] = useState<string>('')
  const [materiaisBiblioteca, setMateriaisBiblioteca] = useState<MaterialBiblioteca[]>([])
  const [novoItemFile, setNovoItemFile] = useState<File | null>(null)
  const [enviandoItem, setEnviandoItem] = useState(false)
  const [itemError, setItemError] = useState('')

  // Modal de Avaliação do Gestor (Etapa 3)
  const [decisaoAvaliacao, setDecisaoAvaliacao] = useState<'apto' | 'nao_apto' | null>(null)
  const [observacoesAvaliacao, setObservacoesAvaliacao] = useState('')
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false)

  // Estados do Teste de Conhecimento (Etapa 3)
  const [tentativasTeste, setTentativasTeste] = useState<TesteTentativa[]>([])
  const [loadingTeste, setLoadingTeste] = useState(false)
  const [liberandoReteste, setLiberandoReteste] = useState(false)
  const [modalRetesteOpen, setModalRetesteOpen] = useState(false)
  const [motivoReteste, setMotivoReteste] = useState('')
  const [modalGabaritoAdminOpen, setModalGabaritoAdminOpen] = useState(false)
  const [tentativaSelecionadaAdmin, setTentativaSelecionadaAdmin] = useState<TesteTentativa | null>(
    null,
  )

  // Modal Solicitar Refação da Fase (Gestor/Admin e RH)
  const [modalRefacaoOpen, setModalRefacaoOpen] = useState(false)
  const [faseParaRefacao, setFaseParaRefacao] = useState<{
    faseId: string
    faseTitulo: string
    refacoesAtuais: number
  } | null>(null)
  const [motivoRefacao, setMotivoRefacao] = useState('')
  const [solicitandoRefacao, setSolicitandoRefacao] = useState(false)

  // Modal de Visualização de Arquivo (Player Vídeo / Visualizador Doc)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const carregarTentativasTeste = async (onbId: string) => {
    try {
      setLoadingTeste(true)
      const res = await testeConhecimentoService.listarTentativas(onbId, role || 'gestao')
      setTentativasTeste(res)
    } catch (e) {
      console.warn('Erro ao carregar tentativas do teste:', e)
    } finally {
      setLoadingTeste(false)
    }
  }

  const fetchData = async () => {
    if (!id) return
    try {
      const [onb, tars, aval, confs] = await Promise.all([
        onboardingService.getById(id),
        tarefaService.listByOnboarding(id),
        avaliacaoService.getByOnboarding(id),
        confirmacaoColaboradorService.listByOnboarding(id),
      ])
      setOnboarding(onb)
      setTarefas(tars)
      setAvaliacao(aval)

      // Carregar histórico de tentativas do teste de conhecimento
      carregarTentativasTeste(id)

      if (onb?.clientes_mapeamento && Array.isArray(onb.clientes_mapeamento)) {
        setCliente1(onb.clientes_mapeamento[0] || '')
        setCliente2(onb.clientes_mapeamento[1] || '')
        setCliente3(onb.clientes_mapeamento[2] || '')
      } else {
        setCliente1('')
        setCliente2('')
        setCliente3('')
      }

      setTecnicoNome(onb?.tecnico_responsavel_nome || '')
      setTecnicoEmail(onb?.tecnico_responsavel_email || '')

      if (onb?.setor) {
        faseService.listBySetor(onb.setor, onb.setor_ref).then(setFasesSetor).catch(console.error)
      }

      const mapConfs: Record<string, ConfirmacaoColaborador> = {}
      for (const c of confs) {
        mapConfs[c.tarefa] = c
      }
      setConfirmacoes(mapConfs)

      if (onb) {
        onboardingService.getOrGeneratePublicLink(onb).then(setLinkColaborador)

        // Buscar todos os onboardings da mesma pessoa (para perfil do colaborador & histórico de vida)
        try {
          const todosOnbs = await onboardingService.listByColaborador(
            onb.colaborador_nome,
            onb.colaborador_email,
          )
          setTodosOnboardings(todosOnbs.length > 0 ? todosOnbs : [onb])
        } catch {
          setTodosOnboardings([onb])
        }

        // Buscar avaliações do dossiê (reciclagem, mudança de área, etc.)
        try {
          const avs = await avaliacaoColaboradorService.listByColaborador(onb.id)
          setAvaliacoesDossie(avs)
        } catch {
          setAvaliacoesDossie([])
        }

        // Buscar certificados (se RH ou Admin)
        if (isAdmin || isRH) {
          try {
            const certs = await certificadoService.listByColaborador(onb.id)
            setCertificadosList(certs)
          } catch {
            setCertificadosList([])
          }
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar detalhes do perfil do colaborador.')
    } finally {
      setLoading(false)
    }
  }

  const carregarLogs = async () => {
    if (!id) return
    setLoadingLogs(true)
    try {
      const logs = await auditoriaService.listByOnboarding(id)
      setLogsAuditoria(logs)
    } catch (e) {
      console.error('Erro ao carregar logs:', e)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  useEffect(() => {
    // Carregar logs também quando abrir auditoria ou trajetória
    if (abaAtiva === 'auditoria' || abaAtiva === 'trajetoria') {
      carregarLogs()
    }
  }, [abaAtiva, id])

  // Realtime para refletir mudanças sincronizadas
  useRealtime<Onboarding>('onboardings', () => {
    fetchData()
  })
  useRealtime<TarefaOnboarding>('tarefas_onboarding', () => {
    if (id) {
      tarefaService.listByOnboarding(id).then(setTarefas)
    }
  })
  useRealtime<ConfirmacaoColaborador>('confirmacoes_colaborador', () => {
    if (id) {
      confirmacaoColaboradorService.listByOnboarding(id).then((confs) => {
        const mapConfs: Record<string, ConfirmacaoColaborador> = {}
        for (const c of confs) {
          mapConfs[c.tarefa] = c
        }
        setConfirmacoes(mapConfs)
      })
    }
  })

  // Cálculos de prazo e progresso
  const prazoInfo = useMemo(() => {
    if (!onboarding)
      return {
        diasRestantes: 0,
        isAtrasado: false,
        isCritico: false,
        isHoje: false,
        isVencido: false,
        labelBadge: '—',
      }

    const prazo = calcularDiasRestantes(onboarding.data_fim)
    const isFinalizado = onboarding.status === 'concluido' || onboarding.status === 'nao_apto'
    const isAtrasado = !isFinalizado && prazo.isVencido
    const isCritico = !isFinalizado && prazo.isCritico

    return {
      diasRestantes: prazo.diasRestantes ?? 0,
      isAtrasado,
      isCritico,
      isHoje: prazo.isHoje,
      isVencido: prazo.isVencido,
      labelBadge: prazo.labelBadge,
    }
  }, [onboarding])

  const progressoPercent = useMemo(() => {
    if (!onboarding) return 0
    let p = 0
    if (onboarding.etapa1_concluida) p += 33
    if (onboarding.etapa2_concluida) p += 33
    if (onboarding.etapa3_concluida) p += 34
    return p
  }, [onboarding])

  // Itens fixos da Etapa 1 (Apresentação RH)
  // Separar tarefas da Etapa 1 e Etapa 2
  const tarefasEtapa1 = useMemo(() => {
    return tarefas.filter((t) => t.etapa === 1)
  }, [tarefas])

  const tarefasEtapa2 = useMemo(() => {
    return tarefas.filter((t) => t.etapa === 2 || !t.etapa)
  }, [tarefas])

  // Contadores de confirmação do colaborador por etapa
  const confirmacoesEtapa1 = useMemo(() => {
    return tarefasEtapa1.filter((t) => Boolean(confirmacoes[t.id])).length
  }, [tarefasEtapa1, confirmacoes])

  const confirmacoesEtapa2 = useMemo(() => {
    return tarefasEtapa2.filter((t) => Boolean(confirmacoes[t.id])).length
  }, [tarefasEtapa2, confirmacoes])

  // Determinar status de bloqueio sequencial de cada fase na Etapa 2 (FONTE DA VERDADE UNIFICADA):
  // Uma fase N só libera para atuação após a CONCLUSÃO FORMAL PELO GESTOR da fase anterior (0 .. N-1).
  // A conclusão do Gestor exige:
  // 1) Que o colaborador tenha confirmado TODOS os itens da fase ("assisti/li" no portal);
  // 2) Que o colaborador tenha sinalizado o fim da fase com o RELATO OBRIGATÓRIO (não pendente de refação).
  // Nem o toggle "concluída" da tarefa nem qualquer outro sinal conta para destravar fases.
  const fasesStatusEtapa2 = useMemo(() => {
    if (fasesSetor.length === 0) {
      return []
    }

    let faseAnteriorConcluidaPeloGestor = true

    return fasesSetor.map((fase, index) => {
      const itensDaFase = tarefasEtapa2.filter((t) => t.fase === fase.id)
      const totalItens = itensDaFase.length
      const concluidos = itensDaFase.filter((t) => t.concluida).length
      const confirmadosColab = itensDaFase.filter((t) => Boolean(confirmacoes[t.id])).length

      // Verificar se a fase já foi registrada formalmente pelo Gestor em fases_concluidas
      const registroConclusao = onboarding?.fases_concluidas?.find((f) => {
        if (!f) return false
        if (typeof f === 'string') return f === fase.id
        return f.fase_id === fase.id
      })

      // Sinalização e relato do colaborador
      const sinalizacao = onboarding?.fases_sinalizadas?.find((s) => s.fase_id === fase.id)
      const temRelatoValido = Boolean(
        sinalizacao &&
        sinalizacao.status_sinalizacao !== 'refacao_solicitada' &&
        sinalizacao.relato &&
        sinalizacao.relato.trim().length >= 10,
      )

      // Colaborador confirmou todos os itens da fase (se existirem)
      const todosItensConfirmadosColab = totalItens === 0 || confirmadosColab === totalItens

      // Uma fase está formalmente completa se o Gestor/Admin já a concluiu
      const estaCompleta = Boolean(registroConclusao)

      // A fase atual só está desbloqueada se a fase anterior já foi formalmente CONCLUÍDA PELO GESTOR
      const estaDesbloqueada = faseAnteriorConcluidaPeloGestor

      // Atualiza o acumulador para a próxima fase
      if (!estaCompleta) {
        faseAnteriorConcluidaPeloGestor = false
      }

      // O gestor pode concluir a fase quando:
      // - Fase está desbloqueada;
      // - Ainda não foi concluída;
      // - O colaborador confirmou todos os itens (se existirem);
      // - O colaborador enviou a sinalização com relato dissertativo válido (sem refação pendente).
      const podeConcluirFase =
        estaDesbloqueada && !registroConclusao && todosItensConfirmadosColab && temRelatoValido

      let podeConcluirFaseMotivo:
        | 'bloqueada'
        | 'ja_concluida'
        | 'itens_pendentes'
        | 'refacao_pendente'
        | 'relato_pendente'
        | null = null

      if (!estaDesbloqueada) {
        podeConcluirFaseMotivo = 'bloqueada'
      } else if (registroConclusao) {
        podeConcluirFaseMotivo = 'ja_concluida'
      } else if (!todosItensConfirmadosColab) {
        podeConcluirFaseMotivo = 'itens_pendentes'
      } else if (sinalizacao?.status_sinalizacao === 'refacao_solicitada') {
        podeConcluirFaseMotivo = 'refacao_pendente'
      } else if (!temRelatoValido) {
        podeConcluirFaseMotivo = 'relato_pendente'
      }

      return {
        fase,
        index,
        itens: itensDaFase,
        totalItens,
        concluidos,
        confirmadosColab,
        todosItensConfirmadosColab,
        temRelatoValido,
        sinalizacao,
        estaCompleta,
        estaDesbloqueada,
        registroConclusao,
        podeConcluirFase,
        podeConcluirFaseMotivo,
      }
    })
  }, [
    fasesSetor,
    tarefasEtapa2,
    confirmacoes,
    onboarding?.fases_concluidas,
    onboarding?.fases_sinalizadas,
  ])

  // Indicador da fase atual em andamento (ex: "Fase 2 de 5 — Shadowing Ativo")
  const faseAtualInfo = useMemo(() => {
    if (fasesStatusEtapa2.length === 0) return null
    if (onboarding?.etapa2_concluida) {
      return 'Todas as fases concluídas'
    }
    const atual = fasesStatusEtapa2.find((f) => !f.estaCompleta && f.estaDesbloqueada)
    if (atual) {
      return `Fase ${atual.index + 1} de ${fasesStatusEtapa2.length} — ${atual.fase.titulo}`
    }
    const todasCompletas = fasesStatusEtapa2.every((f) => f.estaCompleta)
    if (todasCompletas) {
      return `Fase ${fasesStatusEtapa2.length} de ${fasesStatusEtapa2.length} — Pronta para Conclusão`
    }
    return `Fase 1 de ${fasesStatusEtapa2.length} — ${fasesStatusEtapa2[0]?.fase.titulo}`
  }, [fasesStatusEtapa2, onboarding?.etapa2_concluida])

  // Itens avulsos da Etapa 2 (sem fase ou fora das fases cadastradas)
  const tarefasEtapa2SemFase = useMemo(() => {
    return tarefasEtapa2.filter((t) => !t.fase || !fasesSetor.some((f) => f.id === t.fase))
  }, [tarefasEtapa2, fasesSetor])

  const handleCopiarLinkColaborador = async () => {
    if (!linkColaborador) return
    try {
      await navigator.clipboard.writeText(linkColaborador)
      setLinkCopiado(true)
      toast.success('Link do colaborador copiado com sucesso! Envie via WhatsApp ou e-mail.')
      setTimeout(() => setLinkCopiado(false), 2500)
    } catch {
      toast.error('Erro ao copiar link para a área de transferência.')
    }
  }

  // Regra da Etapa 1 unificada: a conclusão pelo RH exige:
  // 1) As CONFIRMAÇÕES DO COLABORADOR nos materiais/vídeos ("assisti/li" no portal);
  // 2) O RELATO dissertativo obrigatório da Etapa 1 ("o que entendeu/aprendeu");
  // 3) O checklist de integração físico 100% entregue.
  // As marcações manuais do RH nos materiais NÃO contam nem travam a conclusão.
  const confirmacoesEtapa1Colab = useMemo(() => {
    return tarefasEtapa1.filter((t) => Boolean(confirmacoes[t.id])).length
  }, [tarefasEtapa1, confirmacoes])

  const todosMateriaisEtapa1ConfirmadosColab = useMemo(() => {
    if (tarefasEtapa1.length === 0) return true
    return confirmacoesEtapa1Colab === tarefasEtapa1.length
  }, [tarefasEtapa1, confirmacoesEtapa1Colab])

  const sinalizacaoEtapa1 = useMemo(() => {
    return onboarding?.fases_sinalizadas?.find(
      (s) => s.fase_id === 'etapa1' || (s.etapa === 1 && !s.fase_id),
    )
  }, [onboarding?.fases_sinalizadas])

  const temRelatoEtapa1Valido = useMemo(() => {
    return Boolean(
      sinalizacaoEtapa1 && sinalizacaoEtapa1.relato && sinalizacaoEtapa1.relato.trim().length >= 10,
    )
  }, [sinalizacaoEtapa1])

  const allEtapa1Checked = useMemo(() => {
    return todosMateriaisEtapa1ConfirmadosColab && temRelatoEtapa1Valido
  }, [todosMateriaisEtapa1ConfirmadosColab, temRelatoEtapa1Valido])

  const allEtapa2TarefasChecked = useMemo(() => {
    if (fasesSetor.length > 0) {
      return fasesStatusEtapa2.every((f) => f.estaCompleta)
    }
    return tarefasEtapa2.length === 0 || confirmacoesEtapa2 === tarefasEtapa2.length
  }, [fasesSetor, fasesStatusEtapa2, tarefasEtapa2, confirmacoesEtapa2])

  // Regras de permissão específicas do Onboarding
  // Etapa 1: Ações de escrita (marcar vistos, upload de item, concluir etapa) exclusivas de Admin e RH
  const podeGerenciarEtapa1 = isAdmin || isRH

  // Etapa 2 e Etapa 3: Somente Admin ou o Gestor Responsável atribuído
  const isGestorResponsavel = onboarding?.gestor_id === user?.id
  const podeGerenciarEtapa2e3 =
    isAdmin ||
    (role === 'gestao' && isGestorResponsavel) ||
    (role === 'gestao' && !onboarding?.gestor_id)

  // Toggle de tarefa genérico (serve para Etapa 1 e Etapa 2)
  const handleToggleTarefa = async (tarefa: TarefaOnboarding) => {
    if (tarefa.etapa === 1) {
      if (onboarding?.etapa1_concluida) return
      if (!podeGerenciarEtapa1) {
        toast.error(
          'Você não tem permissão para esta ação. A Etapa 1 é conduzida pelo RH ou Administrador.',
        )
        return
      }
    }

    if (tarefa.etapa === 2 || !tarefa.etapa) {
      if (!onboarding?.etapa1_concluida) {
        toast.error('A Etapa 2 só pode ser iniciada após a conclusão da Etapa 1 pelo RH.')
        return
      }
      if (onboarding?.etapa2_concluida) return
      if (!podeGerenciarEtapa2e3) {
        toast.error(
          'Você não tem permissão para esta ação. A Etapa 2 é conduzida pelo Gestor Responsável ou Administrador.',
        )
        return
      }

      // Validar bloqueio sequencial: se o item pertencer a uma fase bloqueada, impedir marcação
      if (tarefa.fase) {
        const statusFase = fasesStatusEtapa2.find((f) => f.fase.id === tarefa.fase)
        if (statusFase && !statusFase.estaDesbloqueada) {
          toast.error(
            'Esta fase está bloqueada. Conclua todos os itens da fase anterior para liberar.',
          )
          return
        }
      }
    }

    try {
      const updated = await tarefaService.toggleConcluida(tarefa.id, !tarefa.concluida)
      setTarefas((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status do item.')
    }
  }

  // MELHORIA 1 — Salvar Técnico Responsável
  const handleSalvarTecnicoResponsavel = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa2e3) {
      toast.error('Apenas o gestor responsável ou administrador podem definir o técnico.')
      return
    }
    if (!tecnicoNome.trim()) {
      toast.error('O nome do técnico responsável é obrigatório.')
      return
    }

    try {
      setSalvandoTecnico(true)
      const updated = await onboardingService.atualizarTecnicoResponsavel({
        onboardingId: onboarding.id,
        nome: tecnicoNome.trim(),
        email: tecnicoEmail.trim(),
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        colaboradorNome: onboarding.colaborador_nome,
      })

      setOnboarding(updated)
      setEditandoTecnico(false)
      toast.success('Técnico responsável pelo acompanhamento atualizado com sucesso!')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar técnico responsável.')
    } finally {
      setSalvandoTecnico(false)
    }
  }

  // MELHORIA 3 — Alternar Item do Checklist de Integração
  const handleToggleItemChecklistIntegracao = async (item: ItemChecklistIntegracao) => {
    if (!onboarding || !user) return
    if (onboarding.etapa1_concluida) {
      toast.error('A Etapa 1 já está concluída. Checklist bloqueado.')
      return
    }
    if (!podeGerenciarEtapa1) {
      toast.error('Apenas o RH ou Administrador podem marcar itens do checklist de integração.')
      return
    }

    try {
      setMarcandoItemChecklistId(item.id)
      const updated = await onboardingService.atualizarItemChecklistIntegracao({
        onboardingId: onboarding.id,
        itemId: item.id,
        entregue: !item.entregue,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        colaboradorNome: onboarding.colaborador_nome,
      })
      setOnboarding(updated)
      toast.success(
        `Item "${item.titulo}" ${!item.entregue ? 'marcado como entregue' : 'desmarcado'}!`,
      )
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar item do checklist de integração.')
    } finally {
      setMarcandoItemChecklistId(null)
    }
  }

  // MELHORIA 4 — Salvar Observação de um Item do Checklist de Integração
  const handleSalvarObservacaoItemChecklist = async (itemId: string) => {
    if (!onboarding || !user) return
    if (onboarding.etapa1_concluida) {
      toast.error('A Etapa 1 já está concluída. Observações travadas.')
      return
    }
    if (!podeGerenciarEtapa1) {
      toast.error('Apenas o RH ou Administrador podem editar observações do checklist.')
      return
    }

    try {
      setSalvandoObs(true)
      const updated = await onboardingService.atualizarObservacaoItemChecklist({
        onboardingId: onboarding.id,
        itemId,
        observacao: obsTemp,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        colaboradorNome: onboarding.colaborador_nome,
      })
      setOnboarding(updated)
      setEditandoObsItemId(null)
      setObsTemp('')
      toast.success('Observação salva com sucesso!')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar observação.')
    } finally {
      setSalvandoObs(false)
    }
  }

  // Verificar se checklist de integração está 100% entregue
  const checklistIntegracao = useMemo<ItemChecklistIntegracao[]>(() => {
    if (Array.isArray(onboarding?.checklist_integracao)) {
      return onboarding.checklist_integracao
    }
    return []
  }, [onboarding?.checklist_integracao])

  const totalItensChecklist = checklistIntegracao.length
  const entreguesChecklist = checklistIntegracao.filter((i) => i.entregue).length
  const allChecklistEntregue =
    totalItensChecklist === 0 || entreguesChecklist === totalItensChecklist

  // Concluir Etapa 1 (RH)
  const handleConcluirEtapa1 = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa1) {
      toast.error(
        'Você não tem permissão para esta ação. Apenas RH ou Administrador concluem a Etapa 1.',
      )
      return
    }

    // Validações da Etapa 1 unificada:
    // 1) Checklist de integração entregue
    if (!allChecklistEntregue) {
      toast.error(
        `Pendência no Checklist de Integração: ${totalItensChecklist - entreguesChecklist} item(ns) pendente(s) de entrega. Marque todos os itens para concluir a Etapa 1.`,
      )
      return
    }

    // 2) Confirmações do colaborador em todos os materiais
    if (!todosMateriaisEtapa1ConfirmadosColab) {
      toast.error(
        `O colaborador ainda não confirmou todos os materiais no portal público (${confirmacoesEtapa1Colab}/${tarefasEtapa1.length} confirmados). Aguarde as confirmações.`,
      )
      return
    }

    // 3) Relato obrigatório da Etapa 1
    if (!temRelatoEtapa1Valido) {
      toast.error(
        'O colaborador precisa sinalizar o término da Etapa 1 e preencher o relato dissertativo no portal antes da validação pelo RH.',
      )
      return
    }

    try {
      setConcluindoEtapa1(true)
      await onboardingService.concluirEtapa1(onboarding.id, user.id)

      // Registrar auditoria
      await auditoriaService.registrar({
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        acao: 'Etapa 1 Concluída (RH)',
        detalhes: 'Integração institucional finalizada e Etapa 2 liberada ao gestor.',
        foraPrazo: false,
      })

      toast.success(
        'Etapa 1 concluída com sucesso! O gestor responsável receberá uma notificação por e-mail com a liberação da Etapa 2.',
      )
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao concluir Etapa 1.')
    } finally {
      setConcluindoEtapa1(false)
    }
  }

  // Abrir Modal de Solicitação de Refação da Fase
  const handleAbrirSolicitarRefacao = (fase: FaseModelo) => {
    if (!onboarding) return
    const sinalizacao = onboarding.fases_sinalizadas?.find((s) => s.fase_id === fase.id)
    const refacoesAtuais = sinalizacao?.refacoes_count || 0

    if (refacoesAtuais >= 2) {
      toast.error('Esta fase já atingiu o limite máximo de 2 refações permitidas.')
      return
    }

    setFaseParaRefacao({
      faseId: fase.id,
      faseTitulo: fase.titulo,
      refacoesAtuais,
    })
    setMotivoRefacao('')
    setModalRefacaoOpen(true)
  }

  // Confirmar Solicitação de Refação da Fase
  const handleConfirmarSolicitacaoRefacao = async () => {
    if (!onboarding || !user || !faseParaRefacao) return
    const motivoLimpo = motivoRefacao.trim()
    if (!motivoLimpo || motivoLimpo.length < 5) {
      toast.error('Informe uma justificativa clara (ao menos 5 caracteres) para a refação.')
      return
    }

    try {
      setSolicitandoRefacao(true)
      const res = await faseService.solicitarRefacaoFase({
        onboardingId: onboarding.id,
        faseId: faseParaRefacao.faseId,
        faseTitulo: faseParaRefacao.faseTitulo,
        motivo: motivoLimpo,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
      })

      setOnboarding(res.onboarding)
      setModalRefacaoOpen(false)
      setFaseParaRefacao(null)
      setMotivoRefacao('')
      toast.success(res.message || 'Refação solicitada com sucesso!')
      fetchData()
    } catch (err: unknown) {
      console.error('Erro ao solicitar refação da fase:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar refação da fase.'
      toast.error(msg)
    } finally {
      setSolicitandoRefacao(false)
    }
  }

  // Salvar Clientes de Referência para a Fase 2 (Mapeamento de Ambientes)
  const handleSalvarClientesMapeamento = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa2e3) {
      toast.error('Apenas o gestor responsável ou administrador podem indicar os clientes.')
      return
    }

    try {
      setSalvandoClientes(true)
      const lista = [cliente1, cliente2, cliente3].map((c) => c.trim()).filter((c) => c.length > 0)

      const updated = await onboardingService.atualizarClientesMapeamento({
        onboardingId: onboarding.id,
        clientes: lista,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        colaboradorNome: onboarding.colaborador_nome,
      })

      setOnboarding(updated)
      setEditandoClientes(false)
      toast.success('Clientes de referência do Passportal atualizados com sucesso!')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar clientes de referência.')
    } finally {
      setSalvandoClientes(false)
    }
  }

  // Concluir Fase Uniforme da Etapa 2
  const handleConcluirFase = async (fase: FaseModelo, index: number) => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa2e3) {
      toast.error('Conclusão restrita ao gestor responsável e administrador.')
      return
    }

    // Identificar a data planejada limite no cronograma_fases (se houver)
    const itemCronograma = onboarding.cronograma_fases?.find((c) => c.fase_id === fase.id)
    const dataLimite = itemCronograma?.data_limite

    try {
      setConcluindoFaseId(fase.id)
      const res = await onboardingService.concluirFase({
        onboardingId: onboarding.id,
        faseId: fase.id,
        faseTitulo: fase.titulo,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        colaboradorNome: onboarding.colaborador_nome,
        diasPlanejados: fase.dias_previstos || 2,
        dataPlanejadaLimite: dataLimite,
      })

      setOnboarding(res.onboarding)
      toast.success(
        `Fase "${fase.titulo}" concluída com sucesso! ${res.faseInfo.destaque_prazo ? `(${res.faseInfo.destaque_prazo})` : ''}`,
      )
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao concluir fase.')
    } finally {
      setConcluindoFaseId(null)
    }
  }

  // Excluir Tarefa customizada
  const handleDeleteTarefa = async (tarefaId: string, etapa: number = 1) => {
    if (etapa === 1 && !podeGerenciarEtapa1) {
      toast.error('Você não tem permissão para remover itens da Etapa 1.')
      return
    }
    if (etapa === 2 && !podeGerenciarEtapa2e3) {
      toast.error('Você não tem permissão para remover itens da Etapa 2.')
      return
    }

    if (!confirm('Deseja realmente remover este item do onboarding?')) return
    try {
      await tarefaService.delete(tarefaId)
      setTarefas((prev) => prev.filter((t) => t.id !== tarefaId))
      toast.success('Item removido com sucesso.')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao remover item.')
    }
  }

  // Todas as fases da Etapa 2 foram concluídas formalmente pelo gestor
  const todasFasesEtapa2ConcluidasPeloGestor = useMemo(() => {
    if (fasesSetor.length > 0) {
      return fasesStatusEtapa2.every((f) => Boolean(f.registroConclusao))
    }
    // Setor sem fases modelo cadastradas: exige que todos os itens tenham sido confirmados pelo colaborador
    if (tarefasEtapa2.length === 0) return true
    return tarefasEtapa2.every((t) => Boolean(confirmacoes[t.id]))
  }, [fasesSetor, fasesStatusEtapa2, tarefasEtapa2, confirmacoes])

  // Concluir Etapa 2
  const handleConcluirEtapa2 = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa2e3) {
      toast.error(
        'Você não tem permissão para esta ação. Apenas o Gestor Responsável ou Administrador concluem a Etapa 2.',
      )
      return
    }

    try {
      setConcluindoEtapa2(true)
      await onboardingService.concluirEtapa2(onboarding.id, user.id)

      // Registrar auditoria
      await auditoriaService.registrar({
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        acao: 'Etapa 2 Concluída (Vivência Técnica)',
        detalhes:
          'Todas as fases e tarefas técnicas cumpridas. Liberada Avaliação Final (Etapa 3).',
        foraPrazo: false,
      })

      toast.success(
        'Etapa 2 (Vivência Técnica) concluída! O gestor responsável receberá uma notificação por e-mail para realizar a Avaliação Final.',
      )
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao concluir Etapa 2.')
    } finally {
      setConcluindoEtapa2(false)
    }
  }

  // Estado para armazenar qual fase associar no novo item do onboarding (quando etapa 2)
  const [novoItemFaseId, setNovoItemFaseId] = useState<string>('')

  // Abrir modal de novo item especificando a etapa (1 ou 2)
  const openAddItemModal = (etapa: 1 | 2, defaultFaseId?: string) => {
    if (etapa === 1 && !podeGerenciarEtapa1) {
      toast.error('Você não tem permissão para esta ação.')
      return
    }
    if (etapa === 2 && !podeGerenciarEtapa2e3) {
      toast.error('Você não tem permissão para esta ação.')
      return
    }

    setModalItemEtapa(etapa)
    setNovoItemTitulo('')
    setNovoItemDescricao('')
    setNovoItemTipo('manual')
    setNovoItemOrigem('upload')
    setNovoItemMaterialId('')
    setNovoItemFile(null)
    setNovoItemFaseId(defaultFaseId || '')
    setItemError('')
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Carregar materiais disponíveis da biblioteca
    materialService.listAll().then(setMateriaisBiblioteca).catch(console.error)
    setModalItemOpen(true)
  }

  // Preenche dados ao selecionar um material da biblioteca
  const handleSelectMaterialModal = (matId: string) => {
    setNovoItemMaterialId(matId)
    if (!matId) return
    const mat = materiaisBiblioteca.find((m) => m.id === matId)
    if (mat) {
      if (!novoItemTitulo.trim()) {
        setNovoItemTitulo(mat.titulo)
      }
      if (!novoItemDescricao.trim() && mat.descricao) {
        setNovoItemDescricao(mat.descricao)
      }
      setNovoItemTipo(mat.tipo)
    }
  }

  // Upload de novo item para o onboarding (Etapa 1 ou Etapa 2)
  const handleAddItemOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    setItemError('')

    if (!onboarding) return
    if (modalItemEtapa === 1 && !podeGerenciarEtapa1) {
      toast.error('Você não tem permissão para adicionar itens na Etapa 1.')
      return
    }
    if (modalItemEtapa === 2 && !podeGerenciarEtapa2e3) {
      toast.error('Você não tem permissão para adicionar itens na Etapa 2.')
      return
    }

    if (!novoItemTitulo.trim()) {
      setItemError('O título do item é obrigatório.')
      return
    }

    if (novoItemOrigem === 'upload' && novoItemFile && novoItemFile.size > 52428800) {
      setItemError('O arquivo não pode exceder 50 MB.')
      return
    }

    try {
      setEnviandoItem(true)
      const formData = new FormData()
      formData.append('onboarding_id', onboarding.id)
      formData.append('titulo', novoItemTitulo.trim())
      formData.append('descricao', novoItemDescricao.trim())
      formData.append('tipo', novoItemTipo)
      formData.append('etapa', String(modalItemEtapa))
      formData.append('concluida', 'false')
      formData.append('criado_automaticamente', 'false')

      if (modalItemEtapa === 2 && novoItemFaseId) {
        formData.append('fase', novoItemFaseId)
      } else {
        formData.append('fase', '')
      }

      if (novoItemOrigem === 'biblioteca') {
        formData.append('material', novoItemMaterialId || '')
      } else {
        formData.append('material', '')
        if (novoItemFile) {
          formData.append('conteudo_url', novoItemFile)
        }
      }

      const nova = await tarefaService.create(formData)
      // Atualizar lista completa para garantir expand de material
      const atualizadas = await tarefaService.listByOnboarding(onboarding.id)
      setTarefas(atualizadas)

      toast.success(
        modalItemEtapa === 1
          ? 'Item adicionado à Apresentação da Empresa (Etapa 1)!'
          : 'Item adicionado à Vivência Técnica (Etapa 2)!',
      )
      setModalItemOpen(false)
      setNovoItemTitulo('')
      setNovoItemDescricao('')
      setNovoItemFile(null)
      setNovoItemMaterialId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error(err)
      const msg = getErrorMessage(err)
      setItemError(msg || 'Falha ao adicionar item.')
      toast.error(msg ? `Falha ao adicionar item: ${msg}` : 'Falha ao adicionar item.')
    } finally {
      setEnviandoItem(false)
    }
  }

  // Ação: Liberar Reteste do Teste de Conhecimento
  const handleConfirmarLiberacaoReteste = async () => {
    if (!onboarding) return
    try {
      setLiberandoReteste(true)
      await testeConhecimentoService.liberarReteste({
        onboardingId: onboarding.id,
        motivo: motivoReteste || 'Revisão com o colaborador antes de nova avaliação',
        usuarioId: user?.id,
        usuarioNome: user?.name,
        usuarioRole: role,
      })
      toast.success(
        'Reteste liberado com sucesso! O colaborador já pode refazer o teste no portal público.',
      )
      setModalRetesteOpen(false)
      setMotivoReteste('')
      fetchData()
    } catch (err: unknown) {
      console.error('Erro ao liberar reteste:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao liberar reteste.'
      toast.error(msg)
    } finally {
      setLiberandoReteste(false)
    }
  }

  // Registrar Decisão da Avaliação Final (Etapa 3)
  const handleRegistrarAvaliacao = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa2e3) {
      toast.error(
        'Você não tem permissão para esta ação. Avaliação exclusiva do Gestor Responsável ou Administrador.',
      )
      return
    }
    if (!decisaoAvaliacao) {
      toast.error('A decisão (Apto ou Não Apto) é obrigatória.')
      return
    }

    const reavaliacoesCount = onboarding.reavaliacoes_count || 0
    const atingiuTeto = reavaliacoesCount >= 2

    if (decisaoAvaliacao === 'nao_apto' && !atingiuTeto && !naoAptoDefinitivo && !faseRetornoId) {
      toast.error('Selecione a fase de retorno para o colaborador.')
      return
    }

    try {
      setSalvandoAvaliacao(true)
      const res = await avaliacaoService.registrarDecisao({
        onboardingId: onboarding.id,
        avaliadorId: user.id,
        decisao: decisaoAvaliacao,
        observacoes: observacoesAvaliacao.trim(),
        faseRetornoId: decisaoAvaliacao === 'nao_apto' ? faseRetornoId : undefined,
        prazoSuplementarDias: decisaoAvaliacao === 'nao_apto' ? prazoSuplementarDias : undefined,
        definitivo: decisaoAvaliacao === 'nao_apto' ? atingiuTeto || naoAptoDefinitivo : false,
      })

      setAvaliacao(res.avaliacao)
      setOnboarding(res.onboarding)

      // Identificar título da fase de retorno se houver
      const faseRetornoObj = fasesSetor.find((f) => f.id === faseRetornoId)

      // Auditoria
      await auditoriaService.registrar({
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        usuarioId: user.id,
        usuarioNome: user.name || user.email,
        usuarioRole: role || '',
        gestorNome: onboarding.expand?.gestor_id?.name || '',
        acao:
          decisaoAvaliacao === 'apto'
            ? 'Avaliação: Aprovado (Apto)'
            : atingiuTeto || naoAptoDefinitivo
              ? 'Avaliação: Não Apto Definitivo'
              : `Avaliação: Não Apto (Retorno à fase ${faseRetornoObj?.titulo || 'técnica'})`,
        detalhes:
          decisaoAvaliacao === 'apto'
            ? `Colaborador aprovado como APTO. Parecer: ${observacoesAvaliacao.trim() || 'Sem observações'}`
            : atingiuTeto || naoAptoDefinitivo
              ? `Reprovado em caráter definitivo após ${reavaliacoesCount + 1} ciclos. Parecer: ${observacoesAvaliacao.trim() || 'Sem observações'}`
              : `Retorno para a fase "${faseRetornoObj?.titulo || 'selecionada'}" com +${prazoSuplementarDias} dias de prazo suplementar. Status: Em acompanhamento. Parecer: ${observacoesAvaliacao.trim() || 'Sem observações'}`,
        foraPrazo: false,
      })

      if (decisaoAvaliacao === 'apto') {
        toast.success(
          'Avaliação registrada! Colaborador marcado como Apto. Notificação por e-mail enviada para o RH e Administração.',
        )
      } else if (atingiuTeto || naoAptoDefinitivo) {
        toast.error('Avaliação registrada! Colaborador marcado como Não Apto Definitivo.')
      } else {
        toast.info(
          `Colaborador retornou para acompanhamento na fase "${faseRetornoObj?.titulo || 'selecionada'}" com +${prazoSuplementarDias} dias suplementares.`,
        )
      }
      fetchData()
    } catch (err) {
      console.error(err)
      const msg = getErrorMessage(err)
      toast.error(msg ? `Erro ao registrar avaliação: ${msg}` : 'Erro ao registrar avaliação.')
    } finally {
      setSalvandoAvaliacao(false)
    }
  }

  // Abrir preview modal
  const openPreview = (item: { titulo: string; tipo: TarefaTipo; url: string }) => {
    setPreviewItem(item)
    setPreviewModalOpen(true)
  }

  const formatDate = (iso?: string) => {
    return formatDateTime(iso)
  }

  if (loading || !onboarding) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Carregando detalhes do onboarding...</p>
      </div>
    )
  }

  const setorInfo = getSetorVisual(onboarding.setor, onboarding.expand?.setor_ref)
  const statusInfo = STATUS_INFO[onboarding.status]

  return (
    <div className="space-y-7">
      {/* Top Breadcrumb & Voltar */}
      <div className="flex items-center justify-between gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900 -ml-2"
        >
          <Link to="/onboardings" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar aos Onboardings</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {prazoInfo.isAtrasado && (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-xs font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              Atrasado ({Math.abs(prazoInfo.diasRestantes)} dias além do limite)
            </Badge>
          )}

          {/* Botão de Editar Colaborador (Exclusivo RH / Admin — Gestão não edita) */}
          {(isAdmin || isRH) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalEditarOpen(true)}
              className="border-gray-300 text-gray-700 hover:text-brand-700 hover:bg-brand-50 font-semibold text-xs h-8 gap-1.5"
              title="Editar cargo, setor ou gestor responsável do colaborador"
            >
              <Pencil className="w-3.5 h-3.5 text-brand-600" />
              <span>Editar Perfil</span>
            </Button>
          )}

          {/* Botão de Excluir Colaborador (Exclusivo RH / Admin) */}
          {(isAdmin || isRH) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalExcluirOpen(true)}
              className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold text-xs h-8 gap-1.5"
              title="Excluir este colaborador e todos os registros vinculados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Perfil</span>
            </Button>
          )}
        </div>
      </div>

      {/* Banner / Card do Link Público do Colaborador */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-sm space-y-3 border border-brand-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-brand-500/25 text-cyan-200 px-2.5 py-0.5 rounded-full border border-cyan-400/30 inline-flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                Link Público do Colaborador (Sem Login)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Acesso exclusivo para {onboarding.colaborador_nome}
            </h3>
            <p className="text-xs text-cyan-100/90 max-w-2xl leading-relaxed">
              O colaborador assiste aos vídeos e lê os manuais por este link e confirma que já
              assistiu/leu diretamente da tela dele. O RH e Gestão acompanham o progresso em tempo
              real.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={handleCopiarLinkColaborador}
              className="bg-white text-brand-950 hover:bg-brand-50 font-bold text-xs h-10 px-4 shadow-sm"
            >
              {linkCopiado ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 text-brand-600" />
                  Link Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar link do colaborador
                </>
              )}
            </Button>

            {linkColaborador && (
              <Button
                asChild
                variant="outline"
                className="bg-brand-800/60 border-brand-700 text-white hover:bg-brand-800 text-xs h-10 px-3"
              >
                <a
                  href={linkColaborador}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir página do colaborador em nova guia"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {linkColaborador && (
          <div className="pt-2 border-t border-brand-800/80 flex items-center gap-2 text-xs text-cyan-200 font-mono overflow-hidden">
            <span className="text-cyan-400 select-none shrink-0 font-sans font-medium">
              URL direta:
            </span>
            <span className="truncate select-all bg-brand-950/80 px-2.5 py-1 rounded border border-brand-800/60 flex-1">
              {linkColaborador}
            </span>
          </div>
        )}
      </div>

      {/* Header Consolidado do Perfil do Colaborador (Ficha Única da Pessoa) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar com Iniciais */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0 ring-4 ring-brand-50">
              {(() => {
                const nomes = (onboarding.colaborador_nome || 'Colaborador').trim().split(/\s+/)
                if (nomes.length === 1) return nomes[0].slice(0, 2).toUpperCase()
                return (nomes[0][0] + nomes[nomes.length - 1][0]).toUpperCase()
              })()}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight text-[#1A2233]">
                  {onboarding.colaborador_nome}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-brand-50 text-brand-700 border-brand-200 inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: setorInfo.cor }}
                  />
                  Área: {setorInfo.nome}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.corBg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.corDot}`} />
                  {statusInfo.nome}
                </span>
                {todosOnboardings.length > 1 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-semibold"
                  >
                    {todosOnboardings.length} onboardings registrados
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-500 flex-wrap pt-0.5">
                <span className="text-gray-700 font-medium">{onboarding.colaborador_email}</span>
                {onboarding.cargo && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-gray-800">{onboarding.cargo}</span>
                  </>
                )}
                <span>•</span>
                <span>Contratação/Início: {formatShortDate(onboarding.data_inicio)}</span>
                <span>•</span>
                <span className="font-semibold text-gray-700">
                  Prazo Onboarding: {formatShortDate(onboarding.data_fim)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-start md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 gap-1 shrink-0">
            <span className="text-xs text-gray-400 font-medium">Gestor Responsável:</span>
            <span className="text-sm font-bold text-gray-900">
              {onboarding.expand?.gestor_id?.name || 'Gestão TI'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Geral do Onboarding Ativo */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1.5">
            <span>Progresso Geral do Onboarding Vigente</span>
            <span>{progressoPercent}% Concluído</span>
          </div>
          <Progress value={progressoPercent} className="h-2 rounded-full" />
        </div>

        {/* Abas Consolidadas do Perfil do Colaborador */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Aba 1: Trajetória Unificada */}
          <button
            type="button"
            onClick={() => setAbaAtiva('trajetoria')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              abaAtiva === 'trajetoria'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Trajetória</span>
          </button>

          {/* Aba 2: Onboarding (3 Etapas) */}
          <button
            type="button"
            onClick={() => setAbaAtiva('onboarding')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              abaAtiva === 'onboarding'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Onboarding ({progressoPercent}%)</span>
          </button>

          {/* Aba 3: Certificados (RH / Admin) */}
          {(isAdmin || isRH) && (
            <button
              type="button"
              onClick={() => {
                setAbaAtiva('certificados')
                recarregarCertificadosPerfil()
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                abaAtiva === 'certificados'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Certificados</span>
              {certificadosList.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    abaAtiva === 'certificados'
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {certificadosList.length}
                </span>
              )}
            </button>
          )}

          {/* Aba 4: Dossiê de Avaliações */}
          <button
            type="button"
            onClick={() => setAbaAtiva('avaliacoes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              abaAtiva === 'avaliacoes'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Dossiê de Avaliações</span>
            {avaliacoesDossie.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  abaAtiva === 'avaliacoes' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {avaliacoesDossie.length}
              </span>
            )}
          </button>

          {/* Aba 5: Histórico & Auditoria */}
          <button
            type="button"
            onClick={() => setAbaAtiva('auditoria')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              abaAtiva === 'auditoria'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Histórico & Auditoria</span>
            {logsAuditoria.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  abaAtiva === 'auditoria' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {logsAuditoria.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ABA 1: Trajetória Unificada */}
      {abaAtiva === 'trajetoria' && (
        <div className="space-y-6">
          <SecaoTrajetoria
            colaboradorAtual={onboarding}
            todosOnboardings={todosOnboardings}
            logsAuditoria={logsAuditoria}
            avaliacoes={avaliacoesDossie}
            certificados={certificadosList}
          />
        </div>
      )}

      {/* ABA 3: Certificados do Colaborador (RH/Admin) */}
      {abaAtiva === 'certificados' && (
        <div className="space-y-6">
          <SecaoCertificados
            onboarding={onboarding}
            todosOnboardings={todosOnboardings}
            onCertificadoAlterado={() => {
              recarregarCertificadosPerfil()
            }}
          />
        </div>
      )}

      {/* ABA 4: Dossiê de Avaliações */}
      {abaAtiva === 'avaliacoes' && (
        <div className="space-y-6">
          <SecaoAvaliacoesColaborador
            onboarding={onboarding}
            onAvaliacaoAdicionada={() => {
              fetchData()
            }}
          />
        </div>
      )}

      {/* ABA 5: Histórico & Auditoria */}
      {abaAtiva === 'auditoria' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                <span>Trilha de Auditoria & Histórico de Conclusões</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Registro imutável de todas as etapas, fases concluídas, alterações funcionais,
                certificações e decisões de avaliação.
              </p>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Registros mantidos por 6 meses</span>
            </div>
          </div>

          {loadingLogs ? (
            <div className="py-12 text-center text-xs text-gray-500">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando registros de auditoria...
            </div>
          ) : logsAuditoria.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              Nenhum registro de auditoria registrado para este onboarding ainda.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logsAuditoria.map((log) => (
                <div
                  key={log.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-gray-900">{log.acao}</span>
                      {log.fora_prazo ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          Fora do Prazo
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          No Prazo
                        </span>
                      )}
                      {log.destaque_prazo && (
                        <span className="text-[11px] text-gray-500 font-medium">
                          • {log.destaque_prazo}
                        </span>
                      )}
                    </div>
                    {log.detalhes && <p className="text-xs text-gray-600">{log.detalhes}</p>}
                    <div className="text-[11px] text-gray-400 flex items-center gap-3">
                      <span>
                        Executado por: <strong>{log.usuario_nome || 'Sistema'}</strong> (
                        {log.usuario_role || 'gestor'})
                      </span>
                      {log.gestor_nome && <span>• Gestor: {log.gestor_nome}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-xs text-gray-400 font-mono">
                    {formatDate(log.created)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: Onboarding Vigente (3 Etapas Conectadas + Timeline Lateral) */}
      {abaAtiva === 'onboarding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna das 3 Etapas */}
          <div className="lg:col-span-2 space-y-6">
            {/* ETAPA 1 — APRESENTAÇÃO DA EMPRESA (RH) */}
            <div
              className={`bg-white rounded-xl border p-6 shadow-sm transition-all relative ${
                onboarding.etapa1_concluida
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : 'border-brand-200 ring-1 ring-brand-100'
              }`}
            >
              {/* Header da Etapa */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      onboarding.etapa1_concluida
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-600 text-white'
                    }`}
                  >
                    {onboarding.etapa1_concluida ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#1A2233]">
                        Etapa 1 — Apresentação da Empresa
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold bg-indigo-50/70 text-indigo-700 border-indigo-200"
                      >
                        {confirmacoesEtapa1} de {tarefasEtapa1.length} confirmados pelo colaborador
                      </Badge>

                      {/* Badge de Sinalização pelo Colaborador (Etapa 1) */}
                      {(() => {
                        const sinalizacaoEtapa1 = onboarding.fases_sinalizadas?.find(
                          (s) => s.fase_id === 'etapa1' || (s.etapa === 1 && !s.fase_id),
                        )
                        if (!sinalizacaoEtapa1) return null
                        return (
                          <span
                            className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs"
                            title={`O colaborador sinalizou que finalizou os materiais da Etapa 1 em ${formatDate(sinalizacaoEtapa1.sinalizado_em)}`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-amber-700" />
                            Sinalizado pelo colaborador em{' '}
                            {formatDate(sinalizacaoEtapa1.sinalizado_em)}
                          </span>
                        )
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Conduzida e validada pelo setor de RH • Integração institucional
                    </p>
                  </div>
                </div>

                {onboarding.etapa1_concluida ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold">
                    Concluída em {formatShortDate(onboarding.data_conclusao_etapa1)}
                  </Badge>
                ) : (
                  <Badge className="bg-brand-50 text-brand-700 hover:bg-brand-50 text-xs font-semibold">
                    Em andamento
                  </Badge>
                )}
              </div>

              {/* Checklist de Integração da Etapa 1 (Entrega de Equipamentos & Apresentações) */}
              <div className="mb-6 pb-5 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                          Checklist de Integração (RH)
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            allChecklistEntregue
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          {entreguesChecklist} de {totalItensChecklist} entregues
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Entrega física de equipamentos (notebook, periféricos, headset, cartão
                        Flash) e apresentações institucionais.
                      </p>
                    </div>
                  </div>

                  {!podeGerenciarEtapa1 && (
                    <span className="text-[11px] text-gray-400 italic">
                      (Modo leitura — conferência exclusiva do RH)
                    </span>
                  )}
                </div>

                {checklistIntegracao.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-xs text-gray-400">
                    Nenhum item no checklist de integração para este colaborador.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    {checklistIntegracao.map((item) => {
                      const isMarcando = marcandoItemChecklistId === item.id
                      const isEditandoObs = editandoObsItemId === item.id

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 transition-colors ${
                            item.entregue ? 'bg-emerald-50/20' : 'bg-white hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                disabled={
                                  onboarding.etapa1_concluida || !podeGerenciarEtapa1 || isMarcando
                                }
                                onClick={() => handleToggleItemChecklistIntegracao(item)}
                                className={`mt-0.5 transition-transform shrink-0 ${
                                  podeGerenciarEtapa1 && !onboarding.etapa1_concluida
                                    ? 'hover:text-emerald-700 active:scale-95 cursor-pointer'
                                    : 'cursor-default opacity-80'
                                }`}
                                aria-label="Marcar entrega do item"
                                title={
                                  !podeGerenciarEtapa1
                                    ? 'Apenas RH ou Administrador podem marcar a entrega'
                                    : onboarding.etapa1_concluida
                                      ? 'Etapa 1 já concluída'
                                      : item.entregue
                                        ? 'Clique para desmarcar'
                                        : 'Clique para marcar como entregue'
                                }
                              >
                                {item.entregue ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-xs font-semibold ${
                                      item.entregue ? 'text-gray-900' : 'text-gray-800'
                                    }`}
                                  >
                                    {item.titulo}
                                  </span>

                                  {item.entregue ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Entregue em {formatDate(item.entregue_em)} por{' '}
                                      {item.entregue_por_nome || 'RH'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Pendente de entrega
                                    </span>
                                  )}
                                </div>

                                {/* Observação do item (visível para RH/Gestor/Admin) */}
                                {item.observacao && !isEditandoObs && (
                                  <div className="mt-1.5 text-[11px] text-gray-600 bg-gray-50 border border-gray-200/80 rounded-md p-2 flex items-start gap-1.5">
                                    <MessageSquare className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <strong className="text-gray-700">Obs interna:</strong>{' '}
                                      <span>{item.observacao}</span>
                                    </div>
                                    {podeGerenciarEtapa1 && !onboarding.etapa1_concluida && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setObsTemp(item.observacao || '')
                                          setEditandoObsItemId(item.id)
                                        }}
                                        className="text-brand-600 hover:text-brand-700 text-[10px] font-semibold ml-1 shrink-0"
                                      >
                                        Editar
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Editor inline de observação */}
                                {isEditandoObs && (
                                  <div className="mt-2 space-y-2 p-2.5 bg-gray-50 rounded-lg border border-brand-200">
                                    <label className="text-[11px] font-semibold text-gray-700 block">
                                      Observação interna para &quot;{item.titulo}&quot;:
                                    </label>
                                    <Textarea
                                      value={obsTemp}
                                      onChange={(e) => setObsTemp(e.target.value)}
                                      placeholder="Ex.: Patrimônio NT-4820, entregue com cabo HDMI e adaptador..."
                                      rows={2}
                                      className="text-xs bg-white"
                                      disabled={salvandoObs}
                                    />
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={salvandoObs}
                                        onClick={() => {
                                          setEditandoObsItemId(null)
                                          setObsTemp('')
                                        }}
                                        className="h-7 text-xs text-gray-600"
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={salvandoObs}
                                        onClick={() => handleSalvarObservacaoItemChecklist(item.id)}
                                        className="h-7 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                                      >
                                        <Save className="w-3 h-3 mr-1" />
                                        {salvandoObs ? 'Salvando...' : 'Salvar Observação'}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Botão de adicionar observação caso não exista */}
                            {!item.observacao &&
                              !isEditandoObs &&
                              podeGerenciarEtapa1 &&
                              !onboarding.etapa1_concluida && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setObsTemp('')
                                    setEditandoObsItemId(item.id)
                                  }}
                                  className="h-7 text-[11px] text-gray-500 hover:text-brand-700 shrink-0"
                                >
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Obs
                                </Button>
                              )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Ações de topo dos Materiais da Etapa 1: Adicionar item de upload */}
              {!onboarding.etapa1_concluida && (
                <div className="flex justify-between items-center mb-3 pt-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Materiais & Validações do RH
                  </span>
                  {podeGerenciarEtapa1 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddItemModal(1)}
                      className="h-8 text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      Adicionar item (upload)
                    </Button>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">
                      (Modo visualização — condução do RH)
                    </span>
                  )}
                </div>
              )}

              {/* Lista de itens da Etapa 1 */}
              <div className="divide-y divide-gray-100 mb-5">
                {tarefasEtapa1.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                    Nenhum item configurado para a Etapa 1.
                  </div>
                ) : (
                  tarefasEtapa1.map((item) => {
                    const fileUrl = tarefaService.getFileUrl(item)
                    const checked = onboarding.etapa1_concluida || item.concluida

                    return (
                      <div
                        key={item.id}
                        className="py-3 flex items-start justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            type="button"
                            disabled={onboarding.etapa1_concluida || !podeGerenciarEtapa1}
                            onClick={() => handleToggleTarefa(item)}
                            className={`mt-0.5 text-gray-400 transition-transform ${
                              podeGerenciarEtapa1 && !onboarding.etapa1_concluida
                                ? 'hover:text-brand-600 active:scale-95'
                                : 'cursor-default opacity-80'
                            }`}
                            aria-label="Marcar item"
                            title={
                              !podeGerenciarEtapa1
                                ? 'Apenas RH ou Administrador podem marcar itens da Etapa 1'
                                : undefined
                            }
                          >
                            {checked ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-300" />
                            )}
                          </button>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.tipo === 'video' ? (
                                <Video className="w-4 h-4 text-purple-600 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                              )}
                              <span
                                className={`text-sm font-semibold ${
                                  checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                }`}
                              >
                                {item.titulo}
                              </span>
                              {item.conteudo_url ? (
                                <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">
                                  Arquivo próprio
                                </span>
                              ) : item.material ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                                  Material biblioteca
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                                  Sem arquivo
                                </span>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                {item.descricao}
                              </p>
                            )}
                            {/* Estado de Confirmação do Colaborador vs. Marcação do RH */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {confirmacoes[item.id] ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Confirmado pelo colaborador em{' '}
                                  {formatDate(
                                    confirmacoes[item.id].confirmado_em ||
                                      confirmacoes[item.id].created,
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                  <Clock className="w-3 h-3" />
                                  Aguardando confirmação do colaborador
                                </span>
                              )}

                              {item.concluida_em && (
                                <span className="text-[11px] text-gray-500">
                                  • Validado RH em {formatDate(item.concluida_em)}
                                </span>
                              )}
                            </div>{' '}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openPreview({
                                titulo: item.titulo,
                                tipo: item.tipo,
                                url: fileUrl,
                              })
                            }
                            className="h-8 text-xs text-brand-600 hover:text-brand-700 shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Visualizar
                          </Button>

                          {!item.criado_automaticamente &&
                            !onboarding.etapa1_concluida &&
                            podeGerenciarEtapa1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTarefa(item.id, 1)}
                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                aria-label="Excluir item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Ação Concluir Etapa 1 */}
              {!onboarding.etapa1_concluida && (
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    {!podeGerenciarEtapa1 ? (
                      <span>
                        O Gestor acompanha esta etapa em modo leitura. A conclusão cabe ao RH ou
                        Administrador.
                      </span>
                    ) : !allChecklistEntregue ? (
                      <span className="text-amber-700 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        Checklist pendente: entregue todos os {totalItensChecklist} itens do
                        checklist de integração antes de concluir ({entreguesChecklist}/
                        {totalItensChecklist} entregues).
                      </span>
                    ) : !allEtapa1Checked ? (
                      <span>
                        Marque todos os materiais da empresa acima para liberar a conclusão.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        Todos os materiais e itens do checklist foram conferidos! O RH pode concluir
                        a etapa e repassar ao Gestor.
                      </span>
                    )}
                  </div>

                  {podeGerenciarEtapa1 ? (
                    <Button
                      onClick={handleConcluirEtapa1}
                      disabled={!allEtapa1Checked || !allChecklistEntregue || concluindoEtapa1}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
                      title={
                        !allChecklistEntregue
                          ? `Existem ${totalItensChecklist - entreguesChecklist} item(ns) pendente(s) no Checklist de Integração.`
                          : !allEtapa1Checked
                            ? 'Marque todos os materiais da Etapa 1.'
                            : 'Concluir Etapa 1 e notificar o gestor responsável'
                      }
                    >
                      {concluindoEtapa1 ? (
                        <span>Concluindo...</span>
                      ) : (
                        <span>Concluir Etapa 1 (RH)</span>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled
                      className="text-xs text-gray-400 border-gray-200"
                      title="Apenas RH ou Administrador podem concluir a Etapa 1."
                    >
                      Somente RH / Admin
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Linha conectora vertical */}
            <div className="w-0.5 h-4 bg-gray-200 mx-auto" />

            {/* ETAPA 2 — VIVÊNCIA TÉCNICA (POR SETOR) */}
            <div
              className={`bg-white rounded-xl border p-6 shadow-sm transition-all ${
                !onboarding.etapa1_concluida
                  ? 'opacity-60 bg-gray-50/50 border-gray-200'
                  : onboarding.etapa2_concluida
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-blue-200 ring-1 ring-blue-100'
              }`}
            >
              {/* Header Etapa 2 */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      !onboarding.etapa1_concluida
                        ? 'bg-gray-300 text-gray-600'
                        : onboarding.etapa2_concluida
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                    }`}
                  >
                    {!onboarding.etapa1_concluida ? (
                      <Lock className="w-4 h-4" />
                    ) : onboarding.etapa2_concluida ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      '2'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#1A2233]">
                        Etapa 2 — Vivência Técnica ({setorInfo.nome})
                      </h3>
                      {faseAtualInfo && (
                        <span className="text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Layers className="w-3 h-3 text-brand-600" />
                          {faseAtualInfo}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold bg-indigo-50/70 text-indigo-700 border-indigo-200"
                      >
                        {confirmacoesEtapa2} de {tarefasEtapa2.length} confirmados pelo colaborador
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fasesSetor.length > 0
                        ? 'Progressão estruturada por fases sequenciais obrigatórias com confirmação prática.'
                        : 'Movidesk (chamados), Passportal (documentação), shadow técnico e atuação assistida.'}
                    </p>
                  </div>
                </div>

                {!onboarding.etapa1_concluida ? (
                  <Badge variant="outline" className="text-gray-400 text-xs">
                    Bloqueada
                  </Badge>
                ) : onboarding.etapa2_concluida ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold">
                    Concluída em {formatShortDate(onboarding.data_conclusao_etapa2)}
                  </Badge>
                ) : (
                  <Badge className="bg-brand-50 text-brand-700 hover:bg-brand-50 text-xs font-semibold">
                    Liberada para atuação
                  </Badge>
                )}
              </div>

              {/* Conteúdo Etapa 2 */}
              {!onboarding.etapa1_concluida ? (
                <div className="space-y-4">
                  <div className="py-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center">
                    <Lock className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="font-semibold text-gray-600">
                      Aguarde a conclusão da Etapa 1 pelo RH
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Esta etapa será destravada automaticamente quando a integração RH for
                      finalizada.
                    </p>
                  </div>

                  {/* Painel "Clientes de Referência" visível desde a Etapa 1 em modo aguardando */}
                  <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-gray-900">
                            Clientes de Referência no Passportal (até 3)
                          </h5>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-100/60 border-amber-300 text-amber-900 font-medium"
                          >
                            Estudo Técnico
                          </Badge>
                        </div>
                        <p className="text-[11px] text-gray-600">
                          Clientes indicados pelo Gestor para o colaborador analisar topologia de
                          rede, IPs e particularidades.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/80 border border-dashed border-amber-200 rounded-lg p-2.5 text-xs text-amber-800/90 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="italic">
                        Aguardando definição dos clientes pelo gestor (disponível na Etapa 2)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Painel do Técnico Responsável pelo Acompanhamento (Topo da Etapa 2) */}
                  <div className="mb-5 p-4 rounded-xl border border-brand-200 bg-brand-50/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-800 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-900">
                              Técnico Responsável pelo Acompanhamento
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-brand-100/60 border-brand-300 text-brand-900 font-medium"
                            >
                              Ponto Focal
                            </Badge>
                          </div>
                          <p className="text-[11px] text-gray-600">
                            Técnico sênior/pleno que conduzirá a rotina e dúvidas do novo
                            colaborador na área.
                          </p>
                        </div>
                      </div>

                      {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                        <div className="shrink-0">
                          {!editandoTecnico ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTecnicoNome(onboarding.tecnico_responsavel_nome || '')
                                setTecnicoEmail(onboarding.tecnico_responsavel_email || '')
                                setEditandoTecnico(true)
                              }}
                              className="h-7 text-xs border-brand-300 text-brand-900 hover:bg-brand-100/60"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              {onboarding.tecnico_responsavel_nome
                                ? 'Alterar Técnico'
                                : 'Definir Técnico'}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={salvandoTecnico}
                                onClick={() => setEditandoTecnico(false)}
                                className="h-7 text-xs text-gray-600 hover:text-gray-900"
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                disabled={salvandoTecnico}
                                onClick={handleSalvarTecnicoResponsavel}
                                className="h-7 text-xs bg-brand-600 hover:bg-brand-700 text-white font-medium"
                              >
                                <Save className="w-3 h-3 mr-1" />
                                {salvandoTecnico ? 'Salvando...' : 'Salvar'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {editandoTecnico ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-gray-700 block">
                            Nome do Técnico Responsável *
                          </label>
                          <Input
                            placeholder="Ex.: Carlos Eduardo Santos"
                            value={tecnicoNome}
                            onChange={(e) => setTecnicoNome(e.target.value)}
                            className="h-8 text-xs bg-white border-brand-300 focus-visible:ring-brand-500"
                            disabled={salvandoTecnico}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-gray-700 block">
                            E-mail do Técnico (opcional)
                          </label>
                          <Input
                            type="email"
                            placeholder="Ex.: carlos.santos@open.com.br"
                            value={tecnicoEmail}
                            onChange={(e) => setTecnicoEmail(e.target.value)}
                            className="h-8 text-xs bg-white border-brand-300 focus-visible:ring-brand-500"
                            disabled={salvandoTecnico}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        {onboarding.tecnico_responsavel_nome ? (
                          <div className="flex items-center gap-2 bg-white border border-brand-200/90 rounded-lg px-3 py-2 shadow-2xs">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                              <UserIcon className="w-3.5 h-3.5" />
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                              <span className="font-semibold text-gray-900">
                                {onboarding.tecnico_responsavel_nome}
                              </span>
                              {onboarding.tecnico_responsavel_email && (
                                <span className="text-gray-500 flex items-center gap-1 text-[11px]">
                                  <Mail className="w-3 h-3 text-brand-600" />
                                  {onboarding.tecnico_responsavel_email}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white/80 border border-dashed border-brand-200 rounded-lg p-2.5 text-xs text-brand-900/90 flex items-center justify-between">
                            <span className="italic">
                              Nenhum técnico responsável definido ainda para este colaborador.
                            </span>
                            {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                              <button
                                type="button"
                                onClick={() => setEditandoTecnico(true)}
                                className="text-brand-700 font-semibold hover:underline text-xs shrink-0 ml-2"
                              >
                                Definir técnico agora →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações de topo da Etapa 2: Adicionar item de upload */}
                  {!onboarding.etapa2_concluida && (
                    <div className="flex justify-between items-center mb-3 pt-1">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Itens do Setor & Materiais de Apoio
                      </span>
                      {podeGerenciarEtapa2e3 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddItemModal(2)}
                          className="h-8 text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          Adicionar item (upload)
                        </Button>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">
                          {role === 'rh'
                            ? '(Etapa técnica sob condução do Gestor Responsável)'
                            : '(Apenas o Gestor Responsável ou Administrador conduzem)'}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Se a área possui Fases Técnicas Ordenadas: Exibir por Fase com Trava Sequencial */}
                  {fasesSetor.length > 0 ? (
                    <div className="space-y-5 mb-5">
                      {fasesStatusEtapa2.map((faseStatus) => {
                        const {
                          fase,
                          index,
                          itens,
                          totalItens,
                          concluidos,
                          confirmadosColab,
                          estaCompleta,
                          estaDesbloqueada,
                        } = faseStatus

                        return (
                          <div
                            key={fase.id}
                            className={`border rounded-xl overflow-hidden transition-all ${
                              !estaDesbloqueada
                                ? 'bg-gray-50/70 border-gray-200 opacity-75'
                                : estaCompleta
                                  ? 'bg-emerald-50/20 border-emerald-200'
                                  : 'bg-white border-brand-200 shadow-xs'
                            }`}
                          >
                            {/* Top Header da Fase */}
                            <div
                              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                                !estaDesbloqueada
                                  ? 'bg-gray-100/70 border-gray-200 text-gray-500'
                                  : estaCompleta
                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                    : 'bg-gradient-to-r from-brand-50/70 to-white border-brand-100 text-gray-900'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                                    !estaDesbloqueada
                                      ? 'bg-gray-300 text-gray-600'
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

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-sm">
                                      Fase {index + 1}: {fase.titulo}
                                    </h4>
                                    {!estaDesbloqueada ? (
                                      <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Bloqueada
                                      </span>
                                    ) : estaCompleta ? (
                                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Fase Concluída (
                                        {concluidos}/{totalItens})
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                        Em Andamento ({concluidos}/{totalItens} validados)
                                      </span>
                                    )}

                                    {/* Badge de Sinalização pelo Colaborador (Etapa 2) */}
                                    {(() => {
                                      const sinalizacao = onboarding.fases_sinalizadas?.find(
                                        (s) => s.fase_id === fase.id,
                                      )
                                      if (!sinalizacao) return null
                                      const isRefacaoSolicitada =
                                        sinalizacao.status_sinalizacao === 'refacao_solicitada'
                                      const count = sinalizacao.refacoes_count || 0

                                      return (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {isRefacaoSolicitada ? (
                                            <span
                                              className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs"
                                              title={`Refação solicitada por ${sinalizacao.refacao_solicitada_por || 'Gestor'}`}
                                            >
                                              <RotateCcw className="w-3 h-3 text-amber-700" />
                                              Refação Solicitada (Ciclo {count}/2)
                                            </span>
                                          ) : (
                                            <span
                                              className="text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs"
                                              title={`O colaborador sinalizou que finalizou suas atividades nesta fase em ${formatDate(sinalizacao.sinalizado_em)}`}
                                            >
                                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                              Sinalizado pelo colaborador em{' '}
                                              {formatDate(sinalizacao.sinalizado_em)}
                                            </span>
                                          )}

                                          {count > 0 && !isRefacaoSolicitada && (
                                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-300 px-2 py-0.5 rounded-full">
                                              Refações: {count}/2
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                  {fase.descricao && (
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                      {fase.descricao}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                                {/* Botão Solicitar Refação da Fase (Gestor/Admin e RH) */}
                                {!onboarding.etapa2_concluida &&
                                  (podeGerenciarEtapa2e3 || isRH) &&
                                  (() => {
                                    const sinalizacao = onboarding.fases_sinalizadas?.find(
                                      (s) => s.fase_id === fase.id,
                                    )
                                    const refacoesCount = sinalizacao?.refacoes_count || 0
                                    const atingiuLimite = refacoesCount >= 2

                                    if (atingiuLimite) {
                                      return (
                                        <Badge
                                          variant="outline"
                                          className="h-8 text-[11px] font-semibold bg-red-50 text-red-700 border-red-200 inline-flex items-center gap-1"
                                          title="Teto máximo de 2 refações já atingido para esta fase"
                                        >
                                          <AlertTriangle className="w-3 h-3 text-red-600" />
                                          Limite atingido (2/2 refações)
                                        </Badge>
                                      )
                                    }

                                    return (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAbrirSolicitarRefacao(fase)}
                                        className="h-8 text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-50 flex items-center gap-1"
                                        title={`Solicitar refação desta fase ao colaborador (Ciclo ${refacoesCount + 1}/2)`}
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Solicitar Refação</span>
                                        {refacoesCount > 0 && (
                                          <span className="text-[10px] bg-amber-200/70 text-amber-950 px-1.5 py-0.2 rounded-full font-bold">
                                            {refacoesCount}/2
                                          </span>
                                        )}
                                      </Button>
                                    )
                                  })()}

                                {/* Botão de Concluir Fase Uniforme */}
                                {!onboarding.etapa2_concluida && (
                                  <>
                                    {faseStatus.registroConclusao ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Fase Concluída
                                        </span>
                                        {faseStatus.registroConclusao.destaque_prazo && (
                                          <span
                                            className={`text-[10px] mt-0.5 font-semibold ${
                                              faseStatus.registroConclusao.fora_prazo
                                                ? 'text-red-600'
                                                : 'text-emerald-700'
                                            }`}
                                          >
                                            {faseStatus.registroConclusao.destaque_prazo}
                                          </span>
                                        )}
                                      </div>
                                    ) : podeGerenciarEtapa2e3 ? (
                                      <Button
                                        size="sm"
                                        disabled={
                                          !faseStatus.podeConcluirFase ||
                                          concluindoFaseId === fase.id
                                        }
                                        onClick={() => handleConcluirFase(fase, index)}
                                        className={`h-8 text-xs font-semibold shadow-xs ${
                                          faseStatus.podeConcluirFase
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                        }`}
                                        title={
                                          !faseStatus.estaDesbloqueada
                                            ? 'Conclua a fase anterior primeiro'
                                            : !faseStatus.podeConcluirFaseMotivo
                                              ? 'Concluir esta fase e liberar a próxima'
                                              : faseStatus.podeConcluirFaseMotivo === 'bloqueada'
                                                ? 'Conclua a fase anterior primeiro'
                                                : faseStatus.podeConcluirFaseMotivo ===
                                                    'itens_pendentes'
                                                  ? 'O colaborador ainda não confirmou todos os materiais desta fase'
                                                  : faseStatus.podeConcluirFaseMotivo ===
                                                      'refacao_pendente'
                                                    ? 'Refação solicitada: aguardando novo relato do colaborador'
                                                    : 'Aguardando o colaborador sinalizar a conclusão da fase e enviar o relato dissertativo'
                                        }
                                      >
                                        {concluindoFaseId === fase.id ? (
                                          'Concluindo...'
                                        ) : (
                                          <>
                                            <CheckSquare className="w-3.5 h-3.5 mr-1" />
                                            Concluir Fase
                                          </>
                                        )}
                                      </Button>
                                    ) : (
                                      <span
                                        className="text-[11px] text-gray-400 italic px-2 py-1 bg-gray-50 rounded border border-gray-200"
                                        title="Apenas o Gestor Responsável ou Administrador podem concluir a fase"
                                      >
                                        Conclusão restrita ao gestor
                                      </span>
                                    )}
                                  </>
                                )}

                                {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAddItemModal(2, fase.id)}
                                    className="h-8 text-xs border-brand-200 text-brand-700 hover:bg-brand-50"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Item
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Exibição do Relato Dissertativo da Fase e Histórico de Refações */}
                            {(() => {
                              const sinalizacao = onboarding.fases_sinalizadas?.find(
                                (s) => s.fase_id === fase.id,
                              )
                              if (!sinalizacao) return null

                              const temRelato = Boolean(
                                sinalizacao.relato && sinalizacao.relato.trim(),
                              )
                              const historico = sinalizacao.historico_refacoes || []

                              return (
                                <div className="p-3.5 border-b bg-purple-50/30 border-purple-200/70 space-y-2.5 text-xs">
                                  {temRelato ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-900">
                                        <span className="flex items-center gap-1.5">
                                          <MessageSquare className="w-3.5 h-3.5 text-purple-700" />
                                          Relato de Aprendizado do Colaborador:
                                        </span>
                                        <span className="text-[10px] font-normal text-purple-700 lowercase">
                                          enviado em {formatDate(sinalizacao.sinalizado_em)}
                                        </span>
                                      </div>
                                      <div className="p-3 rounded-lg bg-white border border-purple-200 text-slate-800 leading-relaxed font-sans shadow-2xs whitespace-pre-wrap">
                                        {sinalizacao.relato}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-purple-800 italic flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span>
                                        {sinalizacao.status_sinalizacao === 'refacao_solicitada'
                                          ? 'Aguardando o colaborador reenviar novo relato após praticar a refação.'
                                          : 'Nenhum relato dissertativo associado a este sinal.'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Histórico de Refações desta Fase */}
                                  {historico.length > 0 && (
                                    <div className="space-y-1.5 pt-1 border-t border-purple-200/60">
                                      <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <RotateCcw className="w-3 h-3 text-amber-700" />
                                        Histórico de Refações Solicitadas ({historico.length}/2):
                                      </span>
                                      <div className="space-y-1.5">
                                        {historico.map((h, hIdx) => (
                                          <div
                                            key={hIdx}
                                            className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] space-y-1 text-amber-950"
                                          >
                                            <div className="flex items-center justify-between font-semibold">
                                              <span>
                                                Ciclo {h.ciclo} — Solicitado por {h.solicitado_por}{' '}
                                                ({h.solicitado_por_role || 'gestor'})
                                              </span>
                                              <span className="text-[10px] text-amber-800 font-normal">
                                                {formatDate(h.solicitado_em)}
                                              </span>
                                            </div>
                                            <p className="italic text-slate-800">
                                              <strong>Justificativa:</strong> "{h.motivo}"
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Destaque explícito de prazo se a fase estiver concluída */}
                            {faseStatus.registroConclusao && (
                              <div
                                className={`px-4 py-2 border-b text-xs flex items-center justify-between ${
                                  faseStatus.registroConclusao.fora_prazo
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-emerald-50/70 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    {faseStatus.registroConclusao.destaque_prazo ||
                                      'Concluída no prazo'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-500">
                                  Responsável:{' '}
                                  <strong>
                                    {faseStatus.registroConclusao.concluida_por_nome || 'Gestão TI'}
                                  </strong>{' '}
                                  em {formatDate(faseStatus.registroConclusao.concluida_em)}
                                </span>
                              </div>
                            )}

                            {/* Campo de Clientes de Referência exclusivo da Fase 2 (Mapeamento de Ambientes) */}
                            {(index === 1 ||
                              fase.ordem === 2 ||
                              fase.titulo.toLowerCase().includes('mapeamento')) && (
                              <div className="p-4 border-b bg-amber-50/40 border-amber-200/70 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                                      <Building2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                        Clientes de Referência no Passportal (até 3)
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] bg-amber-100/60 border-amber-300 text-amber-900 font-medium"
                                        >
                                          Estudo Técnico
                                        </Badge>
                                      </h5>
                                      <p className="text-[11px] text-gray-600">
                                        Clientes indicados pelo Gestor para o colaborador analisar
                                        topologia de rede, IPs e particularidades.
                                      </p>
                                    </div>
                                  </div>

                                  {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                                    <div className="shrink-0">
                                      {!editandoClientes ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setCliente1(onboarding.clientes_mapeamento?.[0] || '')
                                            setCliente2(onboarding.clientes_mapeamento?.[1] || '')
                                            setCliente3(onboarding.clientes_mapeamento?.[2] || '')
                                            setEditandoClientes(true)
                                          }}
                                          className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100/60"
                                        >
                                          <Pencil className="w-3 h-3 mr-1" />
                                          {onboarding.clientes_mapeamento &&
                                          onboarding.clientes_mapeamento.length > 0
                                            ? 'Editar Clientes'
                                            : 'Indicar Clientes'}
                                        </Button>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={salvandoClientes}
                                            onClick={() => setEditandoClientes(false)}
                                            className="h-7 text-xs text-gray-600 hover:text-gray-900"
                                          >
                                            Cancelar
                                          </Button>
                                          <Button
                                            size="sm"
                                            disabled={salvandoClientes}
                                            onClick={handleSalvarClientesMapeamento}
                                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                          >
                                            <Save className="w-3 h-3 mr-1" />
                                            {salvandoClientes ? 'Salvando...' : 'Salvar'}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {editandoClientes ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-semibold text-gray-700 block">
                                        Cliente 1
                                      </label>
                                      <Input
                                        placeholder="Ex.: Hospital São Lucas"
                                        value={cliente1}
                                        onChange={(e) => setCliente1(e.target.value)}
                                        className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                                        disabled={salvandoClientes}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-semibold text-gray-700 block">
                                        Cliente 2
                                      </label>
                                      <Input
                                        placeholder="Ex.: Indústria Alfa Metal"
                                        value={cliente2}
                                        onChange={(e) => setCliente2(e.target.value)}
                                        className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                                        disabled={salvandoClientes}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-semibold text-gray-700 block">
                                        Cliente 3
                                      </label>
                                      <Input
                                        placeholder="Ex.: Distribuidora Central"
                                        value={cliente3}
                                        onChange={(e) => setCliente3(e.target.value)}
                                        className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                                        disabled={salvandoClientes}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {onboarding.clientes_mapeamento &&
                                    onboarding.clientes_mapeamento.filter(Boolean).length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                                        {onboarding.clientes_mapeamento
                                          .filter(Boolean)
                                          .map((cliente, idx) => (
                                            <div
                                              key={idx}
                                              className="bg-white border border-amber-200/90 rounded-lg px-3 py-2 flex items-center gap-2 shadow-2xs"
                                            >
                                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                              </span>
                                              <span
                                                className="text-xs font-semibold text-gray-800 truncate"
                                                title={cliente}
                                              >
                                                {cliente}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    ) : (
                                      <div className="bg-white/80 border border-dashed border-amber-200 rounded-lg p-2.5 text-xs text-amber-800/90 flex items-center justify-between">
                                        <span className="italic">
                                          Nenhum cliente indicado ainda pelo Gestor Responsável.
                                        </span>
                                        {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                                          <button
                                            type="button"
                                            onClick={() => setEditandoClientes(true)}
                                            className="text-amber-800 font-semibold hover:underline text-xs shrink-0 ml-2"
                                          >
                                            Definir 3 clientes agora →
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Mensagem quando bloqueada */}
                            {!estaDesbloqueada ? (
                              <div className="p-4 bg-gray-50/60 flex items-center gap-2 text-xs text-gray-500 italic">
                                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                                <span>
                                  Conclua a fase anterior para liberar esta etapa de vivência
                                  técnica.
                                </span>
                              </div>
                            ) : (
                              /* Lista de itens da fase */
                              <div className="divide-y divide-gray-100 bg-white">
                                {itens.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50/50 space-y-1">
                                    <p className="font-medium text-slate-700">
                                      Fase de Vivência Prática / Operacional
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      Esta fase não possui materiais/tarefas obrigatórias
                                      cadastradas. O colaborador vivencia as atividades e envia o
                                      relato dissertativo no portal para validação do gestor.
                                    </p>
                                    {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => openAddItemModal(2, fase.id)}
                                          className="text-brand-600 font-semibold hover:underline text-xs"
                                        >
                                          + Adicionar material/tarefa opcional
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  itens.map((tarefa) => {
                                    const fileUrl = tarefaService.getFileUrl(tarefa)

                                    return (
                                      <div
                                        key={tarefa.id}
                                        className="py-3 px-4 flex items-start justify-between gap-3 group hover:bg-gray-50/60 transition-colors"
                                      >
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <button
                                            type="button"
                                            disabled={
                                              onboarding.etapa2_concluida || !podeGerenciarEtapa2e3
                                            }
                                            onClick={() => handleToggleTarefa(tarefa)}
                                            className={`mt-0.5 text-gray-400 transition-transform ${
                                              podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida
                                                ? 'hover:text-brand-600 active:scale-95'
                                                : 'cursor-default opacity-80'
                                            }`}
                                            aria-label="Marcar tarefa"
                                          >
                                            {tarefa.concluida ? (
                                              <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                                            ) : (
                                              <Square className="w-5 h-5 text-gray-300" />
                                            )}
                                          </button>

                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {tarefa.tipo === 'video' ? (
                                                <Video className="w-4 h-4 text-purple-600 shrink-0" />
                                              ) : (
                                                <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                                              )}
                                              <span
                                                className={`text-sm font-semibold truncate ${
                                                  tarefa.concluida
                                                    ? 'text-gray-500 line-through'
                                                    : 'text-gray-800'
                                                }`}
                                              >
                                                {tarefa.titulo}
                                              </span>
                                              {tarefa.conteudo_url ? (
                                                <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">
                                                  Arquivo próprio
                                                </span>
                                              ) : tarefa.material ? (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                                                  Material biblioteca
                                                </span>
                                              ) : null}
                                            </div>

                                            {tarefa.descricao && (
                                              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                                {tarefa.descricao}
                                              </p>
                                            )}

                                            {/* Confirmação do Colaborador na Etapa 2 */}
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                              {confirmacoes[tarefa.id] ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                  Confirmado pelo colaborador em{' '}
                                                  {formatDate(
                                                    confirmacoes[tarefa.id].confirmado_em ||
                                                      confirmacoes[tarefa.id].created,
                                                  )}
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                                  <Clock className="w-3 h-3" />
                                                  Aguardando confirmação do colaborador
                                                </span>
                                              )}

                                              {tarefa.concluida_em && (
                                                <span className="text-[11px] text-gray-500">
                                                  • Validado Gestão em{' '}
                                                  {formatDate(tarefa.concluida_em)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              openPreview({
                                                titulo: tarefa.titulo,
                                                tipo: tarefa.tipo,
                                                url: fileUrl,
                                              })
                                            }
                                            className="h-8 text-xs text-brand-600 hover:text-brand-700"
                                          >
                                            <Eye className="w-3.5 h-3.5 mr-1" />
                                            Visualizar
                                          </Button>

                                          {!tarefa.criado_automaticamente &&
                                            !onboarding.etapa2_concluida &&
                                            podeGerenciarEtapa2e3 && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteTarefa(tarefa.id, 2)}
                                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                aria-label="Excluir tarefa"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            )}
                                        </div>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Itens sem Fase vinculada (Atividades Gerais da Área Técnica) */}
                      {tarefasEtapa2SemFase.length > 0 && (
                        <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden bg-slate-50/50">
                          <div className="p-3.5 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-xs text-gray-700">
                                Atividades Gerais / Outros Itens
                              </h4>
                              <p className="text-[11px] text-gray-500">
                                Itens complementares executados em paralelo com as fases
                              </p>
                            </div>
                          </div>

                          <div className="divide-y divide-gray-100 bg-white">
                            {tarefasEtapa2SemFase.map((tarefa) => {
                              const fileUrl = tarefaService.getFileUrl(tarefa)

                              return (
                                <div
                                  key={tarefa.id}
                                  className="py-3 px-4 flex items-start justify-between gap-3 group hover:bg-gray-50/60 transition-colors"
                                >
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <button
                                      type="button"
                                      disabled={
                                        onboarding.etapa2_concluida || !podeGerenciarEtapa2e3
                                      }
                                      onClick={() => handleToggleTarefa(tarefa)}
                                      className={`mt-0.5 text-gray-400 transition-transform ${
                                        podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida
                                          ? 'hover:text-brand-600 active:scale-95'
                                          : 'cursor-default opacity-80'
                                      }`}
                                    >
                                      {tarefa.concluida ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-300" />
                                      )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {tarefa.tipo === 'video' ? (
                                          <Video className="w-4 h-4 text-purple-600 shrink-0" />
                                        ) : (
                                          <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                                        )}
                                        <span
                                          className={`text-sm font-semibold truncate ${
                                            tarefa.concluida
                                              ? 'text-gray-500 line-through'
                                              : 'text-gray-800'
                                          }`}
                                        >
                                          {tarefa.titulo}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {confirmacoes[tarefa.id] ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            Confirmado pelo colaborador em{' '}
                                            {formatDate(
                                              confirmacoes[tarefa.id].confirmado_em ||
                                                confirmacoes[tarefa.id].created,
                                            )}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                            <Clock className="w-3 h-3" />
                                            Aguardando confirmação do colaborador
                                          </span>
                                        )}

                                        {tarefa.concluida_em && (
                                          <span className="text-[11px] text-gray-500">
                                            • Validado Gestão em {formatDate(tarefa.concluida_em)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        openPreview({
                                          titulo: tarefa.titulo,
                                          tipo: tarefa.tipo,
                                          url: fileUrl,
                                        })
                                      }
                                      className="h-8 text-xs text-brand-600 hover:text-brand-700"
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-1" />
                                      Visualizar
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Modo plano para áreas sem fases (ex: RH, Comercial, Laboratório) */
                    <div className="divide-y divide-gray-100 mb-5">
                      {tarefasEtapa2.length === 0 ? (
                        <div className="py-6 text-center text-gray-400 text-xs">
                          Nenhum item adicionado para este setor.
                        </div>
                      ) : (
                        tarefasEtapa2.map((tarefa) => {
                          const fileUrl = tarefaService.getFileUrl(tarefa)

                          return (
                            <div
                              key={tarefa.id}
                              className="py-3 flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <button
                                  type="button"
                                  disabled={onboarding.etapa2_concluida || !podeGerenciarEtapa2e3}
                                  onClick={() => handleToggleTarefa(tarefa)}
                                  className={`mt-0.5 text-gray-400 transition-transform ${
                                    podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida
                                      ? 'hover:text-brand-600 active:scale-95'
                                      : 'cursor-default opacity-80'
                                  }`}
                                  aria-label="Marcar tarefa"
                                >
                                  {tarefa.concluida ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-300" />
                                  )}
                                </button>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {tarefa.tipo === 'video' ? (
                                      <Video className="w-4 h-4 text-purple-600 shrink-0" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                                    )}
                                    <span
                                      className={`text-sm font-semibold ${
                                        tarefa.concluida
                                          ? 'text-gray-500 line-through'
                                          : 'text-gray-800'
                                      }`}
                                    >
                                      {tarefa.titulo}
                                    </span>
                                    {tarefa.conteudo_url ? (
                                      <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">
                                        Arquivo próprio
                                      </span>
                                    ) : tarefa.material ? (
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                                        Material biblioteca
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {confirmacoes[tarefa.id] ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Confirmado pelo colaborador em{' '}
                                        {formatDate(
                                          confirmacoes[tarefa.id].confirmado_em ||
                                            confirmacoes[tarefa.id].created,
                                        )}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                        <Clock className="w-3 h-3" />
                                        Aguardando confirmação do colaborador
                                      </span>
                                    )}

                                    {tarefa.concluida_em && (
                                      <span className="text-[11px] text-gray-500">
                                        • Validado Gestão em {formatDate(tarefa.concluida_em)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    openPreview({
                                      titulo: tarefa.titulo,
                                      tipo: tarefa.tipo,
                                      url: fileUrl,
                                    })
                                  }
                                  className="h-8 text-xs text-brand-600 hover:text-brand-700"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Visualizar
                                </Button>

                                {!tarefa.criado_automaticamente &&
                                  !onboarding.etapa2_concluida &&
                                  podeGerenciarEtapa2e3 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteTarefa(tarefa.id, 2)}
                                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                                      aria-label="Excluir tarefa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* Concluir Etapa 2 */}
                  {!onboarding.etapa2_concluida && (
                    <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">
                        {!podeGerenciarEtapa2e3
                          ? role === 'rh'
                            ? 'A Etapa 2 é conduzida pelo Gestor Responsável.'
                            : 'Apenas o Gestor Responsável atribuído ou o Administrador concluem a Etapa 2.'
                          : allEtapa2TarefasChecked
                            ? 'Todas as tarefas técnicas concluídas! Liberado para finalizar etapa 2.'
                            : 'Marque todas as tarefas técnicas para liberar a avaliação do gestor.'}
                      </span>

                      {podeGerenciarEtapa2e3 ? (
                        <Button
                          onClick={handleConcluirEtapa2}
                          disabled={!allEtapa2TarefasChecked || concluindoEtapa2}
                          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
                        >
                          {concluindoEtapa2 ? (
                            <span>Concluindo...</span>
                          ) : (
                            <span>Concluir Etapa 2 (Vivência Técnica)</span>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled
                          className="text-xs text-gray-400 border-gray-200"
                          title="Apenas o Gestor Responsável ou Administrador podem concluir a Etapa 2."
                        >
                          Somente Gestor / Admin
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Linha conectora vertical */}
            <div className="w-0.5 h-4 bg-gray-200 mx-auto" />

            {/* ETAPA 3 — AVALIAÇÃO DO GESTOR */}
            <div
              className={`bg-white rounded-xl border p-6 shadow-sm transition-all ${
                !onboarding.etapa2_concluida
                  ? 'opacity-60 bg-gray-50/50 border-gray-200'
                  : onboarding.etapa3_concluida
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-amber-200 ring-1 ring-amber-100'
              }`}
            >
              {/* Header Etapa 3 */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      !onboarding.etapa2_concluida
                        ? 'bg-gray-300 text-gray-600'
                        : onboarding.etapa3_concluida
                          ? onboarding.status === 'concluido'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-amber-600 text-white'
                    }`}
                  >
                    {!onboarding.etapa2_concluida ? (
                      <Lock className="w-4 h-4" />
                    ) : onboarding.etapa3_concluida ? (
                      onboarding.status === 'concluido' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )
                    ) : (
                      '3'
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1A2233]">
                      Etapa 3 — Avaliação Final do Gestor
                    </h3>
                    <p className="text-xs text-gray-500">
                      Reunião avaliativa de liberação para suporte 100% autônomo
                    </p>
                  </div>
                </div>

                {!onboarding.etapa2_concluida ? (
                  <Badge variant="outline" className="text-gray-400 text-xs">
                    Bloqueada
                  </Badge>
                ) : onboarding.etapa3_concluida ? (
                  <Badge
                    className={
                      onboarding.status === 'concluido'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {onboarding.status === 'concluido' ? 'Aprovado (Apto)' : 'Reprovado (Não Apto)'}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 text-xs font-semibold">
                    Aguardando Decisão do Gestor
                  </Badge>
                )}
              </div>

              {/* PAINEL DO TESTE DE CONHECIMENTO (INSUMO DA ETAPA 3) */}
              {onboarding.etapa2_concluida && (
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {onboarding.expand?.questionario_id?.nome ||
                            'Teste de Conhecimento Técnico'}
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            Régua: {onboarding.expand?.questionario_id?.percentual_aprovacao || 95}%
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          {onboarding.expand?.questionario_id?.descricao ||
                            'Questões de atendimento, suporte técnico e boas práticas aplicadas ao colaborador'}
                        </p>
                      </div>
                    </div>

                    {tentativasTeste.length > 0 && (
                      <div className="flex items-center gap-2">
                        {tentativasTeste[0].aprovado ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs">
                            Aprovado no Teste ({tentativasTeste[0].acertos}/
                            {tentativasTeste[0].total_questoes} — {tentativasTeste[0].percentual}%)
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 font-bold text-xs">
                            Reprovado no Teste ({tentativasTeste[0].acertos}/
                            {tentativasTeste[0].total_questoes} — {tentativasTeste[0].percentual}%)
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {tentativasTeste.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-500 bg-white rounded-lg border border-dashed border-slate-200 space-y-1">
                      <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="font-semibold text-slate-700">
                        Aguardando envio do teste pelo colaborador
                      </p>
                      <p className="text-[11px] text-slate-400">
                        O teste de conhecimento já está liberado no portal público. Assim que o
                        colaborador responder, o resultado será exibido aqui como insumo da
                        avaliação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Destaque para reprovação */}
                      {!tentativasTeste[0].aprovado && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-red-900 flex items-center gap-1.5 uppercase tracking-wide">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              Colaborador Reprovado no Teste de Conhecimento
                            </span>
                            <p className="text-xs text-red-800 leading-relaxed">
                              O aproveitamento ({tentativasTeste[0].percentual}%) ficou abaixo da
                              régua de 95% (mínimo de 19 acertos). Como Gestor, você pode decidir
                              entre liberar uma nova tentativa (reteste) ou registrar a avaliação
                              final como Não Apto.
                            </p>
                          </div>

                          {podeGerenciarEtapa2e3 && !onboarding.etapa3_concluida && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setModalRetesteOpen(true)}
                                className="h-9 text-xs font-semibold bg-white text-brand-700 border-brand-300 hover:bg-brand-50"
                              >
                                Liberar Reteste
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setDecisaoAvaliacao('nao_apto')
                                  if (!faseRetornoId && fasesSetor.length > 0) {
                                    setFaseRetornoId(fasesSetor[0].id)
                                  }
                                  const el = document.getElementById('secaoDecisaoGestor')
                                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                                }}
                                className="h-9 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                              >
                                Registrar Não Apto
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tabela de histórico de tentativas */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>Histórico de Tentativas</span>
                          <span>Total: {tentativasTeste.length}</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {tentativasTeste.map((tent) => (
                            <div
                              key={tent.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">
                                    Tentativa #{tent.tentativa_numero}
                                  </span>
                                  <Badge
                                    className={
                                      tent.aprovado
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                        : 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                                    }
                                  >
                                    {tent.aprovado ? 'Aprovado' : 'Reprovado'}
                                  </Badge>
                                  {tent.reteste_liberado && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      Reteste concedido
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Submetido em:{' '}
                                  {formatDateTime(tent.data_submissao || tent.created)}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <div className="font-bold text-slate-900">
                                    {tent.acertos} de {tent.total_questoes} ({tent.percentual}%)
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {tent.aprovado ? '≥ 95% atingido' : '< 95% insuficiente'}
                                  </div>
                                </div>

                                {/* ADMIN: Botão para ver gabarito e mapa completo */}
                                {isAdmin && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setTentativaSelecionadaAdmin(tent)
                                      setModalGabaritoAdminOpen(true)
                                    }}
                                    className="h-8 text-[11px] text-brand-700 border-brand-200 hover:bg-brand-50"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    Ver Gabarito
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conteúdo Etapa 3 */}
              {!onboarding.etapa2_concluida ? (
                <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center">
                  <Lock className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-semibold text-gray-600">
                    Aguarde a conclusão das etapas anteriores
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    A avaliação só fica disponível após o término integral da vivência técnica.
                  </p>
                </div>
              ) : onboarding.etapa3_concluida && avaliacao ? (
                /* Resultado já gravado */
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Decisão Registrada
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(avaliacao.created)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {avaliacao.decisao === 'apto' ? (
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-base bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Colaborador APTO para atendimento solo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 font-bold text-base bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span>Colaborador NÃO APTO</span>
                      </div>
                    )}
                  </div>

                  {avaliacao.observacoes && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs font-semibold text-gray-700 block mb-1">
                        Parecer do Gestor:
                      </span>
                      <p className="text-xs text-gray-600 italic bg-white p-2.5 rounded border border-gray-200">
                        "{avaliacao.observacoes}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Formulário de Avaliação (Gestão tem permissão de escrita; RH vê modo leitura) */
                <div className="space-y-4 pt-2">
                  <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <strong>Instrução ao Gestor:</strong> O analista realizou todo o treinamento de
                    Movidesk, Passportal e acompanhou chamados com a equipe. Defina se o colaborador
                    está 100% apto a assumir chamados sozinho.
                  </div>

                  {!podeGerenciarEtapa2e3 ? (
                    <div className="p-4 rounded-lg bg-gray-100 text-xs text-gray-600 text-center space-y-1">
                      <p className="font-semibold text-gray-700">Visualização em modo de leitura</p>
                      <p className="text-[11px] text-gray-500">
                        {role === 'rh'
                          ? 'O perfil de RH não realiza a avaliação. A decisão final cabe exclusivamente ao Gestor de TI Responsável ou Administrador.'
                          : 'Apenas o Gestor Responsável atribuído a este onboarding ou o Administrador podem registrar a decisão final.'}
                      </p>
                    </div>
                  ) : (
                    <div id="secaoDecisaoGestor" className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                          Decisão Obrigatória *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setDecisaoAvaliacao('apto')}
                            className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                              decisaoAvaliacao === 'apto'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm scale-[1.01]'
                                : 'border-gray-200 hover:border-emerald-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-5 h-5 ${
                                decisaoAvaliacao === 'apto' ? 'text-emerald-600' : 'text-gray-400'
                              }`}
                            />
                            <span>Apto (Liberar Suporte)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDecisaoAvaliacao('nao_apto')
                              if (!faseRetornoId && fasesSetor.length > 0) {
                                setFaseRetornoId(fasesSetor[0].id)
                              }
                            }}
                            className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                              decisaoAvaliacao === 'nao_apto'
                                ? 'border-red-600 bg-red-50 text-red-800 shadow-sm scale-[1.01]'
                                : 'border-gray-200 hover:border-red-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <XCircle
                              className={`w-5 h-5 ${
                                decisaoAvaliacao === 'nao_apto' ? 'text-red-600' : 'text-gray-400'
                              }`}
                            />
                            <span>Não Apto</span>
                          </button>
                        </div>
                      </div>

                      {/* Bloco condicional do fluxo Não Apto: Retorno à fase e prazo suplementar */}
                      {decisaoAvaliacao === 'nao_apto' && (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3.5 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              Ajuste de Acompanhamento / Reavaliação
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                              Reavaliações realizadas: {onboarding.reavaliacoes_count || 0} de 2
                              permitidas
                            </span>
                          </div>

                          {(onboarding.reavaliacoes_count || 0) >= 2 ? (
                            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-900 space-y-1">
                              <p className="font-bold flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 text-red-700" />
                                Teto de 2 reavaliações atingido!
                              </p>
                              <p className="text-[11px]">
                                O colaborador já passou por 2 ciclos de reavaliação. Ao confirmar, o
                                status será definido como <strong>Não apto definitivo</strong> e o
                                processo será encerrado.
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                Ao marcar <strong>Não apto</strong>, o status do onboarding mudará
                                para <strong>Em acompanhamento (âmbar)</strong>. Selecione a fase
                                técnica para a qual o colaborador deve retornar e os dias
                                suplementares.
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Fase de Retorno *
                                  </label>
                                  <select
                                    value={faseRetornoId}
                                    onChange={(e) => setFaseRetornoId(e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                                    disabled={naoAptoDefinitivo}
                                  >
                                    {fasesSetor.length > 0 ? (
                                      fasesSetor.map((f, idx) => (
                                        <option key={f.id} value={f.id}>
                                          Fase {idx + 1}: {f.titulo} ({f.dias_previstos || 2}d)
                                        </option>
                                      ))
                                    ) : (
                                      <option value="">Nenhuma fase cadastrada no setor</option>
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Prazo Suplementar (dias) *
                                  </label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={prazoSuplementarDias}
                                    onChange={(e) =>
                                      setPrazoSuplementarDias(
                                        Math.max(1, Number(e.target.value) || 1),
                                      )
                                    }
                                    className="h-9 text-xs bg-white border-gray-300"
                                    disabled={naoAptoDefinitivo}
                                  />
                                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                                    Padrão: 5 dias adicionais à data final.
                                  </span>
                                </div>
                              </div>

                              {/* Opção para reprovação definitiva antes do teto */}
                              <div className="pt-2 border-t border-red-200/60 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="chkDefinitivo"
                                  checked={naoAptoDefinitivo}
                                  onChange={(e) => setNaoAptoDefinitivo(e.target.checked)}
                                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                <label
                                  htmlFor="chkDefinitivo"
                                  className="text-xs text-red-800 font-medium cursor-pointer"
                                >
                                  Encerrar imediatamente como "Não Apto Definitivo" (sem ciclo
                                  suplementar)
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                          Observações do Gestor (Opcional)
                        </label>
                        <Textarea
                          rows={3}
                          placeholder="Ex.: Colaborador demonstrou bom domínio em roteamento, boa comunicação e postura com o cliente..."
                          value={observacoesAvaliacao}
                          onChange={(e) => setObservacoesAvaliacao(e.target.value)}
                          className="text-xs border-gray-300 resize-none"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleRegistrarAvaliacao}
                          disabled={!decisaoAvaliacao || salvandoAvaliacao}
                          className={`h-11 px-6 font-semibold rounded-lg shadow-sm ${
                            decisaoAvaliacao === 'apto'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : decisaoAvaliacao === 'nao_apto'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-brand-600 hover:bg-brand-700 text-white'
                          }`}
                        >
                          {salvandoAvaliacao ? 'Registrando Decisão...' : 'Registrar Decisão Final'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Linha do Tempo / Timeline Lateral do Onboarding Vigente */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
              <h3 className="text-sm font-bold text-[#1A2233] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Linha do Tempo do Onboarding</span>
              </h3>

              <div className="relative pl-6 space-y-6 border-l-2 border-gray-200 my-2">
                {/* Evento 1: Criação */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-brand-600 border-2 border-white" />
                  <span className="text-xs font-bold text-gray-800 block">Onboarding Iniciado</span>
                  <span className="text-[11px] text-gray-500 block">
                    {formatDate(onboarding.created)}
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                    Prazo de 15 dias calculado.
                  </span>
                </div>

                {/* Evento 2: Etapa 1 */}
                <div className="relative">
                  <div
                    className={`absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      onboarding.etapa1_concluida ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-gray-800 block">Etapa 1 (RH)</span>
                  {onboarding.etapa1_concluida ? (
                    <>
                      <span className="text-[11px] text-emerald-600 font-semibold block">
                        Concluída em {formatDate(onboarding.data_conclusao_etapa1)}
                      </span>
                      <span className="text-[11px] text-gray-400 block">
                        Validação institucional aprovada.
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 block">
                      Pendente de validação pelo RH
                    </span>
                  )}
                </div>

                {/* Evento 3: Etapa 2 */}
                <div className="relative">
                  <div
                    className={`absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      onboarding.etapa2_concluida ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-gray-800 block">
                    Etapa 2 (Vivência Técnica)
                  </span>
                  {onboarding.etapa2_concluida ? (
                    <>
                      <span className="text-[11px] text-emerald-600 font-semibold block">
                        Concluída em {formatDate(onboarding.data_conclusao_etapa2)}
                      </span>
                      <span className="text-[11px] text-gray-400 block">
                        Tarefas do setor cumpridas.
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 block">
                      {onboarding.etapa1_concluida
                        ? 'Em andamento na vivência'
                        : 'Aguardando liberação'}
                    </span>
                  )}
                </div>

                {/* Evento 4: Avaliação Final */}
                <div className="relative">
                  <div
                    className={`absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      onboarding.etapa3_concluida
                        ? onboarding.status === 'concluido'
                          ? 'bg-emerald-600'
                          : 'bg-red-600'
                        : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-gray-800 block">
                    Etapa 3 (Avaliação do Gestor)
                  </span>
                  {onboarding.etapa3_concluida ? (
                    <>
                      <span
                        className={`text-[11px] font-bold block ${
                          onboarding.status === 'concluido' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        Resultado: {onboarding.status === 'concluido' ? 'Apto' : 'Não Apto'}
                      </span>
                      <span className="text-[11px] text-gray-400 block">
                        {formatDate(onboarding.data_conclusao_etapa3)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 block">
                      Aguardando decisão do gestor
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card com Detalhes do Setor & Suporte Terceirizado */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm text-xs space-y-2.5">
              <span className="font-bold text-gray-800 block uppercase tracking-wider text-[11px]">
                Fluxo Padrão da Equipe
              </span>
              <p className="text-gray-600 leading-relaxed">
                1. O gestor atribui o chamado no Movidesk para o nome do analista.
                <br />
                2. O analista contata o cliente por telefone e executa acesso remoto via TeamViewer.
                <br />
                3. Demandas não resolvidas remotamente são direcionadas para atendimento presencial
                pela equipe de Campo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição do Colaborador (Cargo, Setor, Gestor) */}
      {onboarding && (
        <ModalEditarColaborador
          open={modalEditarOpen}
          onOpenChange={setModalEditarOpen}
          onboarding={onboarding}
          onSucesso={(atualizado) => {
            setOnboarding(atualizado)
            fetchData()
          }}
          onSugerirProvaMudancaSetor={(info) => {
            setDadosSugestao(info)
            setModalSugestaoOpen(true)
          }}
        />
      )}

      {/* Modal de Sugestão de Prova na Mudança de Setor */}
      {dadosSugestao && (
        <ModalSugestaoMudancaArea
          open={modalSugestaoOpen}
          onOpenChange={(aberto) => {
            setModalSugestaoOpen(aberto)
            if (!aberto) setDadosSugestao(null)
          }}
          onboarding={dadosSugestao.onboarding}
          setorAntigo={dadosSugestao.setorAntigo}
          setorNovo={dadosSugestao.setorNovo}
          questionarioSugerido={dadosSugestao.questionarioSugerido}
          onAvaliacaoCriada={() => {
            fetchData()
          }}
        />
      )}

      {/* Modal de Exclusão Forte em Cascata do Colaborador */}
      {onboarding && (
        <ModalExcluirColaborador
          open={modalExcluirOpen}
          onOpenChange={setModalExcluirOpen}
          colaboradorNome={onboarding.colaborador_nome}
          colaboradorEmail={onboarding.colaborador_email}
          onboardingId={onboarding.id}
          onSucesso={() => {
            navigate('/colaboradores')
          }}
        />
      )}

      {/* Modal: Adicionar Item (Etapa 1 ou Etapa 2) */}
      <Dialog open={modalItemOpen} onOpenChange={setModalItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {modalItemEtapa === 1
                ? 'Adicionar Item à Apresentação da Empresa (Etapa 1)'
                : 'Adicionar Item à Vivência Técnica (Etapa 2)'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddItemOnboarding} className="space-y-4 py-2">
            {itemError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{itemError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Título do Item *
              </label>
              <Input
                placeholder={
                  modalItemEtapa === 1
                    ? 'Ex.: Apresentação de Benefícios e Convênios'
                    : 'Ex.: Treinamento Específico de Roteador Mikrotik'
                }
                value={novoItemTitulo}
                onChange={(e) => setNovoItemTitulo(e.target.value)}
                className="h-10 text-xs"
                disabled={enviandoItem}
              />
            </div>

            {/* Se estiver adicionando na Etapa 2 e houver fases técnicas no setor */}
            {modalItemEtapa === 2 && fasesSetor.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Vincular à Fase (Opcional)
                </label>
                <select
                  value={novoItemFaseId}
                  onChange={(e) => setNovoItemFaseId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                  disabled={enviandoItem}
                >
                  <option value="">-- Sem fase (Atividades Gerais) --</option>
                  {fasesSetor.map((f, idx) => (
                    <option key={f.id} value={f.id}>
                      Fase {idx + 1}: {f.titulo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Descrição ou Instruções
              </label>
              <Textarea
                placeholder="Ex.: Visão geral dos procedimentos a serem seguidos..."
                value={novoItemDescricao}
                onChange={(e) => setNovoItemDescricao(e.target.value)}
                className="text-xs min-h-[60px]"
                disabled={enviandoItem}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tipo de Conteúdo *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={novoItemTipo === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNovoItemTipo('manual')}
                  className={
                    novoItemTipo === 'manual' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''
                  }
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Manual / Documento
                </Button>
                <Button
                  type="button"
                  variant={novoItemTipo === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNovoItemTipo('video')}
                  className={
                    novoItemTipo === 'video' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''
                  }
                >
                  <Video className="w-3.5 h-3.5 mr-1" />
                  Vídeo (MP4)
                </Button>
              </div>
            </div>

            {/* SELEÇÃO: Escolher material da biblioteca OU upload direto */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/70 space-y-2.5">
              <label className="block text-xs font-semibold text-gray-700">
                Origem do Material
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={novoItemOrigem === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNovoItemOrigem('upload')}
                  className={`text-xs h-8 ${novoItemOrigem === 'upload' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''}`}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Upload Direto
                </Button>
                <Button
                  type="button"
                  variant={novoItemOrigem === 'biblioteca' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNovoItemOrigem('biblioteca')}
                  className={`text-xs h-8 ${novoItemOrigem === 'biblioteca' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Da Biblioteca
                </Button>
              </div>

              {novoItemOrigem === 'biblioteca' ? (
                <div className="pt-1 space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-600">
                    Selecione o material da biblioteca:
                  </label>
                  <select
                    value={novoItemMaterialId}
                    onChange={(e) => handleSelectMaterialModal(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                    disabled={enviandoItem}
                  >
                    <option value="">-- Escolher material da biblioteca --</option>
                    {materiaisBiblioteca
                      .filter((m) => m.tipo === novoItemTipo)
                      .map((mat) => (
                        <option key={mat.id} value={mat.id}>
                          {mat.titulo} {mat.setor_origem ? `[${mat.setor_origem}]` : '[Geral]'}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="pt-1 space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-600">
                    Arquivo (.mp4, .pdf, .pptx, .docx — máx. 50MB):
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setNovoItemFile(file)
                    }}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    disabled={enviandoItem}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalItemOpen(false)}
                disabled={enviandoItem}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enviandoItem}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {enviandoItem ? 'Enviando...' : 'Adicionar ao Onboarding'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Liberar Reteste do Teste de Conhecimento */}
      <Dialog open={modalRetesteOpen} onOpenChange={setModalRetesteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-brand-600" />
              <span>Liberar Reteste do Teste de Conhecimento</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Ao liberar o reteste, o colaborador <strong>{onboarding?.colaborador_nome}</strong>{' '}
              poderá acessar novamente o link público e submeter uma nova tentativa de 20 questões.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Importante:</strong> Esta ação será registrada no histórico de auditoria com
              seu usuário e data/hora. A nota anterior será substituída para fins de resultado
              atual, mantendo o histórico de tentativas gravado.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa / Motivo da Liberação *
              </label>
              <Textarea
                rows={3}
                placeholder="Ex.: Realizada sessão de alinhamento sobre as normas de atendimento e procedimentos antes da reavaliação..."
                value={motivoReteste}
                onChange={(e) => setMotivoReteste(e.target.value)}
                className="text-xs border-slate-300 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalRetesteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={liberandoReteste}
              onClick={handleConfirmarLiberacaoReteste}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs"
            >
              {liberandoReteste ? 'Liberando...' : 'Confirmar e Liberar no Portal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar Refação da Fase (Gestor/Admin e RH) */}
      <Dialog open={modalRefacaoOpen} onOpenChange={setModalRefacaoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              <span>Solicitar Refação de Fase — {faseParaRefacao?.faseTitulo}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3.5 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
              <span className="font-bold block">
                Ciclo de Refação: {(faseParaRefacao?.refacoesAtuais || 0) + 1} de 2 permitidos
              </span>
              <p className="leading-relaxed text-amber-900 text-[11px]">
                Ao solicitar a refação, a fase será reaberta para o colaborador no portal público, o
                status de conclusão será cancelado e o colaborador será orientado a praticar e
                preencher um novo relato dissertativo.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Justificativa / Orientações para a Refação *
              </label>
              <Textarea
                rows={4}
                placeholder="Explique o que precisa ser revisto ou melhor executado pelo colaborador nesta fase..."
                value={motivoRefacao}
                onChange={(e) => setMotivoRefacao(e.target.value)}
                className="text-xs resize-none"
              />
              <span className="text-[11px] text-slate-500 block">
                Esta justificativa será visível para o colaborador no portal e ficará registrada
                permanentemente na auditoria do onboarding.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={solicitandoRefacao}
              onClick={() => setModalRefacaoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={solicitandoRefacao}
              onClick={handleConfirmarSolicitacaoRefacao}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {solicitandoRefacao ? 'Solicitando...' : 'Confirmar Solicitação de Refação'}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Gabarito e Mapa Completo de Respostas (Exclusivo Administrador) */}
      <Dialog open={modalGabaritoAdminOpen} onOpenChange={setModalGabaritoAdminOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <span>
                Auditoria de Gabarito — Tentativa #{tentativaSelecionadaAdmin?.tentativa_numero}{' '}
                (Admin)
              </span>
            </DialogTitle>
          </DialogHeader>

          {tentativaSelecionadaAdmin && (
            <div className="py-2 space-y-4">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-purple-950 block">
                    Colaborador: {onboarding?.colaborador_nome}
                  </span>
                  <span className="text-purple-800">
                    Data:{' '}
                    {formatDateTime(
                      tentativaSelecionadaAdmin.data_submissao || tentativaSelecionadaAdmin.created,
                    )}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-purple-950">
                    {tentativaSelecionadaAdmin.acertos}/{tentativaSelecionadaAdmin.total_questoes} (
                    {tentativaSelecionadaAdmin.percentual}%)
                  </div>
                  <Badge
                    className={
                      tentativaSelecionadaAdmin.aprovado
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {tentativaSelecionadaAdmin.aprovado ? 'Aprovado' : 'Reprovado'}
                  </Badge>
                </div>
              </div>

              {/* Detalhe de cada questão */}
              <div className="space-y-4">
                {tentativaSelecionadaAdmin.respostas_detalhe &&
                tentativaSelecionadaAdmin.respostas_detalhe.length > 0 ? (
                  tentativaSelecionadaAdmin.respostas_detalhe.map((item, idx) => {
                    const acertou = item.correta
                    const letras = ['A', 'B', 'C', 'D']
                    const letraEscolhida = letras[item.resposta_escolhida] || '-'
                    const letraCorreta =
                      item.correta_index !== undefined ? letras[item.correta_index] : '-'

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
                                    Marcada pelo Colaborador
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

                        {/* Comentário explicativo do gabarito (Admin Only) */}
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
          )}

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalGabaritoAdminOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Visualizador de Arquivo / Player */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              {previewItem?.tipo === 'video' ? (
                <Video className="w-5 h-5 text-purple-600" />
              ) : (
                <FileText className="w-5 h-5 text-brand-600" />
              )}
              <span>{previewItem?.titulo}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {previewItem?.url ? (
              previewItem.tipo === 'video' ? (
                <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <video controls className="w-full max-h-[400px]" src={previewItem.url}>
                    Seu navegador não suporta reprodução de vídeo HTML5.
                  </video>
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-gray-50 border border-gray-200 text-center space-y-4">
                  <FileCheck2 className="w-12 h-12 text-brand-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Documento disponível para leitura
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Você pode abrir o arquivo original ou fazer download para estudar.
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
                      <span>Abrir Documento</span>
                    </a>
                  </Button>
                </div>
              )
            ) : (
              <div className="p-8 rounded-lg bg-gray-50 border border-gray-200 text-center space-y-3">
                <Info className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-sm font-bold text-gray-700">
                  Conteúdo Demonstrativo do Sistema
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Este item foi provisionado pelo template base. Arquivos definitivos (.mp4, .pdf)
                  podem ser carregados pela equipe de RH ou Gestão na aba{' '}
                  <strong>Modelos de Tarefas</strong>.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewModalOpen(false)}>
              Fechar Visualização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
