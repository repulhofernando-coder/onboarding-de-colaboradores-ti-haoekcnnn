import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { colaboradorAnotacaoService } from '@/services/onboarding'
import { formatDateTime, formatShortDate } from '@/lib/dateUtils'
import type { ColaboradorAnotacao, Onboarding, TipoAnotacaoColaborador } from '@/types/onboarding'
import { TIPO_ANOTACAO_INFO } from '@/types/onboarding'
import { toast } from 'sonner'
import {
  MessageSquareText,
  Plus,
  Trash2,
  Edit2,
  Lock,
  UserCheck,
  Calendar,
  Sparkles,
  ShieldAlert,
  Clock,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface SecaoAnotacoesColaboradorProps {
  onboarding: Onboarding
  todosOnboardings?: Onboarding[]
  onAnotacaoAlterada?: () => void
}

export function SecaoAnotacoesColaborador({
  onboarding,
  todosOnboardings = [],
  onAnotacaoAlterada,
}: SecaoAnotacoesColaboradorProps) {
  const { user, isAdmin, isRH, isGestao } = useAuth()
  const [anotacoes, setAnotacoes] = useState<ColaboradorAnotacao[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtro por tipo
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Modal Criar / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [anotacaoEmEdicao, setAnotacaoEmEdicao] = useState<ColaboradorAnotacao | null>(null)
  const [tipo, setTipo] = useState<TipoAnotacaoColaborador>('feedback_1_1')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Dialog Excluir
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [anotacaoExcluir, setAnotacaoExcluir] = useState<ColaboradorAnotacao | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // IDs unificados do colaborador
  const idsColaborador = useMemo(() => {
    const ids = new Set<string>()
    ids.add(onboarding.id)
    todosOnboardings.forEach((o) => {
      if (
        o.colaborador_nome.trim().toLowerCase() === onboarding.colaborador_nome.trim().toLowerCase()
      ) {
        ids.add(o.id)
      }
    })
    return Array.from(ids)
  }, [onboarding, todosOnboardings])

  const carregarAnotacoes = async () => {
    try {
      setCarregando(true)
      const arrays = await Promise.all(
        idsColaborador.map((id) => colaboradorAnotacaoService.listarPorColaborador(id)),
      )
      const mapa = new Map<string, ColaboradorAnotacao>()
      arrays.flat().forEach((a) => {
        mapa.set(a.id, a)
      })

      // Ordenar decrescente por created
      const ordenadas = Array.from(mapa.values()).sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      )
      setAnotacoes(ordenadas)
    } catch (err) {
      console.error('[SecaoAnotacoesColaborador] Erro ao carregar:', err)
      toast.error('Não foi possível carregar as anotações do colaborador.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarAnotacoes()
  }, [idsColaborador])

  const anotacoesFiltradas = useMemo(() => {
    if (filtroTipo === 'todos') return anotacoes
    return anotacoes.filter((a) => a.tipo === filtroTipo)
  }, [anotacoes, filtroTipo])

  const abrirModalCriar = () => {
    setModoEdicao(false)
    setAnotacaoEmEdicao(null)
    setTipo('feedback_1_1')
    setTexto('')
    setModalOpen(true)
  }

  const abrirModalEditar = (anotacao: ColaboradorAnotacao) => {
    setModoEdicao(true)
    setAnotacaoEmEdicao(anotacao)
    setTipo(anotacao.tipo)
    setTexto(anotacao.texto)
    setModalOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) {
      toast.error('O texto da anotação não pode ficar em branco.')
      return
    }

    try {
      setSalvando(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'Gestor',
        role: user?.role || 'gestao',
      }

      if (modoEdicao && anotacaoEmEdicao) {
        await colaboradorAnotacaoService.atualizar({
          id: anotacaoEmEdicao.id,
          colaboradorId: onboarding.id,
          colaboradorNome: onboarding.colaborador_nome,
          tipo,
          texto,
          autor,
        })
        toast.success('Anotação atualizada com sucesso!')
      } else {
        await colaboradorAnotacaoService.criar({
          colaboradorId: onboarding.id,
          colaboradorNome: onboarding.colaborador_nome,
          tipo,
          texto,
          autor,
        })
        toast.success('Anotação registrada com sucesso no histórico!')
      }

      setModalOpen(false)
      carregarAnotacoes()
      if (onAnotacaoAlterada) onAnotacaoAlterada()
    } catch (err) {
      console.error('[SecaoAnotacoesColaborador] Erro ao salvar:', err)
      toast.error('Falha ao salvar anotação do gestor.')
    } finally {
      setSalvando(false)
    }
  }

  const handleConfirmarExcluir = async () => {
    if (!anotacaoExcluir) return

    try {
      setExcluindo(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'Gestor',
        role: user?.role || 'gestao',
      }

      await colaboradorAnotacaoService.excluir({
        id: anotacaoExcluir.id,
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        autor,
      })

      toast.success('Anotação excluída do histórico.')
      setModalExcluirOpen(false)
      setAnotacaoExcluir(null)
      carregarAnotacoes()
      if (onAnotacaoAlterada) onAnotacaoAlterada()
    } catch (err) {
      console.error('[SecaoAnotacoesColaborador] Erro ao excluir:', err)
      toast.error('Falha ao excluir anotação.')
    } finally {
      setExcluindo(false)
    }
  }

  // Contadores por tipo
  const contadores = useMemo(() => {
    let f11 = 0
    let aval = 0
    let obs = 0
    anotacoes.forEach((a) => {
      if (a.tipo === 'feedback_1_1') f11++
      else if (a.tipo === 'avaliacao') aval++
      else obs++
    })
    return { f11, aval, obs, total: anotacoes.length }
  }, [anotacoes])

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-gray-900">
                  Anotações & Feedbacks do Gestor
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs bg-white text-purple-800 border-purple-200"
                >
                  {contadores.total} {contadores.total === 1 ? 'registro' : 'registros'}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-red-50 text-red-700 border-red-200 font-semibold gap-1"
                >
                  <Lock className="w-3 h-3 text-red-600" />
                  Uso Interno (Colaborador não vê)
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Histórico confidencial de reuniões de feedback 1:1, anotações de avaliações e
                observações de desempenho
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={abrirModalCriar}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs h-8 shrink-0 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Anotação</span>
          </Button>
        </div>

        {/* Filtros rápidos */}
        {anotacoes.length > 0 && (
          <div className="flex items-center gap-2 pt-3 flex-wrap">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filtrar por tipo:
            </span>
            <Button
              type="button"
              variant={filtroTipo === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroTipo('todos')}
              className={`h-6 text-[11px] px-2.5 ${
                filtroTipo === 'todos' ? 'bg-purple-600 hover:bg-purple-700' : 'text-gray-600'
              }`}
            >
              Todos ({contadores.total})
            </Button>
            <Button
              type="button"
              variant={filtroTipo === 'feedback_1_1' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroTipo('feedback_1_1')}
              className={`h-6 text-[11px] px-2.5 ${
                filtroTipo === 'feedback_1_1'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'text-purple-700 border-purple-200'
              }`}
            >
              Feedback 1:1 ({contadores.f11})
            </Button>
            <Button
              type="button"
              variant={filtroTipo === 'avaliacao' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroTipo('avaliacao')}
              className={`h-6 text-[11px] px-2.5 ${
                filtroTipo === 'avaliacao'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'text-blue-700 border-blue-200'
              }`}
            >
              Avaliação ({contadores.aval})
            </Button>
            <Button
              type="button"
              variant={filtroTipo === 'observacao_geral' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroTipo('observacao_geral')}
              className={`h-6 text-[11px] px-2.5 ${
                filtroTipo === 'observacao_geral'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'text-slate-700 border-slate-200'
              }`}
            >
              Observações ({contadores.obs})
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {carregando ? (
          <div className="py-12 text-center text-xs text-gray-400 space-y-2">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Carregando anotações do gestor...</p>
          </div>
        ) : anotacoesFiltradas.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                {anotacoes.length === 0
                  ? 'Nenhuma anotação ou feedback registrado para este colaborador'
                  : 'Nenhuma anotação encontrada com o filtro selecionado'}
              </p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
                Utilize este espaço confidencial para registrar o que foi conversado em reuniões de
                1:1, pontos de atenção em avaliações ou observações de desenvolvimento ao longo do
                tempo.
              </p>
            </div>
            {anotacoes.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={abrirModalCriar}
                className="text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar Primeira Anotação
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {anotacoesFiltradas.map((anot) => {
              const infoTipo = TIPO_ANOTACAO_INFO[anot.tipo]
              const ehAutor = user?.id === anot.autor
              const podeEditar = isAdmin || isRH || ehAutor

              return (
                <div
                  key={anot.id}
                  className="rounded-xl border border-gray-200 p-4 bg-white hover:border-purple-200 transition-all space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${infoTipo.badgeClass}`}>
                        {infoTipo.label}
                      </Badge>
                      <span className="text-xs font-semibold text-gray-800">
                        {anot.autor_nome || anot.expand?.autor?.name || 'Gestor'}
                      </span>
                      {anot.autor_role && (
                        <span className="text-[10px] text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                          {anot.autor_role}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDateTime(anot.created)}
                      </span>

                      {podeEditar && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirModalEditar(anot)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-purple-700 hover:bg-purple-50"
                            title="Editar anotação"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAnotacaoExcluir(anot)
                              setModalExcluirOpen(true)
                            }}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50"
                            title="Excluir anotação"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap pl-1 border-l-2 border-purple-200">
                    {anot.texto}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Criar / Editar Anotação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-purple-600" />
              {modoEdicao ? 'Editar Anotação do Gestor' : 'Nova Anotação ou Feedback'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Colaborador: <strong>{onboarding.colaborador_nome}</strong> ({onboarding.cargo} •{' '}
              {onboarding.setor})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-4 pt-2">
            <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-700" />
                Registro Restrito da Gestão e RH
              </p>
              <p className="text-[11px] text-purple-800">
                Esta anotação fica salva no histórico confidencial e alimenta a Trajetória do
                colaborador. O colaborador NÃO tem acesso a este conteúdo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Tipo de Registro <span className="text-red-500">*</span>
              </Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAnotacaoColaborador)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feedback_1_1">Feedback 1:1 (Reunião Individual)</SelectItem>
                  <SelectItem value="avaliacao">
                    Avaliação (Notas sobre Prova/Desempenho)
                  </SelectItem>
                  <SelectItem value="observacao_geral">Observação Geral da Gestão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Anotações e Detalhes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Descreva os tópicos abordados, pontos fortes, oportunidades de melhoria ou combinados acordados..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                className="text-xs leading-relaxed"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={salvando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando || !texto.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
              >
                {salvando
                  ? 'Salvando...'
                  : modoEdicao
                    ? 'Salvar Alterações'
                    : 'Salvar no Histórico'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Excluir */}
      <AlertDialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              Excluir Anotação do Histórico?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Esta ação removerá a anotação permanentemente do histórico confidencial e da
              Trajetória do colaborador. O registro de auditoria documentará a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluir}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {excluindo ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
