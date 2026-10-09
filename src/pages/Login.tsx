import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle2, Lock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('projetos@mundoopen.com.br')
  const [password, setPassword] = useState('Skip@Pass')
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
      console.error(err)
      if (
        (err instanceof Error && err.name === 'AccountDisabledError') ||
        (err instanceof Error && err.message.includes('desativada'))
      ) {
        setErrorMsg('Sua conta está desativada. Fale com o RH.')
        toast.error('Sua conta está desativada. Fale com o RH.')
      } else {
        setErrorMsg('E-mail ou senha incorretos. Verifique suas credenciais.')
        toast.error('Não foi possível entrar. Verifique os dados informados.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2233]">Onboarding TI</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Plataforma de Treinamento e Integração Técnica
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#1A2233]">Acessar o sistema</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Área restrita para Gestores e equipe de RH
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
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
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-blue-500 text-sm"
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
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
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
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-blue-500 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
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

          {/* Seed credentials hint */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Acesso padrão de teste:</span>
            <div className="mt-1 space-y-0.5 text-[11px] font-mono text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
              <div>Admin: projetos@mundoopen.com.br / Skip@Pass</div>
              <div>RH: rh@empresa.com.br / Skip@Pass</div>
              <div>Gestor: gestor@empresa.com.br / Skip@Pass</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
