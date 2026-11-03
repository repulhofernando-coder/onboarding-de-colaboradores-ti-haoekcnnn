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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus, Calendar, Mail, User, Briefcase, Building2 } from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import type { Onboarding, SetorModel } from '@/types/onboarding'

export interface ModalNovoColaboradorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setoresList: SetorModel[]
  onSucesso: (novoColaborador: Onboarding) => void
}

export function ModalNovoColaborador({
  open,
  onOpenChange,
  setoresList,
  onSucesso,
}: ModalNovoColaboradorProps) {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [setor, setSetor] = useState(setoresList[0]?.chave || setoresList[0]?.nome || 'windows')
  const [dataAdmissao, setDataAdmissao] = useState(() => new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nomeTrim = nome.trim()
    const emailTrim = email.trim()
    const cargoTrim = cargo.trim()

    if (!nomeTrim) {
      toast.error('Informe o nome do colaborador.')
      return
    }

    if (!emailTrim || !emailTrim.includes('@')) {
      toast.error('Informe um e-mail corporativo válido.')
      return
    }

    if (!setor) {
      toast.error('Selecione o setor do colaborador.')
      return
    }

    if (!dataAdmissao) {
      toast.error('Informe a data de admissão do colaborador.')
      return
    }

    if (!user) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }

    try {
      setSalvando(true)

      const setorObj = setoresList.find(
        (s) => s.chave === setor || s.nome === setor || s.id === setor,
      )

      const novo = await onboardingService.criarColaboradorDireto({
        nome: nomeTrim,
        email: emailTrim,
        cargo: cargoTrim,
        setor,
        setor_ref: setorObj?.id,
        data_admissao: dataAdmissao,
        gestor_id: user.id,
        autor: {
          id: user.id,
          nome: user.name || user.email,
          role: user.role || 'rh',
        },
      })

      toast.success('Colaborador cadastrado com sucesso!')
      onSucesso(novo)
      onOpenChange(false)
      setNome('')
      setEmail('')
      setCargo('')
    } catch (err) {
      console.error('Erro ao cadastrar colaborador direto:', err)
      toast.error('Não foi possível cadastrar o colaborador. Verifique os dados.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <UserPlus className="w-5 h-5 text-brand-600" />
              <span>Novo Colaborador (Sem Onboarding)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Cadastre o colaborador diretamente para compor a equipe. O perfil completo estará
              disponível imediatamente (férias, trajetória, cursos, certificados e provas).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Nome completo *</span>
              </Label>
              <Input
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="h-9 text-xs"
                disabled={salvando}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span>E-mail corporativo *</span>
              </Label>
              <Input
                type="email"
                placeholder="carlos.oliveira@mundoopen.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-xs"
                disabled={salvando}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Setor / Área *</span>
                </Label>
                <Select value={setor} onValueChange={setSetor} disabled={salvando}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setoresList.map((s) => (
                      <SelectItem key={s.id} value={s.chave || s.nome} className="text-xs">
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  <span>Cargo / Função</span>
                </Label>
                <Input
                  placeholder="Ex: Analista N1"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="h-9 text-xs"
                  disabled={salvando}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Data de Admissão (CLT) *</span>
              </Label>
              <Input
                type="date"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
                required
                className="h-9 text-xs"
                disabled={salvando}
              />
              <p className="text-[11px] text-gray-500">
                Alimenta o controle automático de férias (vencimento = admissão + 12 meses).
              </p>
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
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs h-9 font-semibold"
            >
              {salvando ? 'Cadastrando...' : 'Cadastrar Colaborador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
