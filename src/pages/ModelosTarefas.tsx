import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  modeloService,
  materialService,
  setorService,
  faseService,
  itemIntegracaoModeloService,
} from '@/services/onboarding'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type {
  ModeloTarefa,
  MaterialBiblioteca,
  Setor,
  TarefaTipo,
  SetorModel,
  ItemIntegracaoModelo,
  SetorVisualInfo,
  FaseModelo,
} from '@/types/onboarding'
import { SETORES_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import {
  Video,
  FileText,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  ExternalLink,
  Info,
  FileCheck2,
  ShieldCheck,
  Library,
  Search,
  Upload,
  Settings2,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Lock,
  CheckSquare,
} from 'lucide-react'
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

type TabType = 'biblioteca' | 'etapa1' | string

export default function ModelosTarefas() {
  const { user, isAdmin, isRH } = useAuth()

  // Lista dinâmica de setores da coleção
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loadingSetores, setLoadingSetores] = useState(true)

  // Aba selecionada: 'biblioteca' | 'etapa1' | setor.id ou setor.chave
  const [selectedTab, setSelectedTab] = useState<TabType>('biblioteca')
  const [modelos, setModelos] = useState<ModeloTarefa[]>([])
  const [fases, setFases] = useState<FaseModelo[]>([])
  const [materiais, setMateriais] = useState<MaterialBiblioteca[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Gerenciamento Geral de Áreas
  const [gerenciarSetoresOpen, setGerenciarSetoresOpen] = useState(false)
  const [setorModalOpen, setSetorModalOpen] = useState(false)
  const [setorEditing, setSetorEditing] = useState<SetorModel | null>(null)
  const [setorNome, setSetorNome] = useState('')
  const [setorDescricao, setSetorDescricao] = useState('')
  const [setorCor, setSetorCor] = useState('#2563EB')
  const [setorAtivo, setSetorAtivo] = useState(true)
  const [setorSubmitting, setSetorSubmitting] = useState(false)
  const [setorError, setSetorError] = useState('')

  // Modal Confirmação de Exclusão/Desativação de Área com contagem de uso
  const [deleteSetorItem, setDeleteSetorItem] = useState<{
    setor: SetorModel
    modelosCount: number
    onboardingsCount: number
  } | null>(null)
  const [deletingSetor, setDeletingSetor] = useState(false)

  // Filtro de busca na biblioteca
  const [buscaMaterial, setBuscaMaterial] = useState('')
  const [filtroTipoMaterial, setFiltroTipoMaterial] = useState<'todos' | 'video' | 'manual'>(
    'todos',
  )

  // Modal Novo / Edição de Material na Biblioteca
  const [materialModalOpen, setMaterialModalOpen] = useState(false)
  const [materialEditingId, setMaterialEditingId] = useState<string | null>(null)
  const [materialTitulo, setMaterialTitulo] = useState('')
  const [materialDescricao, setMaterialDescricao] = useState('')
  const [materialTipo, setMaterialTipo] = useState<TarefaTipo>('manual')
  const [materialSetorOrigem, setMaterialSetorOrigem] = useState<Setor | ''>('')
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [materialSubmitting, setMaterialSubmitting] = useState(false)
  const [materialError, setMaterialError] = useState('')
  const materialFileInputRef = useRef<HTMLInputElement>(null)

  // Modal Confirmação de Exclusão de Material
  const [deleteMaterialItem, setDeleteMaterialItem] = useState<{
    material: MaterialBiblioteca
    modelosCount: number
  } | null>(null)
  const [deletingMaterial, setDeletingMaterial] = useState(false)

  // Modal Novo / Edição de Item do Modelo (Etapa 1 ou Setores)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TarefaTipo>('video')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formFaseId, setFormFaseId] = useState<string>('')
  const [formOrigemArquivo, setFormOrigemArquivo] = useState<'biblioteca' | 'upload_direto'>(
    'biblioteca',
  )
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formLink, setFormLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal Novo / Edição de Fase do Modelo
  const [faseModalOpen, setFaseModalOpen] = useState(false)
  const [faseEditingId, setFaseEditingId] = useState<string | null>(null)
  const [faseTitulo, setFaseTitulo] = useState('')
  const [faseDescricao, setFaseDescricao] = useState('')
  const [faseSubmitting, setFaseSubmitting] = useState(false)
  const [faseError, setFaseError] = useState('')

  // Modal Preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
    descricao?: string
    origem?: string
  } | null>(null)

  // Carregar setores da coleção
  const fetchSetores = async () => {
    try {
      setLoadingSetores(true)
      const data = await setorService.listAll()
      setSetoresList(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar setores.')
    } finally {
      setLoadingSetores(false)
    }
  }

  // Itens de checklist de integração do modelo (Etapa 1)
  const [itensIntegracao, setItensIntegracao] = useState<ItemIntegracaoModelo[]>([])
  const [loadingItensIntegracao, setLoadingItensIntegracao] = useState(false)
  const [novoItemIntegracaoTitulo, setNovoItemIntegracaoTitulo] = useState('')
  const [salvandoItemIntegracao, setSalvandoItemIntegracao] = useState(false)
  const [itemIntegracaoEditandoId, setItemIntegracaoEditandoId] = useState<string | null>(null)
  const [itemIntegracaoEditandoTitulo, setItemIntegracaoEditandoTitulo] = useState('')

  const fetchItensIntegracao = async () => {
    try {
      setLoadingItensIntegracao(true)
      const data = await itemIntegracaoModeloService.listAll()
      setItensIntegracao(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar checklist de integração do modelo.')
    } finally {
      setLoadingItensIntegracao(false)
    }
  }

  // Carregar dados de materiais
  const fetchMateriais = async () => {
    try {
      const list = await materialService.listAll()
      setMateriais(list)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar biblioteca de materiais.')
    }
  }

  // Setor ativo atual (objeto SetorModel correspondente à aba)
  const activeSetorModel = useMemo(() => {
    if (selectedTab === 'biblioteca' || selectedTab === 'etapa1') return null
    return (
      setoresList.find(
        (s) =>
          s.id === selectedTab ||
          s.chave === selectedTab ||
          s.chave?.toLowerCase() === selectedTab.toLowerCase() ||
          s.nome.toLowerCase() === selectedTab.toLowerCase(),
      ) || null
    )
  }, [selectedTab, setoresList])

  // Carregar fases da área ativa (quando não for biblioteca e nem etapa1)
  const fetchFases = async () => {
    if (selectedTab === 'biblioteca' || selectedTab === 'etapa1') {
      setFases([])
      return
    }
    try {
      const setorId = activeSetorModel?.id
      const setorChave = activeSetorModel?.chave || selectedTab
      const list = await faseService.listBySetor(setorChave, setorId)
      setFases(list)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar fases do setor.')
    }
  }

  // Carregar modelos da aba ativa
  const fetchModelos = async () => {
    if (selectedTab === 'biblioteca') {
      return
    }
    try {
      setLoading(true)
      if (selectedTab === 'etapa1') {
        const list = await modeloService.listEtapa1()
        setModelos(list)
        setFases([])
      } else {
        const setorId = activeSetorModel?.id
        const setorChave = activeSetorModel?.chave || selectedTab
        const [listMod, listFas] = await Promise.all([
          modeloService.listBySetor(setorChave, setorId),
          faseService.listBySetor(setorChave, setorId),
        ])
        setModelos(listMod)
        setFases(listFas)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar templates de tarefas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSetores()
    fetchMateriais()
    fetchItensIntegracao()
  }, [])

  useEffect(() => {
    if (selectedTab === 'biblioteca') {
      setLoading(false)
    } else {
      fetchModelos()
    }
  }, [selectedTab, setoresList])

  // Materiais filtrados para a tela da Biblioteca
  const materiaisFiltrados = useMemo(() => {
    return materiais.filter((m) => {
      const matchTipo = filtroTipoMaterial === 'todos' || m.tipo === filtroTipoMaterial
      const matchBusca =
        !buscaMaterial.trim() ||
        m.titulo.toLowerCase().includes(buscaMaterial.toLowerCase()) ||
        (m.descricao && m.descricao.toLowerCase().includes(buscaMaterial.toLowerCase()))
      return matchTipo && matchBusca
    })
  }, [materiais, buscaMaterial, filtroTipoMaterial])

  const videosModelos = useMemo(() => modelos.filter((m) => m.tipo === 'video'), [modelos])
  const manuaisModelos = useMemo(() => modelos.filter((m) => m.tipo === 'manual'), [modelos])

  // ==================== AÇÕES DA BIBLIOTECA DE MATERIAIS ====================
  const openNewMaterialModal = (tipo: TarefaTipo = 'manual') => {
    setMaterialEditingId(null)
    setMaterialTipo(tipo)
    setMaterialTitulo('')
    setMaterialDescricao('')
    setMaterialSetorOrigem('')
    setMaterialFile(null)
    setMaterialError('')
    if (materialFileInputRef.current) materialFileInputRef.current.value = ''
    setMaterialModalOpen(true)
  }

  const openEditMaterialModal = (item: MaterialBiblioteca) => {
    setMaterialEditingId(item.id)
    setMaterialTipo(item.tipo)
    setMaterialTitulo(item.titulo)
    setMaterialDescricao(item.descricao || '')
    setMaterialSetorOrigem(item.setor_origem || '')
    setMaterialFile(null)
    setMaterialError('')
    if (materialFileInputRef.current) materialFileInputRef.current.value = ''
    setMaterialModalOpen(true)
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    setMaterialError('')

    if (!materialTitulo.trim()) {
      setMaterialError('O título do material é obrigatório.')
      return
    }

    if (!materialEditingId && !materialFile) {
      setMaterialError('Por favor selecione um arquivo para o material da biblioteca.')
      return
    }

    if (materialFile && materialFile.size > 52428800) {
      setMaterialError('O arquivo selecionado excede o limite máximo de 50 MB.')
      return
    }

    try {
      setMaterialSubmitting(true)
      const formData = new FormData()
      formData.append('titulo', materialTitulo.trim())
      formData.append('descricao', materialDescricao.trim())
      formData.append('tipo', materialTipo)
      if (materialSetorOrigem) {
        formData.append('setor_origem', materialSetorOrigem)
      } else {
        formData.append('setor_origem', '')
      }

      if (user?.id && !materialEditingId) {
        formData.append('criado_por', user.id)
      }

      if (materialFile) {
        formData.append('arquivo', materialFile)
      }

      if (materialEditingId) {
        await materialService.update(materialEditingId, formData)
        toast.success('Material atualizado com sucesso!')
      } else {
        await materialService.create(formData)
        toast.success('Novo material adicionado à biblioteca!')
      }

      setMaterialModalOpen(false)
      await fetchMateriais()
      if (selectedTab !== 'biblioteca') {
        fetchModelos()
      }
    } catch (err) {
      console.error(err)
      const msg = getErrorMessage(err)
      setMaterialError(msg || 'Erro ao salvar material na biblioteca.')
      toast.error(
        msg ? `Erro ao salvar material: ${msg}` : 'Erro ao salvar material na biblioteca.',
      )
    } finally {
      setMaterialSubmitting(false)
    }
  }

  const promptDeleteMaterial = async (item: MaterialBiblioteca) => {
    try {
      const count = await materialService.countModelosUsingMaterial(item.id)
      setDeleteMaterialItem({ material: item, modelosCount: count })
    } catch (err) {
      console.error(err)
      setDeleteMaterialItem({ material: item, modelosCount: 0 })
    }
  }

  const confirmDeleteMaterial = async () => {
    if (!deleteMaterialItem) return
    try {
      setDeletingMaterial(true)
      await materialService.delete(deleteMaterialItem.material.id)
      toast.success('Material excluído da biblioteca.')
      setDeleteMaterialItem(null)
      fetchMateriais()
      if (selectedTab !== 'biblioteca') {
        fetchModelos()
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir material.')
    } finally {
      setDeletingMaterial(false)
    }
  }

  const openPreviewMaterial = (item: MaterialBiblioteca) => {
    const url = materialService.getFileUrl(item)
    setPreviewItem({
      titulo: item.titulo,
      tipo: item.tipo,
      descricao: item.descricao,
      origem: 'Biblioteca Central de Materiais',
      url,
    })
    setPreviewOpen(true)
  }

  // ==================== AÇÕES DO CHECKLIST DE INTEGRAÇÃO (ETAPA 1) ====================
  const handleAdicionarItemIntegracao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoItemIntegracaoTitulo.trim()) return
    if (!isAdmin && !isRH) {
      toast.error('Apenas Administradores e RH podem editar o checklist do modelo.')
      return
    }

    try {
      setSalvandoItemIntegracao(true)
      await itemIntegracaoModeloService.create({
        titulo: novoItemIntegracaoTitulo.trim(),
        ordem: itensIntegracao.length + 1,
        ativo: true,
      })
      setNovoItemIntegracaoTitulo('')
      toast.success('Item de integração adicionado ao modelo!')
      await fetchItensIntegracao()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao adicionar item de integração.')
    } finally {
      setSalvandoItemIntegracao(false)
    }
  }

  const handleSalvarEdicaoItemIntegracao = async (id: string) => {
    if (!itemIntegracaoEditandoTitulo.trim()) return
    if (!isAdmin && !isRH) {
      toast.error('Apenas Administradores e RH podem editar o checklist do modelo.')
      return
    }

    try {
      setSalvandoItemIntegracao(true)
      await itemIntegracaoModeloService.update(id, {
        titulo: itemIntegracaoEditandoTitulo.trim(),
      })
      setItemIntegracaoEditandoId(null)
      setItemIntegracaoEditandoTitulo('')
      toast.success('Item atualizado!')
      await fetchItensIntegracao()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar item de integração.')
    } finally {
      setSalvandoItemIntegracao(false)
    }
  }

  const handleExcluirItemIntegracao = async (item: ItemIntegracaoModelo) => {
    if (!isAdmin && !isRH) {
      toast.error('Apenas Administradores e RH podem excluir itens do modelo.')
      return
    }
    if (!confirm(`Remover "${item.titulo}" do checklist de integração do modelo?`)) {
      return
    }

    try {
      await itemIntegracaoModeloService.delete(item.id)
      toast.success('Item removido do modelo.')
      await fetchItensIntegracao()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir item de integração.')
    }
  }

  // ==================== AÇÕES DE FASES DO MODELO ====================
  const openNewFaseModal = () => {
    setFaseEditingId(null)
    setFaseTitulo('')
    setFaseDescricao('')
    setFaseError('')
    setFaseModalOpen(true)
  }

  const openEditFaseModal = (fase: FaseModelo) => {
    setFaseEditingId(fase.id)
    setFaseTitulo(fase.titulo)
    setFaseDescricao(fase.descricao || '')
    setFaseError('')
    setFaseModalOpen(true)
  }

  const handleSaveFase = async (e: React.FormEvent) => {
    e.preventDefault()
    setFaseError('')

    if (!faseTitulo.trim()) {
      setFaseError('O título da fase é obrigatório.')
      return
    }

    try {
      setFaseSubmitting(true)
      const setorChave = (
        activeSetorModel?.chave ||
        activeSetorModel?.nome ||
        selectedTab
      ).toLowerCase()

      if (faseEditingId) {
        await faseService.update(faseEditingId, {
          titulo: faseTitulo.trim(),
          descricao: faseDescricao.trim(),
        })
        toast.success('Fase atualizada com sucesso!')
      } else {
        await faseService.create({
          titulo: faseTitulo.trim(),
          descricao: faseDescricao.trim(),
          ordem: fases.length + 1,
          setor: setorChave,
          setor_ref: activeSetorModel?.id || '',
          etapa: 2,
        })
        toast.success('Nova fase criada com sucesso!')
      }

      setFaseModalOpen(false)
      fetchModelos()
    } catch (err) {
      console.error(err)
      const msg = getErrorMessage(err)
      setFaseError(msg || 'Erro ao salvar fase.')
      toast.error(msg ? `Erro ao salvar fase: ${msg}` : 'Erro ao salvar fase.')
    } finally {
      setFaseSubmitting(false)
    }
  }

  const handleDeleteFase = async (fase: FaseModelo) => {
    const itensVinculados = modelos.filter((m) => m.fase === fase.id)
    if (
      !confirm(
        `Tem certeza que deseja excluir a fase "${fase.titulo}"?${
          itensVinculados.length > 0
            ? `\n\nATENÇÃO: Existem ${itensVinculados.length} item(ns) nesta fase. Eles serão movidos para "Atividades Gerais".`
            : ''
        }`,
      )
    ) {
      return
    }

    try {
      // Desvincular itens da fase antes de excluí-la
      for (const item of itensVinculados) {
        await modeloService.update(item.id, { fase: '' })
      }
      await faseService.delete(fase.id)
      toast.success('Fase excluída com sucesso.')
      fetchModelos()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir fase.')
    }
  }

  const handleMoverFase = async (faseId: string, direcao: 'cima' | 'baixo') => {
    const index = fases.findIndex((f) => f.id === faseId)
    if (index === -1) return
    if (direcao === 'cima' && index === 0) return
    if (direcao === 'baixo' && index === fases.length - 1) return

    const targetIndex = direcao === 'cima' ? index - 1 : index + 1
    const currentFase = fases[index]
    const targetFase = fases[targetIndex]

    const newFases = [...fases]
    newFases[index] = targetFase
    newFases[targetIndex] = currentFase

    setFases(newFases)

    try {
      await Promise.all([
        faseService.update(currentFase.id, { ordem: targetIndex + 1 }),
        faseService.update(targetFase.id, { ordem: index + 1 }),
      ])
      toast.success('Ordem das fases atualizada!')
      fetchModelos()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao reordenar fases.')
      fetchModelos()
    }
  }

  // ==================== AÇÕES DE MODELOS DE TAREFAS ====================
  const openNewModal = (tipo: TarefaTipo, defaultFaseId?: string) => {
    setEditingId(null)
    setModalTipo(tipo)
    setFormTitulo('')
    setFormDescricao('')
    setFormFaseId(defaultFaseId || '')
    setFormOrigemArquivo('biblioteca')
    setSelectedMaterialId('')
    setFormFile(null)
    setFormLink('')
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalOpen(true)
  }

  const openEditModal = (item: ModeloTarefa) => {
    setEditingId(item.id)
    setModalTipo(item.tipo)
    setFormTitulo(item.titulo)
    setFormDescricao(item.descricao || '')
    setFormFaseId(item.fase || '')
    if (item.material) {
      setFormOrigemArquivo('biblioteca')
      setSelectedMaterialId(item.material)
    } else if (item.conteudo_url) {
      setFormOrigemArquivo('upload_direto')
      setSelectedMaterialId('')
    } else {
      setFormOrigemArquivo('biblioteca')
      setSelectedMaterialId('')
    }
    setFormFile(null)
    setFormLink(item.conteudo_link || '')
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalOpen(true)
  }

  // Ao selecionar um material da biblioteca no dropdown do modelo, sugerir título e descrição caso vazios
  const handleSelectMaterial = (matId: string) => {
    setSelectedMaterialId(matId)
    if (!matId) return
    const mat = materiais.find((m) => m.id === matId)
    if (mat) {
      if (!formTitulo.trim()) {
        setFormTitulo(mat.titulo)
      }
      if (!formDescricao.trim() && mat.descricao) {
        setFormDescricao(mat.descricao)
      }
    }
  }

  const handleSaveModelo = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formTitulo.trim()) {
      setFormError('O título é obrigatório.')
      return
    }

    if (formOrigemArquivo === 'upload_direto' && formFile && formFile.size > 52428800) {
      setFormError('O arquivo selecionado excede o limite máximo de 50 MB.')
      return
    }

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('titulo', formTitulo.trim())
      formData.append('descricao', formDescricao.trim())
      formData.append('tipo', modalTipo)
      formData.append('conteudo_link', formLink.trim())
      formData.append('obrigatorio', 'true')

      if (selectedTab === 'etapa1') {
        formData.append('etapa', '1')
        formData.append('setor', '')
        formData.append('setor_ref', '')
        formData.append('fase', '')
      } else {
        formData.append('etapa', '2')
        const setorChave = (
          activeSetorModel?.chave ||
          activeSetorModel?.nome ||
          selectedTab
        ).toLowerCase()
        formData.append('setor', setorChave)
        if (activeSetorModel?.id) {
          formData.append('setor_ref', activeSetorModel.id)
        }
        formData.append('fase', formFaseId || '')
      }

      if (formOrigemArquivo === 'biblioteca') {
        // Vincula relation ao material e desvincula upload direto
        formData.append('material', selectedMaterialId || '')
      } else {
        // Upload pontual direto neste modelo
        formData.append('material', '')
        if (formFile) {
          formData.append('conteudo_url', formFile)
        }
      }

      if (editingId) {
        await modeloService.update(editingId, formData)
        toast.success('Modelo atualizado com sucesso!')
      } else {
        formData.append('ordem', String(modelos.length + 1))
        await modeloService.create(formData)
        toast.success(`${modalTipo === 'video' ? 'Vídeo' : 'Manual'} adicionado ao template!`)
      }

      setModalOpen(false)
      fetchModelos()
    } catch (err) {
      console.error(err)
      const msg = getErrorMessage(err)
      setFormError(msg || 'Erro ao salvar template.')
      toast.error(msg ? `Erro ao salvar template: ${msg}` : 'Erro ao salvar template.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteModelo = async (id: string, titulo: string) => {
    if (
      !confirm(`Tem certeza que deseja excluir "${titulo}"? (Afetará apenas futuros onboardings)`)
    ) {
      return
    }

    try {
      await modeloService.delete(id)
      toast.success('Item removido com sucesso.')
      setModelos((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir item.')
    }
  }

  const openPreviewModelo = (item: ModeloTarefa) => {
    const url = modeloService.getFileUrl(item)
    const origemTexto = item.material
      ? `Material da Biblioteca (${item.expand?.material?.titulo || 'vinculado'})`
      : item.conteudo_url
        ? 'Arquivo direto do modelo'
        : 'Sem anexo'

    setPreviewItem({
      titulo: item.titulo,
      tipo: item.tipo,
      descricao: item.descricao,
      origem: origemTexto,
      url,
    })
    setPreviewOpen(true)
  }

  // ==================== GESTÃO DE ÁREAS / SETORES ====================
  const openNewSetorModal = () => {
    setSetorEditing(null)
    setSetorNome('')
    setSetorDescricao('')
    setSetorCor('#2563EB')
    setSetorAtivo(true)
    setSetorError('')
    setSetorModalOpen(true)
  }

  const openEditSetorModal = (item: SetorModel) => {
    setSetorEditing(item)
    setSetorNome(item.nome)
    setSetorDescricao(item.descricao || '')
    setSetorCor(item.cor || '#2563EB')
    setSetorAtivo(item.ativo)
    setSetorError('')
    setSetorModalOpen(true)
  }

  const handleSaveSetor = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetorError('')

    if (!setorNome.trim()) {
      setSetorError('O nome da área/setor é obrigatório.')
      return
    }

    try {
      setSetorSubmitting(true)
      if (setorEditing) {
        await setorService.update(setorEditing.id, {
          nome: setorNome.trim(),
          descricao: setorDescricao.trim(),
          cor: setorCor,
          ativo: setorAtivo,
        })
        toast.success(`Área "${setorNome.trim()}" atualizada com sucesso!`)
      } else {
        const novo = await setorService.create({
          nome: setorNome.trim(),
          descricao: setorDescricao.trim(),
          cor: setorCor,
          ativo: true,
          ordem: setoresList.length + 1,
        })
        toast.success(`Área "${novo.nome}" criada com sucesso!`, {
          description: 'Você pode adicionar modelos de tarefas para ela a qualquer momento.',
          action: {
            label: 'Criar modelo para esta área',
            onClick: () => {
              setSelectedTab(novo.id)
              setGerenciarSetoresOpen(false)
              setTimeout(() => {
                openNewModal('manual')
              }, 200)
            },
          },
        })
        // Abre automaticamente a aba da nova área
        setSelectedTab(novo.id)
      }

      setSetorModalOpen(false)
      await fetchSetores()
    } catch (err: unknown) {
      console.error(err)
      const msg = getErrorMessage(err)
      setSetorError(msg || 'Erro ao salvar área. Verifique se o nome já existe.')
      toast.error(msg ? `Erro ao salvar área: ${msg}` : 'Erro ao salvar área.')
    } finally {
      setSetorSubmitting(false)
    }
  }

  const promptDeleteSetor = async (item: SetorModel) => {
    try {
      const counts = await setorService.countUsage(item.id, item.chave || item.nome)
      setDeleteSetorItem({
        setor: item,
        modelosCount: counts.modelosCount,
        onboardingsCount: counts.onboardingsCount,
      })
    } catch (err) {
      console.error(err)
      setDeleteSetorItem({
        setor: item,
        modelosCount: 0,
        onboardingsCount: 0,
      })
    }
  }

  const confirmDeleteSetor = async () => {
    if (!deleteSetorItem) return
    try {
      setDeletingSetor(true)
      await setorService.delete(deleteSetorItem.setor.id)
      toast.success(`Área "${deleteSetorItem.setor.nome}" excluída com sucesso.`)

      // Se a aba excluída era a ativa, volta para biblioteca
      if (selectedTab === deleteSetorItem.setor.id || selectedTab === deleteSetorItem.setor.chave) {
        setSelectedTab('biblioteca')
      }

      setDeleteSetorItem(null)
      await fetchSetores()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir área.')
    } finally {
      setDeletingSetor(false)
    }
  }

  const handleToggleAtivoSetor = async (item: SetorModel) => {
    try {
      const novoStatus = !item.ativo
      await setorService.update(item.id, { ativo: novoStatus })
      toast.success(`Área "${item.nome}" ${novoStatus ? 'ativada' : 'desativada'} com sucesso!`)
      await fetchSetores()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao alterar status da área.')
    }
  }

  const isBiblioteca = selectedTab === 'biblioteca'
  const isEtapa1 = selectedTab === 'etapa1'

  // Informações visuais do setor ativo atual
  const currentSetorInfo: SetorVisualInfo | null = useMemo(() => {
    if (isBiblioteca || isEtapa1) return null
    return getSetorVisual(selectedTab, activeSetorModel)
  }, [isBiblioteca, isEtapa1, selectedTab, activeSetorModel])

  // Materiais disponíveis no modal de seleção filtrados pelo tipo corrente
  const materiaisCompativeis = useMemo(() => {
    return materiais.filter((m) => m.tipo === modalTipo)
  }, [materiais, modalTipo])

  // Modelos agrupados por fase na aba de setor
  const modelosSemFase = useMemo(() => {
    return modelos.filter((m) => !m.fase || !fases.some((f) => f.id === m.fase))
  }, [modelos, fases])

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-[#1A2233]">Modelos de Tarefas & Treinamento</h2>
              {isAdmin ? (
                <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Acesso Administrador
                </span>
              ) : isRH ? (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Gestão pelo RH
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">
              Centralize vídeos e manuais na <strong>Biblioteca Central de Materiais</strong> e
              associe aos templates da <strong>Etapa 1 (Geral RH)</strong> e das{' '}
              <strong>Áreas/Setores da Empresa</strong>. Você pode adicionar novas áreas
              dinamicamente conforme a empresa expande.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {(isAdmin || isRH) && (
              <Button
                variant="outline"
                onClick={() => setGerenciarSetoresOpen(true)}
                className="text-xs font-semibold h-9 border-gray-300 hover:bg-gray-50 rounded-lg shadow-xs"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1.5 text-gray-600" />
                Gerenciar Áreas
              </Button>
            )}

            {isBiblioteca ? (
              <Button
                onClick={() => openNewMaterialModal('manual')}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-9 rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Novo Material na Biblioteca
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => openNewModal('video')}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold h-9 rounded-lg"
                >
                  <Video className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar Vídeo
                </Button>
                <Button
                  onClick={() => openNewModal('manual')}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-9 rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar Manual
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Seleção de Abas: [Biblioteca de Materiais] + [Etapa 1 — Geral RH] + [Setores Dinâmicos da Coleção] */}
      <div className="flex flex-wrap gap-2.5">
        {/* 1. Aba Biblioteca Central */}
        <button
          type="button"
          onClick={() => setSelectedTab('biblioteca')}
          className={`p-3 rounded-xl border-2 text-left transition-all flex-1 min-w-[140px] max-w-[200px] ${
            selectedTab === 'biblioteca'
              ? 'border-indigo-600 bg-white shadow-sm ring-1 ring-indigo-200'
              : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Library className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold text-xs text-gray-900 truncate">Biblioteca</span>
          </div>
          <span className="text-[11px] text-gray-400 block truncate">Materiais compartilhados</span>
        </button>

        {/* 2. Aba Etapa 1 */}
        <button
          type="button"
          onClick={() => setSelectedTab('etapa1')}
          className={`p-3 rounded-xl border-2 text-left transition-all flex-1 min-w-[140px] max-w-[200px] ${
            selectedTab === 'etapa1'
              ? 'border-brand-600 bg-white shadow-sm ring-1 ring-brand-200'
              : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-brand-600 shrink-0" />
            <span className="font-bold text-xs text-gray-900 truncate">Etapa 1 — RH</span>
          </div>
          <span className="text-[11px] text-gray-400 block truncate">
            Apresentação institucional
          </span>
        </button>

        {/* 3. Abas das Áreas Dinâmicas da Coleção (ou fallback se carregando/vazio) */}
        {(setoresList.length > 0
          ? setoresList.filter((s) => s.ativo !== false)
          : Object.keys(SETORES_INFO).map((k) => ({
              id: k,
              nome: SETORES_INFO[k].nome,
              descricao: SETORES_INFO[k].descricao,
              cor: SETORES_INFO[k].cor,
              ativo: true,
            }))
        ).map((s) => {
          const isSelected = selectedTab === s.id || (s.chave && selectedTab === s.chave)
          const cor = s.cor || '#4F46E5'

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedTab(s.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all flex-1 min-w-[130px] max-w-[190px] ${
                isSelected
                  ? 'border-brand-600 bg-white shadow-sm ring-1 ring-brand-200'
                  : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                <span className="font-bold text-xs text-gray-900 truncate">{s.nome}</span>
              </div>
              <span className="text-[11px] text-gray-400 block truncate">
                {s.descricao || 'Área da empresa'}
              </span>
            </button>
          )
        })}

        {/* Botão Atalho "Nova Área" para Admin/RH direto nas abas */}
        {(isAdmin || isRH) && (
          <button
            type="button"
            onClick={openNewSetorModal}
            className="p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-500 hover:bg-brand-50/50 text-gray-500 hover:text-brand-600 transition-all flex items-center justify-center gap-1.5 min-w-[110px]"
            title="Criar nova área/setor para a empresa"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Nova área</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CONTEÚDO DA ABA: BIBLIOTECA CENTRAL DE MATERIAIS */}
      {/* ========================================================================= */}
      {isBiblioteca ? (
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Biblioteca Central de Materiais de TI
                </h3>
                <p className="text-xs text-gray-400">
                  Arquivos únicos (.mp4, .pdf, .pptx, .docx) que podem ser associados a múltiplos
                  modelos de tarefas
                </p>
              </div>
            </div>

            <Button
              onClick={() => openNewMaterialModal('manual')}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-8 rounded-lg shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Material
            </Button>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Buscar material por título ou descrição..."
                value={buscaMaterial}
                onChange={(e) => setBuscaMaterial(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto self-start">
              <Button
                variant={filtroTipoMaterial === 'todos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroTipoMaterial('todos')}
                className={`h-8 text-xs ${
                  filtroTipoMaterial === 'todos'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : ''
                }`}
              >
                Todos ({materiais.length})
              </Button>
              <Button
                variant={filtroTipoMaterial === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroTipoMaterial('video')}
                className={`h-8 text-xs ${
                  filtroTipoMaterial === 'video'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : ''
                }`}
              >
                <Video className="w-3 h-3 mr-1" />
                Vídeos ({materiais.filter((m) => m.tipo === 'video').length})
              </Button>
              <Button
                variant={filtroTipoMaterial === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroTipoMaterial('manual')}
                className={`h-8 text-xs ${
                  filtroTipoMaterial === 'manual'
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : ''
                }`}
              >
                <FileText className="w-3 h-3 mr-1" />
                Manuais ({materiais.filter((m) => m.tipo === 'manual').length})
              </Button>
            </div>
          </div>

          {/* Tabela / Lista de Materiais */}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/20">
            {materiaisFiltrados.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Library className="w-10 h-10 text-gray-300 mx-auto" />
                <h4 className="text-sm font-semibold text-gray-700">
                  {materiais.length === 0
                    ? 'Nenhum material na biblioteca central ainda'
                    : 'Nenhum material encontrado com este filtro'}
                </h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  {materiais.length === 0
                    ? 'Adicione documentos e vídeos institucionais comuns (ex.: manual do Movidesk, Passportal, regras de conduta) para reutilizar em todos os setores.'
                    : 'Tente alterar os termos de busca ou o filtro de tipo.'}
                </p>
                {materiais.length === 0 && (
                  <Button
                    onClick={() => openNewMaterialModal('manual')}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Subir Primeiro Material
                  </Button>
                )}
              </div>
            ) : (
              materiaisFiltrados.map((item) => {
                const setorOrigemStr = setorToString(item.setor_origem)
                const setorOrigemNome = setorOrigemStr
                  ? setoresList.find((s) => s.chave === setorOrigemStr || s.nome === setorOrigemStr)
                      ?.nome || getSetorVisual(setorOrigemStr).nome
                  : null

                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          item.tipo === 'video'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {item.tipo === 'video' ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-gray-900 truncate">
                            {item.titulo}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                              item.tipo === 'video'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-brand-50 text-brand-700 border-brand-200'
                            }`}
                          >
                            {item.tipo === 'video' ? 'Vídeo (MP4)' : 'Manual / PDF'}
                          </span>
                          {setorOrigemNome && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              Origem: {setorOrigemNome}
                            </span>
                          )}
                          {item.arquivo ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                              Arquivo pronto
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Sem arquivo
                            </span>
                          )}
                        </div>

                        {item.descricao && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5 max-w-2xl">
                            {item.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPreviewMaterial(item)}
                        className="h-8 text-xs text-brand-600 hover:text-brand-700"
                      >
                        Visualizar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditMaterialModal(item)}
                        className="h-8 w-8 text-gray-500 hover:text-gray-800"
                        aria-label="Editar material"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => promptDeleteMaterial(item)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        aria-label="Excluir material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CONTEÚDO DAS ABAS DE MODELOS (ETAPA 1 RH OU SETOR ESPECÍFICO)             */
        /* ========================================================================= */
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-7">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              {isEtapa1 ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                    E1
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Etapa 1 — Apresentação da Empresa (Comum a Todos os Setores)
                    </h3>
                    <p className="text-xs text-gray-400">
                      Itens que o RH apresenta e valida antes de liberar a Vivência Técnica
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: currentSetorInfo?.cor }}
                  />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Etapa 2 — Templates do Setor: {currentSetorInfo?.nome}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Treinamento técnico pré-carregado no início da vivência
                    </p>
                  </div>
                </>
              )}
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {modelos.length} {modelos.length === 1 ? 'item configurado' : 'itens configurados'}
            </span>
          </div>

          {/* SE ETAPA 1: CHECKLIST DE INTEGRAÇÃO + VÍDEOS E MANUAIS */}
          {isEtapa1 ? (
            <>
              {/* Checklist de Integração (Entrega de Material e Apresentações pelo RH) */}
              <div className="space-y-3 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        Checklist de Integração e Entrega de Material
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Etapa 1 — RH
                        </span>
                      </h4>
                      <p className="text-xs text-gray-500">
                        Itens entregues/apresentados pelo RH no primeiro dia. Novos onboardings
                        herdam esta lista como snapshot inicial.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Formulário para Adicionar Item (Admin ou RH) */}
                {(isAdmin || isRH) && (
                  <form onSubmit={handleAdicionarItemIntegracao} className="flex gap-2 pt-1">
                    <Input
                      type="text"
                      placeholder="Novo item do checklist (ex.: Crachá físico, Fone USB, etc.)"
                      value={novoItemIntegracaoTitulo}
                      onChange={(e) => setNovoItemIntegracaoTitulo(e.target.value)}
                      className="text-xs h-9 bg-white"
                      disabled={salvandoItemIntegracao}
                    />
                    <Button
                      type="submit"
                      disabled={salvandoItemIntegracao || !novoItemIntegracaoTitulo.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Item
                    </Button>
                  </form>
                )}

                {/* Lista de Itens do Modelo */}
                <div className="divide-y divide-emerald-100 border border-emerald-100 rounded-lg overflow-hidden bg-white">
                  {loadingItensIntegracao ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Carregando checklist de integração...
                    </div>
                  ) : itensIntegracao.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Nenhum item configurado no checklist de integração.
                    </div>
                  ) : (
                    itensIntegracao.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-emerald-50/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {itemIntegracaoEditandoId === item.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                type="text"
                                value={itemIntegracaoEditandoTitulo}
                                onChange={(e) => setItemIntegracaoEditandoTitulo(e.target.value)}
                                className="text-xs h-8 bg-white flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSalvarEdicaoItemIntegracao(item.id)}
                                disabled={salvandoItemIntegracao}
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setItemIntegracaoEditandoId(null)
                                  setItemIntegracaoEditandoTitulo('')
                                }}
                                className="h-8 text-xs"
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-gray-900 block truncate">
                                {item.titulo}
                              </span>
                            </div>
                          )}
                        </div>

                        {itemIntegracaoEditandoId !== item.id && (isAdmin || isRH) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setItemIntegracaoEditandoId(item.id)
                                setItemIntegracaoEditandoTitulo(item.titulo)
                              }}
                              className="h-7 w-7 text-gray-500 hover:text-gray-800"
                              title="Renomear item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExcluirItemIntegracao(item)}
                              className="h-7 w-7 text-gray-400 hover:text-red-600"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 1. Vídeos Obrigatórios Etapa 1 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-purple-600" />
                    <h4 className="text-sm font-bold text-gray-800">Vídeos Institucionais</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openNewModal('video')}
                    className="h-8 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar Vídeo
                  </Button>
                </div>

                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/30">
                  {loading ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Carregando modelos...
                    </div>
                  ) : videosModelos.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Nenhum vídeo cadastrado para a Etapa 1.
                    </div>
                  ) : (
                    videosModelos.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-gray-900 block truncate">
                                {item.titulo}
                              </span>
                              {item.material ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1 shrink-0">
                                  <Library className="w-3 h-3" /> Material da Biblioteca
                                </span>
                              ) : item.conteudo_url ? (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                                  Upload direto
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded font-medium shrink-0">
                                  Sem anexo
                                </span>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                {item.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreviewModelo(item)}
                            className="h-8 text-xs text-brand-600 hover:text-brand-700"
                          >
                            Visualizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 text-gray-500 hover:text-gray-800"
                            aria-label="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteModelo(item.id, item.titulo)}
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Manuais Obrigatórios Etapa 1 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-gray-800">
                      Manuais e Documentos Obrigatórios
                    </h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openNewModal('manual')}
                    className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar Manual
                  </Button>
                </div>

                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/30">
                  {loading ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Carregando modelos...
                    </div>
                  ) : manuaisModelos.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Nenhum manual cadastrado para a Etapa 1.
                    </div>
                  ) : (
                    manuaisModelos.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-gray-900 block truncate">
                                {item.titulo}
                              </span>
                              {item.material ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1 shrink-0">
                                  <Library className="w-3 h-3" /> Material da Biblioteca
                                </span>
                              ) : item.conteudo_url ? (
                                <span className="text-[10px] bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                                  Upload direto
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded font-medium shrink-0">
                                  Sem anexo
                                </span>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                {item.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreviewModelo(item)}
                            className="h-8 text-xs text-brand-600 hover:text-brand-700"
                          >
                            Visualizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 text-gray-500 hover:text-gray-800"
                            aria-label="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteModelo(item.id, item.titulo)}
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* SE ETAPA 2 (ÁREA/SETOR): PROGRESSÃO DE FASES ORDENADAS + ATIVIDADES GERAIS */
            <div className="space-y-6">
              {/* Barra de Ações de Fases da Área */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-600" />
                    <h4 className="text-sm font-bold text-gray-900">
                      Progressão de Fases Técnicas ({fases.length}{' '}
                      {fases.length === 1 ? 'fase' : 'fases'})
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fases.length > 0
                      ? 'No onboarding, o colaborador só desbloqueia a fase seguinte quando concluir todos os itens da fase anterior.'
                      : 'Esta área não possui fases ordenadas. Seus itens são exibidos no grupo de atividades gerais.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={openNewFaseModal}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 rounded-lg shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Fase
                </Button>
              </div>

              {/* Lista das Fases Ordenadas */}
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Carregando fases e tarefas...
                </div>
              ) : (
                <div className="space-y-5">
                  {fases.map((fase, idx) => {
                    const itensDaFase = modelos.filter((m) => m.fase === fase.id)
                    return (
                      <div
                        key={fase.id}
                        className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs"
                      >
                        {/* Header da Fase */}
                        <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-sm text-gray-900">{fase.titulo}</h5>
                                <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.2 rounded-full">
                                  Fase {idx + 1} de {fases.length}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  {itensDaFase.length} {itensDaFase.length === 1 ? 'item' : 'itens'}
                                </span>
                              </div>
                              {fase.descricao && (
                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                  {fase.descricao}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Ações da Fase */}
                          <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              onClick={() => handleMoverFase(fase.id, 'cima')}
                              className="h-7 w-7 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === fases.length - 1}
                              onClick={() => handleMoverFase(fase.id, 'baixo')}
                              className="h-7 w-7 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditFaseModal(fase)}
                              className="h-7 w-7 text-gray-500 hover:text-gray-900"
                              title="Editar fase"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFase(fase)}
                              className="h-7 w-7 text-gray-400 hover:text-red-600"
                              title="Excluir fase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openNewModal('manual', fase.id)}
                              className="h-7 text-xs border-brand-200 text-brand-700 hover:bg-brand-50"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Item
                            </Button>
                          </div>
                        </div>

                        {/* Itens vinculados à Fase */}
                        <div className="divide-y divide-gray-100 bg-white">
                          {itensDaFase.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">
                              Nenhum item adicionado a esta fase ainda.{' '}
                              <button
                                type="button"
                                onClick={() => openNewModal('manual', fase.id)}
                                className="text-brand-600 font-semibold hover:underline ml-1"
                              >
                                Adicionar primeiro item
                              </button>
                            </div>
                          ) : (
                            itensDaFase.map((item) => (
                              <div
                                key={item.id}
                                className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      item.tipo === 'video'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-brand-100 text-brand-700'
                                    }`}
                                  >
                                    {item.tipo === 'video' ? (
                                      <Video className="w-4 h-4" />
                                    ) : (
                                      <FileText className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-xs text-gray-900 block truncate">
                                        {item.titulo}
                                      </span>
                                      <span
                                        className={`text-[10px] font-medium px-2 py-0.2 rounded border ${
                                          item.tipo === 'video'
                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                            : 'bg-brand-50 text-brand-700 border-brand-200'
                                        }`}
                                      >
                                        {item.tipo === 'video' ? 'Vídeo' : 'Manual'}
                                      </span>
                                      {item.material ? (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1 shrink-0">
                                          <Library className="w-3 h-3" /> Biblioteca
                                        </span>
                                      ) : item.conteudo_url ? (
                                        <span className="text-[10px] bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                                          Upload direto
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.2 rounded font-medium shrink-0">
                                          Sem anexo
                                        </span>
                                      )}
                                    </div>
                                    {item.descricao && (
                                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                        {item.descricao}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openPreviewModelo(item)}
                                    className="h-8 text-xs text-brand-600 hover:text-brand-700"
                                  >
                                    Visualizar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditModal(item)}
                                    className="h-8 w-8 text-gray-500 hover:text-gray-800"
                                    aria-label="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteModelo(item.id, item.titulo)}
                                    className="h-8 w-8 text-gray-400 hover:text-red-600"
                                    aria-label="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Grupo Fallback: Itens sem fase ou Atividades Gerais */}
                  {(fases.length === 0 || modelosSemFase.length > 0) && (
                    <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden bg-slate-50/50">
                      <div className="px-4 py-3 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-xs text-gray-700">
                            {fases.length > 0
                              ? 'Atividades Gerais / Sem Fase Específica'
                              : 'Atividades e Treinamentos da Área'}
                          </h5>
                          <p className="text-[11px] text-gray-500">
                            {fases.length > 0
                              ? 'Itens executados como atividades gerais desta área (disponíveis para confirmação).'
                              : 'Esta área não utiliza fases. Todos os itens ficam reunidos aqui.'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openNewModal('manual')}
                          className="h-7 text-xs border-gray-300 hover:bg-white"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Adicionar Item
                        </Button>
                      </div>

                      <div className="divide-y divide-gray-100 bg-white">
                        {modelosSemFase.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400">
                            Nenhum item avulso neste grupo.
                          </div>
                        ) : (
                          modelosSemFase.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    item.tipo === 'video'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-brand-100 text-brand-700'
                                  }`}
                                >
                                  {item.tipo === 'video' ? (
                                    <Video className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs text-gray-900 block truncate">
                                      {item.titulo}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.2 rounded border ${
                                        item.tipo === 'video'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-brand-50 text-brand-700 border-brand-200'
                                      }`}
                                    >
                                      {item.tipo === 'video' ? 'Vídeo' : 'Manual'}
                                    </span>
                                    {item.material ? (
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1 shrink-0">
                                        <Library className="w-3 h-3" /> Biblioteca
                                      </span>
                                    ) : item.conteudo_url ? (
                                      <span className="text-[10px] bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                                        Upload direto
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.2 rounded font-medium shrink-0">
                                        Sem anexo
                                      </span>
                                    )}
                                  </div>
                                  {item.descricao && (
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                      {item.descricao}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPreviewModelo(item)}
                                  className="h-8 text-xs text-brand-600 hover:text-brand-700"
                                >
                                  Visualizar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(item)}
                                  className="h-8 w-8 text-gray-500 hover:text-gray-800"
                                  aria-label="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteModelo(item.id, item.titulo)}
                                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                                  aria-label="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO / EDITAR MATERIAL DA BIBLIOTECA                               */}
      {/* ========================================================================= */}
      <Dialog open={materialModalOpen} onOpenChange={setMaterialModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Library className="w-5 h-5 text-indigo-600" />
              <span>
                {materialEditingId
                  ? 'Editar Material da Biblioteca'
                  : 'Novo Material na Biblioteca'}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveMaterial} className="space-y-4 py-2">
            {materialError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{materialError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tipo de Material *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={materialTipo === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMaterialTipo('manual')}
                  className={
                    materialTipo === 'manual' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''
                  }
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Manual / Documento (PDF/DOCX/PPTX)
                </Button>
                <Button
                  type="button"
                  variant={materialTipo === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMaterialTipo('video')}
                  className={
                    materialTipo === 'video' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
                  }
                >
                  <Video className="w-3.5 h-3.5 mr-1" />
                  Vídeo (MP4)
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Título do Material *
              </label>
              <Input
                placeholder="Ex.: Treinamento Sistema de Chamados Movidesk"
                value={materialTitulo}
                onChange={(e) => setMaterialTitulo(e.target.value)}
                className="h-10 text-xs"
                disabled={materialSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Descrição ou Instruções
              </label>
              <Textarea
                placeholder="Ex.: Manual completo de uso do Movidesk para abertura, escalonamento e encerramento de tickets..."
                value={materialDescricao}
                onChange={(e) => setMaterialDescricao(e.target.value)}
                className="text-xs min-h-[70px]"
                disabled={materialSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Setor de Referência (Opcional)
              </label>
              <select
                value={materialSetorOrigem}
                onChange={(e) => setMaterialSetorOrigem(e.target.value as Setor | '')}
                className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                disabled={materialSubmitting}
              >
                <option value="">Geral / Comum a Todos os Setores</option>
                {setoresList.map((s) => (
                  <option key={s.id} value={s.chave || s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Arquivo {materialEditingId ? '(opcional para substituir)' : '*'} (.mp4, .pdf, .pptx,
                .docx — máx. 50 MB)
              </label>
              <input
                ref={materialFileInputRef}
                type="file"
                accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                disabled={materialSubmitting}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {materialEditingId
                  ? 'Deixe em branco para manter o arquivo atual.'
                  : 'O arquivo será armazenado na biblioteca central e poderá ser associado a múltiplos modelos de tarefas.'}
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaterialModalOpen(false)}
                disabled={materialSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={materialSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {materialSubmitting ? 'Salvando...' : 'Salvar na Biblioteca'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE MATERIAL DA BIBLIOTECA                  */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(deleteMaterialItem)}
        onOpenChange={(open) => !open && setDeleteMaterialItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Confirmar Exclusão de Material</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-600">
              Tem certeza que deseja excluir o material{' '}
              <strong>"{deleteMaterialItem?.material.titulo}"</strong> da biblioteca central?
            </p>

            {deleteMaterialItem && deleteMaterialItem.modelosCount > 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Atenção: Material em uso!
                </p>
                <p>
                  Existem <strong>{deleteMaterialItem.modelosCount}</strong> modelo(s) de tarefa
                  associado(s) a este material. Ao excluir, esses modelos deixarão de exibir este
                  documento/vídeo.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">
                Nenhum modelo de tarefa está vinculado a este material atualmente.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteMaterialItem(null)}
              disabled={deletingMaterial}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmDeleteMaterial}
              disabled={deletingMaterial}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deletingMaterial ? 'Excluindo...' : 'Sim, Excluir Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR / EDITAR ITEM DO MODELO DE TAREFAS                       */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {editingId
                ? 'Editar Item do Modelo'
                : `Adicionar ${modalTipo === 'video' ? 'Vídeo' : 'Manual'} (${
                    isEtapa1 ? 'Etapa 1 — RH' : currentSetorInfo?.nome
                  })`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveModelo} className="space-y-4 py-2">
            {formError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título *</label>
              <Input
                placeholder="Ex.: Manual de Procedimentos e Atendimento Movidesk"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="h-10 text-xs"
                disabled={submitting}
              />
            </div>

            {/* Se estiver em uma área com fases (Etapa 2), permite escolher a fase */}
            {!isEtapa1 && fases.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Vincular à Fase (Opcional)
                </label>
                <select
                  value={formFaseId}
                  onChange={(e) => setFormFaseId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                  disabled={submitting}
                >
                  <option value="">-- Sem fase (Atividades Gerais) --</option>
                  {fases.map((f, idx) => (
                    <option key={f.id} value={f.id}>
                      Fase {idx + 1}: {f.titulo}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Itens vinculados a uma fase só poderão ser validados quando as fases anteriores
                  estiverem concluídas no onboarding.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Descrição ou Instruções
              </label>
              <Textarea
                placeholder="Ex.: Visão geral dos procedimentos a serem seguidos..."
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                className="text-xs min-h-[65px]"
                disabled={submitting}
              />
            </div>

            {/* SELEÇÃO: Associar Material da Biblioteca OU Upload Direto */}
            <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-3">
              <label className="block text-xs font-semibold text-gray-800">
                Origem do Arquivo ({modalTipo === 'video' ? 'Vídeo .mp4' : 'Manual .pdf/.docx'})
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormOrigemArquivo('biblioteca')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formOrigemArquivo === 'biblioteca'
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <Library className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Material da Biblioteca</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Reutiliza arquivo compartilhado
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormOrigemArquivo('upload_direto')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formOrigemArquivo === 'upload_direto'
                      ? 'border-brand-600 bg-brand-50/60 text-brand-900 font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <Upload className="w-3.5 h-3.5 text-brand-600" />
                    <span>Upload direto deste item</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Arquivo só para este modelo
                  </span>
                </button>
              </div>

              {formOrigemArquivo === 'biblioteca' ? (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-gray-700">
                    Selecione o Material da Biblioteca:
                  </label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => handleSelectMaterial(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white"
                    disabled={submitting}
                  >
                    <option value="">-- Escolher material da biblioteca (opcional) --</option>
                    {materiaisCompativeis.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.titulo} {mat.setor_origem ? `[${mat.setor_origem}]` : '[Geral]'}
                      </option>
                    ))}
                  </select>
                  {materiaisCompativeis.length === 0 && (
                    <p className="text-[11px] text-amber-600">
                      Nenhum material do tipo {modalTipo === 'video' ? 'vídeo' : 'manual'} na
                      biblioteca. Você pode criar um na aba "Biblioteca" ou usar a opção de upload
                      direto.
                    </p>
                  )}
                  {selectedMaterialId && (
                    <p className="text-[11px] text-emerald-600">
                      ✓ Material selecionado. Caso o arquivo da biblioteca seja atualizado no
                      futuro, este modelo receberá a atualização automaticamente.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-gray-700">
                    Selecione o arquivo local (.mp4, .pdf, .pptx, .docx — máx. 50 MB):
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-gray-400">
                    {editingId
                      ? 'Deixe em branco para manter o arquivo atual.'
                      : 'Opcional. Se não enviar agora, pode carregar posteriormente.'}
                  </p>
                </div>
              )}
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
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {submitting ? 'Salvando...' : 'Salvar Modelo'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR FASE DO MODELO                                      */}
      {/* ========================================================================= */}
      <Dialog open={faseModalOpen} onOpenChange={setFaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-600" />
              <span>{faseEditingId ? 'Editar Fase Técnica' : 'Nova Fase Técnica'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveFase} className="space-y-4 py-2">
            {faseError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{faseError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Título da Fase *
              </label>
              <Input
                placeholder="Ex.: Mapeamento de Ambientes, Shadowing Ativo..."
                value={faseTitulo}
                onChange={(e) => setFaseTitulo(e.target.value)}
                className="h-10 text-xs"
                disabled={faseSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Descrição Curta e Instruções da Fase
              </label>
              <Textarea
                placeholder="Ex.: Estudo aprofundado da documentação no Passportal. Identificação de topologia de rede e faixas de IP..."
                value={faseDescricao}
                onChange={(e) => setFaseDescricao(e.target.value)}
                className="text-xs min-h-[90px]"
                disabled={faseSubmitting}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Esta descrição será exibida para o colaborador no portal e para o gestor durante a
                condução.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFaseModalOpen(false)}
                disabled={faseSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={faseSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {faseSubmitting ? 'Salvando...' : faseEditingId ? 'Salvar Fase' : 'Criar Fase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZAÇÃO / PLAYER DE ARQUIVO                                   */}
      {/* ========================================================================= */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
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

          <div className="py-2 space-y-4">
            {previewItem?.origem && (
              <div className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5">
                <Library className="w-3.5 h-3.5" />
                <span>Origem: {previewItem.origem}</span>
              </div>
            )}

            {previewItem?.descricao && (
              <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200/80 leading-relaxed">
                {previewItem.descricao}
              </p>
            )}

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
                      Arquivo anexado ({previewItem.origem || 'Modelo de Tarefas'}).
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
                <h4 className="text-sm font-bold text-gray-700">Nenhum Arquivo Anexado</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Este item ainda não possui um arquivo enviado. Você pode editar este item a
                  qualquer momento para associar um material da biblioteca central ou fazer upload
                  direto.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: GERENCIAMENTO DE ÁREAS / SETORES                                    */}
      {/* ========================================================================= */}
      <Dialog open={gerenciarSetoresOpen} onOpenChange={setGerenciarSetoresOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-600" />
                <span>Gestão de Áreas da Empresa</span>
              </DialogTitle>
              <Button
                size="sm"
                onClick={openNewSetorModal}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Área
              </Button>
            </div>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-500">
              Crie novas áreas ou ajuste as existentes (técnicas ou administrativas). As áreas
              ativas aparecem no formulário de novos onboardings e como abas nos modelos de tarefas.
            </p>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
              {setoresList.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">Carregando áreas...</div>
              ) : (
                setoresList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors ${
                      !item.ativo ? 'opacity-60 bg-gray-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.cor || '#2563EB' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-900 truncate">
                            {item.nome}
                          </span>
                          {!item.ativo && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 border px-1.5 py-0.2 rounded font-medium">
                              Desativada
                            </span>
                          )}
                        </div>
                        {item.descricao && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {item.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAtivoSetor(item)}
                        className={`h-8 text-xs ${
                          item.ativo
                            ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {item.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditSetorModal(item)}
                        className="h-8 w-8 text-gray-500 hover:text-gray-800"
                        aria-label="Editar área"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => promptDeleteSetor(item)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        aria-label="Excluir área"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGerenciarSetoresOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR ÁREA / SETOR                                        */}
      {/* ========================================================================= */}
      <Dialog open={setorModalOpen} onOpenChange={setSetorModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-600" />
              <span>{setorEditing ? 'Editar Área / Setor' : 'Nova Área / Setor'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSetor} className="space-y-4 py-2">
            {setorError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{setorError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nome da Área / Setor *
              </label>
              <Input
                placeholder="Ex.: RH, Comercial, Laboratório, Financeiro..."
                value={setorNome}
                onChange={(e) => setSetorNome(e.target.value)}
                className="h-10 text-xs"
                disabled={setorSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Descrição ou Atribuições da Área
              </label>
              <Textarea
                placeholder="Ex.: Atividades de recrutamento, departamento pessoal e rotinas da empresa..."
                value={setorDescricao}
                onChange={(e) => setSetorDescricao(e.target.value)}
                className="text-xs min-h-[70px]"
                disabled={setorSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cor da Identidade
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={setorCor}
                    onChange={(e) => setSetorCor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded cursor-pointer border border-gray-300"
                    disabled={setorSubmitting}
                  />
                  <span className="text-xs text-gray-600 font-mono">{setorCor}</span>
                </div>
              </div>

              {setorEditing && (
                <div className="pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setorAtivo}
                      onChange={(e) => setSetorAtivo(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600"
                      disabled={setorSubmitting}
                    />
                    <span>Área Ativa</span>
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSetorModalOpen(false)}
                disabled={setorSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={setorSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {setorSubmitting
                  ? 'Salvando...'
                  : setorEditing
                    ? 'Salvar Alterações'
                    : 'Criar Área'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE ÁREA / SETOR COM AVISO DE CONTAGEM       */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(deleteSetorItem)}
        onOpenChange={(open) => !open && setDeleteSetorItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Confirmar Exclusão da Área</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-600">
              Tem certeza que deseja excluir a área <strong>"{deleteSetorItem?.setor.nome}"</strong>
              ?
            </p>

            {deleteSetorItem &&
            (deleteSetorItem.modelosCount > 0 || deleteSetorItem.onboardingsCount > 0) ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Atenção: Área em uso no sistema!
                </p>
                <p>
                  Esta área possui: <strong>{deleteSetorItem.modelosCount}</strong> modelo(s) de
                  tarefa e <strong>{deleteSetorItem.onboardingsCount}</strong> colaborador(es) em
                  onboarding associados.
                </p>
                <p className="text-[11px] text-amber-800">
                  Recomendação: prefira <strong>desativar</strong> a área para preservar o histórico
                  e os modelos já configurados.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">
                Nenhum modelo ou onboarding está vinculado a esta área no momento.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteSetorItem(null)}
              disabled={deletingSetor}
            >
              Cancelar
            </Button>
            {deleteSetorItem && deleteSetorItem.setor.ativo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (deleteSetorItem) {
                    await handleToggleAtivoSetor(deleteSetorItem.setor)
                    setDeleteSetorItem(null)
                  }
                }}
                disabled={deletingSetor}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                Apenas Desativar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={confirmDeleteSetor}
              disabled={deletingSetor}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deletingSetor ? 'Excluindo...' : 'Excluir Área'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
