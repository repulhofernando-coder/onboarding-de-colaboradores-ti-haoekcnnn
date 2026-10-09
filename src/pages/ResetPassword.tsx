import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, Lock, ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!token) {
      setErrorMsg('Token de recuperação não encontrado ou inválido.')
      return
    }

    if (password.length < 8) {
      setErrorMsg('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMsg('As senhas digitadas não conferem.')
      return
    }

    try {
      setLoading(true)
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      toast.success('Senha redefinida com sucesso! Faça login com a nova credencial.')
      navigate('/login')
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('O link de recuperação expirou ou é inválido. Solicite um novo.')
      toast.error('Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2233]">Nova Senha</h1>
          <p className="text-sm text-[#6B7280] mt-1">Digite sua nova senha de acesso ao sistema</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
          {!token && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Nenhum token fornecido na URL. Verifique o link recebido por e-mail.</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Nova Senha (mínimo 8 dígitos)
              </label>
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-blue-500 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !token}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
            >
              {loading ? 'Salvando nova senha...' : 'Salvar nova senha'}
            </Button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para o login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
