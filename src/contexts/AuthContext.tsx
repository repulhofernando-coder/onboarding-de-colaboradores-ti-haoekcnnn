import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/onboarding'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((token, model) => {
      setUser((model as unknown as User) || null)
    })

    // Se tiver token salvo, tenta validar e refrescar
    if (pb.authStore.isValid && pb.authStore.record) {
      pb.collection('users')
        .authRefresh<User>()
        .then((res) => {
          setUser(res.record)
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
    setUser(res.record)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      const res = await pb.collection('users').authRefresh<User>()
      setUser(res.record)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user && pb.authStore.isValid,
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
