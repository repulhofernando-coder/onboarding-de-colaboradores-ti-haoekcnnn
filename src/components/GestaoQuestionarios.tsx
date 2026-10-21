import React, { useState, useEffect } from 'react'
import { questionarioService, setorService } from '@/services/onboarding'
import pb from '@/lib/pocketbase/client'
import type {
  QuestionarioModel,
  TesteQuestaoModel,
  TipoDeUsoQuestionario,
  SetorModel,
} from '@/types/onboarding'
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowLeft,
  ListOrdered,
  Percent,
  Check,
  FileQuestion,
  Info,
  AlertTriangle,
  Printer,
  FileText,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import { AvisoSetorGestor } from '@/components/AvisoSetorGestor'

const TIPOS_USO_INFO: Record<
  TipoDeUsoQuestionario,
  { label: string; desc: string; badge: string }
> = {
  onboarding: {
    label: 'Onboarding (Etapa 3)',
    desc: 'Usado na prova de conhecimento técnico ao fim da vivência',
    badge: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  reciclagem: {
    label: 'Reciclagem Periódica',
    desc: 'Avaliação de atualização contínua da equipe',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  mudanca_area: {
    label: 'Mudança de Área',
    desc: 'Transição entre setores técnicos',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  avaliacao: {
    label: 'Avaliação Periódica',
    desc: 'Avaliações formais de desempenho',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  contratacao: {
    label: 'Contratação',
    desc: 'Aplicação com candidatos e pré-selecionados',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
}

export function GestaoQuestionarios({ setoresList }: { setoresList: SetorModel[] }) {
  const { user, role, isAdmin, isGestao, isRH } = useAuth()
  const [questionarios, setQuestionarios] = useState<QuestionarioModel[]>([])
  const [loading, setLoading] = useState(true)

  // Questionário selecionado para gerenciar suas questões
  const [selectedQuestionario, setSelectedQuestionario] = useState<QuestionarioModel | null>(null)
  const [questoes, setQuestoes] = useState<TesteQuestaoModel[]>([])
  const [loadingQuestoes, setLoadingQuestoes] = useState(false)

  // Modal Questionário
  const [modalQOpen, setModalQOpen] = useState(false)
  const [editingQ, setEditingQ] = useState<QuestionarioModel | null>(null)
  const [formQNome, setFormQNome] = useState('')
  const [formQDescricao, setFormQDescricao] = useState('')
  const [formQSetor, setFormQSetor] = useState('windows')
  const [formQTipoUso, setFormQTipoUso] = useState<TipoDeUsoQuestionario>('onboarding')
  const [formQPercentual, setFormQPercentual] = useState(95)
  const [formQQuestoesPorProva, setFormQQuestoesPorProva] = useState(20)
  const [formQAtivo, setFormQAtivo] = useState(true)
  const [submittingQ, setSubmittingQ] = useState(false)
  const [contagemQuestoes, setContagemQuestoes] = useState<
    Record<string, { total: number; objetivas: number }>
  >({})

  // Modal Questão
  const [modalQuestaoOpen, setModalQuestaoOpen] = useState(false)
  const [editingQuestao, setEditingQuestao] = useState<TesteQuestaoModel | null>(null)
  const [qEnunciado, setQEnunciado] = useState('')
  const [qAlternativas, setQAlternativas] = useState<string[]>(['', '', '', ''])
  const [qCorretaIndex, setQCorretaIndex] = useState(0)
  const [qComentario, setQComentario] = useState('')
  const [qTema, setQTema] = useState('')
  const [qOrdem, setQOrdem] = useState(1)
  const [qAtivo, setQAtivo] = useState(true)
  const [submittingQuestao, setSubmittingQuestao] = useState(false)

  // Modal Confirmação Exclusão
  const [deleteQItem, setDeleteQItem] = useState<QuestionarioModel | null>(null)
  const [deleteQuestaoItem, setDeleteQuestaoItem] = useState<TesteQuestaoModel | null>(null)

  // Controle de permissão de escrita de questionários/questões:
  // - Admin e RH sempre podem escrever.
  // - Gestor pode escrever somente se tiver pode_editar_questionarios === true.
  const podeEditarQuestionarios = Boolean(
    isAdmin || isRH || (isGestao && user?.pode_editar_questionarios),
  )

  // Função auxiliar para verificar se o usuário pode alterar um questionário específico (permissão + setor correspondente)
  const podeModificarQuestionario = (qSetor?: string) => {
    if (isAdmin || isRH) return true
    if (!isGestao) return false
    if (!user?.pode_editar_questionarios) return false
    return podeVisualizarSetor({
      role,
      userSetor: user?.setor as string | undefined,
      itemSetor: qSetor,
      setoresCadastrados: setoresList,
    })
  }

  // Regra de impressão:
  // - Admin e RH sempre podem imprimir (ambas as vias).
  // - Gestão só pode imprimir se tiver pode_editar_questionarios ativo E pertencer ao mesmo setor.
  // Equivalente à regra de podeModificarQuestionario:
  const podeImprimirQuestionario = (qSetor?: string) => {
    return podeModificarQuestionario(qSetor)
  }

  const handleAbrirImpressao = (qId: string, via: 'gabarito' | 'branco') => {
    window.open(`/avaliacoes/impressao/${qId}?via=${via}`, '_blank')
  }

  const carregarQuestionarios = async () => {
    try {
      setLoading(true)
      const list = await questionarioService.listAll()
      // Se papel Gestão, defesa em profundidade na interface (servidor já filtra)
      const filtrados = isGestao
        ? list.filter((q) =>
            podeVisualizarSetor({
              role,
              userSetor: user?.setor as string | undefined,
              itemSetor: q.setor,
              setoresCadastrados: setoresList,
            }),
          )
        : list
      setQuestionarios(filtrados)

      // Carregar contagem de questões para cada questionário (para alertar banco insuficiente)
      try {
        const todas = await pb.collection('teste_questoes').getFullList<TesteQuestaoModel>({
          filter: 'ativo = true',
        })
        const counts: Record<string, { total: number; objetivas: number }> = {}
        todas.forEach((q) => {
          const qid = q.questionario_id || 'sem_id'
          if (!counts[qid]) counts[qid] = { total: 0, objetivas: 0 }
          counts[qid].total++
          if (q.tipo !== 'dissertativa') {
            counts[qid].objetivas++
          }
        })
        setContagemQuestoes(counts)
      } catch (errCount) {
        console.warn('Aviso ao carregar contagem de questões:', errCount)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar questionários.')
    } finally {
      setLoading(false)
    }
  }

  const carregarQuestoes = async (qId: string) => {
    try {
      setLoadingQuestoes(true)
      const list = await questionarioService.listQuestoes(qId)
      setQuestoes(list)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar questões do questionário.')
    } finally {
      setLoadingQuestoes(false)
    }
  }

  useEffect(() => {
    carregarQuestionarios()
  }, [])

  useEffect(() => {
    if (selectedQuestionario) {
      carregarQuestoes(selectedQuestionario.id)
    } else {
      setQuestoes([])
    }
  }, [selectedQuestionario])

  // Handlers Questionário
  const handleOpenNovoQ = () => {
    if (!podeEditarQuestionarios) {
      toast.error(
        'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.',
      )
      return
    }
    // Para papel Gestão, preencher o setor com o setor do usuário
    const setorGestao = user?.setor as string | undefined
    const setorPadrao =
      isGestao && setorGestao
        ? setoresList.find(
            (s) =>
              s.chave?.toLowerCase() === setorGestao.toLowerCase() ||
              s.nome.toLowerCase() === setorGestao.toLowerCase() ||
              s.id === setorGestao,
          )?.chave || setorGestao
        : setoresList[0]?.chave || setoresList[0]?.id || 'windows'

    setEditingQ(null)
    setFormQNome('')
    setFormQDescricao('')
    setFormQSetor(setorPadrao)
    setFormQTipoUso('onboarding')
    setFormQPercentual(95)
    setFormQQuestoesPorProva(20)
    setFormQAtivo(true)
    setModalQOpen(true)
  }

  const handleOpenEditarQ = (q: QuestionarioModel) => {
    if (!podeModificarQuestionario(q.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para editar questionário de outro setor.',
      )
      return
    }
    setEditingQ(q)
    setFormQNome(q.nome)
    setFormQDescricao(q.descricao || '')
    setFormQSetor(q.setor || 'windows')
    setFormQTipoUso(q.tipo_de_uso || 'onboarding')
    setFormQPercentual(q.percentual_aprovacao || 95)
    setFormQQuestoesPorProva(q.questoes_por_prova || 20)
    setFormQAtivo(q.ativo !== false)
    setModalQOpen(true)
  }

  const handleSalvarQ = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formQNome.trim()) {
      toast.error('O nome do questionário é obrigatório.')
      return
    }

    try {
      setSubmittingQ(true)
      if (editingQ) {
        const updated = await questionarioService.update(editingQ.id, {
          nome: formQNome,
          descricao: formQDescricao,
          setor: formQSetor,
          tipo_de_uso: formQTipoUso,
          percentual_aprovacao: formQPercentual,
          questoes_por_prova: formQQuestoesPorProva,
          ativo: formQAtivo,
        })
        setQuestionarios((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        if (selectedQuestionario?.id === updated.id) {
          setSelectedQuestionario(updated)
        }
        toast.success('Questionário atualizado com sucesso!')
      } else {
        const created = await questionarioService.create({
          nome: formQNome,
          descricao: formQDescricao,
          setor: formQSetor,
          tipo_de_uso: formQTipoUso,
          percentual_aprovacao: formQPercentual,
          questoes_por_prova: formQQuestoesPorProva,
          ativo: formQAtivo,
        })
        setQuestionarios((prev) => [created, ...prev])
        toast.success('Novo questionário criado!')
      }
      setModalQOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar questionário.')
    } finally {
      setSubmittingQ(false)
    }
  }

  const handleToggleAtivoQ = async (q: QuestionarioModel) => {
    if (!podeModificarQuestionario(q.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para alterar o status deste questionário.',
      )
      return
    }
    try {
      const updated = await questionarioService.update(q.id, { ativo: !q.ativo })
      setQuestionarios((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedQuestionario?.id === updated.id) {
        setSelectedQuestionario(updated)
      }
      toast.success(updated.ativo ? 'Questionário ativado.' : 'Questionário desativado.')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao alternar status do questionário.')
    }
  }

  const handleExcluirQ = async () => {
    if (!deleteQItem) return
    if (!podeModificarQuestionario(deleteQItem.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para excluir este questionário.',
      )
      setDeleteQItem(null)
      return
    }
    try {
      await questionarioService.delete(deleteQItem.id)
      setQuestionarios((prev) => prev.filter((item) => item.id !== deleteQItem.id))
      if (selectedQuestionario?.id === deleteQItem.id) {
        setSelectedQuestionario(null)
      }
      toast.success('Questionário removido.')
      setDeleteQItem(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir questionário.')
    }
  }

  // Handlers Questões
  const handleOpenNovaQuestao = () => {
    if (!selectedQuestionario) return
    if (!podeModificarQuestionario(selectedQuestionario.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para cadastrar questão neste questionário.',
      )
      return
    }
    setEditingQuestao(null)
    setQEnunciado('')
    setQAlternativas(['', '', '', ''])
    setQCorretaIndex(0)
    setQComentario('')
    setQTema('')
    setQOrdem(questoes.length + 1)
    setQAtivo(true)
    setModalQuestaoOpen(true)
  }

  const handleOpenEditarQuestao = (q: TesteQuestaoModel) => {
    if (!selectedQuestionario || !podeModificarQuestionario(selectedQuestionario.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para editar questão deste questionário.',
      )
      return
    }
    setEditingQuestao(q)
    setQEnunciado(q.enunciado)
    setQAlternativas(Array.isArray(q.alternativas) ? [...q.alternativas] : ['', '', '', ''])
    setQCorretaIndex(q.correta_index || 0)
    setQComentario(q.gabarito_comentario || '')
    setQTema(q.tema || '')
    setQOrdem(q.ordem || 1)
    setQAtivo(q.ativo !== false)
    setModalQuestaoOpen(true)
  }

  const handleSalvarQuestao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedQuestionario) return
    if (!qEnunciado.trim()) {
      toast.error('O enunciado da questão é obrigatório.')
      return
    }
    const validadas = qAlternativas.map((a) => a.trim())
    if (validadas.some((a) => !a)) {
      toast.error('Preencha todas as alternativas da questão.')
      return
    }

    try {
      setSubmittingQuestao(true)
      if (editingQuestao) {
        const updated = await questionarioService.updateQuestao(editingQuestao.id, {
          enunciado: qEnunciado,
          alternativas: validadas,
          correta_index: qCorretaIndex,
          gabarito_comentario: qComentario,
          tema: qTema,
          ordem: qOrdem,
          ativo: qAtivo,
        })
        setQuestoes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        toast.success('Questão atualizada!')
      } else {
        const created = await questionarioService.createQuestao({
          questionario_id: selectedQuestionario.id,
          enunciado: qEnunciado,
          alternativas: validadas,
          correta_index: qCorretaIndex,
          gabarito_comentario: qComentario,
          tema: qTema,
          ordem: qOrdem,
          ativo: qAtivo,
        })
        setQuestoes((prev) => [...prev, created])
        toast.success('Questão adicionada ao questionário!')
      }
      setModalQuestaoOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar questão.')
    } finally {
      setSubmittingQuestao(false)
    }
  }

  const handleExcluirQuestao = async () => {
    if (!deleteQuestaoItem) return
    if (!selectedQuestionario || !podeModificarQuestionario(selectedQuestionario.setor)) {
      toast.error(
        isGestao && !user?.pode_editar_questionarios
          ? 'Somente leitura. Solicite ao Administrador a permissão para editar questionários do seu setor.'
          : 'Você não tem permissão para excluir questão deste questionário.',
      )
      setDeleteQuestaoItem(null)
      return
    }
    try {
      await questionarioService.deleteQuestao(deleteQuestaoItem.id)
      setQuestoes((prev) => prev.filter((item) => item.id !== deleteQuestaoItem.id))
      toast.success('Questão removida.')
      setDeleteQuestaoItem(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir questão.')
    }
  }

  // Se estiver visualizando as questões de um questionário
  if (selectedQuestionario) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedQuestionario(null)}
              className="h-8 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar aos Questionários
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">{selectedQuestionario.nome}</h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    TIPOS_USO_INFO[selectedQuestionario.tipo_de_uso]?.badge || 'bg-gray-50'
                  }`}
                >
                  {TIPOS_USO_INFO[selectedQuestionario.tipo_de_uso]?.label ||
                    selectedQuestionario.tipo_de_uso}
                </span>
                <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  Setor: {selectedQuestionario.setor?.toUpperCase() || 'TODOS'}
                </span>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                  Mínimo {selectedQuestionario.percentual_aprovacao || 95}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedQuestionario.descricao ||
                  'Banco de questões para avaliação de conhecimento.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {podeImprimirQuestionario(selectedQuestionario.setor) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold border-gray-300 text-gray-700 hover:text-brand-700 hover:border-brand-300 shadow-xs"
                    title="Imprimir questionário (com gabarito ou prova em branco)"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5 text-brand-600" />
                    Imprimir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuLabel className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                    Opções de Impressão
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleAbrirImpressao(selectedQuestionario.id, 'gabarito')}
                    className="cursor-pointer py-2"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Via com Gabarito</div>
                      <div className="text-[10px] text-gray-500">Respostas corretas destacadas</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAbrirImpressao(selectedQuestionario.id, 'branco')}
                    className="cursor-pointer py-2"
                  >
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Prova em Branco</div>
                      <div className="text-[10px] text-gray-500">
                        Para aplicação física no papel
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {podeModificarQuestionario(selectedQuestionario.setor) && (
              <Button
                onClick={handleOpenNovaQuestao}
                size="sm"
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Questão
              </Button>
            )}
          </div>
        </div>

        {/* Banner discreto para gestor em modo Somente Leitura */}
        {isGestao && !user?.pode_editar_questionarios && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                <strong>Modo Somente Leitura:</strong> Você pode visualizar o questionário e seu
                banco de questões. A criação, alteração e exclusão de questões estão desabilitadas.
                Solicite ao Administrador a permissão para editar questionários do seu setor.
              </span>
            </div>
            <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded shrink-0">
              Leitura
            </span>
          </div>
        )}

        {/* Lista de Questões */}
        {loadingQuestoes ? (
          <div className="text-center py-10 text-xs text-gray-400">Carregando questões...</div>
        ) : questoes.length === 0 ? (
          <div className="p-10 text-center space-y-3 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
            <FileQuestion className="w-10 h-10 text-gray-300 mx-auto" />
            <h4 className="text-sm font-semibold text-gray-700">
              Nenhuma questão cadastrada neste questionário
            </h4>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Adicione questões de múltipla escolha com gabarito comentado para os colaboradores
              realizarem a prova.
            </p>
            {podeModificarQuestionario(selectedQuestionario.setor) ? (
              <Button
                onClick={handleOpenNovaQuestao}
                size="sm"
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Cadastrar Primeira Questão
              </Button>
            ) : (
              <p className="text-xs text-amber-700 font-medium">
                Somente leitura. Solicite ao Administrador a permissão para cadastrar questões.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Aviso de Sorteio e Folga de Banco */}
            {(() => {
              const objetivasCount = questoes.filter((q) => q.tipo !== 'dissertativa').length
              const dissertativasCount = questoes.filter((q) => q.tipo === 'dissertativa').length
              const configurado = selectedQuestionario.questoes_por_prova || 20
              const falta = configurado - objetivasCount

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1 flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <strong>{questoes.length}</strong> questão(ões) cadastrada(s) (
                      {objetivasCount} objetivas, {dissertativasCount} dissertativas)
                      <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        Sorteio da prova: <strong>{configurado}</strong> objetivas
                      </span>
                    </span>
                    <span>
                      Régua: <strong>{selectedQuestionario.percentual_aprovacao || 95}%</strong>
                    </span>
                  </div>

                  {objetivasCount < configurado ? (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          Banco com menos questões que a prova configurada
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          O banco tem <strong>{objetivasCount}</strong> objetivas ativas. A prova
                          entregará todas as {objetivasCount} em vez de {configurado} configuradas.
                          Cadastre mais {falta} questão(ões) para atingir o sorteio pretendido e
                          mais questões ainda para garantir variedade entre as tentativas (ex:
                          recomendados 40 para sortear 20).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-200 text-purple-900 text-xs flex items-center justify-between">
                      <span className="text-[11px]">
                        Banco com <strong>{objetivasCount}</strong> objetivas cadastradas. Cada nova
                        prova sorteará <strong>{configurado}</strong> sem repetição (
                        {objetivasCount - configurado} de folga).
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/20">
              {questoes.map((q, idx) => (
                <div key={q.id} className="p-4 hover:bg-white transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-gray-900">
                            {q.tema ? `[${q.tema}] ` : ''}
                            {q.enunciado}
                          </span>
                          {!q.ativo && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-semibold">
                              Inativa
                            </span>
                          )}
                        </div>

                        {/* Alternativas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                          {(q.alternativas || []).map((alt, aIdx) => {
                            const isCorreta = aIdx === q.correta_index
                            return (
                              <div
                                key={aIdx}
                                className={`text-xs p-2 rounded border flex items-start gap-2 ${
                                  isCorreta
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                    : 'bg-white border-gray-200 text-gray-600'
                                }`}
                              >
                                <span className="font-bold text-[11px] shrink-0">
                                  {String.fromCharCode(65 + aIdx)})
                                </span>
                                <span className="flex-1">{alt}</span>
                                {isCorreta && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {q.gabarito_comentario && (
                          <div className="mt-2 text-[11px] bg-blue-50 border border-blue-200 text-blue-900 p-2 rounded">
                            <span className="font-semibold">Comentário do Gabarito:</span>{' '}
                            {q.gabarito_comentario}
                          </div>
                        )}
                      </div>
                    </div>

                    {podeModificarQuestionario(selectedQuestionario.setor) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditarQuestao(q)}
                          className="h-8 w-8 text-gray-500 hover:text-gray-800"
                          title="Editar questão"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteQuestaoItem(q)}
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          title="Excluir questão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de Nova/Editar Questão */}
        <Dialog open={modalQuestaoOpen} onOpenChange={setModalQuestaoOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">
                {editingQuestao ? 'Editar Questão' : 'Nova Questão do Questionário'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSalvarQuestao} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Tema / Módulo (opcional)
                  </label>
                  <Input
                    placeholder="Ex: Suporte N1, Atendimento, Redes"
                    value={qTema}
                    onChange={(e) => setQTema(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Ordem de Exibição
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={qOrdem}
                    onChange={(e) => setQOrdem(Number(e.target.value))}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Enunciado da Questão *
                </label>
                <Textarea
                  placeholder="Escreva a pergunta clara para o colaborador..."
                  value={qEnunciado}
                  onChange={(e) => setQEnunciado(e.target.value)}
                  className="text-xs min-h-[70px]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                  Alternativas e Gabarito Correto * (selecione o botão de rádio da correta)
                </label>
                <div className="space-y-2">
                  {qAlternativas.map((alt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQCorretaIndex(idx)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          qCorretaIndex === idx
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Marcar como alternativa correta"
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>
                      <Input
                        placeholder={`Alternativa ${String.fromCharCode(65 + idx)}`}
                        value={alt}
                        onChange={(e) => {
                          const updated = [...qAlternativas]
                          updated[idx] = e.target.value
                          setQAlternativas(updated)
                        }}
                        className={`text-xs h-9 flex-1 ${
                          qCorretaIndex === idx ? 'border-emerald-400 bg-emerald-50/30' : ''
                        }`}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Comentário do Gabarito (visível para Admin na auditoria)
                </label>
                <Textarea
                  placeholder="Explicação do porquê esta resposta é a correta..."
                  value={qComentario}
                  onChange={(e) => setQComentario(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="q_ativo"
                  checked={qAtivo}
                  onChange={(e) => setQAtivo(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="q_ativo" className="text-xs text-gray-700 font-medium">
                  Questão ativa para este questionário
                </label>
              </div>

              <DialogFooter className="gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalQuestaoOpen(false)}
                  disabled={submittingQuestao}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingQuestao}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
                >
                  {submittingQuestao
                    ? 'Salvando...'
                    : editingQuestao
                      ? 'Salvar Questão'
                      : 'Adicionar Questão'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmação Exclusão Questão */}
        <Dialog
          open={Boolean(deleteQuestaoItem)}
          onOpenChange={(o) => !o && setDeleteQuestaoItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                <span>Excluir Questão</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 text-xs text-gray-600">
              Tem certeza que deseja excluir esta questão? Ela deixará de aparecer em novas provas.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteQuestaoItem(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleExcluirQuestao}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Visualização de lista dos questionários
  return (
    <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-6">
      <AvisoSetorGestor setoresList={setoresList} moduloNome="questionários de conhecimento" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Questionários de Conhecimento Técnico
            </h3>
            <p className="text-xs text-gray-400">
              Gerencie provas e bancos de questões por setor (Windows, Linux, Redes) e tipo de uso
              (Onboarding, Reciclagem, etc.)
            </p>
          </div>
        </div>

        {podeEditarQuestionarios && (
          <Button
            onClick={handleOpenNovoQ}
            size="sm"
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 rounded-lg shrink-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Questionário
          </Button>
        )}
      </div>

      {/* Banner discreto para gestor sem permissão de edição */}
      {isGestao && !user?.pode_editar_questionarios && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-semibold">Modo de Consulta (Somente Leitura)</p>
            <p className="text-amber-800 text-[11px]">
              Você possui acesso de visualização aos questionários e ao banco de questões do seu
              setor. Para criar novos questionários ou alterar/excluir questões, solicite ao
              Administrador a permissão &quot;Pode editar questionários do seu setor&quot; na tela
              de Usuários.
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Vínculo com Onboarding (Etapa 3)</p>
          <p className="text-blue-800 text-[11px] leading-relaxed">
            Ao criar um onboarding, o sistema vincula o questionário correspondente à área do
            colaborador. A prova do colaborador na Etapa 3 fica fixada no questionário vinculado na
            criação, garantindo que edições futuras não descaracterizem tentativas em andamento.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-gray-400">Carregando questionários...</div>
      ) : questionarios.length === 0 ? (
        <div className="p-10 text-center space-y-3 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
          <HelpCircle className="w-10 h-10 text-gray-300 mx-auto" />
          <h4 className="text-sm font-semibold text-gray-700">Nenhum questionário cadastrado</h4>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Cadastre o primeiro questionário para vincular aos colaboradores da Etapa 3.
          </p>
          {podeEditarQuestionarios && (
            <Button
              onClick={handleOpenNovoQ}
              size="sm"
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Criar Questionário
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questionarios.map((q) => {
            const tipoInfo = TIPOS_USO_INFO[q.tipo_de_uso] || TIPOS_USO_INFO.onboarding
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                  q.ativo
                    ? 'bg-white border-gray-200 shadow-xs hover:border-brand-300'
                    : 'bg-gray-50/60 border-gray-200/80 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tipoInfo.badge}`}
                    >
                      {tipoInfo.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        q.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {q.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-gray-900 mb-1">{q.nome}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {q.descricao || 'Questionário de conhecimento técnico.'}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-3 flex-wrap">
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">
                      Setor: <strong>{q.setor?.toUpperCase() || 'TODOS'}</strong>
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Min: {q.percentual_aprovacao || 95}%
                    </span>
                    <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-medium">
                      Sorteio: <strong>{q.questoes_por_prova || 20}</strong> q.
                    </span>
                  </div>

                  {/* Alerta de Banco de Questões vs. Sorteio */}
                  {(() => {
                    const stats = contagemQuestoes[q.id] || { total: 0, objetivas: 0 }
                    const configurado = q.questoes_por_prova || 20
                    const falta = configurado - stats.objetivas
                    if (stats.objetivas < configurado) {
                      return (
                        <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            Banco tem <strong>{stats.objetivas}</strong> objetivas — a prova
                            entregará todas as {stats.objetivas} em vez de {configurado} (faltam{' '}
                            {falta} para atingir a meta).
                          </span>
                        </div>
                      )
                    }
                    return (
                      <div className="mb-3 text-[11px] text-gray-500">
                        Banco: <strong>{stats.objetivas}</strong> objetivas disponíveis (
                        {stats.objetivas - configurado} de folga para sorteio aleatório).
                      </div>
                    )
                  })()}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setSelectedQuestionario(q)}
                    className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 rounded-lg flex-1"
                  >
                    <ListOrdered className="w-3.5 h-3.5 mr-1.5" />
                    {podeModificarQuestionario(q.setor)
                      ? 'Gerenciar Questões'
                      : 'Ver Questões (Leitura)'}
                  </Button>

                  <div className="flex items-center gap-1">
                    {podeImprimirQuestionario(q.setor) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-brand-700"
                            title="Imprimir questionário"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 text-xs">
                          <DropdownMenuLabel className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            Imprimir Questionário
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleAbrirImpressao(q.id, 'gabarito')}
                            className="cursor-pointer py-2"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                            <div>
                              <div className="font-semibold text-gray-900">Via com Gabarito</div>
                              <div className="text-[10px] text-gray-500">
                                Respostas corretas e critérios
                              </div>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAbrirImpressao(q.id, 'branco')}
                            className="cursor-pointer py-2"
                          >
                            <FileText className="w-4 h-4 mr-2 text-blue-600" />
                            <div>
                              <div className="font-semibold text-gray-900">Prova em Branco</div>
                              <div className="text-[10px] text-gray-500">
                                Folha de prova para o papel
                              </div>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {podeModificarQuestionario(q.setor) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditarQ(q)}
                          className="h-8 w-8 text-gray-500 hover:text-gray-800"
                          title="Editar questionário"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleAtivoQ(q)}
                          className="h-8 w-8 text-gray-500 hover:text-gray-800"
                          title={q.ativo ? 'Desativar questionário' : 'Ativar questionário'}
                        >
                          {q.ativo ? (
                            <XCircle className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteQItem(q)}
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          title="Excluir questionário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar/Editar Questionário */}
      <Dialog open={modalQOpen} onOpenChange={setModalQOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {editingQ ? 'Editar Questionário' : 'Novo Questionário de Conhecimento'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvarQ} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Nome do Questionário *
              </label>
              <Input
                placeholder="Ex: Prova de Windows — Atendimento e Suporte"
                value={formQNome}
                onChange={(e) => setFormQNome(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Descrição</label>
              <Textarea
                placeholder="Breve descrição dos tópicos abordados nesta prova..."
                value={formQDescricao}
                onChange={(e) => setFormQDescricao(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Setor / Área de Aplicação *
                </label>
                <select
                  value={formQSetor}
                  onChange={(e) => setFormQSetor(e.target.value)}
                  className="w-full text-xs h-9 border border-gray-300 rounded-md px-2 bg-white"
                >
                  {setoresList.map((s) => (
                    <option key={s.id} value={s.chave || s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Tipo de Uso *
                </label>
                <select
                  value={formQTipoUso}
                  onChange={(e) => setFormQTipoUso(e.target.value as TipoDeUsoQuestionario)}
                  className="w-full text-xs h-9 border border-gray-300 rounded-md px-2 bg-white"
                >
                  <option value="onboarding">Onboarding (Etapa 3)</option>
                  <option value="reciclagem">Reciclagem</option>
                  <option value="mudanca_area">Mudança de Área</option>
                  <option value="avaliacao">Avaliação Periódica</option>
                  <option value="contratacao">Contratação</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Nota Mínima de Aprovação (%) *
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={formQPercentual}
                    onChange={(e) => setFormQPercentual(Number(e.target.value))}
                    className="text-xs h-9 w-24"
                    required
                  />
                  <span className="text-xs text-gray-500">Padrão: 95%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Questões por Prova (Sorteio) *
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formQQuestoesPorProva}
                    onChange={(e) => setFormQQuestoesPorProva(Math.max(1, Number(e.target.value)))}
                    className="text-xs h-9 w-24"
                    required
                  />
                  <span className="text-xs text-gray-500">Padrão: 20 questões</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="q_ativo_form"
                checked={formQAtivo}
                onChange={(e) => setFormQAtivo(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="q_ativo_form" className="text-xs text-gray-700 font-medium">
                Questionário ativo para uso no sistema
              </label>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalQOpen(false)}
                disabled={submittingQ}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingQ}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {submittingQ
                  ? 'Salvando...'
                  : editingQ
                    ? 'Salvar Questionário'
                    : 'Criar Questionário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Exclusão Questionário */}
      <Dialog open={Boolean(deleteQItem)} onOpenChange={(o) => !o && setDeleteQItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Confirmar Exclusão</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-gray-600">
            Tem certeza que deseja excluir o questionário <strong>"{deleteQItem?.nome}"</strong>?
            Recomendamos desativá-lo caso já tenha sido usado em onboardings passados.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteQItem(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleExcluirQ}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
