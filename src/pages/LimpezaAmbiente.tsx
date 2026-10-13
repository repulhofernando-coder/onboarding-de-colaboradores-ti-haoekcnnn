import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cleanupService, type CleanupStats, type CleanupExecutionResult } from '@/services/cleanup'
import { ROLES_INFO, type User, type UserRole } from '@/types/onboarding'
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Users,
  FileText,
  Layers,
  FolderArchive,
  Info,
  Check,
  X,
  Lock,
  ArrowRight,
  ShieldCheck,
  Shield,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function LimpezaAmbiente() {
  const { user: currentUser, role: currentRole, isAdmin } = useAuth()
  const navigate = useNavigate()

  // Se não for admin, não renderiza nada
  useEffect(() => {
    if (!isAdmin) {
      toast.error('Acesso restrito a Administradores.')
      navigate('/')
    }
  }, [isAdmin, navigate])

  const [loadingStats, setLoadingStats] = useState(true)
  const [stats, setStats] = useState<CleanupStats | null>(null)

  // Seleções dos blocos
  const [limparColabOnb, setLimparColabOnb] = useState(false)
  const [limparLogs, setLimparLogs] = useState(false)
  const [limparMateriais, setLimparMateriais] = useState(false)
  const [limparModelos, setLimparModelos] = useState<
    'nenhum' | 'associados_materiais' | 'todos_itens'
  >('nenhum')
  const [limparUsuarios, setLimparUsuarios] = useState(false)

  // IDs dos usuários selecionados para EXCLUSÃO (por padrão nenhum, e o admin logado nunca pode)
  const [selectedUserIdsToDelete, setSelectedUserIdsToDelete] = useState<string[]>([])

  // Modal etapa 1: revisão detalhada das contagens
  const [modalEtapa1Open, setModalEtapa1Open] = useState(false)

  // Modal etapa 2: confirmação por palavra-chave LIMPAR
  const [modalEtapa2Open, setModalEtapa2Open] = useState(false)
  const [palavraChaveInput, setPalavraChaveInput] = useState('')

  // Execução
  const [executando, setExecutando] = useState(false)
  const [resultadosExecucao, setResultadosExecucao] = useState<CleanupExecutionResult[] | null>(
    null,
  )

  const carregarEstatisticas = async () => {
    try {
      setLoadingStats(true)
      const data = await cleanupService.getStats()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
      toast.error('Não foi possível carregar as contagens atuais do banco de dados.')
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    carregarEstatisticas()
  }, [])

  // Auxiliar para obter papel do usuário
  const getUserRole = (u: User): UserRole => {
    if (u.role === 'admin' || u.role === 'rh' || u.role === 'gestao') return u.role
    if (u.setor === 'RH') return 'rh'
    return 'gestao'
  }

  // Alterna a seleção de um usuário para exclusão
  const toggleUserSelection = (userId: string) => {
    if (currentUser && userId === currentUser.id) {
      toast.error('O seu usuário Administrador logado está estritamente protegido contra exclusão.')
      return
    }

    setSelectedUserIdsToDelete((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  // Selecionar todos os usuários de teste (exceto o próprio admin)
  const handleSelectAllNonAdminUsers = () => {
    if (!stats) return
    const ids = stats.usersList.filter((u) => u.id !== currentUser?.id).map((u) => u.id)
    setSelectedUserIdsToDelete(ids)
  }

  // Desmarcar todos os usuários
  const handleDeselectAllUsers = () => {
    setSelectedUserIdsToDelete([])
  }

  // Verifica se pelo menos um bloco de limpeza foi selecionado
  const algoSelecionado = useMemo(() => {
    return (
      limparColabOnb ||
      limparLogs ||
      limparMateriais ||
      limparModelos !== 'nenhum' ||
      (limparUsuarios && selectedUserIdsToDelete.length > 0)
    )
  }, [
    limparColabOnb,
    limparLogs,
    limparMateriais,
    limparModelos,
    limparUsuarios,
    selectedUserIdsToDelete,
  ])

  // Iniciar fluxo de confirmação
  const handleIniciarFluxo = () => {
    if (!algoSelecionado) {
      toast.warning('Selecione pelo menos um bloco para executar a limpeza.')
      return
    }
    setPalavraChaveInput('')
    setModalEtapa1Open(true)
  }

  // Passar para etapa 2
  const handleAvancarParaEtapa2 = () => {
    setModalEtapa1Open(false)
    setPalavraChaveInput('')
    setModalEtapa2Open(true)
  }

  // Executar limpeza final
  const handleConfirmarLimpezaFinal = async () => {
    if (palavraChaveInput.trim().toUpperCase() !== 'LIMPAR') {
      toast.error('Digite a palavra LIMPAR exatamente como indicado para prosseguir.')
      return
    }

    if (!currentUser) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }

    setExecutando(true)
    try {
      const results = await cleanupService.executeCleanup({
        limparColaboradoresEOnboardings: limparColabOnb,
        limparLogsAuditoria: limparLogs,
        limparMateriais: limparMateriais,
        limparModelosTarefas: limparModelos,
        limparUsuarios: limparUsuarios,
        userIdsParaExcluir: selectedUserIdsToDelete,
        adminUsuario: {
          id: currentUser.id,
          nome: currentUser.name || 'Administrador',
          email: currentUser.email || '',
          role: currentRole,
        },
      })

      setResultadosExecucao(results)
      setModalEtapa2Open(false)
      toast.success('Limpeza de ambiente executada com sucesso!')

      // Reset de seleções
      setLimparColabOnb(false)
      setLimparLogs(false)
      setLimparMateriais(false)
      setLimparModelos('nenhum')
      setLimparUsuarios(false)
      setSelectedUserIdsToDelete([])

      // Recarrega contagens
      await carregarEstatisticas()
    } catch (err) {
      console.error('Erro na execução da limpeza:', err)
      toast.error('Ocorreu um erro durante a limpeza. Verifique o relatório.')
    } finally {
      setExecutando(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Alerta Crítico */}
      <div className="bg-white p-6 rounded-xl border border-red-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-600" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-50 text-red-600">
                <Trash2 className="w-5 h-5" />
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-[#1A2233]">
                Limpeza de Ambiente (Transição para Produção)
              </h2>
            </div>
            <p className="text-sm text-gray-600 max-w-2xl">
              Esta ferramenta foi desenvolvida para você zerar os dados de teste (colaboradores
              fictícios, onboardings de homologação, arquivos e logs de teste) quando decidir migrar
              o sistema para <strong className="text-gray-900">produção</strong>, mantendo apenas os
              usuários reais de acesso.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarEstatisticas}
            disabled={loadingStats}
            className="h-9 text-xs shrink-0 border-gray-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingStats ? 'animate-spin' : ''}`} />
            Atualizar Contagens
          </Button>
        </div>

        {/* Banner de Homologação */}
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> Enquanto estiver em período de homologação e testes,{' '}
            <span className="font-semibold underline">
              não é necessário executar a limpeza agora
            </span>
            . Esta página está pronta para quando você decidir que os testes foram concluídos e
            desejar iniciar com o banco de dados limpo para os colaboradores reais.
          </div>
        </div>
      </div>

      {/* Relatório de última execução, se houver */}
      {resultadosExecucao && (
        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-gray-900">Relatório da Limpeza Realizada</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResultadosExecucao(null)}
              className="text-xs text-gray-500 hover:text-gray-700 h-7"
            >
              Fechar relatório
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {resultadosExecucao.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-xs ${
                  r.sucesso ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="font-bold text-gray-800">{r.bloco}</div>
                <div className="text-gray-600 mt-1">
                  Itens removidos: <strong>{r.itensRemovidos}</strong>
                </div>
                {r.erros && r.erros.length > 0 && (
                  <div className="text-red-600 mt-1 font-mono text-[10px]">
                    {r.erros.join('; ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid com os Blocos Independentes de Limpeza */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          Escolha os blocos que deseja zerar
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BLOCO 1: Colaboradores + Onboardings */}
          <div
            className={`p-5 rounded-xl border transition-all ${
              limparColabOnb
                ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20'
                : 'bg-white border-gray-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Colaboradores & Onboardings</h4>
                    <span className="text-[11px] text-gray-500 block">
                      Zera todos os processos de onboarding de teste
                    </span>
                  </div>
                </div>
              </div>

              <Switch
                checked={limparColabOnb}
                onCheckedChange={setLimparColabOnb}
                aria-label="Selecionar limpeza de colaboradores e onboardings"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Colaboradores distintos:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.colaboradoresCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Processos de onboarding:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.onboardingsCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tarefas vinculadas:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.tarefasCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avaliações finais:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.avaliacoesCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Confirmações do colaborador via link público:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.confirmacoesCount ?? 0)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-gray-500 italic">
              Remove em cascata cronogramas de 15 dias, confirmações com data/hora e clientes de
              mapeamento.
            </div>
          </div>

          {/* BLOCO 2: Materiais da Biblioteca */}
          <div
            className={`p-5 rounded-xl border transition-all ${
              limparMateriais
                ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20'
                : 'bg-white border-gray-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <FolderArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Materiais da Biblioteca</h4>
                    <span className="text-[11px] text-gray-500 block">
                      Arquivos enviados (vídeos, PDFs e manuais)
                    </span>
                  </div>
                </div>
              </div>

              <Switch
                checked={limparMateriais}
                onCheckedChange={setLimparMateriais}
                aria-label="Selecionar limpeza de materiais"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Arquivos cadastrados na biblioteca:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.materiaisCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Itens de modelo vinculados a materiais:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.modeloItensAssociadosCount ?? 0)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-gray-500 italic">
              Apaga os registros da coleção de materiais e seus anexos físicos. Desassocia com
              segurança os modelos para não violar integridade.
            </div>
          </div>

          {/* BLOCO 3: Itens dos Modelos de Tarefas */}
          <div
            className={`p-5 rounded-xl border transition-all ${
              limparModelos !== 'nenhum'
                ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20'
                : 'bg-white border-gray-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">
                      Modelos de Tarefas (Templates)
                    </h4>
                    <span className="text-[11px] text-gray-500 block">
                      Protege as fases padrão e os 8 setores cadastrados
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>Total de itens nos modelos:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.modeloTarefasCount ?? 0)}
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="opcModelos"
                    value="nenhum"
                    checked={limparModelos === 'nenhum'}
                    onChange={() => setLimparModelos('nenhum')}
                    className="w-4 h-4 text-brand-600 border-gray-300"
                  />
                  <span className="text-gray-700">
                    <strong>Manter todos os modelos</strong> (recomendado se os templates já forem
                    oficiais)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="opcModelos"
                    value="associados_materiais"
                    checked={limparModelos === 'associados_materiais'}
                    onChange={() => setLimparModelos('associados_materiais')}
                    className="w-4 h-4 text-brand-600 border-gray-300"
                  />
                  <span className="text-gray-700">
                    Apagar <strong>apenas os itens associados a materiais de teste</strong> (
                    {loadingStats ? '...' : (stats?.modeloItensAssociadosCount ?? 0)} itens)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="opcModelos"
                    value="todos_itens"
                    checked={limparModelos === 'todos_itens'}
                    onChange={() => setLimparModelos('todos_itens')}
                    className="w-4 h-4 text-red-600 border-gray-300"
                  />
                  <span className="text-red-700">
                    Apagar <strong>todos os itens</strong> ({stats?.modeloTarefasCount ?? 0} itens)
                    — mantém as fases e setores intactos
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
              ✓ <strong>Proteção garantida:</strong> As 5 fases modelo da Etapa 2 e os 8 setores
              (Windows, Linux, Datacenter, Campo, etc.) NUNCA são apagados por esta rotina.
            </div>
          </div>

          {/* BLOCO 4: Logs de Auditoria */}
          <div
            className={`p-5 rounded-xl border transition-all ${
              limparLogs
                ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20'
                : 'bg-white border-gray-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Logs de Auditoria</h4>
                    <span className="text-[11px] text-gray-500 block">
                      Trilha de auditoria das ações de teste
                    </span>
                  </div>
                </div>
              </div>

              <Switch
                checked={limparLogs}
                onCheckedChange={setLimparLogs}
                aria-label="Selecionar limpeza de logs de auditoria"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Registros atuais na auditoria:</span>
                <span className="font-bold text-gray-900">
                  {loadingStats ? '...' : (stats?.logsAuditoriaCount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Política de retenção:</span>
                <span className="font-semibold text-gray-700">6 meses (180 dias)</span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-gray-500 italic">
              Limpa os logs gerados durante os testes em homologação para que a trilha oficial de
              auditoria comece a contar a partir da entrada em produção.
            </div>
          </div>
        </div>

        {/* BLOCO 5: Gestão de Usuários (Proteção Estrita) */}
        <div
          className={`p-5 rounded-xl border transition-all ${
            limparUsuarios && selectedUserIdsToDelete.length > 0
              ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20'
              : 'bg-white border-gray-200/90 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    Usuários de Teste (Controle Individual por Checkbox)
                  </h4>
                  <span className="text-[11px] text-gray-500 block">
                    Escolha manualmente quais contas excluir. Seu usuário Admin está estritamente
                    protegido.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={limparUsuarios}
                onCheckedChange={(checked) => {
                  setLimparUsuarios(checked)
                  if (!checked) {
                    setSelectedUserIdsToDelete([])
                  }
                }}
                aria-label="Habilitar exclusão de usuários"
              />
              <span className="text-xs font-semibold text-gray-700">
                {limparUsuarios ? 'Habilitado' : 'Desabilitado'}
              </span>
            </div>
          </div>

          {limparUsuarios && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-gray-600">
                  Selecionados para exclusão:{' '}
                  <strong className="text-red-600">{selectedUserIdsToDelete.length}</strong> de{' '}
                  {stats?.usersCount ?? 0} usuários
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllNonAdminUsers}
                    className="h-7 text-xs border-gray-300"
                  >
                    Marcar todos (exceto eu)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllUsers}
                    className="h-7 text-xs border-gray-300"
                  >
                    Desmarcar todos
                  </Button>
                </div>
              </div>

              {/* Tabela de seleção de usuários */}
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 text-gray-600 text-[11px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Excluir</th>
                      <th className="py-2.5 px-3">Nome</th>
                      <th className="py-2.5 px-3">E-mail</th>
                      <th className="py-2.5 px-3">Papel</th>
                      <th className="py-2.5 px-3 text-right">Proteção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {stats?.usersList.map((u) => {
                      const isSelf = currentUser?.id === u.id
                      const isSelected = selectedUserIdsToDelete.includes(u.id)
                      const role = getUserRole(u)
                      const roleInfo = ROLES_INFO[role]

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-gray-50/70 transition-colors ${
                            isSelf ? 'bg-blue-50/30 font-medium' : isSelected ? 'bg-red-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            {isSelf ? (
                              <span
                                title="Seu usuário está protegido"
                                className="inline-flex items-center justify-center"
                              >
                                <Lock className="w-4 h-4 text-blue-600 mx-auto" />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUserSelection(u.id)}
                                className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-900">
                              {u.name || 'Sem nome'}
                            </span>
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px] py-0 px-1 text-blue-700 bg-blue-50 border-blue-200"
                              >
                                Você (Admin Atual)
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">{u.email}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${roleInfo.badgeClass}`}
                            >
                              {role === 'admin' ? (
                                <Shield className="w-2.5 h-2.5" />
                              ) : role === 'rh' ? (
                                <UserCheck className="w-2.5 h-2.5" />
                              ) : (
                                <ShieldCheck className="w-2.5 h-2.5" />
                              )}
                              <span>{roleInfo.nome}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isSelf ? (
                              <span className="text-[11px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                                Imune a Exclusão
                              </span>
                            ) : isSelected ? (
                              <span className="text-[11px] font-semibold text-red-700">
                                Marcado p/ Apagar
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-500">Será Mantido</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Ação Inferior */}
      <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-gray-900">
            Pronto para aplicar a limpeza selecionada?
          </div>
          <p className="text-xs text-gray-500">
            Você passará por uma confirmação detalhada em 2 etapas com digitação de palavra-chave.
          </p>
        </div>

        <Button
          onClick={handleIniciarFluxo}
          disabled={!algoSelecionado || loadingStats || executando}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 h-11 rounded-lg shadow-sm shrink-0 disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          <span>Prosseguir com a Limpeza</span>
        </Button>
      </div>

      {/* MODAL ETAPA 1: Resumo Exato do que será apagado */}
      <Dialog open={modalEtapa1Open} onOpenChange={setModalEtapa1Open}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#1A2233]">
              Confirmação - Etapa 1 de 2: Revisão do que será apagado
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 leading-relaxed">
              Verifique detalhadamente a lista de itens que serão permanentemente removidos do banco
              de dados:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="space-y-2 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
              {limparColabOnb && (
                <div className="flex items-start gap-2 text-gray-800">
                  <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Colaboradores & Onboardings:</strong> {stats?.onboardingsCount}{' '}
                    onboardings, {stats?.colaboradoresCount} colaboradores distintos,{' '}
                    {stats?.tarefasCount} tarefas, {stats?.avaliacoesCount} avaliações e{' '}
                    {stats?.confirmacoesCount} confirmações.
                  </div>
                </div>
              )}

              {limparMateriais && (
                <div className="flex items-start gap-2 text-gray-800">
                  <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Materiais da Biblioteca:</strong> {stats?.materiaisCount} arquivos
                    físicos (vídeos, PDFs e manuais).
                  </div>
                </div>
              )}

              {limparModelos !== 'nenhum' && (
                <div className="flex items-start gap-2 text-gray-800">
                  <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Modelos de Tarefas:</strong>{' '}
                    {limparModelos === 'associados_materiais'
                      ? `${stats?.modeloItensAssociadosCount} itens associados a materiais`
                      : `todos os ${stats?.modeloTarefasCount} itens de tarefas dos modelos`}{' '}
                    (fases modelo e setores preservados).
                  </div>
                </div>
              )}

              {limparUsuarios && selectedUserIdsToDelete.length > 0 && (
                <div className="flex items-start gap-2 text-gray-800">
                  <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Usuários de Teste:</strong> {selectedUserIdsToDelete.length} usuário(s)
                    selecionado(s).{' '}
                    <span className="text-blue-700 font-semibold">
                      Seu usuário ({currentUser?.email}) está preservado.
                    </span>
                  </div>
                </div>
              )}

              {limparLogs && (
                <div className="flex items-start gap-2 text-gray-800">
                  <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Logs de Auditoria:</strong> {stats?.logsAuditoriaCount} registros
                    históricos de homologação.
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              ⚠️ Esta operação é irreversível. Após a confirmação, os dados serão permanentemente
              excluídos.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalEtapa1Open(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAvancarParaEtapa2}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              <span>Avançar para a Confirmação Final</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ETAPA 2: Digitar a palavra LIMPAR para habilitar */}
      <Dialog open={modalEtapa2Open} onOpenChange={setModalEtapa2Open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center mb-1">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#1A2233]">
              Confirmação - Etapa 2 de 2: Autorização Final
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 leading-relaxed">
              Para evitar qualquer exclusão acidental, digite a palavra{' '}
              <strong className="text-red-600 font-mono text-sm tracking-wider">LIMPAR</strong> no
              campo abaixo para habilitar o botão de exclusão:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Palavra-chave de confirmação:
              </Label>
              <Input
                placeholder="Digite LIMPAR"
                value={palavraChaveInput}
                onChange={(e) => setPalavraChaveInput(e.target.value)}
                autoFocus
                className="mt-1.5 font-mono uppercase tracking-widest text-center text-base font-bold border-red-300 focus-visible:ring-red-500"
              />
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              Um log de auditoria será gerado imediatamente registrando quem solicitou a limpeza.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={executando}
              onClick={() => setModalEtapa2Open(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={palavraChaveInput.trim().toUpperCase() !== 'LIMPAR' || executando}
              onClick={handleConfirmarLimpezaFinal}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-30"
            >
              {executando ? 'Executando Limpeza...' : 'Sim, Excluir Dados Selecionados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
