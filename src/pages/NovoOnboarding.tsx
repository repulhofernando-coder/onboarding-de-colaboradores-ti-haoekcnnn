import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { onboardingService, userService, setorService } from '@/services/onboarding'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Setor, User, SetorModel } from '@/types/onboarding'
import { SETORES_INFO, getSetorVisual } from '@/types/onboarding'
import {
  ArrowLeft,
  Calendar,
  UserCheck,
  Briefcase,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function NovoOnboarding() {
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [setor, setSetor] = useState<Setor>('windows')
  const [gestorId, setGestorId] = useState('')
  const [dataInicio, setDataInicio] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loadingSetores, setLoadingSetores] = useState(true)
  const [gestores, setGestores] = useState<User[]>([])
  const [loadingGestores, setLoadingGestores] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Carregar gestores
    userService
      .getGestores()
      .then((res) => {
        setGestores(res)
        if (res.length > 0) {
          setGestorId(res[0].id)
        }
      })
      .catch((err) => {
        console.error(err)
        toast.error('Erro ao carregar lista de gestores.')
      })
      .finally(() => {
        setLoadingGestores(false)
      })

    // Carregar setores ativos da coleção
    setorService
      .listAtivos()
      .then((res) => {
        if (res.length > 0) {
          setSetoresList(res)
          const firstKey = res[0].chave || res[0].nome
          setSetor(firstKey)
        }
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        setLoadingSetores(false)
      })
  }, [])

  // Data de fim calculada = início + 15 dias
  const dataFimCalculada = useMemo(() => {
    if (!dataInicio) return ''
    try {
      const [ano, mes, dia] = dataInicio.split('-').map(Number)
      const d = new Date(Date.UTC(ano, mes - 1, dia))
      d.setUTCDate(d.getUTCDate() + 15)
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yyyy = d.getUTCFullYear()
      return `${dd}/${mm}/${yyyy}`
    } catch {
      return ''
    }
  }, [dataInicio])

  const validate = () => {
    const errs: Record<string, string> = {}

    if (!nome.trim()) {
      errs.nome = 'O nome completo do colaborador é obrigatório.'
    }

    if (!email.trim()) {
      errs.email = 'O e-mail do colaborador é obrigatório.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Formato de e-mail inválido.'
    }

    if (!setor) {
      errs.setor = 'Selecione um setor de atuação.'
    }

    if (!gestorId) {
      errs.gestorId = 'Selecione o gestor de TI responsável.'
    }

    if (!dataInicio) {
      errs.dataInicio = 'Defina a data de início do treinamento.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios corretamente.')
      return
    }

    try {
      setSubmitting(true)
      // Descobre o setor_ref se existir na lista carregada
      const foundModel = setoresList.find(
        (s) => s.chave === setor || s.nome === setor || s.id === setor,
      )

      const novo = await onboardingService.create({
        colaborador_nome: nome,
        colaborador_email: email,
        cargo,
        setor,
        setor_ref: foundModel?.id,
        gestor_id: gestorId,
        data_inicio: dataInicio,
      })

      toast.success('Onboarding criado com sucesso!')
      navigate(`/colaboradores/${novo.id}`)
    } catch (err: unknown) {
      console.error(err)
      const msg = getErrorMessage(err)
      toast.error(
        msg ? `Falha ao criar onboarding: ${msg}` : 'Falha ao criar onboarding. Tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900 -ml-2"
        >
          <Link to="/onboardings" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para lista</span>
          </Link>
        </Button>
      </div>

      {/* Card Principal */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-6 sm:p-8">
        <div className="border-b border-gray-100 pb-5 mb-6">
          <h2 className="text-xl font-bold text-[#1A2233]">Cadastrar Novo Onboarding de TI</h2>
          <p className="text-xs text-gray-500 mt-1">
            Inicie a jornada de integração técnica do novo colaborador. Os templates do setor serão
            carregados automaticamente.
          </p>
        </div>

        {/* Caixa Informativa sobre as 3 etapas sequenciais */}
        <div className="mb-8 p-4 rounded-xl bg-brand-50/80 border border-brand-200/70 text-brand-950">
          <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-brand-800">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>Estrutura de 15 dias da Mundo Open</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/90 p-2.5 rounded-lg border border-brand-200/60">
              <span className="font-bold text-brand-700 block mb-1">1. Apresentação RH</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Cultura da empresa, estrutura dos setores e boas práticas gerais de atendimento.
              </p>
            </div>
            <div className="bg-white/90 p-2.5 rounded-lg border border-brand-200/60">
              <span className="font-bold text-brand-700 block mb-1">2. Vivência Técnica</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Movidesk (chamados), Passportal (documentação) e procedimentos específicos do setor.
              </p>
            </div>
            <div className="bg-white/90 p-2.5 rounded-lg border border-brand-200/60">
              <span className="font-bold text-brand-700 block mb-1">3. Avaliação Gestor</span>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Gestor avalia após 15 dias e decide se o colaborador está apto para o suporte.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
              Nome Completo do Colaborador *
            </label>
            <Input
              placeholder="Ex.: Lucas Gabriel da Silva"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (errors.nome) setErrors((prev) => ({ ...prev, nome: '' }))
              }}
              className={`h-11 border-gray-300 text-sm ${
                errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
              disabled={submitting}
            />
            {errors.nome && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.nome}
              </p>
            )}
          </div>

          {/* E-mail e Cargo em linha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                E-mail Corporativo *
              </label>
              <Input
                type="email"
                placeholder="colaborador@empresa.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
                }}
                className={`h-11 border-gray-300 text-sm ${
                  errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Cargo / Especialidade (Opcional)
              </label>
              <Input
                placeholder="Ex.: Analista de Suporte Nível 1"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="h-11 border-gray-300 text-sm"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Setor e Gestor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Setor de Atuação *
              </label>
              <Select
                value={setor}
                onValueChange={(val: Setor) => setSetor(val)}
                disabled={submitting || loadingSetores}
              >
                <SelectTrigger className="h-11 border-gray-300 text-sm">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setoresList.length > 0
                    ? setoresList.map((item) => (
                        <SelectItem key={item.id} value={item.chave || item.nome}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: item.cor || '#2563EB' }}
                            />
                            <span>{item.nome}</span>
                          </div>
                        </SelectItem>
                      ))
                    : (Object.keys(SETORES_INFO) as Setor[]).map((key) => {
                        const info = SETORES_INFO[key]
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: info.cor }}
                              />
                              <span>{info.nome}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500 mt-1">
                {setoresList.find((s) => s.chave === setor || s.nome === setor)?.descricao ||
                  getSetorVisual(setor).descricao}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Gestor Responsável (Setor Gestão) *
              </label>
              <Select
                value={gestorId}
                onValueChange={(val) => {
                  setGestorId(val)
                  if (errors.gestorId) setErrors((prev) => ({ ...prev, gestorId: '' }))
                }}
                disabled={submitting || loadingGestores}
              >
                <SelectTrigger
                  className={`h-11 border-gray-300 text-sm ${
                    errors.gestorId ? 'border-red-500' : ''
                  }`}
                >
                  <SelectValue
                    placeholder={loadingGestores ? 'Carregando gestores...' : 'Selecione o gestor'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {gestores.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gestorId && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.gestorId}
                </p>
              )}
            </div>
          </div>

          {/* Data de início e Prazo calculado */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Data de Início do Onboarding *
                </label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value)
                    if (errors.dataInicio) setErrors((prev) => ({ ...prev, dataInicio: '' }))
                  }}
                  className="h-11 border-gray-300 text-sm bg-white"
                  disabled={submitting}
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col justify-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prazo Final Automático (15 dias)
                </span>
                <span className="text-base font-bold text-brand-700 mt-0.5">
                  {dataFimCalculada ? `Prazo final: ${dataFimCalculada}` : '-'}
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  Tempo máximo para conclusão de todas as etapas e avaliação.
                </span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/onboardings')}
              disabled={submitting}
              className="h-11 px-5 border-gray-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criando onboarding...</span>
                </div>
              ) : (
                'Criar Onboarding'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
