import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { questionarioService, setorService } from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import type { QuestionarioModel, TesteQuestaoModel, SetorModel } from '@/types/onboarding'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, ArrowLeft, CheckCircle2, FileText, AlertCircle } from 'lucide-react'

export default function ImpressaoQuestionario() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, role, isAdmin, isRH, isGestao } = useAuth()

  const viaParam = searchParams.get('via') === 'branco' ? 'branco' : 'gabarito'
  const [via, setVia] = useState<'gabarito' | 'branco'>(viaParam)

  const [questionario, setQuestionario] = useState<QuestionarioModel | null>(null)
  const [questoes, setQuestoes] = useState<TesteQuestaoModel[]>([])
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [dataImpressao] = useState(() => new Date())

  // Sincroniza via com query string
  useEffect(() => {
    const currentVia = searchParams.get('via') === 'branco' ? 'branco' : 'gabarito'
    if (currentVia !== via) {
      setVia(currentVia)
    }
  }, [searchParams])

  const alternarVia = (novaVia: 'gabarito' | 'branco') => {
    setVia(novaVia)
    setSearchParams({ via: novaVia })
  }

  useEffect(() => {
    let cancel = false

    const carregar = async () => {
      if (!id) {
        setErro('Identificador do questionário não informado.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErro(null)

        const [qData, questoesData, setoresData] = await Promise.all([
          questionarioService.getById(id),
          questionarioService.listQuestoes(id),
          setorService.listAll(),
        ])

        if (cancel) return

        // Validação de acesso / permissão:
        // - Admin e RH sempre podem imprimir.
        // - Gestor: precisa de pode_editar_questionarios === true E questionário pertencer ao setor dele.
        if (isGestao) {
          if (!user?.pode_editar_questionarios) {
            setErro(
              'Acesso restrito: para imprimir questionários e gabaritos, é necessário possuir a permissão "Pode editar questionários do seu setor". Solicite ao Administrador.',
            )
            setLoading(false)
            return
          }

          const temAcessoSetor = podeVisualizarSetor({
            role,
            userSetor: user?.setor as string | undefined,
            itemSetor: qData.setor,
            setoresCadastrados: setoresData,
          })

          if (!temAcessoSetor) {
            setErro('Acesso restrito: você só pode imprimir questionários do seu próprio setor.')
            setLoading(false)
            return
          }
        }

        setQuestionario(qData)
        // Ordenar questões pela ordem cadastrada
        const ordenadas = [...questoesData].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        setQuestoes(ordenadas)
        setSetoresList(setoresData)
      } catch (err) {
        console.error('Erro ao carregar questionário para impressão:', err)
        if (!cancel) {
          setErro(
            'Não foi possível carregar o questionário. Verifique se ele existe e se você possui permissão.',
          )
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    }

    carregar()
    return () => {
      cancel = true
    }
  }, [id, user, role, isGestao])

  const handlePrint = () => {
    window.print()
  }

  // Nome do setor amigável
  const setorNome = (() => {
    if (!questionario?.setor) return 'Todos os Setores / Geral'
    const encontrado = setoresList.find(
      (s) =>
        s.chave?.toLowerCase() === questionario.setor?.toLowerCase() ||
        s.nome.toLowerCase() === questionario.setor?.toLowerCase() ||
        s.id === questionario.setor,
    )
    return encontrado?.nome || questionario.setor.toUpperCase()
  })()

  const usuarioNome = user?.name || user?.email || 'Usuário do Sistema'
  const usuarioPapel =
    role === 'admin' ? 'Administrador' : role === 'rh' ? 'RH' : `Gestão (${setorNome})`

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center p-6 text-center text-gray-500">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-gray-700">
          Carregando questionário para impressão...
        </p>
      </div>
    )
  }

  if (erro || !questionario) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Acesso Restrito / Não Encontrado</h2>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              {erro || 'Questionário não encontrado.'}
            </p>
          </div>
          <Button onClick={() => navigate(-1)} variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  const objetivas = questoes.filter((q) => q.tipo !== 'dissertativa')
  const dissertativas = questoes.filter((q) => q.tipo === 'dissertativa')

  return (
    <div className="min-h-screen bg-[#F6F7F9] print:bg-white text-slate-900">
      {/* Barra de controle superior (oculta no print) */}
      <div className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-xs px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="h-8 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Voltar
            </Button>
            <div className="text-xs">
              <span className="font-bold text-gray-900">{questionario.nome}</span>
              <span className="text-gray-400 mx-1.5">•</span>
              <span className="text-gray-600">Setor: {setorNome}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Seletor de Vias */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => alternarVia('gabarito')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  via === 'gabarito'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Via com Gabarito
              </button>
              <button
                type="button"
                onClick={() => alternarVia('branco')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  via === 'branco'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Prova em Branco
              </button>
            </div>

            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold h-8 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* Documento A4 de Impressão */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8 print:p-0 print:max-w-full">
        <article className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-10 print:border-none print:shadow-none print:p-0">
          {/* Cabeçalho da Prova / Gabarito */}
          <header className="border-b-2 border-brand-600 pb-5 mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <MundoOpenLogo variant="full" size="md" />
            </div>
            <div className="sm:text-right space-y-1">
              <div className="inline-flex items-center gap-1.5">
                {via === 'gabarito' ? (
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs">
                    VIA COM GABARITO OFICIAL
                  </Badge>
                ) : (
                  <Badge className="bg-blue-50 text-blue-800 border-blue-300 font-bold text-xs">
                    CADERNO DE PROVA (EM BRANCO)
                  </Badge>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Grupo Mundo Open • Avaliação Técnica de TI
              </div>
            </div>
          </header>

          {/* Dados do Questionário */}
          <section className="mb-6 pb-5 border-b border-gray-200 space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
              {questionario.nome}
            </h1>
            {questionario.descricao && (
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {questionario.descricao}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Setor</span>
                <span className="font-bold text-gray-900">{setorNome}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  Questões
                </span>
                <span className="font-bold text-gray-900">
                  {questoes.length} total ({objetivas.length} obj. / {dissertativas.length} diss.)
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  Régua Mínima
                </span>
                <span className="font-bold text-emerald-700">
                  {questionario.percentual_aprovacao || 95}% de acerto
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  Sorteio Prova
                </span>
                <span className="font-bold text-purple-700">
                  {questionario.questoes_por_prova || 20} por tentativa
                </span>
              </div>
            </div>

            {/* Cabeçalho do Aluno na via em branco para preenchimento a mão */}
            {via === 'branco' && (
              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-300 rounded-lg space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 border-b border-gray-400 pb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-600 block">
                      Nome do Avaliado:
                    </span>
                  </div>
                  <div className="w-full sm:w-48 border-b border-gray-400 pb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-600 block">
                      Data de Aplicação:
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 border-b border-gray-400 pb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-600 block">
                      Avaliador / Instrutor:
                    </span>
                  </div>
                  <div className="w-full sm:w-48 border-b border-gray-400 pb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-600 block">
                      Nota / Acertos:
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Lista de Questões */}
          {questoes.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Nenhuma questão cadastrada neste questionário.
            </div>
          ) : (
            <section className="space-y-6">
              {questoes.map((q, idx) => {
                const isDissertativa = q.tipo === 'dissertativa'
                const alternativas = Array.isArray(q.alternativas) ? q.alternativas : []

                return (
                  <div
                    key={q.id}
                    className="avoid-break pb-5 border-b border-gray-200 last:border-b-0 space-y-2.5"
                  >
                    {/* Enunciado */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 print:border print:border-black">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {q.tema && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                              {q.tema}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-gray-500">
                            {isDissertativa ? 'Questão Dissertativa' : 'Múltipla Escolha'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-line">
                          {q.enunciado}
                        </p>
                      </div>
                    </div>

                    {/* Alternativas ou Linhas para dissertativa */}
                    {!isDissertativa ? (
                      <div className="pl-8 space-y-1.5 pt-1">
                        {alternativas.map((alt, aIdx) => {
                          const isCorreta = via === 'gabarito' && aIdx === q.correta_index
                          const letra = String.fromCharCode(65 + aIdx)

                          return (
                            <div
                              key={aIdx}
                              className={`p-2 rounded-lg text-xs flex items-start gap-2.5 transition-colors border ${
                                isCorreta
                                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-medium print:bg-emerald-100'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isCorreta
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-gray-400 text-gray-700 bg-gray-50'
                                }`}
                              >
                                {letra}
                              </span>
                              <span className="flex-1 pt-0.5">{alt}</span>
                              {isCorreta && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>CORRETA</span>
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* Questão Dissertativa */
                      <div className="pl-8 pt-1 space-y-2">
                        {via === 'gabarito' ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 space-y-1">
                            <span className="font-bold text-emerald-900 block text-[11px] uppercase tracking-wide">
                              Gabarito Esperado / Critério de Avaliação:
                            </span>
                            <p className="whitespace-pre-line leading-relaxed">
                              {q.gabarito_comentario || 'Sem gabarito detalhado cadastrado.'}
                            </p>
                          </div>
                        ) : (
                          /* Linhas em branco para preenchimento na prova em papel */
                          <div className="space-y-3 pt-2">
                            <div className="h-6 border-b border-dashed border-gray-400" />
                            <div className="h-6 border-b border-dashed border-gray-400" />
                            <div className="h-6 border-b border-dashed border-gray-400" />
                            <div className="h-6 border-b border-dashed border-gray-400" />
                            <div className="h-6 border-b border-dashed border-gray-400" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comentário do gabarito para múltipla escolha (apenas na via gabarito) */}
                    {via === 'gabarito' && !isDissertativa && q.gabarito_comentario && (
                      <div className="ml-8 mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-950 space-y-0.5">
                        <span className="font-bold text-blue-900 block">
                          Comentário Explicativo do Gabarito:
                        </span>
                        <p className="leading-relaxed">{q.gabarito_comentario}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {/* Rodapé Oficial da Impressão */}
          <footer className="mt-10 pt-5 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-500">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="font-bold text-gray-800">
                Mundo Open — Onboarding & Treinamento Técnico de TI
              </div>
              <div>
                Documento gerado por: <strong>{usuarioNome}</strong> ({usuarioPapel})
              </div>
            </div>
            <div className="text-center sm:text-right space-y-0.5">
              <div>
                Impresso em:{' '}
                <strong>
                  {dataImpressao.toLocaleDateString('pt-BR')} às{' '}
                  {dataImpressao.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
              <div className="text-gray-400">
                Via: {via === 'gabarito' ? 'Gabarito Oficial' : 'Prova em Branco'} • ID:{' '}
                {questionario.id}
              </div>
            </div>
          </footer>
        </article>
      </main>
    </div>
  )
}
