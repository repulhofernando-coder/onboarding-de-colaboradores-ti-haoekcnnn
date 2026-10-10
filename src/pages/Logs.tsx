import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { auditoriaService, onboardingService, userService } from '@/services/onboarding'
import type { LogAuditoria, Onboarding, User } from '@/types/onboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileText,
  Search,
  Filter,
  Download,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  Shield,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react'

export default function Logs() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [gestores, setGestores] = useState<User[]>([])

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState<string>('todos')
  const [filtroGestor, setFiltroGestor] = useState<string>('todos')
  const [somenteForaPrazo, setSomenteForaPrazo] = useState(false)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [logsData, onbsData, usersData] = await Promise.all([
        auditoriaService.list({ limit: 500 }),
        onboardingService.list(),
        userService.getGestores(),
      ])
      setLogs(logsData)
      setOnboardings(onbsData)
      setGestores(usersData)
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Nomes únicos de colaboradores presentes nos logs para o filtro
  const listaColaboradores = useMemo(() => {
    const setColab = new Set<string>()
    logs.forEach((l) => {
      if (l.colaborador_nome) setColab.add(l.colaborador_nome)
    })
    onboardings.forEach((o) => {
      if (o.colaborador_nome) setColab.add(o.colaborador_nome)
    })
    return Array.from(setColab).sort()
  }, [logs, onboardings])

  // Nomes únicos de gestores presentes nos logs
  const listaGestores = useMemo(() => {
    const setG = new Set<string>()
    logs.forEach((l) => {
      if (l.gestor_nome) setG.add(l.gestor_nome)
    })
    gestores.forEach((g) => {
      if (g.name) setG.add(g.name)
    })
    return Array.from(setG).sort()
  }, [logs, gestores])

  // Filtragem
  const logsFiltrados = useMemo(() => {
    return logs
      .filter((log) => {
        // Busca textual
        if (search) {
          const s = search.toLowerCase()
          const matchAcao = (log.acao || '').toLowerCase().includes(s)
          const matchColab = (log.colaborador_nome || '').toLowerCase().includes(s)
          const matchUser = (log.usuario_nome || '').toLowerCase().includes(s)
          const matchGestor = (log.gestor_nome || '').toLowerCase().includes(s)
          const matchDet = (log.detalhes || '').toLowerCase().includes(s)
          if (!matchAcao && !matchColab && !matchUser && !matchGestor && !matchDet) {
            return false
          }
        }

        // Filtro colaborador
        if (filtroColaborador !== 'todos') {
          if (log.colaborador_nome !== filtroColaborador) return false
        }

        // Filtro gestor
        if (filtroGestor !== 'todos') {
          if (log.gestor_nome !== filtroGestor) return false
        }

        // Filtro fora do prazo
        if (somenteForaPrazo && !log.fora_prazo) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const timeA = new Date(a.created).getTime()
        const timeB = new Date(b.created).getTime()
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB
      })
  }, [logs, search, filtroColaborador, filtroGestor, somenteForaPrazo, sortOrder])

  // Formatação de data
  const formatDate = (iso: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  // Exportar CSV
  const handleExportCSV = () => {
    if (logsFiltrados.length === 0) return

    const headers = [
      'Data/Hora',
      'Acao',
      'Colaborador',
      'Gestor Responsavel',
      'Executado Por',
      'Papel',
      'Fora do Prazo',
      'Destaque de Prazo',
      'Detalhes',
    ]

    const rows = logsFiltrados.map((log) => [
      `"${formatDate(log.created)}"`,
      `"${(log.acao || '').replace(/"/g, '""')}"`,
      `"${(log.colaborador_nome || '').replace(/"/g, '""')}"`,
      `"${(log.gestor_nome || '').replace(/"/g, '""')}"`,
      `"${(log.usuario_nome || '').replace(/"/g, '""')}"`,
      `"${(log.usuario_role || '').replace(/"/g, '""')}"`,
      `"${log.fora_prazo ? 'SIM' : 'NAO'}"`,
      `"${(log.destaque_prazo || '').replace(/"/g, '""')}"`,
      `"${(log.detalhes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `auditoria_onboarding_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar TXT
  const handleExportTXT = () => {
    if (logsFiltrados.length === 0) return

    let txtContent = `RELATORIO DE AUDITORIA - ONBOARDING MUNDO OPEN TI\n`
    txtContent += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    txtContent += `Total de registros exportados: ${logsFiltrados.length}\n`
    txtContent += `Nota: Registros sao mantidos por 6 meses pelo sistema.\n`
    txtContent += `================================================================================\n\n`

    logsFiltrados.forEach((log, index) => {
      txtContent += `[Registro #${index + 1}]\n`
      txtContent += `Data/Hora: ${formatDate(log.created)}\n`
      txtContent += `Acao: ${log.acao}\n`
      txtContent += `Colaborador: ${log.colaborador_nome || '-'}\n`
      txtContent += `Gestor: ${log.gestor_nome || '-'}\n`
      txtContent += `Executado por: ${log.usuario_nome || '-'} (${log.usuario_role || '-'})\n`
      txtContent += `Conformidade: ${log.fora_prazo ? 'FORA DO PRAZO' : 'No Prazo'} ${log.destaque_prazo ? `(${log.destaque_prazo})` : ''}\n`
      txtContent += `Detalhes: ${log.detalhes || '-'}\n`
      txtContent += `--------------------------------------------------------------------------------\n`
    })

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `auditoria_onboarding_${new Date().toISOString().split('T')[0]}.txt`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2233]">
              Logs de Auditoria & Conformidade
            </h2>
          </div>
          <p className="text-sm text-gray-500 max-w-xl">
            Rastreabilidade imutável de todas as conclusões de fases, etapas e decisões de avaliação
            dos colaboradores de TI.
          </p>
        </div>

        {/* Botões de Exportação */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTXT}
            disabled={logsFiltrados.length === 0}
            className="h-9 text-xs border-gray-300"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar TXT
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={logsFiltrados.length === 0}
            className="h-9 text-xs bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Aviso discreto de retenção */}
      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Retenção legal:</strong> Os registros de auditoria são mantidos pelo sistema por{' '}
            <strong>6 meses</strong> e limpos automaticamente via rotina programada.
          </span>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded">
          {logs.length} registros ativos
        </span>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por ação, usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs border-gray-300"
            />
          </div>

          {/* Filtro Colaborador */}
          <div>
            <select
              value={filtroColaborador}
              onChange={(e) => setFiltroColaborador(e.target.value)}
              className="w-full h-9 text-xs border border-gray-300 rounded-md px-2.5 bg-white text-gray-700"
            >
              <option value="todos">Todos os Colaboradores ({listaColaboradores.length})</option>
              {listaColaboradores.map((colab) => (
                <option key={colab} value={colab}>
                  {colab}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Gestor */}
          <div>
            <select
              value={filtroGestor}
              onChange={(e) => setFiltroGestor(e.target.value)}
              className="w-full h-9 text-xs border border-gray-300 rounded-md px-2.5 bg-white text-gray-700"
            >
              <option value="todos">Todos os Gestores ({listaGestores.length})</option>
              {listaGestores.map((gestor) => (
                <option key={gestor} value={gestor}>
                  {gestor}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Somente Fora do Prazo */}
          <div className="flex items-center justify-between sm:justify-end gap-3 px-1">
            <label
              htmlFor="chkForaPrazo"
              className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                id="chkForaPrazo"
                checked={somenteForaPrazo}
                onChange={(e) => setSomenteForaPrazo(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
              />
              <span className="flex items-center gap-1 text-red-700">
                <AlertCircle className="w-3.5 h-3.5" />
                Somente fora do prazo
              </span>
            </label>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 text-xs flex items-center gap-1 border border-gray-200"
              title="Inverter ordenação"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span>
            Mostrando <strong>{logsFiltrados.length}</strong> de {logs.length} registros
          </span>
          {(search ||
            filtroColaborador !== 'todos' ||
            filtroGestor !== 'todos' ||
            somenteForaPrazo) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFiltroColaborador('todos')
                setFiltroGestor('todos')
                setSomenteForaPrazo(false)
              }}
              className="text-xs text-brand-600 hover:underline font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500">
            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Carregando trilha de auditoria...
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            Nenhum registro de auditoria encontrado com os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Executado Por</th>
                  <th className="py-3 px-4">Gestor Responsável</th>
                  <th className="py-3 px-4">Prazo</th>
                  <th className="py-3 px-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-brand-50/20 transition-colors">
                    {/* Data/Hora */}
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600 font-mono text-[11px]">
                      {formatDate(log.created)}
                    </td>

                    {/* Ação */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-900 block">{log.acao}</span>
                    </td>

                    {/* Colaborador */}
                    <td className="py-3 px-4">
                      {log.onboarding_id ? (
                        <Link
                          to={`/colaboradores/${log.onboarding_id}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {log.colaborador_nome || 'Colaborador'}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-800">
                          {log.colaborador_nome || '-'}
                        </span>
                      )}
                    </td>

                    {/* Executado Por */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">
                        {log.usuario_nome || 'Sistema'}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase">
                        {log.usuario_role || '-'}
                      </span>
                    </td>

                    {/* Gestor Responsável */}
                    <td className="py-3 px-4 text-gray-700">{log.gestor_nome || '-'}</td>

                    {/* Conformidade de Prazo */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.fora_prazo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          Fora do Prazo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          No Prazo
                        </span>
                      )}
                      {log.destaque_prazo && (
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {log.destaque_prazo}
                        </span>
                      )}
                    </td>

                    {/* Detalhes */}
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={log.detalhes}>
                      {log.detalhes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
