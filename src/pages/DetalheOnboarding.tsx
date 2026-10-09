import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { onboardingService, tarefaService, avaliacaoService } from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding, TarefaOnboarding, Avaliacao, TarefaTipo } from '@/types/onboarding'
import { SETORES_INFO, STATUS_INFO } from '@/types/onboarding'
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
  const { user } = useAuth()
  const navigate = useNavigate()

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [tarefas, setTarefas] = useState<TarefaOnboarding[]>([])
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [loading, setLoading] = useState(true)

  // Estados de ações
  const [concluindoEtapa1, setConcluindoEtapa1] = useState(false)
  const [concluindoEtapa2, setConcluindoEtapa2] = useState(false)

  // Modal de Adicionar Item (Etapa 2)
  const [modalItemOpen, setModalItemOpen] = useState(false)
  const [novoItemTitulo, setNovoItemTitulo] = useState('')
  const [novoItemTipo, setNovoItemTipo] = useState<TarefaTipo>('manual')
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
      const [onb, tars, aval] = await Promise.all([
        onboardingService.getById(id),
        tarefaService.listByOnboarding(id),
        avaliacaoService.getByOnboarding(id),
      ])
      setOnboarding(onb)
      setTarefas(tars)
      setAvaliacao(aval)
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
  const itensEtapa1 = useMemo(() => {
    return [
      {
        id: 'e1-1',
        titulo: 'Apresentação Institucional & Cultura da Empresa',
        tipo: 'manual' as TarefaTipo,
        descricao:
          'Visão geral da empresa, valores, conduta ética e estrutura de comunicação interna.',
      },
      {
        id: 'e1-2',
        titulo: 'Segmentação dos 5 Setores e Fluxo de Atendimento',
        tipo: 'video' as TarefaTipo,
        descricao:
          'Explicação dos setores (Windows, Linux, Datacenter, Campo, Infra), escalonamento e transição de chamados.',
      },
      {
        id: 'e1-3',
        titulo: 'Regras de Atendimento Remoto (TeamViewer) e Telefone',
        tipo: 'manual' as TarefaTipo,
        descricao:
          'Protocolo de atendimento telefônico, identificação e boas práticas em acessos remotos aos clientes.',
      },
    ]
  }, [])

  // Estado local para checkboxes da Etapa 1 (guardado no localStorage por onboarding)
  const [etapa1Checks, setEtapa1Checks] = useState<Record<string, boolean>>(() => {
    if (!id) return {}
    try {
      const saved = localStorage.getItem(`etapa1_checks_${id}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleCheckEtapa1 = (itemId: string) => {
    if (onboarding?.etapa1_concluida) return
    const next = { ...etapa1Checks, [itemId]: !etapa1Checks[itemId] }
    setEtapa1Checks(next)
    if (id) {
      localStorage.setItem(`etapa1_checks_${id}`, JSON.stringify(next))
    }
  }

  const allEtapa1Checked = useMemo(() => {
    if (onboarding?.etapa1_concluida) return true
    return itensEtapa1.every((item) => etapa1Checks[item.id])
  }, [onboarding?.etapa1_concluida, itensEtapa1, etapa1Checks])

  // Concluir Etapa 1
  const handleConcluirEtapa1 = async () => {
    if (!onboarding || !user) return
    try {
      setConcluindoEtapa1(true)
      await onboardingService.concluirEtapa1(onboarding.id, user.id)
      toast.success('Etapa 1 concluída com sucesso pelo RH! Etapa 2 liberada.')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao concluir Etapa 1.')
    } finally {
      setConcluindoEtapa1(false)
    }
  }

  // Toggle Tarefa da Etapa 2
  const handleToggleTarefaEtapa2 = async (tarefa: TarefaOnboarding) => {
    if (onboarding?.etapa2_concluida) return
    try {
      const updated = await tarefaService.toggleConcluida(tarefa.id, !tarefa.concluida)
      setTarefas((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status da tarefa.')
    }
  }

  // Excluir Tarefa customizada da Etapa 2
  const handleDeleteTarefa = async (tarefaId: string) => {
    if (!confirm('Deseja realmente remover esta tarefa do onboarding?')) return
    try {
      await tarefaService.delete(tarefaId)
      setTarefas((prev) => prev.filter((t) => t.id !== tarefaId))
      toast.success('Tarefa removida com sucesso.')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao remover tarefa.')
    }
  }

  const allEtapa2TarefasChecked = useMemo(() => {
    if (tarefas.length === 0) return false
    return tarefas.every((t) => t.concluida)
  }, [tarefas])

  // Concluir Etapa 2
  const handleConcluirEtapa2 = async () => {
    if (!onboarding || !user) return
    try {
      setConcluindoEtapa2(true)
      await onboardingService.concluirEtapa2(onboarding.id, user.id)
      toast.success(
        'Etapa 2 (Vivência Técnica) concluída! Onboarding enviado para Avaliação do Gestor.',
      )
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao concluir Etapa 2.')
    } finally {
      setConcluindoEtapa2(false)
    }
  }

  // Upload de novo item para Etapa 2
  const handleAddItemEtapa2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setItemError('')

    if (!onboarding) return
    if (!novoItemTitulo.trim()) {
      setItemError('O título da tarefa é obrigatório.')
      return
    }

    if (novoItemFile && novoItemFile.size > 52428800) {
      setItemError('O arquivo não pode exceder 50 MB.')
      return
    }

    try {
      setEnviandoItem(true)
      const formData = new FormData()
      formData.append('onboarding_id', onboarding.id)
      formData.append('titulo', novoItemTitulo.trim())
      formData.append('tipo', novoItemTipo)
      formData.append('concluida', 'false')
      formData.append('criado_automaticamente', 'false')

      if (novoItemFile) {
        formData.append('conteudo_url', novoItemFile)
      }

      const nova = await tarefaService.create(formData)
      setTarefas((prev) => [...prev, nova])
      toast.success('Item adicionado à Vivência Técnica!')
      setModalItemOpen(false)
      setNovoItemTitulo('')
      setNovoItemFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error(err)
      toast.error('Falha ao adicionar item.')
    } finally {
      setEnviandoItem(false)
    }
  }

  // Registrar Decisão da Avaliação Final (Etapa 3)
  const handleRegistrarAvaliacao = async () => {
    if (!onboarding || !user) return
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
          ? 'Avaliação registrada! Colaborador liberado como Apto.'
          : 'Avaliação registrada! Colaborador marcado como Não Apto.',
      )
    } catch (err) {
      console.error(err)
      toast.error('Erro ao registrar avaliação.')
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
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Carregando detalhes do onboarding...</p>
      </div>
    )
  }

  const setorInfo = SETORES_INFO[onboarding.setor]
  const statusInfo = STATUS_INFO[onboarding.status]

  // Regras de permissão
  const isRH = user?.setor === 'RH'
  const isGestao = user?.setor === 'Gestão'

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

      {/* Header do Colaborador */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight text-[#1A2233]">
                {onboarding.colaborador_nome}
              </h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${setorInfo.corBg}`}
              >
                Setor: {setorInfo.nome}
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
                : 'border-blue-200 ring-1 ring-blue-100'
            }`}
          >
            {/* Header da Etapa */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    onboarding.etapa1_concluida
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {onboarding.etapa1_concluida ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A2233]">
                    Etapa 1 — Apresentação da Empresa
                  </h3>
                  <p className="text-xs text-gray-500">
                    Conduzida e validada pelo setor de RH • Integração institucional
                  </p>
                </div>
              </div>

              {onboarding.etapa1_concluida ? (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold">
                  Concluída em {formatShortDate(onboarding.data_conclusao_etapa1)}
                </Badge>
              ) : (
                <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs font-semibold">
                  Em andamento
                </Badge>
              )}
            </div>

            {/* Lista de itens da Etapa 1 */}
            <div className="divide-y divide-gray-100 mb-5">
              {itensEtapa1.map((item) => {
                const checked = onboarding.etapa1_concluida || !!etapa1Checks[item.id]

                return (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        type="button"
                        disabled={onboarding.etapa1_concluida}
                        onClick={() => toggleCheckEtapa1(item.id)}
                        className="mt-0.5 text-gray-400 hover:text-blue-600 transition-transform active:scale-95 disabled:cursor-default"
                        aria-label="Marcar item"
                      >
                        {checked ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-fade-in" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {item.tipo === 'video' ? (
                            <Video className="w-4 h-4 text-purple-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span
                            className={`text-sm font-semibold ${
                              checked ? 'text-gray-500 line-through' : 'text-gray-800'
                            }`}
                          >
                            {item.titulo}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {item.descricao}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openPreview({
                          titulo: item.titulo,
                          tipo: item.tipo,
                          url: '',
                        })
                      }
                      className="h-8 text-xs text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Visualizar
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Ação Concluir Etapa 1 */}
            {!onboarding.etapa1_concluida && (
              <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {allEtapa1Checked
                    ? 'Todos os itens conferidos! O RH pode concluir a etapa.'
                    : 'Marque todos os itens acima para liberar a conclusão.'}
                </span>

                <Button
                  onClick={handleConcluirEtapa1}
                  disabled={!allEtapa1Checked || concluindoEtapa1 || (!isRH && !isGestao)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  {concluindoEtapa1 ? (
                    <span>Concluindo...</span>
                  ) : (
                    <span>Concluir Etapa 1 (RH)</span>
                  )}
                </Button>
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
                  <h3 className="text-base font-bold text-[#1A2233]">
                    Etapa 2 — Vivência Técnica ({setorInfo.nome})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Movidesk (chamados), Passportal (documentação), shadow técnico e atuação
                    assistida
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
                <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs font-semibold">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModalItemOpen(true)}
                      className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      Adicionar item (upload)
                    </Button>
                  </div>
                )}

                {/* Lista de Tarefas da Etapa 2 */}
                <div className="divide-y divide-gray-100 mb-5">
                  {tarefas.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-xs">
                      Nenhum item adicionado para este setor.
                    </div>
                  ) : (
                    tarefas.map((tarefa) => {
                      const fileUrl = tarefaService.getFileUrl(tarefa)

                      return (
                        <div
                          key={tarefa.id}
                          className="py-3 flex items-start justify-between gap-3 group"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <button
                              type="button"
                              disabled={onboarding.etapa2_concluida}
                              onClick={() => handleToggleTarefaEtapa2(tarefa)}
                              className="mt-0.5 text-gray-400 hover:text-blue-600 transition-transform active:scale-95 disabled:cursor-default"
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
                                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
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
                                {tarefa.conteudo_url && (
                                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                    Arquivo anexado
                                  </span>
                                )}
                              </div>
                              {tarefa.concluida_em && (
                                <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">
                                  Concluído em: {formatDate(tarefa.concluida_em)}
                                </span>
                              )}
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
                              className="h-8 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Visualizar
                            </Button>

                            {!tarefa.criado_automaticamente && !onboarding.etapa2_concluida && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTarefa(tarefa.id)}
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

                {/* Concluir Etapa 2 */}
                {!onboarding.etapa2_concluida && (
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      {allEtapa2TarefasChecked
                        ? 'Todas as tarefas técnicas concluídas! Liberado para finalizar etapa 2.'
                        : 'Marque todas as tarefas técnicas para liberar a avaliação do gestor.'}
                    </span>

                    <Button
                      onClick={handleConcluirEtapa2}
                      disabled={!allEtapa2TarefasChecked || concluindoEtapa2}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                    >
                      {concluindoEtapa2 ? (
                        <span>Concluindo...</span>
                      ) : (
                        <span>Concluir Etapa 2 (Vivência Técnica)</span>
                      )}
                    </Button>
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

                {!isGestao ? (
                  <div className="p-4 rounded-lg bg-gray-100 text-xs text-gray-600 text-center">
                    Visualização em modo de leitura (Setor RH). A decisão final cabe ao Gestor de TI
                    responsável.
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
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
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
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Linha do Tempo do Onboarding</span>
            </h3>

            <div className="relative pl-6 space-y-6 border-l-2 border-gray-200 my-2">
              {/* Evento 1: Criação */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white" />
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

      {/* Modal: Adicionar Item (Etapa 2) */}
      <Dialog open={modalItemOpen} onOpenChange={setModalItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Adicionar Item à Vivência Técnica
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddItemEtapa2} className="space-y-4 py-2">
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
                placeholder="Ex.: Treinamento Específico de Roteador Mikrotik"
                value={novoItemTitulo}
                onChange={(e) => setNovoItemTitulo(e.target.value)}
                className="h-10 text-xs"
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
                  className={novoItemTipo === 'manual' ? 'bg-blue-600' : ''}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Manual / Documento
                </Button>
                <Button
                  type="button"
                  variant={novoItemTipo === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNovoItemTipo('video')}
                  className={novoItemTipo === 'video' ? 'bg-blue-600' : ''}
                >
                  <Video className="w-3.5 h-3.5 mr-1" />
                  Vídeo (MP4)
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Arquivo (.mp4, .pdf, .pptx, .docx — máx. 50MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setNovoItemFile(file)
                }}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={enviandoItem}
              />
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
                <FileText className="w-5 h-5 text-blue-600" />
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
                  <FileCheck2 className="w-12 h-12 text-blue-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Documento disponível para leitura
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Você pode abrir o arquivo original ou fazer download para estudar.
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
