import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { feedbackAvaliacaoPublicoService } from '@/services/onboarding'
import { MundoOpenLogo } from '@/components/MundoOpenLogo'
import { formatDateTime } from '@/lib/dateUtils'
import type { FeedbackAvaliacaoPublico as DadosFeedbackPublico } from '@/types/onboarding'
import {
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Clock,
  Sparkles,
  Award,
  Calendar,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function ColaboradorFeedbackPublico() {
  const { token } = useParams<{ token: string }>()
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosFeedbackPublico | null>(null)

  useEffect(() => {
    if (!token) {
      setErro('Token de feedback não informado na URL.')
      setCarregando(false)
      return
    }

    setCarregando(true)
    setErro(null)

    feedbackAvaliacaoPublicoService
      .getFeedback(token)
      .then((res) => {
        setDados(res)
      })
      .catch((err: any) => {
        console.error('[ColaboradorFeedbackPublico] Erro:', err)
        setErro(
          err?.data?.error ||
            err?.message ||
            'Não foi possível encontrar o feedback desta avaliação ou o link foi desativado.',
        )
      })
      .finally(() => {
        setCarregando(false)
      })
  }, [token])

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">
            Carregando devolutiva da avaliação...
          </p>
        </div>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-md bg-white">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold text-gray-900">Feedback Indisponível</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              {erro || 'Nenhuma devolutiva oficial foi encontrada para este link.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-3 space-y-2">
            <p className="text-xs text-gray-500 leading-relaxed">
              O feedback ao colaborador só é liberado quando o gestor preenche o parecer formal. Se
              você esperava receber este feedback, entre em contato com seu gestor ou RH.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isApto = dados.decisao === 'apto'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-800 antialiased flex flex-col justify-between">
      {/* Topo Institucional / Branding */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm sticky top-0 z-30 shadow-2xs">
        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MundoOpenLogo className="h-8 w-auto text-blue-600" />
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Portal do Colaborador
              </p>
              <h1 className="text-sm sm:text-base font-bold text-slate-900">
                Feedback da Avaliação
              </h1>
            </div>
          </div>

          <Badge
            variant="outline"
            className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1.5 hidden sm:flex"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Documento Oficial
          </Badge>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 w-full flex-1 space-y-6">
        {/* Banner do Colaborador & Decisão */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                Colaborador(a)
              </p>
              <h2 className="text-lg font-bold text-slate-900">{dados.colaboradorNome}</h2>
              <p className="text-xs text-slate-500">
                {dados.cargo} • Setor: {dados.setor}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Resultado do Onboarding:</span>
            {isApto ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold gap-1 px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Apto (Aprovado)
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold gap-1 px-3 py-1">
                <XCircle className="w-3.5 h-3.5 text-amber-600" />
                Não Apto
              </Badge>
            )}
          </div>
        </div>

        {/* Card Principal do Feedback */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-50/60 via-slate-50 to-white border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge
                variant="outline"
                className="text-[11px] bg-white text-blue-800 border-blue-200 gap-1.5 font-semibold"
              >
                <Award className="w-3.5 h-3.5 text-blue-600" />
                Devolutiva Formal da Gestão
              </Badge>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Avaliação realizada em: <strong>{formatDateTime(dados.dataAvaliacao)}</strong>
              </span>
            </div>
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 pt-2">
              Parecer e Orientações do Gestor
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 leading-relaxed">
              Mensagem oficial redigida por <strong>{dados.gestorNome}</strong> para o seu
              desenvolvimento e continuidade na equipe de TI.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Texto do Feedback */}
            <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Mensagem ao Colaborador
              </div>
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {dados.feedbackTexto}
              </div>
            </div>

            {/* Metadados e Carimbo de Leitura */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Registro de Leitura:{' '}
                  <strong className="text-slate-700">
                    {dados.lidoEm
                      ? formatDateTime(dados.lidoEm)
                      : 'Primeiro acesso registrado agora'}
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Responsável:{' '}
                <span className="font-semibold text-slate-600">{dados.gestorNome}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Rodapé Institucional */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-slate-400">
          Sistema de Onboarding de TI • Acompanhamento e Avaliação Contínua Mundo Open
        </div>
      </footer>
    </div>
  )
}
