import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  Building2,
  User,
  Briefcase,
  Layers,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { candidatoProvaPublicaService } from '@/services/onboarding'
import type { TesteQuestaoPublica } from '@/types/onboarding'
import { getSetorVisual } from '@/types/onboarding'
import { formatDateTime } from '@/lib/dateUtils'

export default function CandidatoProvaPublica() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [provaInfo, setProvaInfo] = useState<{
    liberado: boolean
    jaSubmetido?: boolean
    reprovado?: boolean
    candidatoNome?: string
    cargoPretendido?: string
    setor?: string
    questionarioNome?: string
    questionarioDescricao?: string
    totalQuestoes?: number
    questoes?: TesteQuestaoPublica[]
    dataConclusao?: string
    mensagem?: string
    error?: string
  } | null>(null)

  const [respostas, setRespostas] = useState<Record<string, number>>({})
  const [submetendo, setSubmetendo] = useState(false)
  const [sucessoEnvio, setSucessoEnvio] = useState<string | null>(null)

  const carregarProva = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await candidatoProvaPublicaService.getProva(token)
      setProvaInfo(data)
    } catch (err: unknown) {
      console.error('Erro ao carregar prova do candidato:', err)
      const msg = err instanceof Error ? err.message : 'Não foi possível carregar a prova.'
      setProvaInfo({
        liberado: false,
        error: msg,
      })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    carregarProva()
  }, [carregarProva])

  const handleSelecionarAlternativa = (questaoId: string, index: number) => {
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: index,
    }))
  }

  const handleSubmeter = async () => {
    if (!token || !provaInfo?.questoes) return

    const total = provaInfo.questoes.length
    const respondidas = Object.keys(respostas).length
    const faltantes = total - respondidas

    if (faltantes > 0) {
      toast.error(
        `Faltam ${faltantes} questão(ões) para você responder. Responda todas as ${total} questões antes de submeter.`,
      )
      return
    }

    try {
      setSubmetendo(true)
      const res = await candidatoProvaPublicaService.submeterProva(token, respostas)
      setSucessoEnvio(
        res.mensagem ||
          'Sua prova foi enviada com sucesso! Suas respostas foram salvas e a equipe de gestão da área entrará em contato.',
      )
      toast.success('Prova submetida com sucesso!')
      // Recarregar status
      await carregarProva()
    } catch (err: unknown) {
      console.error('Erro ao submeter prova:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao enviar respostas.'
      toast.error(msg)
    } finally {
      setSubmetendo(false)
    }
  }

  // Estado de carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            Carregando prova de conhecimento...
          </p>
          <p className="text-xs text-slate-400">Verificando dados de acesso do candidato</p>
        </div>
      </div>
    )
  }

  // Erro ou link reprovado/expirado
  if (!provaInfo || provaInfo.error || provaInfo.reprovado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Link Inativo ou Não Encontrado</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {provaInfo?.error ||
                'Este link de avaliação não está mais ativo ou foi concluído pela equipe responsável.'}
            </p>
          </div>
          <div className="pt-2 text-[11px] text-slate-400">
            Dúvidas? Entre em contato com o Recursos Humanos ou recrutador responsável.
          </div>
        </div>
      </div>
    )
  }

  // Já submetido (tentativa única sem reteste)
  if (provaInfo.jaSubmetido || sucessoEnvio) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6">
        <header className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6">
          <MundoOpenLogo variant="full" size="sm" subtitle="Avaliação de Candidatos" />
          <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
            Processo Seletivo de TI
          </span>
        </header>

        <main className="max-w-2xl w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Prova Enviada com Sucesso
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Obrigado, {provaInfo.candidatoNome || 'Candidato'}!
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {sucessoEnvio ||
                provaInfo.mensagem ||
                'Sua prova foi finalizada. As respostas foram enviadas para avaliação da equipe de gestão da área.'}
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Candidato:</span>
              <span className="font-semibold text-slate-800">{provaInfo.candidatoNome}</span>
            </div>
            {provaInfo.cargoPretendido && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Cargo Pretendido:</span>
                <span className="font-semibold text-slate-800">{provaInfo.cargoPretendido}</span>
              </div>
            )}
            {provaInfo.questionarioNome && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Avaliação Realizada:</span>
                <span className="font-semibold text-slate-800">{provaInfo.questionarioNome}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Tentativas permitidas:</span>
              <span className="font-bold text-slate-700">1 de 1 (Tentativa Única)</span>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 text-left flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Próximos passos:</strong> O gestor técnico da área analisará sua avaliação em
              conjunto com a 1ª fase da entrevista. Você receberá o retorno pelo seu e-mail
              cadastrado.
            </p>
          </div>
        </main>

        <footer className="max-w-3xl w-full mx-auto pt-6 text-center text-xs text-slate-400">
          Mundo Open Tecnologia • Sistema de Onboarding e Avaliação de Talentos
        </footer>
      </div>
    )
  }

  // Tela principal da prova com questões
  const questoes = provaInfo.questoes || []
  const totalQuestoes = questoes.length
  const respondidasCount = Object.keys(respostas).length
  const progressoPercent =
    totalQuestoes > 0 ? Math.round((respondidasCount / totalQuestoes) * 100) : 0
  const tudoRespondido = totalQuestoes > 0 && respondidasCount === totalQuestoes
  const setorVisual = getSetorVisual(provaInfo.setor)

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Header Público */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MundoOpenLogo variant="icon" size="sm" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 block">
                Processo Seletivo de TI
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {provaInfo.questionarioNome || 'Prova Técnica de Conhecimento'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold border bg-brand-50 text-brand-700 border-brand-200 hidden sm:inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: setorVisual.cor }}
              />
              {setorVisual.nome}
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Banner Informativo do Candidato */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Candidato(a):</span>
                <span className="text-base font-bold text-slate-900">
                  {provaInfo.candidatoNome}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Cargo: <strong>{provaInfo.cargoPretendido || 'Área Técnica'}</strong>
                </span>
                <span>•</span>
                <span>
                  Área: <strong>{setorVisual.nome}</strong>
                </span>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Tentativa Única (Sem reteste)
              </span>
            </div>
          </div>

          {provaInfo.questionarioDescricao && (
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              {provaInfo.questionarioDescricao}
            </p>
          )}

          {/* Barra de Progresso de Respostas */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Progresso das respostas:{' '}
                <strong>
                  {respondidasCount} de {totalQuestoes} questões
                </strong>
              </span>
              <span className="font-bold text-brand-700">{progressoPercent}%</span>
            </div>
            <Progress value={progressoPercent} className="h-2 bg-slate-100" />
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Importante:</strong> Esta prova é de múltipla escolha. Ao clicar em finalizar,
              suas respostas serão gravadas definitivamente no sistema e o gestor da área receberá o
              aviso. Não será possível refazer o teste.
            </p>
          </div>
        </div>

        {/* Lista de Questões */}
        <div className="space-y-5">
          {questoes.map((q, qIndex) => {
            const respondida = respostas[q.id] !== undefined
            const respostaAtual = respostas[q.id]

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 space-y-4 ${
                  respondida
                    ? 'border-slate-200 shadow-sm'
                    : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Cabeçalho da Questão */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        respondida ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {q.ordem || qIndex + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {q.tema || `Questão ${q.ordem || qIndex + 1}`}
                    </span>
                  </div>

                  {respondida ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Respondida
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      Pendente
                    </span>
                  )}
                </div>

                {/* Enunciado */}
                <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                  {q.enunciado}
                </p>

                {/* Alternativas A, B, C, D */}
                <div className="space-y-2.5 pt-1">
                  {q.alternativas.map((altTexto, altIdx) => {
                    const letras = ['A', 'B', 'C', 'D', 'E']
                    const letra = letras[altIdx] || `${altIdx + 1}`
                    const selecionada = respostaAtual === altIdx

                    return (
                      <button
                        key={altIdx}
                        type="button"
                        onClick={() => handleSelecionarAlternativa(q.id, altIdx)}
                        disabled={submetendo}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-3 ${
                          selecionada
                            ? 'bg-brand-50/80 border-brand-500 text-brand-950 font-medium ring-2 ring-brand-500/20'
                            : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            selecionada
                              ? 'bg-brand-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-600'
                          }`}
                        >
                          {letra}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{altTexto}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Barra Inferior Fixa de Submissão */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {tudoRespondido
                ? 'Todas as questões foram respondidas!'
                : `Faltam ${totalQuestoes - respondidasCount} de ${totalQuestoes} questão(ões)`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Revise suas opções antes de confirmar o envio definitivo.
            </p>
          </div>

          <Button
            type="button"
            disabled={!tudoRespondido || submetendo}
            onClick={handleSubmeter}
            className={`h-11 px-8 font-bold text-sm shadow-sm transition-all ${
              tudoRespondido
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submetendo ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enviando respostas...</span>
              </div>
            ) : tudoRespondido ? (
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>Finalizar e Enviar Prova</span>
              </div>
            ) : (
              `Responda todas (${respondidasCount}/${totalQuestoes})`
            )}
          </Button>
        </div>
      </main>

      {/* Footer Público */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <p className="font-semibold text-slate-600">Mundo Open Tecnologia</p>
        <p className="mt-1">Link de avaliação individual. Suas respostas são confidenciais.</p>
      </footer>
    </div>
  )
}
