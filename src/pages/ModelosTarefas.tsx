import React, { useState, useEffect, useRef, useMemo } from 'react'
import { modeloService } from '@/services/onboarding'
import type { ModeloTarefa, Setor, TarefaTipo } from '@/types/onboarding'
import { SETORES_INFO } from '@/types/onboarding'
import {
  Layers,
  Video,
  FileText,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  ExternalLink,
  Info,
  FileCheck2,
  Building2,
  ShieldCheck,
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

export default function ModelosTarefas() {
  const { user } = useAuth()
  const isRH = user?.setor === 'RH'
  const isGestao = user?.setor === 'Gestão'

  // Aba selecionada: 'etapa1' ou um dos 5 setores (etapa 2)
  const [selectedTab, setSelectedTab] = useState<'etapa1' | Setor>('etapa1')
  const [modelos, setModelos] = useState<ModeloTarefa[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TarefaTipo>('video')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formLink, setFormLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Modal Preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{
    titulo: string
    tipo: TarefaTipo
    url: string
    descricao?: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchModelos = async () => {
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
    fetchModelos()
  }, [selectedTab])

  const videos = useMemo(() => modelos.filter((m) => m.tipo === 'video'), [modelos])
  const manuais = useMemo(() => modelos.filter((m) => m.tipo === 'manual'), [modelos])

  const openNewModal = (tipo: TarefaTipo) => {
    setEditingId(null)
    setModalTipo(tipo)
    setFormTitulo('')
    setFormDescricao('')
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
    setFormFile(null)
    setFormLink(item.conteudo_link || '')
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formTitulo.trim()) {
      setFormError('O título é obrigatório.')
      return
    }

    if (formFile && formFile.size > 52428800) {
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

      if (formFile) {
        formData.append('conteudo_url', formFile)
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

  const handleDelete = async (id: string, titulo: string) => {
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

  const openPreview = (item: ModeloTarefa) => {
    const url = modeloService.getFileUrl(item)
    setPreviewItem({
      titulo: item.titulo,
      tipo: item.tipo,
      descricao: item.descricao,
      url,
    })
    setPreviewOpen(true)
  }

  const isEtapa1 = selectedTab === 'etapa1'
  const currentSetorInfo = !isEtapa1 ? SETORES_INFO[selectedTab as Setor] : null

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-[#1A2233]">Modelos de Tarefas & Treinamento</h2>
              {isRH ? (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Gestão pelo RH
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Configure os materiais institucionais da{' '}
              <strong>Etapa 1 (Apresentação da Empresa)</strong> e os vídeos/manuais específicos de
              cada setor para a <strong>Etapa 2 (Vivência Técnica)</strong>. Suba arquivos de vídeo
              (.mp4) ou documentos (.pdf) de até 50 MB.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </div>
      </div>

      {/* Grid de Seleção de Abas: Etapa 1 (Geral RH) + 5 Setores de TI (Etapa 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        {/* Aba Etapa 1 */}
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
            <span className="font-bold text-xs text-gray-900 truncate">Etapa 1 — Geral RH</span>
          </div>
          <span className="text-[11px] text-gray-400 block truncate">
            Apresentação institucional & cultura
          </span>
        </button>

        {/* Abas dos 5 Setores */}
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

      {/* Seção de Conteúdo da Aba Selecionada */}
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
            ) : videos.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Nenhum vídeo cadastrado{' '}
                {isEtapa1 ? 'para a Etapa 1' : `para o setor ${currentSetorInfo?.nome}`}.
              </div>
            ) : (
              videos.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-gray-900 block truncate">
                          {item.titulo}
                        </span>
                        {item.conteudo_url ? (
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                            Vídeo anexado
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
                      onClick={() => openPreview(item)}
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
                      onClick={() => handleDelete(item.id, item.titulo)}
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
              <h4 className="text-sm font-bold text-gray-800">Manuais e Documentos Obrigatórios</h4>
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
            ) : manuais.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Nenhum manual cadastrado{' '}
                {isEtapa1 ? 'para a Etapa 1' : `para o setor ${currentSetorInfo?.nome}`}.
              </div>
            ) : (
              manuais.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-gray-900 block truncate">
                          {item.titulo}
                        </span>
                        {item.conteudo_url ? (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-medium shrink-0">
                            Documento anexado
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
                      onClick={() => openPreview(item)}
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
                      onClick={() => handleDelete(item.id, item.titulo)}
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

      {/* Modal Adicionar / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {editingId
                ? 'Editar Item do Modelo'
                : `Adicionar ${modalTipo === 'video' ? 'Vídeo' : 'Manual'} (${
                    isEtapa1 ? 'Etapa 1 — RH' : currentSetorInfo?.nome
                  })`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {formError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título *</label>
              <Input
                placeholder="Ex.: Manual de Procedimentos e Atendimento"
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
                className="text-xs min-h-[70px]"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Upload de Material (vídeo .mp4, documento .pdf, .pptx, .docx — máx. 50 MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={submitting}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {editingId
                  ? 'Deixe em branco para manter o arquivo atual, ou escolha um novo para substituí-lo.'
                  : 'Opcional. Se não enviar agora, pode carregar o arquivo posteriormente.'}
              </p>
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

      {/* Modal Visualização */}
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
                      Arquivo anexado ao modelo (
                      {isEtapa1 ? 'Etapa 1 — RH' : currentSetorInfo?.nome}).
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
                  Este item do modelo ainda não possui um arquivo enviado. Você pode editar este
                  item a qualquer momento para subir o vídeo (.mp4) ou manual (.pdf).
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
