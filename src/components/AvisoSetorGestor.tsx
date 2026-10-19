import React from 'react'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getSetorUsuarioNome } from '@/lib/gestaoVisibility'
import type { SetorModel } from '@/types/onboarding'

interface AvisoSetorGestorProps {
  setoresList?: SetorModel[]
  className?: string
  moduloNome?: string
}

/**
 * Alerta informativo exibido para usuários com papel 'Gestão'
 * - Caso NÃO possuam setor cadastrado: exibe alerta de bloqueio orientando a contatar Admin/RH.
 * - Caso possuam setor: exibe discreto selo indicando que a visão está restrita ao departamento cadastrado.
 */
export function AvisoSetorGestor({
  setoresList = [],
  className = '',
  moduloNome = 'dados',
}: AvisoSetorGestorProps) {
  const { user, isGestao } = useAuth()

  if (!isGestao) return null

  const temSetor = Boolean(user?.setor && user.setor.trim())
  const setorNome = getSetorUsuarioNome(user, setoresList)

  if (!temSetor) {
    return (
      <div
        className={`p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs ${className}`}
        role="alert"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-amber-800 text-sm block">
            Setor de Atuação Não Configurado
          </span>
          <p className="text-amber-700 leading-relaxed">
            Seu usuário possui o papel <strong>Gestão</strong>, mas ainda não tem um departamento
            vinculado ao seu cadastro. Por segurança, os {moduloNome} ficam ocultos até que um{' '}
            <strong>Administrador ou RH</strong> configure o seu setor em{' '}
            <em>Gerenciamento de Usuários</em>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`px-3.5 py-2 rounded-lg bg-blue-50/70 border border-blue-200/80 text-blue-900 flex items-center justify-between gap-3 text-xs shadow-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-brand-600 shrink-0" />
        <span>
          Visualização restrita ao setor <strong>{setorNome || user?.setor}</strong> (papel Gestão).
        </span>
      </div>
      <span className="text-[11px] font-semibold text-brand-700 bg-brand-100/70 px-2 py-0.5 rounded-full shrink-0">
        Filtro de Departamento Ativo
      </span>
    </div>
  )
}
