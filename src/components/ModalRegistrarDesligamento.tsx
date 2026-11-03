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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { UserX, Calendar, AlertTriangle } from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import { MOTIVOS_DESLIGAMENTO, type MotivoDesligamento, type Onboarding } from '@/types/onboarding'

export interface ModalRegistrarDesligamentoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onboarding: Onboarding
  onSucesso: (atualizado: Onboarding) => void
}

export function ModalRegistrarDesligamento({
  open,
  onOpenChange,
  onboarding,
  onSucesso,
}: ModalRegistrarDesligamentoProps) {
  const { user } = useAuth()
  const [dataDesligamento, setDataDesligamento] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [motivo, setMotivo] = useState<MotivoDesligamento>(MOTIVOS_DESLIGAMENTO[1])
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dataDesligamento) {
      toast.error('Informe a data do desligamento.')
      return
    }

    if (!motivo) {
      toast.error('Selecione o motivo do desligamento.')
      return
    }

    if (!user) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }

    try {
      setSalvando(true)

      const atualizado = await onboardingService.registrarDesligamento({
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        dataDesligamento,
        motivo,
        observacoes,
        autor: {
          id: user.id,
          nome: user.name || user.email,
          role: user.role || 'gestao',
        },
      })

      toast.success(`Desligamento de ${onboarding.colaborador_nome} registrado com sucesso.`)
      onSucesso(atualizado)
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao registrar desligamento:', err)
      toast.error('Falha ao registrar desligamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-700">
              <UserX className="w-5 h-5 text-red-600" />
              <span>Registrar Desligamento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Registra a saída de <strong>{onboarding.colaborador_nome}</strong> da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Efeitos imediatos no sistema:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700 pl-1">
              <li>
                O card ganha o badge vermelho <strong>Demitido</strong>.
              </li>
              <li>O colaborador é excluído dos alertas de férias da Visão Geral.</li>
              <li>Bloqueio para aplicar novas provas e iniciar novos onboardings.</li>
              <li>O evento entra na Trajetória e na trilha de auditoria (6 meses).</li>
            </ul>
          </div>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Data do desligamento *</span>
              </Label>
              <Input
                type="date"
                value={dataDesligamento}
                onChange={(e) => setDataDesligamento(e.target.value)}
                required
                className="h-9 text-xs"
                disabled={salvando}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Motivo do desligamento *
              </Label>
              <Select
                value={motivo}
                onValueChange={(val) => setMotivo(val as MotivoDesligamento)}
                disabled={salvando}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_DESLIGAMENTO.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Observações internas (opcional)
              </Label>
              <Textarea
                rows={3}
                placeholder="Detalhes adicionais sobre a rescisão, acordos ou contexto..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="text-xs resize-none"
                disabled={salvando}
              />
            </div>
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
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 font-semibold"
            >
              {salvando ? 'Registrando...' : 'Confirmar Desligamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
