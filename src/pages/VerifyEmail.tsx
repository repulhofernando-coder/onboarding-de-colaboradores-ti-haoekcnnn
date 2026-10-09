import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setErrorMsg('Token de verificação ausente na URL.')
      return
    }

    pb.collection('users')
      .confirmVerification(token)
      .then(() => {
        setSuccess(true)
      })
      .catch((err) => {
        console.error(err)
        setErrorMsg('O token de verificação expirou ou já foi utilizado.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">
                Validando verificação de e-mail...
              </p>
            </div>
          ) : success ? (
            <div className="py-4 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1A2233] mb-2">E-mail verificado!</h2>
              <p className="text-sm text-[#6B7280] mb-6">
                Sua conta de acesso ao Onboarding Mundo Open foi confirmada com sucesso.
              </p>
              <Button
                asChild
                className="w-full h-11 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg"
              >
                <Link to="/login" className="flex items-center justify-center gap-2">
                  <span>Ir para o Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1A2233] mb-2">Falha na verificação</h2>
              <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
              <Button asChild variant="outline" className="w-full h-11 rounded-lg">
                <Link to="/login">Voltar para o Login</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
