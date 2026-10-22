import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { materialService, colaboradorDocumentoService, setorService } from '@/services/onboarding'
import { formatDateTime, formatShortDate } from '@/lib/dateUtils'
import type {
  ColaboradorDocumento,
  MaterialBiblioteca,
  Onboarding,
  SetorModel,
  StatusDocumentoComplementar,
} from '@/types/onboarding'
import { STATUS_DOCUMENTO_COMPLEMENTAR_INFO } from '@/types/onboarding'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Trash2,
  UploadCloud,
  Library,
  FileCheck2,
  Link as LinkIcon,
  Video,
  File,
  Eye,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface SecaoDocumentosComplementaresProps {
  onboarding: Onboarding
  todosOnboardings?: Onboarding[]
  onDocumentoAlterado?: () => void
}

export function SecaoDocumentosComplementares({
  onboarding,
  todosOnboardings = [],
  onDocumentoAlterado,
}: SecaoDocumentosComplementaresProps) {
  const { user, isAdmin, isRH } = useAuth()
  const podeGerenciar = isAdmin || isRH

  const [documentos, setDocumentos] = useState<ColaboradorDocumento[]>([])
  const [materiaisBiblioteca, setMateriaisBiblioteca] = useState<MaterialBiblioteca[]>([])
  const [carregando, setCarregando] = useState(true)

  // Modal Associar / Upload
  const [modalOpen, setModalOpen] = useState(false)
  const [abaModal, setAbaModal] = useState<'biblioteca' | 'pontual'>('biblioteca')

  // Form Biblioteca
  const [materialSelecionadoId, setMaterialSelecionadoId] = useState('')
  const [filtroBiblioteca, setFiltroBiblioteca] = useState('')
  const [observacaoAssociacao, setObservacaoAssociacao] = useState('')

  // Form Upload Pontual
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novoTipo, setNovoTipo] = useState<'arquivo' | 'link' | 'video'>('arquivo')
  const [novoUrl, setNovoUrl] = useState('')
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null)
  const [novoObservacao, setNovoObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Dialog Remover
  const [modalRemoverOpen, setModalRemoverOpen] = useState(false)
  const [docRemover, setDocRemover] = useState<ColaboradorDocumento | null>(null)
  const [removendo, setRemovendo] = useState(false)

  // IDs unificados do colaborador
  const idsColaborador = useMemo(() => {
    const ids = new Set<string>()
    ids.add(onboarding.id)
    todosOnboardings.forEach((o) => {
      if (
        o.colaborador_nome.trim().toLowerCase() === onboarding.colaborador_nome.trim().toLowerCase()
      ) {
        ids.add(o.id)
      }
    })
    return Array.from(ids)
  }, [onboarding, todosOnboardings])

  const carregarDados = async () => {
    try {
      setCarregando(true)
      const [todosMateriais, ...docsArrays] = await Promise.all([
        materialService.listAll(),
        ...idsColaborador.map((id) => colaboradorDocumentoService.listarPorColaborador(id)),
      ])

      // Flatten e deduplicar
      const mapa = new Map<string, ColaboradorDocumento>()
      docsArrays.flat().forEach((doc) => {
        mapa.set(doc.id, doc)
      })

      setDocumentos(Array.from(mapa.values()))
      setMateriaisBiblioteca(todosMateriais)
    } catch (err) {
      console.error('[SecaoDocumentosComplementares] Erro ao carregar dados:', err)
      toast.error('Não foi possível carregar os documentos complementares.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [idsColaborador])

  // Materiais disponíveis para associação (evita duplicar o mesmo material já associado)
  const idsMateriaisJaAssociados = useMemo(() => {
    return new Set(documentos.map((d) => d.material))
  }, [documentos])

  const materiaisFiltrados = useMemo(() => {
    return materiaisBiblioteca.filter((mat) => {
      const termo = filtroBiblioteca.trim().toLowerCase()
      if (!termo) return true
      return (
        mat.titulo.toLowerCase().includes(termo) ||
        (mat.descricao || '').toLowerCase().includes(termo) ||
        (mat.setor_origem || '').toLowerCase().includes(termo)
      )
    })
  }, [materiaisBiblioteca, filtroBiblioteca])

  const handleCopiarLink = (token: string, titulo: string) => {
    const link = colaboradorDocumentoService.obterLinkPublico(token)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link)
      toast.success(`Link público de "${titulo}" copiado para a área de transferência!`)
    } else {
      window.prompt('Copie o link público do documento:', link)
    }
  }

  const handleAbrirModal = () => {
    setAbaModal('biblioteca')
    setMaterialSelecionadoId('')
    setFiltroBiblioteca('')
    setObservacaoAssociacao('')
    setNovoTitulo('')
    setNovaDescricao('')
    setNovoTipo('arquivo')
    setNovoUrl('')
    setNovoArquivo(null)
    setNovoObservacao('')
    setModalOpen(true)
  }

  const handleSalvarAssociacaoBiblioteca = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!materialSelecionadoId) {
      toast.error('Selecione um material do acervo central.')
      return
    }

    const materialObj = materiaisBiblioteca.find((m) => m.id === materialSelecionadoId)
    if (!materialObj) return

    try {
      setSalvando(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorDocumentoService.associarDaBiblioteca({
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        materialId: materialObj.id,
        materialTitulo: materialObj.titulo,
        observacao: observacaoAssociacao,
        autor,
      })

      toast.success(`Documento "${materialObj.titulo}" associado com sucesso!`)
      setModalOpen(false)
      carregarDados()
      if (onDocumentoAlterado) onDocumentoAlterado()
    } catch (err) {
      console.error('[SecaoDocumentosComplementares] Erro ao associar da biblioteca:', err)
      toast.error('Falha ao associar documento da biblioteca.')
    } finally {
      setSalvando(false)
    }
  }

  const handleSalvarUploadPontual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoTitulo.trim()) {
      toast.error('Informe o título do documento complementar.')
      return
    }

    if (novoTipo === 'arquivo' && !novoArquivo) {
      toast.error('Selecione o arquivo para envio.')
      return
    }

    if ((novoTipo === 'link' || novoTipo === 'video') && !novoUrl.trim()) {
      toast.error('Informe a URL do material complementar.')
      return
    }

    try {
      setSalvando(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorDocumentoService.uploadPontualEAssociar({
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        setor: onboarding.setor || 'Geral',
        titulo: novoTitulo,
        descricao: novaDescricao,
        tipo: novoTipo,
        url: novoUrl,
        arquivo: novoArquivo || undefined,
        observacao: novoObservacao,
        autor,
      })

      toast.success(`Documento pontual "${novoTitulo}" cadastrado e associado com sucesso!`)
      setModalOpen(false)
      carregarDados()
      if (onDocumentoAlterado) onDocumentoAlterado()
    } catch (err) {
      console.error('[SecaoDocumentosComplementares] Erro ao realizar upload pontual:', err)
      toast.error('Falha ao enviar documento pontual.')
    } finally {
      setSalvando(false)
    }
  }

  const handleConfirmarRemover = async () => {
    if (!docRemover) return
    const docTitulo = docRemover.expand?.material?.titulo || 'Documento'

    try {
      setRemovendo(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorDocumentoService.desassociar({
        id: docRemover.id,
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        documentoTitulo: docTitulo,
        autor,
      })

      toast.success(`Documento "${docTitulo}" desassociado com sucesso.`)
      setModalRemoverOpen(false)
      setDocRemover(null)
      carregarDados()
      if (onDocumentoAlterado) onDocumentoAlterado()
    } catch (err) {
      console.error('[SecaoDocumentosComplementares] Erro ao desassociar documento:', err)
      toast.error('Falha ao desassociar documento.')
    } finally {
      setRemovendo(false)
    }
  }

  // Estatísticas
  const estatisticas = useMemo(() => {
    let confirmados = 0
    let pendentes = 0
    documentos.forEach((d) => {
      if (d.status === 'confirmado') confirmados++
      else pendentes++
    })
    return { confirmados, pendentes, total: documentos.length }
  }, [documentos])

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-gray-900">
                  Documentos Complementares
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-white text-blue-800 border-blue-200">
                  {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}
                </Badge>
                {estatisticas.confirmados > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {estatisticas.confirmados} lido(s) / confirmado(s)
                  </Badge>
                )}
                {estatisticas.pendentes > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {estatisticas.pendentes} aguardando leitura
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Acervo central e uploads pontuais com entrega via link público e confirmação de
                leitura registrada
              </CardDescription>
            </div>
          </div>

          {podeGerenciar && (
            <Button
              type="button"
              size="sm"
              onClick={handleAbrirModal}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs h-8 shrink-0 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Documento</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {carregando ? (
          <div className="py-12 text-center text-xs text-gray-400 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Carregando documentos complementares...</p>
          </div>
        ) : documentos.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                Nenhum documento complementar associado a este colaborador
              </p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
                Associe arquivos do acervo central (manuais, vídeos, cartilhas) ou faça uploads
                pontuais específicos para a pessoa. O colaborador recebe o link público e confirma a
                leitura sem precisar de login.
              </p>
            </div>
            {podeGerenciar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAbrirModal}
                className="text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar Primeiro Documento
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentos.map((doc) => {
              const material = doc.expand?.material
              const statusInfo = STATUS_DOCUMENTO_COMPLEMENTAR_INFO[doc.status]
              const linkPublico = colaboradorDocumentoService.obterLinkPublico(doc.token)

              return (
                <div
                  key={doc.id}
                  className="rounded-xl border border-gray-200 p-4 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          {material?.tipo === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : (material?.tipo as string) === 'link' ? (
                            <LinkIcon className="w-4 h-4" />
                          ) : (
                            <File className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
                            {material?.titulo || 'Documento sem título'}
                          </h4>
                          <span className="text-[10px] text-gray-400 capitalize">
                            Tipo: {material?.tipo || 'arquivo'}
                            {material?.setor_origem ? ` • Setor: ${material.setor_origem}` : ''}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 font-medium ${statusInfo.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${statusInfo.dotClass}`} />
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {material?.descricao && (
                      <p className="text-xs text-gray-600 line-clamp-2">{material.descricao}</p>
                    )}

                    {doc.observacao && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] text-slate-700">
                        <span className="font-semibold text-slate-800">Obs do gestor/RH: </span>
                        {doc.observacao}
                      </div>
                    )}

                    {/* Status de Confirmação */}
                    <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-100 flex flex-col gap-1">
                      {doc.status === 'confirmado' ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Confirmado em{' '}
                            {doc.confirmado_em
                              ? formatDateTime(doc.confirmado_em)
                              : 'data registrada'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Aguardando confirmação de leitura do colaborador</span>
                        </div>
                      )}

                      {doc.atribuido_por && (
                        <span className="text-[10px] text-gray-400">
                          Atribuído por {doc.atribuido_por} em{' '}
                          {doc.atribuido_em
                            ? formatShortDate(doc.atribuido_em)
                            : formatShortDate(doc.created)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopiarLink(doc.token, material?.titulo || 'Documento')}
                        className="h-7 text-[11px] px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                        title="Copiar link público de confirmação para enviar ao colaborador"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar Link Público</span>
                      </Button>

                      <a
                        href={linkPublico}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-7 text-[11px] px-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        title="Visualizar página pública do documento"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        <span>Abrir</span>
                      </a>
                    </div>

                    {podeGerenciar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDocRemover(doc)
                          setModalRemoverOpen(true)
                        }}
                        className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Desassociar documento do colaborador"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Remover</span>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Adicionar Documento: Da Biblioteca ou Upload Pontual */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
              Adicionar Documento Complementar
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Colaborador: <strong>{onboarding.colaborador_nome}</strong> ({onboarding.cargo} •{' '}
              {onboarding.setor})
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={abaModal}
            onValueChange={(v) => setAbaModal(v as 'biblioteca' | 'pontual')}
            className="w-full pt-2"
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="biblioteca" className="text-xs gap-1.5">
                <Library className="w-3.5 h-3.5" />
                <span>Da Biblioteca (Acervo Central)</span>
              </TabsTrigger>
              <TabsTrigger value="pontual" className="text-xs gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Pontual</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: Da Biblioteca Existente */}
            <TabsContent value="biblioteca" className="space-y-4 pt-3">
              <form onSubmit={handleSalvarAssociacaoBiblioteca} className="space-y-4">
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Library className="w-4 h-4 text-blue-700" />
                    Biblioteca Única de Materiais
                  </p>
                  <p className="text-[11px] text-blue-800">
                    Utiliza o mesmo acervo existente de vídeos, manuais e links da Etapa 1. Ao
                    associar, o colaborador ganha um link público de validação para confirmar a
                    leitura.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Filtrar Acervo de Materiais
                  </Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Pesquisar por título, setor ou descrição..."
                      value={filtroBiblioteca}
                      onChange={(e) => setFiltroBiblioteca(e.target.value)}
                      className="pl-8 text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Selecione o Material <span className="text-red-500">*</span>
                  </Label>
                  <Select value={materialSelecionadoId} onValueChange={setMaterialSelecionadoId}>
                    <SelectTrigger className="text-xs h-10">
                      <SelectValue placeholder="Selecione um documento da biblioteca..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {materiaisFiltrados.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">
                          Nenhum material encontrado no acervo central
                        </div>
                      ) : (
                        materiaisFiltrados.map((mat) => {
                          const jaAssociado = idsMateriaisJaAssociados.has(mat.id)
                          return (
                            <SelectItem
                              key={mat.id}
                              value={mat.id}
                              className="text-xs py-2"
                              disabled={jaAssociado}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {mat.titulo} {jaAssociado ? '(Já associado)' : ''}
                                </span>
                                <span className="text-[10px] text-gray-400 capitalize">
                                  {mat.tipo} • {mat.setor_origem || 'Geral'}
                                </span>
                              </div>
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Observação ou Instrução para o Colaborador (Opcional)
                  </Label>
                  <Textarea
                    placeholder="Ex: Ler o capítulo 3 antes da reunião de alinhamento..."
                    value={observacaoAssociacao}
                    onChange={(e) => setObservacaoAssociacao(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalOpen(false)}
                    disabled={salvando}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={salvando || !materialSelecionadoId}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    {salvando ? 'Associando...' : 'Associar Material (1 Clique)'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* ABA 2: Upload Pontual */}
            <TabsContent value="pontual" className="space-y-4 pt-3">
              <form onSubmit={handleSalvarUploadPontual} className="space-y-4">
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-amber-700" />
                    Upload Pontual com Acervo Integrado
                  </p>
                  <p className="text-[11px] text-amber-800">
                    O documento é cadastrado no acervo central de materiais e associado
                    imediatamente a este colaborador, com link público gerado automaticamente.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Título do Documento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Ex: Política de Segurança Específica 2025"
                    value={novoTitulo}
                    onChange={(e) => setNovoTitulo(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Tipo de Material</Label>
                    <Select
                      value={novoTipo}
                      onValueChange={(v) => setNovoTipo(v as 'arquivo' | 'link' | 'video')}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arquivo">Arquivo (PDF / Manual / DOC)</SelectItem>
                        <SelectItem value="link">Link Externo</SelectItem>
                        <SelectItem value="video">Vídeo (URL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">
                      {novoTipo === 'arquivo' ? 'Arquivo (PDF/DOC)' : 'URL Externa'}{' '}
                      <span className="text-red-500">*</span>
                    </Label>
                    {novoTipo === 'arquivo' ? (
                      <Input
                        type="file"
                        onChange={(e) => setNovoArquivo(e.target.files?.[0] || null)}
                        className="text-xs h-9 cursor-pointer"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                        required
                      />
                    ) : (
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={novoUrl}
                        onChange={(e) => setNovoUrl(e.target.value)}
                        className="text-xs h-9"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Descrição</Label>
                  <Input
                    type="text"
                    placeholder="Breve descrição do conteúdo..."
                    value={novaDescricao}
                    onChange={(e) => setNovaDescricao(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Instrução / Observação para o Colaborador (Opcional)
                  </Label>
                  <Textarea
                    placeholder="Orientações específicas sobre este documento..."
                    value={novoObservacao}
                    onChange={(e) => setNovoObservacao(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalOpen(false)}
                    disabled={salvando}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={salvando || !novoTitulo.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    {salvando ? 'Enviando e Associando...' : 'Salvar e Associar Documento'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Remover Associação */}
      <AlertDialog open={modalRemoverOpen} onOpenChange={setModalRemoverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              Desassociar Documento Complementar?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Tem certeza que deseja desassociar o documento{' '}
              <strong>"{docRemover?.expand?.material?.titulo || 'Documento'}"</strong> do
              colaborador? O link público gerado para esta associação será desativado. O material
              permanecerá salvo na biblioteca central.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarRemover}
              disabled={removendo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {removendo ? 'Desassociando...' : 'Sim, Desassociar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
