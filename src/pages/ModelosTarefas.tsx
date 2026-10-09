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
  Upload,
  AlertCircle,
  ExternalLink,
  Info,
  Play,
  FileCheck2,
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
import { toast } from 'sonner'

export default function ModelosTarefas() {
  const [selectedSetor, setSelectedSetor] = useState<Setor>('windows')
  const [modelos, setModelos] = useState<ModeloTarefa[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TarefaTipo>('video')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitulo, setFormTitulo] = useState('')
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
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchModelos = async () => {
    try {
      setLoading(true)
      const list = await modeloService.listBySetor(selectedSetor)
      setModelos(list)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar templates de tarefas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModelos()
  }, [selectedSetor])

  const videos = useMemo(() => modelos.filter((m) => m.tipo === 'video'), [modelos])
  const manuais = useMemo(() => modelos.filter((m) => m.tipo === 'manual'), [modelos])

  const openNewModal = (tipo: TarefaTipo) => {
    setEditingId(null)
    setModalTipo(tipo)
    setFormTitulo('')
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
      formData.append('setor', selectedSetor)
      formData.append('titulo', formTitulo.trim())
      formData.append('tipo', modalTipo)
      formData.append('conteudo_link', formLink.trim())
      formData.append('obrigatorio', 'true')

      if (formFile) {
        formData.append('conteudo_url', formFile)
      }

      if (editingId) {
        await modeloService.update(editingId, formData)
        toast.success('Modelo atualizado com sucesso!')
      } else {
        await modeloService.create(formData)
        toast.success(`${modalTipo === 'video' ? 'Vídeo' : 'Manual'} adicionado ao setor!`)
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
      !confirm(
        `Tem certeza que deseja excluir "${titulo}"? (Afetará apenas futuros onboardings deste setor)`,
      )
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
      url,
    })
    setPreviewOpen(true)
  }

  const currentSetorInfo = SETORES_INFO[selectedSetor]

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A2233]">Modelos de Tarefas por Setor</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Configure os vídeos e manuais de treinamento pré-carregados para cada um dos 5 setores
              de TI. O upload de novos arquivos ou alterações refletirá automaticamente em todos os
              novos onboardings.
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

      {/* Grid de Abas dos 5 Setores */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {(Object.keys(SETORES_INFO) as Setor[]).map((setorKey) => {
          const info = SETORES_INFO[setorKey]
          const isSelected = selectedSetor === setorKey

          return (
            <button
              key={setorKey}
              type="button"
              onClick={() => setSelectedSetor(setorKey)}
              className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-white shadow-sm scale-[1.01]'
                  : 'border-transparent bg-white/70 hover:bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: info.cor }} />
                <span className="font-bold text-xs text-gray-900 truncate">{info.nome}</span>
              </div>
              <span className="text-[11px] text-gray-400 block truncate">{info.descricao}</span>
            </button>
          )
        })}
      </div>

      {/* Seção do Setor Selecionado */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 space-y-7">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: currentSetorInfo.cor }}
            />
            <h3 className="text-base font-bold text-gray-900">
              Templates do Setor: {currentSetorInfo.nome}
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {modelos.length} itens configurados
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
            {videos.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Nenhum vídeo cadastrado para o setor {currentSetorInfo.nome}.
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
                      <span className="font-semibold text-xs text-gray-900 block truncate">
                        {item.titulo}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {item.conteudo_url ? 'Arquivo MP4 carregado' : 'Vídeo referencial'}
                      </span>
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
            {manuais.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Nenhum manual cadastrado para o setor {currentSetorInfo.nome}.
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
                      <span className="font-semibold text-xs text-gray-900 block truncate">
                        {item.titulo}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {item.conteudo_url ? 'Documento carregado' : 'Documento referencial'}
                      </span>
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
                ? 'Editar Item do Template'
                : `Adicionar ${modalTipo === 'video' ? 'Vídeo' : 'Manual'}`}
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
                placeholder="Ex.: Manual de Procedimentos Movidesk"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="h-10 text-xs"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Upload de Arquivo (mp4, pdf, pptx, docx — máx. 50MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.pdf,.pptx,.docx,.doc,.ppt"
                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={submitting}
              />
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
                {submitting ? 'Salvando...' : 'Salvar no Template'}
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
                      Arquivo anexado ao template do setor {currentSetorInfo.nome}.
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
                <h4 className="text-sm font-bold text-gray-700">Item Pré-carregado no Banco</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Este template foi criado pelo seed do sistema. Você pode carregar o arquivo
                  oficial (.mp4 ou .pdf) editando este item a qualquer momento.
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
