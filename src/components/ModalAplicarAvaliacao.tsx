import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GraduationCap,
  CheckCircle2,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import {
  questionarioService,
  avaliacaoColaboradorService,
  colaboradorAnotacaoService,
} from '@/services/onboarding'
import type { Onboarding, Questionario, AvaliacaoColaborador } from '@/types/onboarding'

export interface ModalAplicarAvaliacaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onboarding: Onboarding
  onSucesso?: (avaliacao: AvaliacaoColaborador) => void
}

export function ModalAplicarAvaliacao({
  open,
  onOpenChange,
  onboarding,
  onSucesso,
}: ModalAplicarAvaliacaoProps) {
  const { user } = useAuth()
  const [questionarios, setQuestionarios] = useState<Questionario[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [questionarioId, setQuestionarioId] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [avaliacaoCriada, setAvaliacaoCriada] = useState<AvaliacaoColaborador | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Carregar apenas questionários dos tipos permitidos: reciclagem, mudanca_area, avaliacao
  // Tipo onboarding e contratacao ficam de fora
  useEffect(() => {
    if (open) {
      setErro(null)
      setAvaliacaoCriada(null)
      setCopiado(false)
      setObservacoes('')
      setCarregando(true)

      questionarioService
        .listAtivos()
        .then((lista) => {
          // Filtrar SOMENTE reciclagem, mudanca_area e avaliacao
          const permitidos = lista.filter((q) => {
            const tipo = q.tipo_de_uso || ''
            return tipo === 'reciclagem' || tipo === 'mudanca_area' || tipo === 'avaliacao'
          })
          setQuestionarios(permitidos)
          if (permitidos.length > 0) {
            setQuestionarioId(permitidos[0].id)
          } else {
            setQuestionarioId('')
          }
        })
        .catch((err) => {
          console.error('[ModalAplicarAvaliacao] Erro ao carregar questionários:', err)
          setErro('Falha ao carregar lista de questionários disponíveis.')
        })
        .finally(() => setCarregando(false))
    }
  }, [open])

  const questionarioSelecionado = questionarios.find((q) => q.id === questionarioId)
  const urlPublica = avaliacaoCriada
    ? `${window.location.origin}/avaliacao/${avaliacaoCriada.token}`
    : ''

  async function handleConfirmarAplicacao(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!questionarioId) {
      setErro('Selecione um questionário para aplicar.')
      return
    }

    setSalvando(true)
    try {
      const q = questionarioSelecionado
      const tipoUso = q?.tipo_de_uso || 'avaliacao'

      const nova = await avaliacaoColaboradorService.aplicarAvaliacao({
        colaboradorId: onboarding.id,
        questionarioId: questionarioId,
        tipoAvaliacao: tipoUso,
        aplicadaPorId: user?.id,
        observacoes: observacoes.trim(),
      })

      // Se o gestor preencheu observações/anotações na aplicação da avaliação,
      // registrar também como anotação interna do tipo 'avaliacao' no histórico confidencial
      if (observacoes.trim() && user?.id) {
        try {
          const questNome = questionarioSelecionado?.nome || 'Avaliação'
          await colaboradorAnotacaoService.criar({
            colaboradorId: onboarding.id,
            colaboradorNome: onboarding.colaborador_nome,
            tipo: 'avaliacao',
            texto: `[Envio da Prova: ${questNome}] ${observacoes.trim()}`,
            autor: {
              id: user.id,
              nome: user.name || user.email || 'Gestor',
              role: user.role || 'gestao',
            },
          })
        } catch (anotErr) {
          console.warn('[ModalAplicarAvaliacao] Falha ao registrar anotação da avaliação:', anotErr)
        }
      }

      setAvaliacaoCriada(nova)
      if (onSucesso) {
        onSucesso(nova)
      }

      toast({
        title: 'Avaliação aplicada com sucesso!',
        description: 'Link exclusivo gerado. Copie e envie ao colaborador.',
      })
    } catch (err: any) {
      console.error('[ModalAplicarAvaliacao] Erro ao aplicar:', err)
      setErro(err?.message || 'Falha ao gerar link de avaliação.')
    } finally {
      setSalvando(false)
    }
  }

  function handleCopiarLink() {
    if (!urlPublica) return
    navigator.clipboard.writeText(urlPublica)
    setCopiado(true)
    toast({
      title: 'Link copiado!',
      description: 'Envie o link ao colaborador por WhatsApp ou e-mail.',
    })
    setTimeout(() => setCopiado(false), 3000)
  }

  function handleFechar() {
    setAvaliacaoCriada(null)
    setCopiado(false)
    onOpenChange(false)
  }

  const TIPO_LABEL: Record<string, string> = {
    reciclagem: 'Reciclagem Periódica',
    mudanca_area: 'Mudança de Área',
    avaliacao: 'Avaliação Periódica de Desempenho',
  }

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Aplicar Avaliação ao Colaborador
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {onboarding.colaborador_nome} • {onboarding.cargo} ({onboarding.setor})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        {!avaliacaoCriada ? (
          <form onSubmit={handleConfirmarAplicacao} className="space-y-4 py-2">
            {carregando ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-500 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                Carregando questionários disponíveis...
              </div>
            ) : questionarios.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs space-y-2">
                <p className="font-semibold">
                  Nenhum questionário cadastrado para esta finalidade.
                </p>
                <p>
                  Para aplicar avaliações aqui, cadastre um questionário com finalidade{' '}
                  <strong>Reciclagem</strong>, <strong>Mudança de Área</strong> ou{' '}
                  <strong>Avaliação</strong> no menu{' '}
                  <em>Modelos & Tarefas → Questionários de TI</em>.
                </p>
                <p className="text-[11px] text-amber-700">
                  (Questionários de <em>Onboarding</em> e <em>Contratação</em> não são listados
                  nesta seção por regra de negócio).
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="select-quest" className="text-xs font-semibold text-gray-700">
                    Selecione o Questionário <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={questionarioId}
                    onValueChange={setQuestionarioId}
                    disabled={salvando}
                  >
                    <SelectTrigger id="select-quest" className="text-xs">
                      <SelectValue placeholder="Escolha a prova" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionarios.map((q) => (
                        <SelectItem key={q.id} value={q.id} className="text-xs">
                          {q.nome} — [{TIPO_LABEL[q.tipo_de_uso] || q.tipo_de_uso}]{' '}
                          {q.setor ? `(${q.setor})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {questionarioSelecionado && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                        {questionarioSelecionado.nome}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-white text-brand-700">
                        Régua: {questionarioSelecionado.percentual_aprovacao || 80}%
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span>
                        Finalidade:{' '}
                        <strong>
                          {TIPO_LABEL[questionarioSelecionado.tipo_de_uso] ||
                            questionarioSelecionado.tipo_de_uso}
                        </strong>
                      </span>
                      {questionarioSelecionado.setor && (
                        <span>
                          • Setor: <strong>{questionarioSelecionado.setor}</strong>
                        </span>
                      )}
                    </div>

                    {questionarioSelecionado.descricao && (
                      <p className="text-gray-500 text-[11px]">
                        {questionarioSelecionado.descricao}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="obs-avaliacao" className="text-xs font-semibold text-gray-700">
                    Motivo / Observações da Aplicação (opcional)
                  </Label>
                  <Textarea
                    id="obs-avaliacao"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Reciclagem semestral de segurança e boas práticas de suporte..."
                    rows={2}
                    className="text-xs"
                    disabled={salvando}
                  />
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-[11px] text-blue-800 space-y-1">
                  <p className="font-semibold">Como funciona o link público?</p>
                  <p>
                    O colaborador responde sem login, sem cronômetro de 60 min. A correção é
                    automática no servidor e o colaborador nunca visualiza sua nota nem o gabarito.
                    O resultado alimenta o dossiê do colaborador nesta página.
                  </p>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFechar}
                    disabled={salvando}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={salvando || !questionarioId}
                    className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Gerando link...
                      </>
                    ) : (
                      'Gerar Link de Avaliação'
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        ) : (
          /* Avaliação criada: Exibir link */
          <div className="space-y-4 py-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Avaliação gerada com sucesso!
              </div>
              <p className="text-xs text-emerald-700">
                Envie o link seguro abaixo ao colaborador{' '}
                <strong>{onboarding.colaborador_nome}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Link de Acesso do Colaborador:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={urlPublica}
                  className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2.5 py-2 text-gray-800 focus:outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopiarLink}
                  className="shrink-0 h-9 text-xs font-semibold"
                >
                  {copiado ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-600 space-y-1">
              <p>• Token exclusivo vinculado ao dossiê do colaborador.</p>
              <p>• Sem necessidade de login e sem cronômetro.</p>
              <p>• Assim que submetido, o resultado constará automaticamente na lista abaixo.</p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={handleFechar}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
