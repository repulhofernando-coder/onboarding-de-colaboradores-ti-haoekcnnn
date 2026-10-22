import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { onboardingService } from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding } from '@/types/onboarding'
import { SETORES_INFO, STATUS_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import { formatShortDate } from '@/lib/dateUtils'
import { avaliarStatusFerias, type FeriasStatus } from '@/services/ferias'
import {
  Users,
  Search,
  ExternalLink,
  Plus,
  Mail,
  Calendar,
  Briefcase,
  CheckCircle2,
  Trash2,
  Palmtree,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import { AvisoSetorGestor } from '@/components/AvisoSetorGestor'
import { ModalExcluirColaborador } from '@/components/ModalExcluirColaborador'
import { ModalEditarColaborador } from '@/components/ModalEditarColaborador'
import { ModalSugestaoMudancaArea } from '@/components/ModalSugestaoMudancaArea'
import { Edit, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import type { Questionario, SetorModel } from '@/types/onboarding'
import { setorService } from '@/services/onboarding'

interface ColaboradorAgregado {
  nome: string
  email: string
  cargo?: string
  setor: Onboarding['setor']
  onboardingMaisRecente: Onboarding
  totalOnboardings: number
}

export default function Colaboradores() {
  const { user, role, isAdmin, isRH, isGestao } = useAuth()
  const podeExcluir = isAdmin || isRH
  const podeEditar = isAdmin || isRH // Gestão não edita

  const [searchParams, setSearchParams] = useSearchParams()
  const filtroFeriasParam = (searchParams.get('ferias') as FeriasStatus | null) || 'todos'

  const [todosOnboardings, setTodosOnboardings] = useState<Onboarding[]>([])
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroFerias, setFiltroFerias] = useState<string>(filtroFeriasParam)

  useEffect(() => {
    const p = searchParams.get('ferias')
    if (p) setFiltroFerias(p)
  }, [searchParams])

  // Estado do modal de edição
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [onboardingParaEditar, setOnboardingParaEditar] = useState<Onboarding | null>(null)

  // Estado da sugestão de mudança de área
  const [modalSugestaoOpen, setModalSugestaoOpen] = useState(false)
  const [dadosSugestao, setDadosSugestao] = useState<{
    onboarding: Onboarding
    setorAntigo: string
    setorNovo: string
    questionarioSugerido: Questionario | null
  } | null>(null)

  // Estado do modal de exclusão
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [colaboradorParaExcluir, setColaboradorParaExcluir] = useState<{
    nome: string
    email?: string
    onboardingId?: string
  } | null>(null)

  const fetchOnboardings = async () => {
    try {
      const [data, setores] = await Promise.all([onboardingService.list(), setorService.listAll()])
      setTodosOnboardings(data)
      setSetoresList(setores)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filtragem de departamento para o papel Gestão
  const onboardings = useMemo(() => {
    if (!isGestao) return todosOnboardings
    return todosOnboardings.filter((o) =>
      podeVisualizarSetor({
        role,
        userSetor: user?.setor as string | undefined,
        itemSetor: setorToString(o.setor),
        itemSetorRef: o.setor_ref || o.expand?.setor_ref?.id,
        setoresCadastrados: setoresList,
      }),
    )
  }, [todosOnboardings, isGestao, role, user?.setor, setoresList])

  useEffect(() => {
    fetchOnboardings()
  }, [])

  useRealtime<Onboarding>('onboardings', () => {
    fetchOnboardings()
  })

  // Agrega registros por colaborador_nome
  const colaboradoresAgregados = useMemo(() => {
    const mapa = new Map<string, Onboarding[]>()

    for (const o of onboardings) {
      const chave = o.colaborador_nome.trim().toLowerCase()
      const lista = mapa.get(chave) || []
      lista.push(o)
      mapa.set(chave, lista)
    }

    const resultado: ColaboradorAgregado[] = []

    mapa.forEach((lista) => {
      // Ordena por created desc para pegar o mais recente
      lista.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      const maisRecente = lista[0]

      resultado.push({
        nome: maisRecente.colaborador_nome,
        email: maisRecente.colaborador_email,
        cargo: maisRecente.cargo,
        setor: setorToString(maisRecente.setor),
        onboardingMaisRecente: maisRecente,
        totalOnboardings: lista.length,
      })
    })

    return resultado.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [onboardings])

  const filtrados = useMemo(() => {
    return colaboradoresAgregados.filter((c) => {
      const q = search.toLowerCase()
      const matchBusca =
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cargo && c.cargo.toLowerCase().includes(q))

      if (!matchBusca) return false

      if (filtroFerias !== 'todos') {
        const feriasInfo = avaliarStatusFerias(c.onboardingMaisRecente)
        if (feriasInfo.status !== filtroFerias) return false
      }

      return true
    })
  }, [colaboradoresAgregados, search, filtroFerias])

  // Contadores globais de férias para os botões de filtro rápido
  const contadoresFerias = useMemo(() => {
    let vencidos = 0
    let vencendo = 0
    let emDia = 0
    for (const c of colaboradoresAgregados) {
      const info = avaliarStatusFerias(c.onboardingMaisRecente)
      if (info.status === 'vencido') vencidos++
      else if (info.status === 'vencendo') vencendo++
      else if (info.status === 'em_dia') emDia++
    }
    return { vencidos, vencendo, emDia, total: colaboradoresAgregados.length }
  }, [colaboradoresAgregados])

  return (
    <div className="space-y-6">
      {/* Aviso de setor para papel Gestão */}
      <AvisoSetorGestor setoresList={setoresList} moduloNome="colaboradores" />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#1A2233]">Colaboradores de Suporte TI</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Visão agregada dos técnicos cadastrados nos processos de onboarding da empresa
          </p>
        </div>

        <Button
          asChild
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm shrink-0"
        >
          <Link to="/onboardings/nova" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Novo Onboarding</span>
          </Link>
        </Button>
      </div>

      {/* Busca & Filtro de Férias */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por colaborador, e-mail ou cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-gray-300 text-sm focus-visible:ring-brand-500"
            />
          </div>

          {/* Filtros rápidos de Férias 🟢🟡🔴 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setFiltroFerias('todos')
                setSearchParams((p) => {
                  p.delete('ferias')
                  return p
                })
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                filtroFerias === 'todos'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Todos ({contadoresFerias.total})
            </button>

            <button
              type="button"
              onClick={() => {
                const novo = filtroFerias === 'vencido' ? 'todos' : 'vencido'
                setFiltroFerias(novo)
                setSearchParams((p) => {
                  if (novo === 'todos') p.delete('ferias')
                  else p.set('ferias', 'vencido')
                  return p
                })
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                filtroFerias === 'vencido'
                  ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
              title="Filtrar colaboradores com férias vencidas"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Vencidos ({contadoresFerias.vencidos})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const novo = filtroFerias === 'vencendo' ? 'todos' : 'vencendo'
                setFiltroFerias(novo)
                setSearchParams((p) => {
                  if (novo === 'todos') p.delete('ferias')
                  else p.set('ferias', 'vencendo')
                  return p
                })
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                filtroFerias === 'vencendo'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Filtrar colaboradores com férias a vencer nos próximos 30 dias"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Vencendo em 30d ({contadoresFerias.vencendo})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const novo = filtroFerias === 'em_dia' ? 'todos' : 'em_dia'
                setFiltroFerias(novo)
                setSearchParams((p) => {
                  if (novo === 'todos') p.delete('ferias')
                  else p.set('ferias', 'em_dia')
                  return p
                })
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                filtroFerias === 'em_dia'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Filtrar colaboradores com férias em dia"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Em dia ({contadoresFerias.emDia})</span>
            </button>
          </div>
        </div>

        <span className="text-xs text-gray-500 font-medium shrink-0 self-end md:self-center">
          Exibindo: {filtrados.length} colaboradores
        </span>
      </div>

      {/* Grid de Cards dos Colaboradores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            {loading ? 'Carregando colaboradores...' : 'Nenhum colaborador encontrado.'}
          </div>
        ) : (
          filtrados.map((item) => {
            const setor = getSetorVisual(item.setor, item.onboardingMaisRecente.expand?.setor_ref)
            const status = STATUS_INFO[item.onboardingMaisRecente.status]
            const onb = item.onboardingMaisRecente
            const feriasInfo = avaliarStatusFerias(onb)

            let progresso = 0
            if (onb.etapa1_concluida) progresso += 33
            if (onb.etapa2_concluida) progresso += 33
            if (onb.etapa3_concluida) progresso += 34

            const dataAdmissaoFormatada = onb.data_admissao
              ? formatShortDate(onb.data_admissao)
              : onb.data_inicio
                ? formatShortDate(onb.data_inicio)
                : 'Não definida'

            return (
              <div
                key={item.nome}
                className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-brand-600 transition-colors">
                        {item.nome}
                      </h3>
                      <span className="text-xs text-gray-500 block">
                        {item.cargo || item.email}
                      </span>
                    </div>

                    <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 bg-brand-50 text-brand-700 border-brand-200 inline-flex items-center gap-1.5">
                      {' '}
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: setor.cor }}
                      />
                      {setor.nome}
                    </span>
                  </div>

                  {/* Badge Visual de Férias 🟢 🟡 🔴 com Tooltip/Data */}
                  <div className="pt-0.5">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${feriasInfo.corBg}`}
                      title={`Data de admissão: ${dataAdmissaoFormatada} • ${feriasInfo.descricao}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${feriasInfo.corDot}`} />
                      <Palmtree className="w-3 h-3 shrink-0 opacity-70" />
                      <span className="truncate">
                        {feriasInfo.status === 'vencido' && (
                          <span className="font-bold">
                            Férias Vencidas ({feriasInfo.vencimentoFormatado})
                          </span>
                        )}
                        {feriasInfo.status === 'vencendo' && (
                          <span>
                            Vence em {feriasInfo.vencimentoFormatado} ({feriasInfo.diasRestantes}d)
                          </span>
                        )}
                        {feriasInfo.status === 'em_dia' && (
                          <span>Férias: {feriasInfo.vencimentoFormatado}</span>
                        )}
                        {feriasInfo.status === 'sem_admissao' && (
                          <span>Sem admissão cadastrada</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        Admissão: {dataAdmissaoFormatada} • Onb: {formatShortDate(onb.data_fim)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">
                        Etapa Atual: {onb.etapa_atual} de 3
                      </span>
                      <span className="font-bold text-gray-700">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-1.5" />
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.corBg}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.corDot}`} />
                    {status.nome}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {podeEditar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOnboardingParaEditar(onb)
                          setModalEditarOpen(true)
                        }}
                        className="h-8 px-2.5 text-xs font-semibold text-gray-700 hover:text-brand-700 hover:bg-brand-50 border-gray-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        title={`Editar cargo, setor ou gestor de ${item.nome}`}
                      >
                        <Edit className="w-3 h-3 text-brand-600" />
                        <span>Editar</span>
                      </Button>
                    )}

                    {podeExcluir && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setColaboradorParaExcluir({
                            nome: item.nome,
                            email: item.email,
                            onboardingId: onb.id,
                          })
                          setModalExcluirOpen(true)
                        }}
                        className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={`Excluir colaborador ${item.nome} e seus dados`}
                        aria-label={`Excluir colaborador ${item.nome}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      asChild
                      size="sm"
                      className="h-8 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                    >
                      <Link
                        to={`/colaboradores/${onb.id}`}
                        className="inline-flex items-center gap-1"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de Edição do Colaborador (Cargo, Setor, Gestor) */}
      {onboardingParaEditar && (
        <ModalEditarColaborador
          open={modalEditarOpen}
          onOpenChange={(aberto) => {
            setModalEditarOpen(aberto)
            if (!aberto) setOnboardingParaEditar(null)
          }}
          onboarding={onboardingParaEditar}
          onSucesso={(atualizado) => {
            setTodosOnboardings((prev) =>
              prev.map((o) => (o.id === atualizado.id ? { ...o, ...atualizado } : o)),
            )
            fetchOnboardings()
          }}
          onSugerirProvaMudancaSetor={(info) => {
            setDadosSugestao(info)
            setModalSugestaoOpen(true)
          }}
        />
      )}

      {/* Modal de Sugestão Automática de Prova na Mudança de Área */}
      {dadosSugestao && (
        <ModalSugestaoMudancaArea
          open={modalSugestaoOpen}
          onOpenChange={(aberto) => {
            setModalSugestaoOpen(aberto)
            if (!aberto) setDadosSugestao(null)
          }}
          onboarding={dadosSugestao.onboarding}
          setorAntigo={dadosSugestao.setorAntigo}
          setorNovo={dadosSugestao.setorNovo}
          questionarioSugerido={dadosSugestao.questionarioSugerido}
        />
      )}

      {/* Modal de Exclusão Forte em Cascata */}
      {colaboradorParaExcluir && (
        <ModalExcluirColaborador
          open={modalExcluirOpen}
          onOpenChange={(aberto) => {
            setModalExcluirOpen(aberto)
            if (!aberto) setColaboradorParaExcluir(null)
          }}
          colaboradorNome={colaboradorParaExcluir.nome}
          colaboradorEmail={colaboradorParaExcluir.email}
          onboardingId={colaboradorParaExcluir.onboardingId}
          onSucesso={(res) => {
            // Atualiza estado local imediatamente sem precisar recarregar a página
            setTodosOnboardings((prev) =>
              prev.filter(
                (o) =>
                  o.colaborador_nome.trim().toLowerCase() !== res.colaboradorNome.toLowerCase() &&
                  (!colaboradorParaExcluir.email ||
                    o.colaborador_email.trim().toLowerCase() !==
                      colaboradorParaExcluir.email.toLowerCase()),
              ),
            )
            // Também sincroniza com o backend
            fetchOnboardings()
          }}
        />
      )}
    </div>
  )
}
