import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { onboardingService, setorService } from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding, SetorModel, OnboardingStatus } from '@/types/onboarding'
import { SETORES_INFO, STATUS_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import {
  Search,
  Plus,
  ArrowUpDown,
  Flame,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export default function OnboardingsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status') as OnboardingStatus | null

  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [setoresList, setSetoresList] = useState<SetorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>(statusParam || 'todos')
  const [selectedSetor, setSelectedSetor] = useState<string>('todos')
  const [sortField, setSortField] = useState<'colaborador_nome' | 'data_fim' | 'progresso'>(
    'data_fim',
  )
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  const fetchData = async () => {
    try {
      const [data, setores] = await Promise.all([onboardingService.list(), setorService.listAll()])
      setOnboardings(data)
      setSetoresList(setores)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useRealtime<Onboarding>('onboardings', () => {
    fetchData()
  })

  useEffect(() => {
    if (statusParam) {
      setSelectedStatus(statusParam)
    }
  }, [statusParam])

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
    setPage(1)
    if (status === 'todos') {
      searchParams.delete('status')
      setSearchParams(searchParams)
    } else {
      setSearchParams({ status })
    }
  }

  const processedData = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    return onboardings.map((o) => {
      const [ano, mes, dia] = o.data_fim.split('-').map(Number)
      const dataFim = new Date(ano, mes - 1, dia)
      dataFim.setHours(0, 0, 0, 0)

      const diffTime = dataFim.getTime() - hoje.getTime()
      const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let progresso = 0
      if (o.etapa1_concluida) progresso += 33
      if (o.etapa2_concluida) progresso += 33
      if (o.etapa3_concluida) progresso += 34

      const isConcluidoOuApto = o.status === 'concluido' || o.status === 'nao_apto'
      const isAtrasado = !isConcluidoOuApto && diasRestantes < 0

      return {
        ...o,
        progresso,
        diasRestantes,
        isAtrasado,
      }
    })
  }, [onboardings])

  const filteredData = useMemo(() => {
    return processedData.filter((item) => {
      const matchesSearch =
        item.colaborador_nome.toLowerCase().includes(search.toLowerCase()) ||
        item.colaborador_email.toLowerCase().includes(search.toLowerCase()) ||
        (item.cargo && item.cargo.toLowerCase().includes(search.toLowerCase()))

      const matchesStatus = selectedStatus === 'todos' || item.status === selectedStatus

      const itemSetorStr = setorToString(item.setor)
      const matchesSetor =
        selectedSetor === 'todos' ||
        itemSetorStr === selectedSetor ||
        item.setor_ref === selectedSetor ||
        (item.expand?.setor_ref &&
          (item.expand.setor_ref.id === selectedSetor ||
            item.expand.setor_ref.chave === selectedSetor ||
            item.expand.setor_ref.nome === selectedSetor))

      return matchesSearch && matchesStatus && matchesSetor
    })
  }, [processedData, search, selectedStatus, selectedSetor])

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (sortField === 'colaborador_nome') {
        const cmp = a.colaborador_nome.localeCompare(b.colaborador_nome)
        return sortAsc ? cmp : -cmp
      }
      if (sortField === 'progresso') {
        return sortAsc ? a.progresso - b.progresso : b.progresso - a.progresso
      }
      if (sortField === 'data_fim') {
        const cmp = a.data_fim.localeCompare(b.data_fim)
        return sortAsc ? cmp : -cmp
      }
      return 0
    })
  }, [filteredData, sortField, sortAsc])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1
  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return sortedData.slice(start, start + itemsPerPage)
  }, [sortedData, page])

  const toggleSort = (field: 'colaborador_nome' | 'data_fim' | 'progresso') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const formatShortDate = (ymd: string) => {
    if (!ymd) return '-'
    const [ano, mes, dia] = ymd.split('-')
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e novo onboarding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#1A2233]">Lista de Onboardings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gerencie o avanço nas 3 etapas técnicas dos colaboradores em treinamento
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

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por colaborador ou cargo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-10 border-gray-300 text-sm focus-visible:ring-brand-500"
            />
          </div>

          <div className="text-xs text-gray-500 self-end sm:self-center font-medium">
            Exibindo {sortedData.length} de {onboardings.length} colaboradores
          </div>
        </div>

        {/* Chips de filtro por status */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 mr-1">Status:</span>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'novo', label: 'Novo' },
            { id: 'em_andamento', label: 'Em andamento' },
            { id: 'avaliacao_pendente', label: 'Aguardando avaliação' },
            { id: 'concluido', label: 'Concluído' },
            { id: 'nao_apto', label: 'Não apto' },
          ].map((chip) => {
            const active = selectedStatus === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleStatusFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Chips de filtro por setor dinâmico */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 mr-1">Área / Setor:</span>
          <button
            type="button"
            onClick={() => {
              setSelectedSetor('todos')
              setPage(1)
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedSetor === 'todos'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas as áreas
          </button>
          {(setoresList.length > 0
            ? setoresList.filter((s) => s.ativo !== false)
            : Object.keys(SETORES_INFO).map((k) => ({
                id: k,
                chave: k,
                nome: SETORES_INFO[k].nome,
                cor: SETORES_INFO[k].cor,
              }))
          ).map((s) => {
            const val = s.chave || s.nome
            const active = selectedSetor === val || selectedSetor === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSetor(val)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.cor || '#2563EB' }}
                />
                <span>{s.nome}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabela de Onboardings (Desktop) e Lista de Cards (Mobile) */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        {/* Tabela Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('colaborador_nome')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Colaborador</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Setor</th>
                <th className="py-3.5 px-4">Etapa Atual</th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('progresso')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Progresso</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('data_fim')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Prazo (15 dias)</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    {loading
                      ? 'Carregando dados...'
                      : 'Nenhum onboarding encontrado com os filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const setor = getSetorVisual(item.setor, item.expand?.setor_ref)
                  const status = STATUS_INFO[item.status]

                  return (
                    <tr key={item.id} className="hover:bg-brand-50/30 transition-colors group">
                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/colaboradores/${item.id}`}
                          className="font-bold text-gray-900 group-hover:text-brand-600 block truncate max-w-[200px]"
                        >
                          {item.colaborador_nome}
                        </Link>
                        <span className="text-xs text-gray-400 block truncate max-w-[200px]">
                          {item.cargo || item.colaborador_email}
                        </span>
                      </td>

                      {/* Setor */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: setor.cor }}
                          />
                          {setor.nome}
                        </span>
                      </td>

                      {/* Etapa */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          Etapa {item.etapa_atual} de 3
                        </span>
                      </td>

                      {/* Progresso */}
                      <td className="py-3.5 px-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                            <span>{item.progresso}%</span>
                          </div>
                          <Progress value={item.progresso} className="h-1.5" />
                        </div>
                      </td>

                      {/* Prazo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-800">
                          {formatShortDate(item.data_fim)}
                        </div>
                        {item.isAtrasado ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                            <Flame className="w-3 h-3" />
                            <span>Atrasado</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400">
                            {item.diasRestantes} dias restantes
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.corBg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${status.corDot}`} />
                          {status.nome}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 text-brand-600 hover:text-brand-700 hover:bg-brand-50 font-medium"
                        >
                          <Link
                            to={`/colaboradores/${item.id}`}
                            className="inline-flex items-center gap-1"
                          >
                            <span>Detalhes</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Versão Mobile (Cards empilhados) */}
        <div className="md:hidden divide-y divide-gray-100">
          {paginatedData.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Nenhum onboarding encontrado.
            </div>
          ) : (
            paginatedData.map((item) => {
              const setor = getSetorVisual(item.setor, item.expand?.setor_ref)
              const status = STATUS_INFO[item.status]

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/colaboradores/${item.id}`}
                        className="font-bold text-sm text-gray-900 hover:text-brand-600 block"
                      >
                        {item.colaborador_nome}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {item.cargo || item.colaborador_email}
                      </span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: setor.cor }}
                      />
                      {setor.nome}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>
                        Progresso: {item.progresso}% (Etapa {item.etapa_atual})
                      </span>
                      <span>Prazo: {formatShortDate(item.data_fim)}</span>
                    </div>
                    <Progress value={item.progresso} className="h-1.5" />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${status.corBg}`}
                      >
                        {status.nome}
                      </span>
                      {item.isAtrasado && (
                        <span className="text-[11px] font-bold text-red-600 flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> Atrasado
                        </span>
                      )}
                    </div>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-brand-600 border-brand-200"
                    >
                      <Link to={`/colaboradores/${item.id}`}>Ver detalhe</Link>
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-xs text-gray-500 font-medium">
            Página {page} de {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Anterior</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 px-2.5"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
