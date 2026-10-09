import React, { useState, useEffect, useRef, useMemo } from 'react'
import { modeloService, materialService } from '@/services/onboarding'
import type { ModeloTarefa, MaterialBiblioteca, Setor, TarefaTipo } from '@/types/onboarding'
import { SETORES_INFO } from '@/types/onboarding'
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
  Link2,
  HelpCircle,
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

type TabType = 'biblioteca' | 'etapa1' | Setor

export default function ModelosTarefas() {
  const { user, isAdmin, isRH } = useAuth()

  // Aba selecionada: 'biblioteca' (nova primeira aba) | 'etapa1' | 5 setores
  const [selectedTab, setSelectedTab] = useState<TabType>('biblioteca')
  const [modelos, setModelos] = useState<ModeloTarefa[]>([])
  const [materiais, setMateriais] = useState<MaterialBiblioteca[]>([])
  const [loading, setLoading] = useState(true)

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
  const [formOrigemArquivo, setFormOrigemArquivo] = useState<'biblioteca' | 'upload_direto'>(
    'biblioteca',
  )
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formLink, setFormLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal Preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
    descricao?: string
    origem?: string
  } | null>(null)

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
      } else {
        const list = await modeloService.listBySetor(selectedTab)
        setModelos(list)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar templates de tarefas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMateriais()
  }, [])

  useEffect(() => {
    if (selectedTab === 'biblioteca') {
      setLoading(false)
    } else {
      fetchModelos()
    }
  }, [selectedTab])

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
      toast.error('Erro ao salvar material na biblioteca.')
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

  // ==================== AÇÕES DE MODELOS DE TAREFAS ====================
  const openNewModal = (tipo: TarefaTipo) => {
    setEditingId(null)
    setModalTipo(tipo)
    setFormTitulo('')
    setFormDescricao('')
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
      } else {
        formData.append('etapa', '2')
        formData.append('setor', selectedTab)
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
      toast.error('Erro ao salvar template.')
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

  const isBiblioteca = selectedTab === 'biblioteca'
  const isEtapa1 = selectedTab === 'etapa1'
  const currentSetorInfo = !isBiblioteca && !isEtapa1 ? SETORES_INFO[selectedTab as Setor] : null

  // Materiais disponíveis no modal de seleção filtrados pelo tipo corrente
  const materiaisCompativeis = useMemo(() => {
    return materiais.filter((m) => m.tipo === modalTipo)
  }, [materiais, modalTipo])

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
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
              Centralize vídeos e manuais na <strong>Biblioteca Central de Materiais</strong> (ex.:
              Movidesk, Passportal) e associe aos templates da <strong>Etapa 1 (Geral RH)</strong> e
              dos <strong>5 Setores de TI (Etapa 2)</strong>, evitando subir o mesmo arquivo
              repetidas vezes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isBiblioteca ? (
              <Button
                onClick={() => openNewMaterialModal('manual')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 rounded-lg shadow-sm"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar Manual
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Seleção de Abas: [Biblioteca de Materiais] + [Etapa 1 — Geral RH] + [5 Setores TI] */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
        {/* 1. Aba Biblioteca Central */}
        <button
          type="button"
          onClick={() => setSelectedTab('biblioteca')}
          className={`p-3.5 rounded-xl border-2 text-left transition-all col-span-2 sm:col-span-1 ${
            selectedTab === 'biblioteca'
              ? 'border-indigo-600 bg-white shadow-sm scale-[1.01]'
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
          className={`p-3.5 rounded-xl border-2 text-left transition-all col-span-2 sm:col-span-1 ${
            selectedTab === 'etapa1'
              ? 'border-blue-600 bg-white shadow-sm scale-[1.01]'
              : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
            <span className="font-bold text-xs text-gray-900 truncate">Etapa 1 — RH</span>
          </div>
          <span className="text-[11px] text-gray-400 block truncate">
            Apresentação institucional
          </span>
        </button>

        {/* 3. Abas dos 5 Setores */}
        {(Object.keys(SETORES_INFO) as Setor[]).map((setorKey) => {
          const info = SETORES_INFO[setorKey]
          const isSelected = selectedTab === setorKey

          return (
            <button
              key={setorKey}
              type="button"
              onClick={() => setSelectedTab(setorKey)}
              className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-white shadow-sm scale-[1.01]'
                  : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: info.cor }}
                />
                <span className="font-bold text-xs text-gray-900 truncate">{info.nome}</span>
              </div>
              <span className="text-[11px] text-gray-400 block truncate">{info.descricao}</span>
            </button>
          )
        })}
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
                  filtroTipoMaterial === 'manual' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
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
                const setorOrigemNome = item.setor_origem
                  ? SETORES_INFO[item.setor_origem as Setor]?.nome
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
                            : 'bg-blue-100 text-blue-700'
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
                                : 'bg-blue-50 text-blue-700 border-blue-200'
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
                        className="h-8 text-xs text-blue-600 hover:text-blue-700"
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
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
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

          {/* 1. Vídeos Obrigatórios */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-bold text-gray-800">Vídeos Obrigatórios</h4>
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
                <div className="p-6 text-center text-xs text-gray-400">Carregando modelos...</div>
              ) : videosModelos.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Nenhum vídeo cadastrado{' '}
                  {isEtapa1 ? 'para a Etapa 1' : `para o setor ${currentSetorInfo?.nome}`}.
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
                        className="h-8 text-xs text-blue-600 hover:text-blue-700"
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

          {/* 2. Manuais Obrigatórios */}
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
                <div className="p-6 text-center text-xs text-gray-400">Carregando modelos...</div>
              ) : manuaisModelos.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Nenhum manual cadastrado{' '}
                  {isEtapa1 ? 'para a Etapa 1' : `para o setor ${currentSetorInfo?.nome}`}.
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
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-medium shrink-0">
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
                        className="h-8 text-xs text-blue-600 hover:text-blue-700"
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
                    materialTipo === 'manual' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
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
                {(Object.keys(SETORES_INFO) as Setor[]).map((s) => (
                  <option key={s} value={s}>
                    {SETORES_INFO[s].nome}
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
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
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
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {submitting ? 'Salvando...' : 'Salvar no Modelo'}
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
                  <FileCheck2 className="w-12 h-12 text-blue-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Documento disponível para leitura
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Arquivo anexado ({previewItem.origem || 'Modelo de Tarefas'}).
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
    </div>
  )
}
