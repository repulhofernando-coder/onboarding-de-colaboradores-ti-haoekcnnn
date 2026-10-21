import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Lock, Mail, AlertCircle, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import { isNetworkError } from '@/lib/pocketbase/errors'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim() || !password) {
      setErrorMsg('Campos obrigatórios: preencha e-mail e senha.')
      return
    }

    try {
      setLoading(true)
      await login(email.trim(), password)
      toast.success('Login realizado com sucesso!')
      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error('Erro ao realizar login:', err)
      if (
        (err instanceof Error && err.name === 'AccountDisabledError') ||
        (err instanceof Error && err.message.includes('desativada'))
      ) {
        setErrorMsg('Sua conta está desativada. Fale com o RH.')
        toast.error('Sua conta está desativada. Fale com o RH.')
      } else if (isNetworkError(err)) {
        const netMsg = 'Falha de conexão com o servidor. Tente novamente em instantes.'
        setErrorMsg(netMsg)
        toast.error(netMsg)
      } else {
        setErrorMsg('E-mail ou senha incorretos. Verifique suas credenciais.')
        toast.error('Não foi possível entrar. Verifique os dados informados.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12 relative overflow-hidden">
      {/* Detalhe de fundo decorativo com o verde da marca */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header Mundo Open */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 inline-flex items-center justify-center">
            <MundoOpenLogo variant="full" size="lg" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200/80 text-brand-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
            Sistema de Onboarding de Colaboradores
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#1A2233]">Acessar o sistema</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Área restrita para Administradores, RH e Gestores
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed animate-fade-in">
              {errorMsg.includes('Falha de conexão') ? (
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              )}
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  required
                  placeholder="seu.email@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-brand-500 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-brand-500 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Entrando...</span>
                </div>
              ) : (
                'Entrar no sistema'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
