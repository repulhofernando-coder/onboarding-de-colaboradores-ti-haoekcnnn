import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { colaboradorDocumentoService } from '@/services/onboarding'
import { MundoOpenLogo } from '@/components/MundoOpenLogo'
import { formatDateTime } from '@/lib/dateUtils'
import type { ColaboradorDocumento } from '@/types/onboarding'
import { toast } from 'sonner'
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Video,
  Link as LinkIcon,
  ShieldCheck,
  Building2,
  User,
  Clock,
  Sparkles,
  FileCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DadosDocumentoPublico {
  id: string
  token: string
  status: 'pendente' | 'confirmado'
  confirmado_em?: string
  observacao?: string
  atribuido_em?: string
  atribuido_por?: string
  colaborador: {
    id: string
    nome: string
    cargo: string
    setor: string
  }
  material: {
    id: string
    titulo: string
    descricao: string
    tipo: 'arquivo' | 'link' | 'video'
    url?: string
    arquivo?: string
    fileUrl?: string
    ordem: number
    obrigatorio: boolean
    duracao_estimada: number
  }
}

export function ColaboradorDocumentoPublico() {
  const { token } = useParams<{ token: string }>()
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosDocumentoPublico | null>(null)

  // Confirmação
  const [concordou, setConcordou] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmadoSucesso, setConfirmadoSucesso] = useState(false)
  const [dataConfirmacao, setDataConfirmacao] = useState<string | null>(null)

  const carregarDocumento = async () => {
    if (!token) {
      setErro('Token do documento complementar não informado.')
      setCarregando(false)
      return
    }

    try {
      setCarregando(true)
      setErro(null)

      const json = await pb.send<DadosDocumentoPublico>(
        `/backend/v1/colaborador/documento/publico?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
        },
      )

      setDados(json)
      if (json && json.status === 'confirmado') {
        setConfirmadoSucesso(true)
        setDataConfirmacao(json.confirmado_em || null)
      }
    } catch (err: any) {
      console.error('[ColaboradorDocumentoPublico] Erro:', err)
      setErro(err.message || 'Falha ao carregar o documento complementar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDocumento()
  }, [token])

  const handleConfirmarLeitura = async () => {
    if (!token || !concordou) return

    try {
      setConfirmando(true)
      const res = await colaboradorDocumentoService.confirmarLeituraViaHook(token)
      setConfirmadoSucesso(true)
      setDataConfirmacao(res.confirmado_em || new Date().toISOString())
      toast.success('Leitura confirmada com sucesso!')
    } catch (err: any) {
      console.error('[ColaboradorDocumentoPublico] Erro ao confirmar:', err)
      toast.error(err.message || 'Erro ao registrar confirmação.')
    } finally {
      setConfirmando(false)
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Carregando documento complementar...</p>
        </div>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold text-gray-900">
              Documento Indisponível
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              {erro || 'Não foi possível carregar as informações deste documento.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-3">
            <p className="text-xs text-gray-500">
              Verifique se o link enviado pelo RH ou Gestor está correto ou solicite um novo link à
              equipe.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { material, colaborador } = dados
  const jaConfirmado = dados.status === 'confirmado' || confirmadoSucesso

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-800 antialiased flex flex-col justify-between">
      {/* Topo / Branding */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MundoOpenLogo className="h-8 w-auto text-blue-600" />
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Portal do Colaborador
              </p>
              <h1 className="text-sm sm:text-base font-bold text-slate-900">
                Documento Complementar
              </h1>
            </div>
          </div>

          <Badge
            variant="outline"
            className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1.5 hidden sm:flex"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Validação Segura
          </Badge>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 w-full flex-1 space-y-6">
        {/* Banner do Colaborador */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                Destinatário
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{colaborador.nome}</h2>
              <p className="text-xs text-slate-500">
                {colaborador.cargo} • Setor: {colaborador.setor}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="text-[11px] text-slate-400">Status de Leitura:</span>
            {jaConfirmado ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Confirmado
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-medium gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Aguardando sua confirmação
              </Badge>
            )}
          </div>
        </div>

        {/* Card do Documento */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 via-slate-50 to-white border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[11px] bg-white text-slate-700 capitalize">
                {material.tipo === 'video'
                  ? 'Vídeo Aula / Instrução'
                  : material.tipo === 'link'
                    ? 'Link Externo'
                    : 'Arquivo / Manual'}
              </Badge>
              {material.obrigatorio && (
                <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                  Obrigatório
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">
              {material.titulo}
            </CardTitle>
            {material.descricao && (
              <CardDescription className="text-xs text-slate-600 leading-relaxed pt-1">
                {material.descricao}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-6">
            {/* Instruções do Gestor/RH se houver */}
            {dados.observacao && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-700" />
                  Instruções da Gestão / RH:
                </p>
                <p className="text-[12px] text-indigo-800 leading-relaxed">{dados.observacao}</p>
              </div>
            )}

            {/* Acesso ao Material */}
            <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/60 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Conteúdo para Leitura / Estudo
              </h3>

              {material.tipo === 'video' && material.url && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Assista ao vídeo disponibilizado no link abaixo com atenção antes de confirmar:
                  </p>
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    <span>Assistir Vídeo no Navegador</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                  </a>
                </div>
              )}

              {material.tipo === 'link' && material.url && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Acesse a documentação externa no link abaixo para leitura completa:
                  </p>
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Acessar Link do Material</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                  </a>
                </div>
              )}

              {material.tipo === 'arquivo' && material.fileUrl && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Faça o download do arquivo ou abra-o diretamente no navegador para realizar a
                    leitura:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={material.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Visualizar Documento</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                    </a>
                    <a
                      href={material.fileUrl}
                      download
                      className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Arquivo</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Caixa de Validação / Confirmação */}
            <div className="pt-4 border-t border-slate-200">
              {jaConfirmado ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">
                      Leitura Confirmada com Sucesso!
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Sua confirmação foi registrada no seu histórico em{' '}
                      <strong>
                        {dataConfirmacao ? formatDateTime(dataConfirmacao) : 'data registrada'}
                      </strong>
                      . O RH e o Gestor do seu setor já receberam a atualização.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-blue-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="termo-concordancia"
                      checked={concordou}
                      onCheckedChange={(checked) => setConcordou(Boolean(checked))}
                      className="mt-1 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="termo-concordancia"
                        className="text-xs sm:text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Confirmo que li / assisti e compreendi este documento complementar
                      </Label>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Ao marcar esta caixa e clicar no botão abaixo, o sistema registrará seu
                        carimbo de data, hora e endereço de acesso como comprovante oficial de
                        leitura para seu dossiê corporativo.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      disabled={!concordou || confirmando}
                      onClick={handleConfirmarLeitura}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-6 py-2.5 h-auto shadow-xs gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {confirmando ? 'Registrando Confirmação...' : 'Confirmar Leitura'}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Rodapé institucional */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-slate-400">
          Sistema de Onboarding de TI • Documentos Complementares e Capacitação Contínua
        </div>
      </footer>
    </div>
  )
}
