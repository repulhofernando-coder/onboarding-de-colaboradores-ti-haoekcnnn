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
} from '@/types/onboarding'
import { SETORES_INFO, STATUS_INFO, getSetorVisual } from '@/types/onboarding'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function DetalheOnboarding() {
  const { id } = useParams<{ id: string }>()
  const { user, role, isAdmin, isRH } = useAuth()
  const navigate = useNavigate()

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [tarefas, setTarefas] = useState<TarefaOnboarding[]>([])
  const [fasesSetor, setFasesSetor] = useState<FaseModelo[]>([])
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmacoes, setConfirmacoes] = useState<Record<string, ConfirmacaoColaborador>>({})
  const [linkColaborador, setLinkColaborador] = useState<string>('')
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Estados de ações
  const [concluindoEtapa1, setConcluindoEtapa1] = useState(false)
  const [concluindoEtapa2, setConcluindoEtapa2] = useState(false)

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

  // Modal de Visualização de Arquivo (Player Vídeo / Visualizador Doc)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar detalhes do onboarding.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

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
    if (!onboarding) return { diasRestantes: 0, isAtrasado: false, isCritico: false }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [ano, mes, dia] = onboarding.data_fim.split('-').map(Number)
    const dataFim = new Date(ano, mes - 1, dia)
    dataFim.setHours(0, 0, 0, 0)

    const diffTime = dataFim.getTime() - hoje.getTime()
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const isFinalizado = onboarding.status === 'concluido' || onboarding.status === 'nao_apto'
    const isAtrasado = !isFinalizado && diasRestantes < 0
    const isCritico = !isFinalizado && diasRestantes <= 3

    return { diasRestantes, isAtrasado, isCritico }
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

  // Determinar status de bloqueio sequencial de cada fase na Etapa 2:
  // Fase N só está desbloqueada se todas as fases anteriores (0 .. N-1) tiverem todos os seus itens confirmados/concluídos
  const fasesStatusEtapa2 = useMemo(() => {
    if (fasesSetor.length === 0) {
      return []
    }

    let faseAnteriorCompleta = true

    return fasesSetor.map((fase, index) => {
      const itensDaFase = tarefasEtapa2.filter((t) => t.fase === fase.id)
      const totalItens = itensDaFase.length
      const concluidos = itensDaFase.filter((t) => t.concluida).length
      const confirmadosColab = itensDaFase.filter((t) => Boolean(confirmacoes[t.id])).length

      // Uma fase é considerada completa quando todos os itens estão concluídos (ou confirmados)
      const estaCompleta = totalItens > 0 && concluidos === totalItens

      const estaDesbloqueada = faseAnteriorCompleta

      // Para a próxima fase: ela só desbloqueia se esta fase estiver completa
      if (!estaCompleta && totalItens > 0) {
        faseAnteriorCompleta = false
      }

      return {
        fase,
        index,
        itens: itensDaFase,
        totalItens,
        concluidos,
        confirmadosColab,
        estaCompleta,
        estaDesbloqueada,
      }
    })
  }, [fasesSetor, tarefasEtapa2, confirmacoes])

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

  // Verificar se todas as tarefas da Etapa 1 estão marcadas
  const allEtapa1Checked = useMemo(() => {
    if (onboarding?.etapa1_concluida) return true
    if (tarefasEtapa1.length === 0) return false
    return tarefasEtapa1.every((t) => t.concluida)
  }, [onboarding?.etapa1_concluida, tarefasEtapa1])

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

  // Concluir Etapa 1
  const handleConcluirEtapa1 = async () => {
    if (!onboarding || !user) return
    if (!podeGerenciarEtapa1) {
      toast.error(
        'Você não tem permissão para esta ação. Apenas RH ou Administrador concluem a Etapa 1.',
      )
      return
    }

    try {
      setConcluindoEtapa1(true)
      await onboardingService.concluirEtapa1(onboarding.id, user.id)
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

  const allEtapa2TarefasChecked = useMemo(() => {
    if (tarefasEtapa2.length === 0) return false
    return tarefasEtapa2.every((t) => t.concluida)
  }, [tarefasEtapa2])

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

    try {
      setSalvandoAvaliacao(true)
      const res = await avaliacaoService.registrarDecisao({
        onboardingId: onboarding.id,
        avaliadorId: user.id,
        decisao: decisaoAvaliacao,
        observacoes: observacoesAvaliacao.trim(),
      })

      setAvaliacao(res.avaliacao)
      setOnboarding(res.onboarding)
      toast.success(
        decisaoAvaliacao === 'apto'
          ? 'Avaliação registrada! Colaborador marcado como Apto. Notificação por e-mail enviada para o RH e Administração.'
          : 'Avaliação registrada! Colaborador marcado como Não Apto. Notificação por e-mail enviada para o RH e Administração.',
      )
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
    const [ano, mes, dia] = ymd.split('-')
    return `${dia}/${mes}/${ano}`
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

        {prazoInfo.isAtrasado && (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-xs font-bold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            Atrasado ({Math.abs(prazoInfo.diasRestantes)} dias além do limite)
          </Badge>
        )}
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

      {/* Header do Colaborador */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
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
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span>{onboarding.colaborador_email}</span>
              {onboarding.cargo && (
                <>
                  <span>•</span>
                  <span>{onboarding.cargo}</span>
                </>
              )}
              <span>•</span>
              <span>Início: {formatShortDate(onboarding.data_inicio)}</span>
              <span>•</span>
              <span className="font-semibold text-gray-700">
                Prazo final (15 dias): {formatShortDate(onboarding.data_fim)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-gray-400 font-medium block">Gestor Responsável:</span>
            <span className="text-xs font-bold text-gray-800">
              {onboarding.expand?.gestor_id?.name || 'Gestão TI'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1.5">
            <span>Progresso Geral do Treinamento</span>
            <span>{progressoPercent}% Concluído</span>
          </div>
          <Progress value={progressoPercent} className="h-2.5 rounded-full" />
        </div>
      </div>

      {/* Layout Principal: 3 Etapas Conectadas (2 colunas) + Timeline Lateral (1 coluna) */}
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

            {/* Ações de topo da Etapa 1: Adicionar item de upload */}
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
              <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {!podeGerenciarEtapa1
                    ? 'O Gestor acompanha esta etapa em modo leitura. A conclusão cabe ao RH ou Administrador.'
                    : allEtapa1Checked
                      ? 'Todos os itens conferidos! O RH pode concluir a etapa e repassar ao Gestor.'
                      : 'Marque todos os itens acima para liberar a conclusão.'}
                </span>

                {podeGerenciarEtapa1 ? (
                  <Button
                    onClick={handleConcluirEtapa1}
                    disabled={!allEtapa1Checked || concluindoEtapa1}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
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
              <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center">
                <Lock className="w-8 h-8 text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">
                  Aguarde a conclusão da Etapa 1 pelo RH
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Esta etapa será destravada automaticamente quando a integração RH for finalizada.
                </p>
              </div>
            ) : (
              <div>
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
                                </div>
                                {fase.descricao && (
                                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                    {fase.descricao}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {podeGerenciarEtapa2e3 && !onboarding.etapa2_concluida && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAddItemModal(2, fase.id)}
                                  className="h-7 text-xs border-brand-200 text-brand-700 hover:bg-brand-50"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Item
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Mensagem quando bloqueada */}
                          {!estaDesbloqueada ? (
                            <div className="p-4 bg-gray-50/60 flex items-center gap-2 text-xs text-gray-500 italic">
                              <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                              <span>
                                Conclua a fase anterior para liberar esta etapa de vivência técnica.
                              </span>
                            </div>
                          ) : (
                            /* Lista de itens da fase */
                            <div className="divide-y divide-gray-100 bg-white">
                              {itens.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400">
                                  Nenhum item nesta fase ainda.{' '}
                                  {podeGerenciarEtapa2e3 && (
                                    <button
                                      type="button"
                                      onClick={() => openAddItemModal(2, fase.id)}
                                      className="text-brand-600 font-semibold hover:underline ml-1"
                                    >
                                      Adicionar item
                                    </button>
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
                                    disabled={onboarding.etapa2_concluida || !podeGerenciarEtapa2e3}
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
                  <div className="space-y-4">
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
                          onClick={() => setDecisaoAvaliacao('nao_apto')}
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

        {/* Linha do Tempo / Timeline Lateral */}
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
