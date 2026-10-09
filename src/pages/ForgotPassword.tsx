import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, Mail, ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

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
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2233]">Recuperar Senha</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Enviaremos um link para você redefinir sua credencial
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
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
                  className="pl-9 h-11 border-gray-300 focus-visible:ring-blue-500 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
            >
              {loading ? 'Enviando link...' : 'Enviar link de recuperação'}
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
