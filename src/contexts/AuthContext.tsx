import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/onboarding'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  role: 'admin' | 'rh' | 'gestao'
  isAdmin: boolean
  isRH: boolean
  isGestao: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      const u = (model as unknown as User) || null
      if (u && u.ativo === false) {
        pb.authStore.clear()
        setUser(null)
      } else {
        setUser(u)
      }
    })

    // Se tiver token salvo, tenta validar e refrescar
    if (pb.authStore.isValid && pb.authStore.record) {
      pb.collection('users')
        .authRefresh<User>()
        .then((res) => {
          if (res.record && res.record.ativo === false) {
            pb.authStore.clear()
            setUser(null)
          } else {
            setUser(res.record)
          }
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const res = await pb.collection('users').authWithPassword<User>(email, pass)
    if (res.record && res.record.ativo === false) {
      pb.authStore.clear()
      setUser(null)
      const err = new Error('Sua conta está desativada. Fale com o RH.')
      err.name = 'AccountDisabledError'
      throw err
    }
    setUser(res.record)
  }

  const logout = async () => {
    // Registrar na auditoria ANTES de limpar a sessão local
    const currentUser = user || (pb.authStore.record as unknown as User) || null
    if (currentUser) {
      try {
        const { auditoriaService } = await import('@/services/onboarding')
        await auditoriaService.registrarLogout({
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
        })
      } catch (err) {
        console.warn('Falha silenciosa ao registrar logout na auditoria:', err)
      }
    }
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const fullRecord = await pb.collection('users').getOne<User>(pb.authStore.record.id)
        setUser(fullRecord)
      } catch {
        const res = await pb.collection('users').authRefresh<User>()
        setUser(res.record)
      }
    }
  }

  // Normalização do papel (role) do usuário
  const effectiveRole = ((): 'admin' | 'rh' | 'gestao' => {
    if (!user) return 'gestao'
    if (user.role === 'admin') return 'admin'
    if (user.role === 'rh') return 'rh'
    if (user.role === 'gestao') return 'gestao'
    // Fallback retrocompatível com setor
    if (user.setor === 'RH') return 'rh'
    return 'gestao'
  })()

  const isAdmin = effectiveRole === 'admin'
  const isRH = effectiveRole === 'rh'
  const isGestao = effectiveRole === 'gestao'

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user && pb.authStore.isValid,
        role: effectiveRole,
        isAdmin,
        isRH,
        isGestao,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
