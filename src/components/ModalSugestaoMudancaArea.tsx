import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { avaliacaoColaboradorService } from '@/services/onboarding'
import type { Onboarding, Questionario, AvaliacaoColaborador } from '@/types/onboarding'

export interface ModalSugestaoMudancaAreaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onboarding: Onboarding
  setorAntigo: string
  setorNovo: string
  questionarioSugerido: Questionario | null
  onAvaliacaoCriada?: (avaliacao: AvaliacaoColaborador) => void
}

export function ModalSugestaoMudancaArea({
  open,
  onOpenChange,
  onboarding,
  setorAntigo,
  setorNovo,
  questionarioSugerido,
  onAvaliacaoCriada,
}: ModalSugestaoMudancaAreaProps) {
  const { user } = useAuth()
  const [aplicando, setAplicando] = useState(false)
  const [avaliacaoGerada, setAvaliacaoGerada] = useState<AvaliacaoColaborador | null>(null)
  const [copiado, setCopiado] = useState(false)

  const urlPublica = avaliacaoGerada
    ? `${window.location.origin}/avaliacao/${avaliacaoGerada.token}`
    : ''

  async function handleAplicar() {
    if (!questionarioSugerido) return

    setAplicando(true)
    try {
      const nova = await avaliacaoColaboradorService.aplicarAvaliacao({
        colaboradorId: onboarding.id,
        questionarioId: questionarioSugerido.id,
        tipoAvaliacao: 'mudanca_area',
        aplicadaPorId: user?.id,
        observacoes: `Aplicação automática sugerida por Mudança de Área (${setorAntigo} → ${setorNovo})`,
      })

      setAvaliacaoGerada(nova)
      if (onAvaliacaoCriada) {
        onAvaliacaoCriada(nova)
      }

      toast({
        title: 'Avaliação aplicada!',
        description: 'Link exclusivo gerado para o colaborador responder a prova do novo setor.',
      })
    } catch (err: any) {
      console.error('[ModalSugestaoMudancaArea] Erro ao aplicar:', err)
      toast({
        title: 'Erro ao aplicar avaliação',
        description: err?.message || 'Não foi possível gerar a avaliação para o colaborador.',
        variant: 'destructive',
      })
    } finally {
      setAplicando(false)
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
    setAvaliacaoGerada(null)
    setCopiado(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Mudança de Área detectada
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {onboarding.colaborador_nome}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          {/* Badge de Transição de Área */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Área Anterior</span>
              <span className="text-xs font-semibold text-gray-700">
                {setorAntigo || '(Sem área)'}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Nova Área</span>
              <span className="text-xs font-bold text-brand-700">{setorNovo}</span>
            </div>
          </div>

          {!questionarioSugerido ? (
            /* Alerta quando o novo setor não possui questionário cadastrado */
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs space-y-1">
                <p className="font-semibold">
                  Nenhum questionário cadastrado para o setor {setorNovo}.
                </p>
                <p className="text-amber-700">
                  Cadastre um questionário com tipo de uso "mudanca_area" ou "onboarding" vinculado
                  ao setor {setorNovo} no menu "Modelos & Tarefas" para aplicar avaliações
                  automáticas neste setor.
                </p>
              </AlertDescription>
            </Alert>
          ) : !avaliacaoGerada ? (
            /* Detalhes da prova sugerida */
            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                Deseja aplicar imediatamente a prova técnica do novo setor para validar as
                competências do colaborador?
              </p>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                    {questionarioSugerido.nome}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white border-blue-200 text-blue-800"
                  >
                    Régua: {questionarioSugerido.percentual_aprovacao || 80}%
                  </Badge>
                </div>
                {questionarioSugerido.descricao && (
                  <p className="text-xs text-blue-700 line-clamp-2">
                    {questionarioSugerido.descricao}
                  </p>
                )}
                <div className="text-[11px] text-blue-600 pt-1">
                  Tipo original:{' '}
                  <strong className="uppercase">{questionarioSugerido.tipo_de_uso}</strong> • Será
                  registrado como Mudança de Área no dossiê.
                </div>
              </div>
            </div>
          ) : (
            /* Prova aplicada: exibir link para cópia */
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Avaliação gerada com sucesso!
                </div>
                <p className="text-xs text-emerald-700">
                  Copie o link abaixo e envie ao colaborador. Ele poderá responder sem login, e o
                  resultado será computado automaticamente.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Link público da avaliação:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={urlPublica}
                    className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-gray-800 focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopiarLink}
                    className="shrink-0 h-8 text-xs font-semibold"
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
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {!avaliacaoGerada ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFechar}
                disabled={aplicando}
                className="text-xs"
              >
                {questionarioSugerido ? 'Pular por enquanto' : 'Entendido'}
              </Button>
              {questionarioSugerido && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAplicar}
                  disabled={aplicando}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
                >
                  {aplicando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Gerando link...
                    </>
                  ) : (
                    'Aplicar Prova Agora'
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleFechar}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              Concluído
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
