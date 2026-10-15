import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  onboardingService,
  userService,
  setorService,
  faseService,
  questionarioService,
} from '@/services/onboarding'
import type { QuestionarioModel } from '@/types/onboarding'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Setor, User, SetorModel, FaseModelo, CronogramaFaseItem } from '@/types/onboarding'
import { formatShortDate } from '@/lib/dateUtils'
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
  Sparkles,
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
  const [fasesDoSetor, setFasesDoSetor] = useState<FaseModelo[]>([])
  const [loadingFases, setLoadingFases] = useState(false)
  const [questionariosDisponiveis, setQuestionariosDisponiveis] = useState<QuestionarioModel[]>([])
  const [questionarioId, setQuestionarioId] = useState<string>('')
  const [loadingQuestionarios, setLoadingQuestionarios] = useState(true)
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
      .then(async (res: SetorModel[]) => {
        if (res.length > 0) {
          setSetoresList(res)
          const firstKey = res[0].chave || res[0].nome
          setSetor(firstKey)
        }
      })
      .catch((err: unknown) => {
        console.error(err)
      })
      .finally(() => {
        setLoadingSetores(false)
      })

    // Carregar questionários ativos
    questionarioService
      .listAll({ ativo: true })
      .then((qs) => {
        setQuestionariosDisponiveis(qs)
      })
      .catch((err) => {
        console.error('Erro ao carregar questionários:', err)
      })
      .finally(() => {
        setLoadingQuestionarios(false)
      })
  }, [])

  // Carregar fases e auto-selecionar questionário quando setor mudar
  useEffect(() => {
    if (!setor) return
    const setorNormalizado = setor.trim().toLowerCase()
    const foundModel = setoresList.find(
      (s) => s.chave === setor || s.nome === setor || s.id === setor,
    )
    setLoadingFases(true)
    faseService
      .listBySetor(setor, foundModel?.id)
      .then((fases) => {
        setFasesDoSetor(fases)
      })
      .catch((err) => {
        console.error('Erro ao carregar fases do setor:', err)
      })
      .finally(() => {
        setLoadingFases(false)
      })

    // Auto-selecionar questionário compatível com o setor:
    // Prioridade 1: tipo_de_uso == 'onboarding' e setor bate com a chave/nome/id
    // Prioridade 2: qualquer questionário ativo cujo setor coincida
    if (questionariosDisponiveis.length > 0) {
      const qCompativel =
        questionariosDisponiveis.find((q) => {
          const qSetor = (q.setor || '').toLowerCase()
          return (
            q.tipo_de_uso === 'onboarding' &&
            (qSetor === setorNormalizado ||
              qSetor === (foundModel?.chave || '').toLowerCase() ||
              qSetor === (foundModel?.nome || '').toLowerCase())
          )
        }) ||
        questionariosDisponiveis.find((q) => {
          const qSetor = (q.setor || '').toLowerCase()
          return (
            qSetor === setorNormalizado ||
            qSetor === (foundModel?.chave || '').toLowerCase() ||
            qSetor === (foundModel?.nome || '').toLowerCase()
          )
        })

      if (qCompativel) {
        setQuestionarioId(qCompativel.id)
      } else {
        setQuestionarioId('')
      }
    }
  }, [setor, setoresList, questionariosDisponiveis])

  // Cálculo e validação dos 15 dias:
  // Etapa 1 RH: 1 dia
  // Fases da Etapa 2: soma de dias_previstos (ou fallback padrão)
  // Etapa 3 Avaliação: 1 dia
  const calculoDias = useMemo(() => {
    const diasEtapa1 = 1
    const diasEtapa3 = 1

    // Fases da etapa 2 ordenadas
    const fasesSorted = [...fasesDoSetor].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    // Se não houver fases cadastradas para o setor ainda, usamos a distribuição padrão de 13 dias
    const diasFases =
      fasesSorted.length > 0
        ? fasesSorted.reduce(
            (acc, f) => acc + (f.dias_previstos && f.dias_previstos > 0 ? f.dias_previstos : 2),
            0,
          )
        : 13

    const totalDias = diasEtapa1 + diasFases + diasEtapa3
    const valido = totalDias <= 15
    const excesso = totalDias > 15 ? totalDias - 15 : 0

    // Construção do cronograma sequencial de datas reais
    const cronograma: Array<{
      fase_id: string
      titulo: string
      etapa: number
      dias: number
      data_inicio: string
      data_limite: string
      data_inicio_fmt: string
      data_limite_fmt: string
      ordem: number
    }> = []

    if (dataInicio) {
      try {
        const [ano, mes, dia] = dataInicio.split('-').map(Number)
        let cursor = new Date(Date.UTC(ano, mes - 1, dia))

        const formatarDDMM = (d: Date) => {
          const dd = String(d.getUTCDate()).padStart(2, '0')
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
          return `${dd}/${mm}`
        }

        const toIso = (d: Date) => d.toISOString().split('T')[0]

        // 1. Etapa 1 (RH)
        const inicioEtapa1 = new Date(cursor)
        const fimEtapa1 = new Date(cursor)
        fimEtapa1.setUTCDate(fimEtapa1.getUTCDate() + (diasEtapa1 - 1))
        cronograma.push({
          fase_id: 'etapa_1',
          titulo: 'Etapa 1: Apresentação RH',
          etapa: 1,
          dias: diasEtapa1,
          data_inicio: toIso(inicioEtapa1),
          data_limite: toIso(fimEtapa1),
          data_inicio_fmt: formatarDDMM(inicioEtapa1),
          data_limite_fmt: formatarDDMM(fimEtapa1),
          ordem: 0,
        })
        // Avança cursor para o próximo dia
        cursor = new Date(fimEtapa1)
        cursor.setUTCDate(cursor.getUTCDate() + 1)

        // 2. Fases Etapa 2
        if (fasesSorted.length > 0) {
          fasesSorted.forEach((fase, idx) => {
            const diasFase =
              fase.dias_previstos && fase.dias_previstos > 0 ? fase.dias_previstos : 2
            const inicioFase = new Date(cursor)
            const fimFase = new Date(cursor)
            fimFase.setUTCDate(fimFase.getUTCDate() + (diasFase - 1))
            cronograma.push({
              fase_id: fase.id,
              titulo: `Fase ${idx + 1}: ${fase.titulo}`,
              etapa: 2,
              dias: diasFase,
              data_inicio: toIso(inicioFase),
              data_limite: toIso(fimFase),
              data_inicio_fmt: formatarDDMM(inicioFase),
              data_limite_fmt: formatarDDMM(fimFase),
              ordem: idx + 1,
            })
            cursor = new Date(fimFase)
            cursor.setUTCDate(cursor.getUTCDate() + 1)
          })
        } else {
          // Fallback caso não haja fases
          const inicioFase = new Date(cursor)
          const fimFase = new Date(cursor)
          fimFase.setUTCDate(fimFase.getUTCDate() + (diasFases - 1))
          cronograma.push({
            fase_id: 'etapa_2_geral',
            titulo: 'Etapa 2: Vivência Técnica',
            etapa: 2,
            dias: diasFases,
            data_inicio: toIso(inicioFase),
            data_limite: toIso(fimFase),
            data_inicio_fmt: formatarDDMM(inicioFase),
            data_limite_fmt: formatarDDMM(fimFase),
            ordem: 1,
          })
          cursor = new Date(fimFase)
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }

        // 3. Etapa 3 (Avaliação Gestor)
        const inicioEtapa3 = new Date(cursor)
        const fimEtapa3 = new Date(cursor)
        fimEtapa3.setUTCDate(fimEtapa3.getUTCDate() + (diasEtapa3 - 1))
        cronograma.push({
          fase_id: 'etapa_3',
          titulo: 'Etapa 3: Avaliação Final pelo Gestor',
          etapa: 3,
          dias: diasEtapa3,
          data_inicio: toIso(inicioEtapa3),
          data_limite: toIso(fimEtapa3),
          data_inicio_fmt: formatarDDMM(inicioEtapa3),
          data_limite_fmt: formatarDDMM(fimEtapa3),
          ordem: 99,
        })
      } catch (e) {
        console.error('Erro ao calcular cronograma:', e)
      }
    }

    return {
      diasEtapa1,
      diasFases,
      diasEtapa3,
      totalDias,
      valido,
      excesso,
      fasesSorted,
      cronograma,
    }
  }, [dataInicio, fasesDoSetor])

  // Data de fim calculada pelo cronograma
  const dataFimCalculada = useMemo(() => {
    if (calculoDias.cronograma.length > 0) {
      const ultimo = calculoDias.cronograma[calculoDias.cronograma.length - 1]
      return formatShortDate(ultimo.data_limite)
    }
    return ''
  }, [calculoDias])

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

    if (!calculoDias.valido) {
      errs.dias = `A soma das fases (${calculoDias.totalDias} dias) ultrapassa o limite máximo de 15 dias em ${calculoDias.excesso} dia(s). Ajuste as fases da área em Modelos antes de prosseguir.`
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      if (!calculoDias.valido) {
        toast.error(
          `Criação bloqueada: cronograma soma ${calculoDias.totalDias} dias (limite: 15 dias). Estouro de ${calculoDias.excesso} dia(s).`,
        )
      } else {
        toast.error('Preencha todos os campos obrigatórios corretamente.')
      }
      return
    }

    try {
      setSubmitting(true)
      // Descobre o setor_ref se existir na lista carregada
      const foundModel = setoresList.find(
        (s) => s.chave === setor || s.nome === setor || s.id === setor,
      )

      // Montar payload do cronograma simplificado para persistir
      const cronogramaPayload: CronogramaFaseItem[] = calculoDias.cronograma.map((item) => ({
        fase_id: item.fase_id,
        titulo: item.titulo,
        ordem: item.ordem,
        dias: item.dias,
        data_inicio: item.data_inicio,
        data_limite: item.data_limite,
      }))

      const novo = await onboardingService.create({
        colaborador_nome: nome,
        colaborador_email: email,
        cargo,
        setor,
        setor_ref: foundModel?.id,
        gestor_id: gestorId,
        data_inicio: dataInicio,
        cronograma_fases: cronogramaPayload,
        questionario_id: questionarioId || undefined,
        questionarios_vinculados: questionarioId ? [questionarioId] : [],
      })

      toast.success('Onboarding criado com sucesso com cronograma de 15 dias!')
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

        {/* Caixa Informativa sobre as 3 etapas sequenciais com validação de 15 dias */}
        <div
          className={`mb-8 p-4 rounded-xl border ${
            calculoDias.valido
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              {calculoDias.valido ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>Distribuição do Ciclo de 15 Dias (Mundo Open)</span>
            </div>
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                calculoDias.valido
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white animate-pulse'
              }`}
            >
              Total: {calculoDias.totalDias} de 15 dias
            </div>
          </div>

          {!calculoDias.valido && (
            <div className="mb-3 p-3 rounded-lg bg-red-100/90 border border-red-300 text-xs text-red-800">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                Criação bloqueada: o cronograma configurado excede os 15 dias permitidos!
              </p>
              <p className="mt-1">
                A soma das etapas ({calculoDias.diasEtapa1}d Etapa 1 + {calculoDias.diasFases}d
                Fases da Área + {calculoDias.diasEtapa3}d Avaliação) totaliza{' '}
                <strong>{calculoDias.totalDias} dias</strong>, estourando{' '}
                <strong>{calculoDias.excesso} dia(s)</strong> do limite oficial. Reduza os dias
                previstos das fases no menu de Modelos.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/95 p-3 rounded-lg border border-gray-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-emerald-700">1. Apresentação RH</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {calculoDias.diasEtapa1} dia
                </span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Mundo Open, regras de convivência, canais de atendimento e boas práticas.
              </p>
            </div>

            <div className="bg-white/95 p-3 rounded-lg border border-gray-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-brand-700">2. Vivência Técnica</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                  {calculoDias.diasFases} dias ({calculoDias.fasesSorted.length || 6} fases)
                </span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Configuração, Mapeamento, Shadowing, Atendimento Invertido, Solo N1 e Consolidação.
              </p>
            </div>

            <div className="bg-white/95 p-3 rounded-lg border border-gray-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-purple-700">3. Avaliação Gestor</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  {calculoDias.diasEtapa3} dia
                </span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Reunião de alinhamento com o gestor técnico para parecer de aptidão.
              </p>
            </div>
          </div>

          {/* Cronograma Sequencial Detalhado */}
          {calculoDias.cronograma.length > 0 && (
            <div className="mt-4 pt-3 border-t border-emerald-200/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-2">
                Linha do Tempo Planejada (a partir de {dataInicio.split('-').reverse().join('/')}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {calculoDias.cronograma.map((item) => (
                  <div
                    key={item.fase_id}
                    className="p-2 rounded bg-white border border-gray-200 text-[11px] flex flex-col justify-between"
                  >
                    <span className="font-semibold text-gray-800 truncate" title={item.titulo}>
                      {item.titulo}
                    </span>
                    <div className="flex items-center justify-between mt-1 text-gray-600 text-[10px]">
                      <span>{item.dias}d</span>
                      {item.fase_id === 'etapa_3' ? (
                        <span className="font-bold text-purple-700">
                          avaliar até {item.data_limite_fmt}
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          até {item.data_limite_fmt}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

          {/* Questionário de Conhecimento (Etapa 3) */}
          <div className="p-4 rounded-lg bg-gray-50/90 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Questionário de Conhecimento (Etapa 3) *
              </label>
              {questionarioId ? (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Questionário fixado
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Sem prova vinculada
                </span>
              )}
            </div>

            <Select
              value={questionarioId}
              onValueChange={(val) => setQuestionarioId(val)}
              disabled={submitting || loadingQuestionarios}
            >
              <SelectTrigger className="h-11 border-gray-300 text-sm bg-white">
                <SelectValue
                  placeholder={
                    loadingQuestionarios
                      ? 'Carregando questionários...'
                      : questionariosDisponiveis.length === 0
                        ? 'Nenhum questionário cadastrado no sistema'
                        : 'Selecione um questionário para a prova'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {questionariosDisponiveis.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{q.nome}</span>
                      <span className="text-gray-400 text-xs">
                        ({q.setor?.toUpperCase() || 'TODOS'} — {q.tipo_de_uso} — mín.{' '}
                        {q.percentual_aprovacao || 95}%)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!questionarioId ? (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Não há questionário cadastrado para este setor.</strong> O colaborador
                  ficará com a Etapa 3 bloqueada até que uma prova seja vinculada manualmente aqui
                  ou cadastrada em <em>Modelos &gt; Questionários</em>.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">
                Pré-preenchido automaticamente com base no setor do colaborador. O questionário
                ficará fixado neste onboarding — alterações posteriores no modelo não alteram a
                prova já em andamento.
              </p>
            )}
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
              disabled={submitting || !calculoDias.valido}
              className={`h-11 px-6 font-semibold rounded-lg shadow-sm ${
                calculoDias.valido
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criando onboarding...</span>
                </div>
              ) : !calculoDias.valido ? (
                `Bloqueado (${calculoDias.totalDias}d > 15d)`
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
