import React, { useState } from 'react'
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
import { toast } from 'sonner'
import { UserCheck, ShieldCheck } from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import type { Onboarding } from '@/types/onboarding'

export interface ModalReverterDesligamentoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onboarding: Onboarding
  onSucesso: (atualizado: Onboarding) => void
}

export function ModalReverterDesligamento({
  open,
  onOpenChange,
  onboarding,
  onSucesso,
}: ModalReverterDesligamentoProps) {
  const { user } = useAuth()
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }

    try {
      setSalvando(true)

      const atualizado = await onboardingService.reverterDesligamento({
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        motivoReversao: justificativa.trim() || 'Reversão de desligamento pelo RH/Admin',
        autor: {
          id: user.id,
          nome: user.name || user.email,
          role: user.role || 'rh',
        },
      })

      toast.success(
        `Colaborador ${onboarding.colaborador_nome} reativado com sucesso no quadro ativo!`,
      )
      onSucesso(atualizado)
      onOpenChange(false)
      setJustificativa('')
    } catch (err) {
      console.error('Erro ao reativar colaborador:', err)
      toast.error('Falha ao reverter desligamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-700">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <span>Reativar Colaborador (Reverter Desligamento)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Restaura <strong>{onboarding.colaborador_nome}</strong> ao quadro de colaboradores
              ativos da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Efeitos da reativação (Exclusivo RH/Admin):</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-700 pl-1">
              <li>O badge "Demitido" é removido e o perfil volta ao estado ativo.</li>
              <li>O colaborador volta a ser monitorado pelo controle de férias.</li>
              <li>Libera a aplicação de novas provas e a abertura de novos onboardings.</li>
              <li>O histórico anterior na Trajetória e na Auditoria é preservado integralmente.</li>
            </ul>
          </div>

          <div className="space-y-1.5 py-1">
            <Label className="text-xs font-semibold text-gray-700">
              Justificativa / Motivo da reativação (opcional)
            </Label>
            <Textarea
              rows={3}
              placeholder="Ex: Registro efetuado por engano ou readmissão funcional autorizada..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="text-xs resize-none"
              disabled={salvando}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold"
            >
              {salvando ? 'Reativando...' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
