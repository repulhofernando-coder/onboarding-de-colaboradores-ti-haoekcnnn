import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileQuestion,
  HelpCircle,
  Building2,
  ArrowRight,
  Send,
  Lock,
} from 'lucide-react'
import { MundoOpenLogo } from '@/components/MundoOpenLogo'
import { toast } from '@/hooks/use-toast'
import { pb } from '@/lib/pocketbase/client'

interface QuestaoPublica {
  id: string
  ordem: number
  tema: string
  enunciado: string
  alternativas: string[]
}

interface DadosAvaliacaoPublica {
  liberado: boolean
  jaSubmetido?: boolean
  colaboradorNome: string
  cargo?: string
  setor?: string
  tipoAvaliacao?: string
  questionarioNome?: string
  questionarioDescricao?: string
  totalQuestoes?: number
  questoes?: QuestaoPublica[]
  mensagem?: string
  dataConclusao?: string
  motivo?: string
}

export function ColaboradorAvaliacaoPublica() {
  const { token } = useParams<{ token: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosAvaliacaoPublica | null>(null)

  // Respostas selecionadas: { [questaoId]: indexNumber }
  const [respostas, setRespostas] = useState<Record<string, number>>({})
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [questoesNaoRespondidas, setQuestoesNaoRespondidas] = useState<number[]>([])

  // Tela de sucesso final
  const [concluidoComSucesso, setConcluidoComSucesso] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  useEffect(() => {
    async function carregarProva() {
      if (!token) {
        setErroCarregamento('Token de acesso não fornecido no link.')
        setCarregando(false)
        return
      }

      setCarregando(true)
      setErroCarregamento(null)

      try {
        const json = await pb.send<DadosAvaliacaoPublica>(
          `/backend/v1/colaborador/avaliacao/publico?token=${encodeURIComponent(token)}`,
          { method: 'GET' },
        )

        setDados(json)
      } catch (err: any) {
        console.error('[ColaboradorAvaliacaoPublica] Erro:', err)
        setErroCarregamento(
          err.message || 'Falha ao conectar ao servidor para carregar a avaliação.',
        )
      } finally {
        setCarregando(false)
      }
    }

    carregarProva()
  }, [token])

  function handleSelecionarResposta(questaoId: string, index: number) {
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: index,
    }))
    // Limpar avisos de faltantes conforme responde
    if (questoesNaoRespondidas.length > 0) {
      setQuestoesNaoRespondidas([])
      setErroEnvio(null)
    }
  }

  async function handleEnviarAvaliacao(e: React.FormEvent) {
    e.preventDefault()
    setErroEnvio(null)
    setQuestoesNaoRespondidas([])

    if (!token || !dados?.questoes) return

    // Validar se todas as questões foram respondidas no front
    const faltantes: number[] = []
    dados.questoes.forEach((q) => {
      if (respostas[q.id] === undefined) {
        faltantes.push(q.ordem)
      }
    })

    if (faltantes.length > 0) {
      setQuestoesNaoRespondidas(faltantes)
      setErroEnvio(
        `Existem ${faltantes.length} questão(ões) pendente(s): Questão(ões) ${faltantes.join(', ')}. Responda todas para finalizar.`,
      )
      toast({
        title: 'Responda todas as questões',
        description: `Questões pendentes: ${faltantes.join(', ')}`,
        variant: 'destructive',
      })
      return
    }

    if (
      !confirm(
        'Deseja realmente enviar suas respostas? Após o envio, a avaliação será finalizada e corrigida automaticamente.',
      )
    ) {
      return
    }

    setEnviando(true)
    try {
      const json = await pb.send<{
        sucesso: boolean
        mensagem: string
        dataConclusao: string
      }>('/backend/v1/colaborador/avaliacao/submeter', {
        method: 'POST',
        body: {
          token: token,
          respostas: respostas,
        },
      })

      // SUCESSO: O colaborador NUNCA vê nota nem gabarito, apenas confirmação de envio
      setConcluidoComSucesso(true)
      setMensagemSucesso(
        json?.mensagem ||
          'Sua avaliação foi enviada e registrada com sucesso! A equipe de RH e Gestão já tem acesso aos seus resultados.',
      )
      toast({
        title: 'Avaliação enviada!',
        description: 'Suas respostas foram registradas no sistema.',
      })
    } catch (err: any) {
      console.error('[ColaboradorAvaliacaoPublica] Erro ao submeter:', err)
      setErroEnvio(err.message || 'Falha ao submeter avaliação. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // 1. Estado de carregamento
  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <MundoOpenLogo className="h-10 mx-auto" />
          <div className="flex items-center justify-center gap-2 text-brand-700 font-medium text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando avaliação técnica...
          </div>
        </div>
      </div>
    )
  }

  // 2. Erro fatal ao carregar
  if (erroCarregamento || !dados) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border border-red-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold text-gray-900">Link Indisponível</CardTitle>
            <CardDescription className="text-xs text-gray-600">
              {erroCarregamento || 'Não foi possível validar este link de avaliação.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4">
            <p className="text-xs text-gray-500 mb-4">
              Verifique se o link enviado está completo ou entre em contato com a equipe de Recursos
              Humanos ou Gestão de TI da Mundo Open.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 3. Caso já submetido anteriormente
  if (dados.jaSubmetido) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border border-emerald-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <CardTitle className="text-lg font-bold text-gray-900">
              Avaliação Já Concluída
            </CardTitle>
            <CardDescription className="text-xs text-gray-600">
              Olá, <strong>{dados.colaboradorNome}</strong>!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 pt-2">
            <p className="text-xs text-gray-600 leading-relaxed">
              {dados.mensagem ||
                'Esta avaliação já foi respondida com sucesso. Suas respostas foram salvas e computadas no seu dossiê corporativo.'}
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
              A equipe de RH e Gestão já tem acesso aos seus resultados. Nenhuma ação adicional é
              necessária.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 4. Concluído com sucesso nesta sessão
  if (concluidoComSucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <Card className="max-w-lg w-full border border-emerald-300 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Avaliação Enviada com Sucesso!
            </CardTitle>
            <CardDescription className="text-xs text-gray-600">
              Obrigado, <strong>{dados.colaboradorNome}</strong>!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 pt-3">
            <p className="text-sm text-gray-700 leading-relaxed">{mensagemSucesso}</p>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 text-left">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Confirmação de Registro:
              </div>
              <p className="text-emerald-700">
                • Todas as suas respostas foram computadas e gravadas na trilha de auditoria oficial
                da Mundo Open.
              </p>
              <p className="text-emerald-700">
                • Seu gestor e o time de RH têm acesso completo ao dossiê técnico atualizado.
              </p>
            </div>
            <p className="text-xs text-gray-400 pt-2">
              Você já pode fechar esta aba com segurança.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 5. Formulário de Resolução da Avaliação
  const questoes = dados.questoes || []
  const totalRespondidas = Object.keys(respostas).length
  const totalQuestoes = questoes.length
  const progresso = totalQuestoes > 0 ? Math.round((totalRespondidas / totalQuestoes) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Topo fixo / institucional */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm py-3 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MundoOpenLogo className="h-8 shrink-0" />
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <span className="text-xs font-semibold text-gray-700 block">
                {dados.questionarioNome || 'Avaliação Técnica'}
              </span>
              <span className="text-[11px] text-gray-400">
                {dados.colaboradorNome} • {dados.cargo}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-gray-400 block font-medium">Progresso</span>
              <span className="text-xs font-bold text-brand-700">
                {totalRespondidas} de {totalQuestoes} respondidas ({progresso}%)
              </span>
            </div>
            <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1">
        {/* Banner de Apresentação */}
        <Card className="border-gray-200 shadow-sm overflow-hidden bg-gradient-to-r from-brand-50/60 via-white to-blue-50/40">
          <CardHeader className="p-4 sm:p-6 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 border border-brand-200 mb-2">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {dados.tipoAvaliacao
                    ? dados.tipoAvaliacao.toUpperCase()
                    : 'AVALIAÇÃO DO COLABORADOR'}
                </span>
                <CardTitle className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {dados.questionarioNome || 'Questionário Técnico'}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-gray-600 mt-1">
                  Colaborador(a): <strong>{dados.colaboradorNome}</strong> • Função:{' '}
                  <strong>{dados.cargo || 'TI'}</strong> • Setor:{' '}
                  <strong>{dados.setor || 'Operações'}</strong>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {dados.questionarioDescricao && (
              <p className="text-xs sm:text-sm text-gray-600 bg-white/70 p-3 rounded-lg border border-gray-200 mt-2">
                {dados.questionarioDescricao}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span className="flex items-center gap-1">
                <FileQuestion className="w-3.5 h-3.5 text-gray-400" />
                {totalQuestoes} questões de múltipla escolha
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sem tempo limite
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                Tentativa única e definitiva
              </span>
            </div>
          </CardContent>
        </Card>

        {erroEnvio && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erroEnvio}</AlertDescription>
          </Alert>
        )}

        {/* Formulário com Lista de Questões */}
        <form onSubmit={handleEnviarAvaliacao} className="space-y-6">
          {questoes.map((q, idx) => {
            const indexRespondido = respostas[q.id]
            const estaFaltando = questoesNaoRespondidas.includes(q.ordem)

            return (
              <Card
                key={q.id}
                className={`border shadow-sm transition-all ${
                  estaFaltando
                    ? 'border-red-400 bg-red-50/20 shadow-red-100'
                    : indexRespondido !== undefined
                      ? 'border-emerald-300 bg-white'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <CardHeader className="p-4 sm:p-5 pb-3 bg-gray-50/60 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {q.ordem || idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {q.tema || `Questão ${q.ordem || idx + 1}`}
                      </span>
                    </div>

                    {indexRespondido !== undefined ? (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Respondida
                      </span>
                    ) : estaFaltando ? (
                      <span className="text-xs font-semibold text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        Pendente
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Pendente</span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 mt-2 leading-relaxed">
                    {q.enunciado}
                  </h3>
                </CardHeader>

                <CardContent className="p-4 sm:p-5">
                  <RadioGroup
                    value={indexRespondido !== undefined ? String(indexRespondido) : undefined}
                    onValueChange={(val) => handleSelecionarResposta(q.id, Number(val))}
                    className="space-y-2.5"
                  >
                    {q.alternativas.map((alt, altIdx) => {
                      const selecionada = indexRespondido === altIdx
                      const letra = String.fromCharCode(65 + altIdx)

                      return (
                        <div
                          key={altIdx}
                          onClick={() => handleSelecionarResposta(q.id, altIdx)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selecionada
                              ? 'border-brand-600 bg-brand-50/70 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <RadioGroupItem
                            value={String(altIdx)}
                            id={`q_${q.id}_alt_${altIdx}`}
                            className="mt-0.5 shrink-0"
                          />
                          <Label
                            htmlFor={`q_${q.id}_alt_${altIdx}`}
                            className="text-xs sm:text-sm text-gray-800 cursor-pointer flex-1 leading-relaxed"
                          >
                            <span className="font-bold mr-1.5 text-gray-700">{letra})</span>
                            {alt}
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>
            )
          })}

          {/* Barra de Submissão Inferior */}
          <Card className="border-gray-200 shadow-md bg-white p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {totalRespondidas === totalQuestoes
                    ? 'Todas as questões respondidas!'
                    : `Faltam ${totalQuestoes - totalRespondidas} questão(ões)`}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Após submeter, a avaliação será processada no servidor da TI. Você não precisará
                  refazer.
                </p>
              </div>

              <Button
                type="submit"
                disabled={enviando || totalQuestoes === 0}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-2.5 h-11 shadow-sm shrink-0"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando avaliação...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Avaliação Definitiva
                  </>
                )}
              </Button>
            </div>
          </Card>
        </form>
      </main>

      {/* Rodapé Institucional */}
      <footer className="border-t border-gray-200 bg-white py-4 px-4 text-center text-xs text-gray-400">
        Mundo Open Tecnologia • Portal de Avaliação Técnica de Colaboradores
      </footer>
    </div>
  )
}
