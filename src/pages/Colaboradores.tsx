import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { onboardingService } from '@/services/onboarding'
import { useRealtime } from '@/hooks/use-realtime'
import type { Onboarding } from '@/types/onboarding'
import { SETORES_INFO, STATUS_INFO, getSetorVisual, setorToString } from '@/types/onboarding'
import {
  Users,
  Search,
  ExternalLink,
  Plus,
  Mail,
  Calendar,
  Briefcase,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface ColaboradorAgregado {
  nome: string
  email: string
  cargo?: string
  setor: Onboarding['setor']
  onboardingMaisRecente: Onboarding
  totalOnboardings: number
}

export default function Colaboradores() {
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchOnboardings = async () => {
    try {
      const data = await onboardingService.list()
      setOnboardings(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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
      return (
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cargo && c.cargo.toLowerCase().includes(q))
      )
    })
  }, [colaboradoresAgregados, search])

  const formatShortDate = (ymd?: string) => {
    if (!ymd) return '-'
    const [ano, mes, dia] = ymd.split('-')
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="space-y-6">
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

      {/* Busca */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por colaborador, e-mail ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 border-gray-300 text-sm focus-visible:ring-brand-500"
          />
        </div>

        <span className="text-xs text-gray-500 font-medium shrink-0">
          Total: {filtrados.length} colaboradores
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

            let progresso = 0
            if (onb.etapa1_concluida) progresso += 33
            if (onb.etapa2_concluida) progresso += 33
            if (onb.etapa3_concluida) progresso += 34

            return (
              <div
                key={item.nome}
                className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-brand-600 transition-colors">
                        {item.colaborador_nome}
                      </h3>
                      <span className="text-xs text-gray-500 block">
                        {item.cargo || item.colaborador_email}
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

                  <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        Início: {formatShortDate(onb.data_inicio)} • Prazo:{' '}
                        {formatShortDate(onb.data_fim)}
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

                  <Button
                    asChild
                    size="sm"
                    className="h-8 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                  >
                    <Link
                      to={`/colaboradores/${onb.id}`}
                      className="inline-flex items-center gap-1"
                    >
                      <span>Abrir Onboarding</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
