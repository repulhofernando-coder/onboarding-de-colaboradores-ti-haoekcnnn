import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Award,
  Plus,
  Calendar,
  Building2,
  FileText,
  Download,
  ExternalLink,
  Trash2,
  Edit,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { certificadoService } from '@/services/onboarding'
import { formatShortDate } from '@/lib/dateUtils'
import type { CertificadoColaborador, Onboarding } from '@/types/onboarding'

export interface SecaoCertificadosProps {
  onboarding: Onboarding
  todosOnboardings?: Onboarding[]
  onCertificadoAlterado?: () => void
}

interface ValidadeInfo {
  status: 'valido' | 'alerta' | 'vencido' | 'sem_validade'
  diasRestantes: number | null
  label: string
  badgeClass: string
}

function calcularStatusValidade(dataValidade?: string): ValidadeInfo {
  if (!dataValidade) {
    return {
      status: 'sem_validade',
      diasRestantes: null,
      label: 'Sem expiração',
      badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
    }
  }

  const [ano, mes, dia] = dataValidade.split('T')[0].split('-').map(Number)
  const dataVal = new Date(ano, mes - 1, dia, 23, 59, 59)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const diffMs = dataVal.getTime() - hoje.getTime()
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias < 0) {
    const atraso = Math.abs(diffDias)
    return {
      status: 'vencido',
      diasRestantes: diffDias,
      label: `Vencido há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`,
      badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
    }
  }

  if (diffDias <= 90) {
    return {
      status: 'alerta',
      diasRestantes: diffDias,
      label:
        diffDias === 0 ? 'Vence hoje' : `Vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    }
  }

  return {
    status: 'valido',
    diasRestantes: diffDias,
    label: `Válido (${diffDias} dias)`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
}

export function SecaoCertificados({
  onboarding,
  todosOnboardings = [],
  onCertificadoAlterado,
}: SecaoCertificadosProps) {
  const { user, isAdmin, isRH } = useAuth()
  // Regra LGPD restrita: Exclusivo de RH e Admin
  const podeGerenciar = isAdmin || isRH

  const [certificados, setCertificados] = useState<CertificadoColaborador[]>([])
  const [carregando, setCarregando] = useState(true)

  // Modais de Criação / Edição
  const [modalFormOpen, setModalFormOpen] = useState(false)
  const [editandoCertificado, setEditandoCertificado] = useState<CertificadoColaborador | null>(
    null,
  )
  const [titulo, setTitulo] = useState('')
  const [emissor, setEmissor] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataValidade, setDataValidade] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal de Exclusão
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [certParaExcluir, setCertParaExcluir] = useState<CertificadoColaborador | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Visualização de Arquivo
  const [previewArquivo, setPreviewArquivo] = useState<{
    titulo: string
    url: string
    isPdf: boolean
    isImage: boolean
  } | null>(null)

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

  const carregarCertificados = async () => {
    if (!podeGerenciar) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const lista = await certificadoService.listByColaboradorIds(idsColaborador)
      setCertificados(lista)
    } catch (err) {
      console.error('[SecaoCertificados] Erro ao carregar certificados:', err)
      toast.error('Não foi possível carregar os certificados do colaborador.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarCertificados()
  }, [idsColaborador, podeGerenciar])

  const abrirModalNovo = () => {
    setEditandoCertificado(null)
    setTitulo('')
    setEmissor('')
    setDataEmissao(new Date().toISOString().split('T')[0])
    setDataValidade('')
    setObservacoes('')
    setArquivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalFormOpen(true)
  }

  const abrirModalEditar = (c: CertificadoColaborador) => {
    setEditandoCertificado(c)
    setTitulo(c.titulo)
    setEmissor(c.emissor)
    setDataEmissao(c.data_emissao ? c.data_emissao.split('T')[0] : '')
    setDataValidade(c.data_validade ? c.data_validade.split('T')[0] : '')
    setObservacoes(c.observacoes || '')
    setArquivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalFormOpen(true)
  }

  const handleSalvarCertificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !emissor.trim() || !dataEmissao) {
      toast.error('Preencha os campos obrigatórios (Título, Emissor e Data de Emissão).')
      return
    }

    if (arquivo && arquivo.size > 52428800) {
      toast.error('O arquivo selecionado excede o limite máximo de 50MB.')
      return
    }

    setSalvando(true)
    const autor = {
      id: user?.id || '',
      nome: user?.name || user?.email || 'RH / Admin',
      role: user?.role || 'rh',
    }

    try {
      if (editandoCertificado) {
        await certificadoService.update(editandoCertificado.id, {
          colaboradorId: onboarding.id,
          colaboradorNome: onboarding.colaborador_nome,
          titulo,
          emissor,
          dataEmissao,
          dataValidade: dataValidade || undefined,
          observacoes,
          arquivo: arquivo || undefined,
          autor,
          antigo: editandoCertificado,
        })
        toast.success(`Certificado "${titulo}" atualizado com sucesso!`)
      } else {
        await certificadoService.create({
          colaboradorId: onboarding.id,
          colaboradorNome: onboarding.colaborador_nome,
          titulo,
          emissor,
          dataEmissao,
          dataValidade: dataValidade || undefined,
          observacoes,
          arquivo,
          autor,
        })
        toast.success(`Certificado "${titulo}" cadastrado com sucesso!`)
      }

      setModalFormOpen(false)
      carregarCertificados()
      if (onCertificadoAlterado) onCertificadoAlterado()
    } catch (err: unknown) {
      console.error('[SecaoCertificados] Erro ao salvar certificado:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar certificado.'
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!certParaExcluir) return
    setExcluindo(true)
    const autor = {
      id: user?.id || '',
      nome: user?.name || user?.email || 'RH / Admin',
      role: user?.role || 'rh',
    }

    try {
      await certificadoService.delete({
        id: certParaExcluir.id,
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        titulo: certParaExcluir.titulo,
        emissor: certParaExcluir.emissor,
        autor,
      })
      toast.success(`Certificado "${certParaExcluir.titulo}" removido com sucesso!`)
      setModalExcluirOpen(false)
      setCertParaExcluir(null)
      carregarCertificados()
      if (onCertificadoAlterado) onCertificadoAlterado()
    } catch (err: unknown) {
      console.error('[SecaoCertificados] Erro ao excluir certificado:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao excluir certificado.'
      toast.error(msg)
    } finally {
      setExcluindo(false)
    }
  }

  const abrirVisualizacaoArquivo = (c: CertificadoColaborador) => {
    const url = certificadoService.getUrlArquivo(c)
    if (!url) return
    const arqLower = (c.arquivo || '').toLowerCase()
    const isPdf = arqLower.endsWith('.pdf')
    const isImage =
      arqLower.endsWith('.png') ||
      arqLower.endsWith('.jpg') ||
      arqLower.endsWith('.jpeg') ||
      arqLower.endsWith('.webp')
    setPreviewArquivo({
      titulo: c.titulo,
      url,
      isPdf,
      isImage,
    })
  }

  // Estatísticas de expiração
  const estatisticas = useMemo(() => {
    let vencidos = 0
    let alerta = 0
    let validos = 0
    certificados.forEach((c) => {
      const v = calcularStatusValidade(c.data_validade)
      if (v.status === 'vencido') vencidos++
      else if (v.status === 'alerta') alerta++
      else validos++
    })
    return { vencidos, alerta, validos }
  }, [certificados])

  // Se o usuário não for RH nem Admin (ex.: Gestão), exibe aviso LGPD restrito conforme especificação
  if (!podeGerenciar) {
    return (
      <Card className="border border-slate-200 shadow-sm bg-slate-50/70">
        <CardContent className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Acesso Restrito — Certificados do Colaborador
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Esta seção é restrita aos papéis de <strong>Recursos Humanos (RH)</strong> e{' '}
            <strong>Administração</strong> conforme diretrizes da LGPD (dados de certificações
            profissionais sob guarda central do RH).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-gray-900">
                  Certificados do Colaborador
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-white text-blue-800 border-blue-200">
                  {certificados.length} {certificados.length === 1 ? 'certificado' : 'certificados'}
                </Badge>
                {estatisticas.vencidos > 0 && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs font-bold gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    {estatisticas.vencidos} vencido(s)
                  </Badge>
                )}
                {estatisticas.alerta > 0 && (
                  <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-xs font-bold gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {estatisticas.alerta} perto de vencer
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Acervo de certificações técnicas e diplomas com upload de anexos e monitoramento de
                validade
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={abrirModalNovo}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm h-8 shrink-0 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Certificado</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {carregando ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            Carregando certificados...
          </div>
        ) : certificados.length === 0 ? (
          <div className="py-10 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                Nenhum certificado cadastrado para este colaborador
              </p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
                Adicione certificações de TI, cursos de aperfeiçoamento, diplomas ou comprovantes
                com anexo em PDF ou imagem.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={abrirModalNovo}
              className="text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Cadastrar Primeiro Certificado
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificados.map((c) => {
              const validade = calcularStatusValidade(c.data_validade)
              const temArquivo = Boolean(c.arquivo)
              const urlArquivo = certificadoService.getUrlArquivo(c)

              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-4.5 bg-white transition-all shadow-sm flex flex-col justify-between gap-3 ${
                    validade.status === 'vencido'
                      ? 'border-red-300 bg-red-50/20 ring-1 ring-red-200'
                      : validade.status === 'alerta'
                        ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            validade.status === 'vencido'
                              ? 'bg-red-100 text-red-700'
                              : validade.status === 'alerta'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          <Award className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 leading-snug break-words">
                            {c.titulo}
                          </h4>
                          <span className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="truncate font-medium">{c.emissor}</span>
                          </span>
                        </div>
                      </div>

                      {/* Badge de Validade / Alerta */}
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 shrink-0 ${validade.badgeClass}`}
                      >
                        {validade.status === 'vencido' && (
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                        )}
                        {validade.status === 'alerta' && (
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                        )}
                        {validade.status === 'valido' && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        )}
                        {validade.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-100">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 block leading-none">
                            Emissão
                          </span>
                          <span className="font-semibold text-gray-700">
                            {formatShortDate(c.data_emissao)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-100">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 block leading-none">
                            Validade
                          </span>
                          <span
                            className={`font-semibold ${
                              validade.status === 'vencido'
                                ? 'text-red-700'
                                : validade.status === 'alerta'
                                  ? 'text-amber-800'
                                  : 'text-gray-700'
                            }`}
                          >
                            {c.data_validade ? formatShortDate(c.data_validade) : 'Indeterminada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {c.observacoes && (
                      <p className="text-[11px] text-gray-500 bg-gray-50/70 p-2 rounded-md border border-gray-100 line-clamp-2">
                        {c.observacoes}
                      </p>
                    )}
                  </div>

                  {/* Rodapé do Card com Ações */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      {temArquivo && urlArquivo ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => abrirVisualizacaoArquivo(c)}
                            className="h-7 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold gap-1"
                            title="Visualizar documento anexado"
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Ver Anexo</span>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                            title="Baixar arquivo diretamente"
                          >
                            <a href={urlArquivo} download target="_blank" rel="noopener noreferrer">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic flex items-center gap-1">
                          <FileText className="w-3 h-3 text-gray-300" />
                          Sem anexo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirModalEditar(c)}
                        className="h-7 px-2 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                        title="Editar certificado"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCertParaExcluir(c)
                          setModalExcluirOpen(true)
                        }}
                        className="h-7 px-2 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                        title="Excluir certificado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Formulário (Novo / Edição) */}
      <Dialog open={modalFormOpen} onOpenChange={setModalFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              <span>{editandoCertificado ? 'Editar Certificado' : 'Novo Certificado'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Colaborador: <strong>{onboarding.colaborador_nome}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarCertificado} className="space-y-3.5 py-1">
            <div className="space-y-1">
              <Label htmlFor="cert-titulo" className="text-xs font-semibold text-gray-700">
                Título do Certificado / Curso <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cert-titulo"
                placeholder="Ex.: Certificação CompTIA Network+, Curso AWS Cloud..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                disabled={salvando}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cert-emissor" className="text-xs font-semibold text-gray-700">
                Órgão Emissor / Instituição <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cert-emissor"
                placeholder="Ex.: Cisco, Microsoft, Alura, FIAP..."
                value={emissor}
                onChange={(e) => setEmissor(e.target.value)}
                required
                disabled={salvando}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cert-emissao" className="text-xs font-semibold text-gray-700">
                  Data de Emissão <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cert-emissao"
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  required
                  disabled={salvando}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cert-validade" className="text-xs font-semibold text-gray-700">
                  Data de Validade (Opcional)
                </Label>
                <Input
                  id="cert-validade"
                  type="date"
                  value={dataValidade}
                  onChange={(e) => setDataValidade(e.target.value)}
                  disabled={salvando}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">
                Documento Comprobatório (PDF ou Imagem, máx. 50MB)
              </Label>
              {editandoCertificado?.arquivo && !arquivo && (
                <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1.5 bg-gray-50 p-2 rounded border border-gray-200">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">Arquivo atual: {editandoCertificado.arquivo}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                disabled={salvando}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cert-obs" className="text-xs font-semibold text-gray-700">
                Observações Adicionais (Opcional)
              </Label>
              <Textarea
                id="cert-obs"
                placeholder="Ex.: Código de autenticidade, carga horária de 40h..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                disabled={salvando}
                className="text-xs"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <strong>Rastreabilidade de Auditoria:</strong> A inclusão e qualquer alteração de
              certificado serão gravadas na trilha com seu usuário, data e hora.
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalFormOpen(false)}
                disabled={salvando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : editandoCertificado ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Certificado'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Confirmar Exclusão de Certificado</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600">
              Tem certeza que deseja remover o certificado{' '}
              <strong>&quot;{certParaExcluir?.titulo}&quot;</strong> do colaborador{' '}
              <strong>{onboarding.colaborador_nome}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
            <p className="font-semibold">Esta ação é irreversível.</p>
            <p className="text-[11px]">
              O documento e os dados do certificado serão excluídos e a ação será registrada no
              histórico de auditoria.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalExcluirOpen(false)}
              disabled={excluindo}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarExclusao}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
            >
              {excluindo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Certificado'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização de Arquivo */}
      {previewArquivo && (
        <Dialog
          open={Boolean(previewArquivo)}
          onOpenChange={(open) => !open && setPreviewArquivo(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
            <DialogHeader className="flex-row items-center justify-between border-b pb-3 space-y-0">
              <DialogTitle className="text-sm font-bold text-gray-900 truncate">
                {previewArquivo.titulo}
              </DialogTitle>
              <div className="flex items-center gap-2 pr-6">
                <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <a href={previewArquivo.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir em nova aba
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <a href={previewArquivo.url} download>
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto my-2 min-h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 p-2">
              {previewArquivo.isImage ? (
                <img
                  src={previewArquivo.url}
                  alt={previewArquivo.titulo}
                  className="max-h-[70vh] max-w-full object-contain rounded"
                />
              ) : previewArquivo.isPdf ? (
                <iframe
                  src={previewArquivo.url}
                  title={previewArquivo.titulo}
                  className="w-full h-[70vh] rounded border-0"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-600">
                    Visualização direta não disponível para este formato.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    <a href={previewArquivo.url} download>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Baixar Arquivo
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
