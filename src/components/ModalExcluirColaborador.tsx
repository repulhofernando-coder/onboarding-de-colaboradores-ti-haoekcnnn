import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  Trash2,
  Layers,
  CheckSquare,
  FileCheck2,
  Award,
  Link2Off,
  UserCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

export interface ModalExcluirColaboradorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaboradorNome: string
  colaboradorEmail?: string
  onboardingId?: string
  onSucesso: (resultado: {
    colaboradorNome: string
    totalOnboardings: number
    totalTarefas: number
    totalConfirmacoes: number
    totalAvaliacoes: number
  }) => void
}

interface ResumoCascata {
  colaboradorNome: string
  colaboradorEmail: string
  totalOnboardings: number
  onboardingIds: string[]
  tarefasCount: number
  confirmacoesCount: number
  avaliacoesCount: number
  tokensCount: number
}

export const ModalExcluirColaborador: React.FC<ModalExcluirColaboradorProps> = ({
  open,
  onOpenChange,
  colaboradorNome,
  colaboradorEmail,
  onboardingId,
  onSucesso,
}) => {
  const { isAdmin, isRH } = useAuth()
  const podeExcluir = isAdmin || isRH

  const [carregandoResumo, setCarregandoResumo] = useState(false)
  const [resumo, setResumo] = useState<ResumoCascata | null>(null)
  const [erroResumo, setErroResumo] = useState<string | null>(null)

  const [nomeDigitado, setNomeDigitado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [executando, setExecutando] = useState(false)

  // Carregar dados de resumo sempre que abrir o modal
  useEffect(() => {
    if (!open) {
      setNomeDigitado('')
      setMotivo('')
      setResumo(null)
      setErroResumo(null)
      setExecutando(false)
      return
    }

    if (!podeExcluir) {
      setErroResumo('Apenas Administrador e RH possuem permissão para excluir colaboradores.')
      return
    }

    let isMounted = true
    setCarregandoResumo(true)
    setErroResumo(null)

    onboardingService
      .getResumoExclusaoColaborador({
        nome: colaboradorNome,
        email: colaboradorEmail,
        onboardingId,
      })
      .then((data) => {
        if (isMounted) {
          setResumo(data)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Erro ao buscar resumo da cascata:', err)
          setErroResumo(
            err && err.message
              ? err.message
              : 'Não foi possível carregar os dados de contagem do colaborador.',
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setCarregandoResumo(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open, colaboradorNome, colaboradorEmail, onboardingId, podeExcluir])

  const nomeEsperado = (resumo?.colaboradorNome || colaboradorNome || '').trim()
  const isNomeCorreto =
    nomeDigitado.trim().length > 0 &&
    nomeDigitado.trim().toLowerCase() === nomeEsperado.toLowerCase()

  const handleConfirmarExclusao = async () => {
    if (!podeExcluir) {
      toast.error('Permissão negada. Apenas Administrador e RH podem excluir colaboradores.')
      return
    }

    if (!isNomeCorreto) {
      toast.error(`Digite exatamente "${nomeEsperado}" para confirmar a exclusão.`)
      return
    }

    try {
      setExecutando(true)
      const res = await onboardingService.excluirColaboradorEmCascata({
        colaboradorNome: nomeEsperado,
        colaboradorEmail: resumo?.colaboradorEmail || colaboradorEmail || '',
        onboardingId,
        nomeConfirmacao: nomeDigitado.trim(),
        motivo: motivo.trim(),
      })

      toast.success(
        `Colaborador ${res.colaboradorNome} e seus registros vinculados foram excluídos com sucesso!`,
      )
      onOpenChange(false)
      onSucesso({
        colaboradorNome: res.colaboradorNome,
        totalOnboardings: res.totalOnboardings,
        totalTarefas: res.totalTarefas,
        totalConfirmacoes: res.totalConfirmacoes,
        totalAvaliacoes: res.totalAvaliacoes,
      })
    } catch (err: unknown) {
      console.error('Erro ao executar exclusão em cascata:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao excluir colaborador.'
      toast.error(`Falha na exclusão: ${msg}`)
    } finally {
      setExecutando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !executando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1">
            <Trash2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">
            Excluir Colaborador & Cascata Completa
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-600 leading-relaxed">
            Esta operação apagará definitivamente o colaborador{' '}
            <strong className="text-gray-900 font-semibold">{nomeEsperado}</strong> e todos os
            registros atrelados à sua jornada. Não será realizado soft delete — os dados serão
            removidos permanentemente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card de Resumo do que será excluído */}
          <div className="space-y-2.5 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <span className="font-bold text-gray-900 text-xs block uppercase tracking-wider">
              Resumo do que será permanentemente removido:
            </span>

            {carregandoResumo ? (
              <div className="py-4 flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                <span>Calculando itens vinculados em tempo real...</span>
              </div>
            ) : erroResumo ? (
              <div className="p-2.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                {erroResumo}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-gray-200/90 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Processos de Onboarding</span>
                    <strong className="text-xs font-bold text-gray-900">
                      {resumo?.totalOnboardings ?? 1} processo(s)
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-gray-200/90 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Tarefas e Atividades</span>
                    <strong className="text-xs font-bold text-gray-900">
                      {resumo?.tarefasCount ?? 0} tarefa(s)
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-gray-200/90 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Confirmações no Portal</span>
                    <strong className="text-xs font-bold text-gray-900">
                      {resumo?.confirmacoesCount ?? 0} confirmação(ões)
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-gray-200/90 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Avaliações Finais</span>
                    <strong className="text-xs font-bold text-gray-900">
                      {resumo?.avaliacoesCount ?? 0} avaliação(ões)
                    </strong>
                  </div>
                </div>

                <div className="col-span-full flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs text-red-900">
                  <div className="w-7 h-7 rounded-md bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                    <Link2Off className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-red-600 font-medium block">
                      Invalidação de Acesso Público
                    </span>
                    <strong className="text-xs font-bold text-red-950">
                      Link público (token) será imediatamente revogado
                    </strong>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      O colaborador não conseguirá mais visualizar nenhum conteúdo ou confirmar
                      leituras.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Aviso de Usuários Preservados */}
          <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-200 p-3 rounded-lg text-blue-900">
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Usuários do sistema preservados:</strong> As contas de acesso dos gestores e
              RH não são tocadas. Apenas o colaborador e seus dados vinculados são excluídos.
            </div>
          </div>

          {/* Campo Opcional de Motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo-exclusao" className="text-xs font-semibold text-gray-800">
              Motivo da exclusão (opcional, registrado em Auditoria):
            </Label>
            <Textarea
              id="motivo-exclusao"
              placeholder="Ex.: Desistiu da vaga antes do início; Cadastro duplicado com dados incorretos feito pelo RH..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={executando}
              rows={2}
              className="text-xs resize-none"
            />
            <p className="text-[11px] text-gray-500">
              O motivo será gravado de forma imutável no Histórico & Auditoria com quem solicitou e
              data/hora.
            </p>
          </div>

          {/* Confirmação Forte por Digitação do Nome */}
          <div className="p-3.5 bg-red-50/70 rounded-xl border border-red-200 space-y-2">
            <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Confirmação de segurança:</span>
            </div>
            <p className="text-[11px] text-red-800 leading-relaxed">
              Para evitar exclusões acidentais, digite o nome exato do colaborador abaixo para
              desbloquear a confirmação final:
            </p>
            <div className="bg-white/90 p-2 rounded border border-red-200 text-center font-mono font-bold text-sm text-red-700 select-all">
              {nomeEsperado}
            </div>
            <Input
              placeholder={`Digite "${nomeEsperado}"`}
              value={nomeDigitado}
              onChange={(e) => setNomeDigitado(e.target.value)}
              disabled={executando}
              className="mt-1 font-semibold text-sm border-red-300 focus-visible:ring-red-500 text-center"
            />
          </div>

          <div className="text-[11px] text-gray-500 flex items-center gap-1.5 justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Ação irreversível. Não há opção de restaurar após confirmar.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            disabled={executando}
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!isNomeCorreto || executando || !podeExcluir}
            onClick={handleConfirmarExclusao}
            className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-30 gap-1.5 shadow-sm"
          >
            {executando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Excluindo em cascata...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Colaborador Definitivamente</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
