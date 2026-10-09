import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

import type { UserRole } from '@/types/onboarding'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, role } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Carregando sessão...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Acesso Restrito</h2>
        <p className="text-sm text-gray-600 max-w-md mb-6">
          Você não tem permissão para esta ação ou tela. Seu perfil atual é{' '}
          <strong className="text-gray-900 uppercase">{role}</strong>.
        </p>
        <Button asChild className="bg-brand-600 hover:bg-brand-700 text-white">
          <Link to="/">Voltar para a Visão Geral</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
