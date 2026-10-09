import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import MundoOpenLogo from '@/components/MundoOpenLogo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim()) {
      setErrorMsg('Informe o e-mail cadastrado.')
      return
    }

    try {
      setLoading(true)
      await pb.collection('users').requestPasswordReset(email.trim())
      toast.success('Link de recuperação enviado com sucesso para o seu e-mail!')
      navigate('/login')
    } catch (err: unknown) {
      console.error(err)
      toast.info('Se o e-mail estiver cadastrado, as instruções foram enviadas.')
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12 relative">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 mb-4 inline-flex items-center justify-center">
            <MundoOpenLogo variant="full" size="md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2233]">Recuperar Senha</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Enviaremos um link para você redefinir sua credencial
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8">
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                E-mail cadastrado
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
            >
              {loading ? 'Enviando link...' : 'Enviar link de recuperação'}
            </Button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-600 font-medium"
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
