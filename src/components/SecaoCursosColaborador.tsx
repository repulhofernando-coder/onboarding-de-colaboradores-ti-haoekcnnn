import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { cursoService, colaboradorCursoService, setorService } from '@/services/onboarding'
import { podeVisualizarSetor } from '@/lib/gestaoVisibility'
import { formatShortDate } from '@/lib/dateUtils'
import type {
  ColaboradorCurso,
  Curso,
  SetorModel,
  Onboarding,
  StatusColaboradorCurso,
} from '@/types/onboarding'
import { NIVEIS_CURSO_INFO, STATUS_COLABORADOR_CURSO_INFO } from '@/types/onboarding'
import { toast } from 'sonner'
import {
  GraduationCap,
  Plus,
  ExternalLink,
  Award,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
  BookOpen,
  Building2,
  Calendar,
  AlertCircle,
  FileCheck2,
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

export interface SecaoCursosColaboradorProps {
  onboarding: Onboarding
  todosOnboardings?: Onboarding[]
  onCursoAlterado?: () => void
  onLancarComoCertificado?: (curso: ColaboradorCurso) => void
}

export function SecaoCursosColaborador({
  onboarding,
  todosOnboardings = [],
  onCursoAlterado,
  onLancarComoCertificado,
}: SecaoCursosColaboradorProps) {
  const { user, isAdmin, isRH, isGestao } = useAuth()
  const podeGerenciar = isAdmin || isRH

  const [colaboradorCursos, setColaboradorCursos] = useState<ColaboradorCurso[]>([])
  const [cursosDisponiveis, setCursosDisponiveis] = useState<Curso[]>([])
  const [setores, setSetores] = useState<SetorModel[]>([])
  const [carregando, setCarregando] = useState(true)

  // Dialog Associar Curso
  const [modalAssociarOpen, setModalAssociarOpen] = useState(false)
  const [cursoSelecionadoId, setCursoSelecionadoId] = useState('')
  const [filtroSetorModal, setFiltroSetorModal] = useState<string>('todos')
  const [observacaoAssociacao, setObservacaoAssociacao] = useState('')
  const [salvandoAssociacao, setSalvandoAssociacao] = useState(false)

  // Dialog Alterar Status
  const [modalStatusOpen, setModalStatusOpen] = useState(false)
  const [cursoEditandoStatus, setCursoEditandoStatus] = useState<ColaboradorCurso | null>(null)
  const [novoStatus, setNovoStatus] = useState<StatusColaboradorCurso>('pendente')
  const [observacaoStatus, setObservacaoStatus] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)

  // Dialog Desassociar
  const [modalRemoverOpen, setModalRemoverOpen] = useState(false)
  const [cursoRemover, setCursoRemover] = useState<ColaboradorCurso | null>(null)
  const [removendo, setRemovendo] = useState(false)

  // Ids consolidados do colaborador (ficha unificada)
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

  const carregarDados = async () => {
    try {
      setCarregando(true)
      const [colabCursos, todosCursos, todosSetores] = await Promise.all([
        colaboradorCursoService.listByColaboradorIds(idsColaborador),
        cursoService.listAll(),
        setorService.listAtivos(),
      ])

      setColaboradorCursos(colabCursos)
      setCursosDisponiveis(todosCursos)
      setSetores(todosSetores)
    } catch (err) {
      console.error('[SecaoCursosColaborador] Erro ao carregar cursos:', err)
      toast.error('Não foi possível carregar os cursos do colaborador.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [idsColaborador])

  // Cursos já associados para evitar duplicação simples na seleção
  const idsCursosJaAssociados = useMemo(() => {
    return new Set(colaboradorCursos.map((cc) => cc.curso))
  }, [colaboradorCursos])

  // Cursos filtrados para a escolha no modal de associação
  const cursosParaSelecao = useMemo(() => {
    return cursosDisponiveis.filter((c) => {
      if (c.ativo === false) return false
      if (filtroSetorModal !== 'todos' && c.setor !== filtroSetorModal) {
        return false
      }
      return true
    })
  }, [cursosDisponiveis, filtroSetorModal])

  const abrirModalAssociar = () => {
    // Tentar selecionar por padrão o setor do colaborador se existir
    const setorColab = setores.find(
      (s) =>
        s.id === onboarding.setor_ref ||
        s.nome.toLowerCase() === (onboarding.setor || '').toLowerCase() ||
        s.chave.toLowerCase() === (onboarding.setor || '').toLowerCase(),
    )

    setFiltroSetorModal(setorColab ? setorColab.id : 'todos')
    setCursoSelecionadoId('')
    setObservacaoAssociacao('')
    setModalAssociarOpen(true)
  }

  const handleSalvarAssociacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cursoSelecionadoId) {
      toast.error('Selecione um curso da grade para associar.')
      return
    }

    const cursoObj = cursosDisponiveis.find((c) => c.id === cursoSelecionadoId)
    if (!cursoObj) return

    try {
      setSalvandoAssociacao(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorCursoService.associar({
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        cursoId: cursoObj.id,
        cursoTitulo: cursoObj.titulo,
        cursoNivel: cursoObj.nivel,
        observacao: observacaoAssociacao,
        autor,
      })

      toast.success(`Curso "${cursoObj.titulo}" associado com sucesso!`)
      setModalAssociarOpen(false)
      carregarDados()
      if (onCursoAlterado) onCursoAlterado()
    } catch (err) {
      console.error('[SecaoCursosColaborador] Erro ao associar curso:', err)
      toast.error('Falha ao associar curso.')
    } finally {
      setSalvandoAssociacao(false)
    }
  }

  const abrirModalEditarStatus = (cc: ColaboradorCurso) => {
    setCursoEditandoStatus(cc)
    setNovoStatus(cc.status)
    setObservacaoStatus(cc.observacao || '')
    setModalStatusOpen(true)
  }

  const handleSalvarStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cursoEditandoStatus) return

    const cursoTitulo = cursoEditandoStatus.expand?.curso?.titulo || 'Curso'
    const cursoNivel = cursoEditandoStatus.expand?.curso?.nivel || 'essencial'

    try {
      setSalvandoStatus(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorCursoService.atualizarStatus({
        id: cursoEditandoStatus.id,
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        cursoTitulo,
        cursoNivel,
        novoStatus,
        observacao: observacaoStatus,
        autor,
      })

      toast.success(`Status do curso "${cursoTitulo}" atualizado para ${novoStatus.toUpperCase()}!`)
      setModalStatusOpen(false)
      carregarDados()
      if (onCursoAlterado) onCursoAlterado()
    } catch (err) {
      console.error('[SecaoCursosColaborador] Erro ao atualizar status:', err)
      toast.error('Falha ao atualizar status do curso.')
    } finally {
      setSalvandoStatus(false)
    }
  }

  const handleConfirmarRemover = async () => {
    if (!cursoRemover) return
    const cursoTitulo = cursoRemover.expand?.curso?.titulo || 'Curso'

    try {
      setRemovendo(true)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'RH / Admin',
        role: user?.role || 'rh',
      }

      await colaboradorCursoService.desassociar({
        id: cursoRemover.id,
        colaboradorId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        cursoTitulo,
        autor,
      })

      toast.success(`Curso "${cursoTitulo}" desassociado com sucesso.`)
      setModalRemoverOpen(false)
      setCursoRemover(null)
      carregarDados()
      if (onCursoAlterado) onCursoAlterado()
    } catch (err) {
      console.error('[SecaoCursosColaborador] Erro ao desassociar curso:', err)
      toast.error('Falha ao desassociar curso.')
    } finally {
      setRemovendo(false)
    }
  }

  // Estatísticas
  const estatisticas = useMemo(() => {
    let concluidos = 0
    let emAndamento = 0
    let pendentes = 0
    colaboradorCursos.forEach((cc) => {
      if (cc.status === 'concluido') concluidos++
      else if (cc.status === 'em_andamento') emAndamento++
      else pendentes++
    })
    return { concluidos, emAndamento, pendentes }
  }, [colaboradorCursos])

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-gray-900">
                  Cursos da Grade Associados
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs bg-white text-emerald-800 border-emerald-200"
                >
                  {colaboradorCursos.length}{' '}
                  {colaboradorCursos.length === 1 ? 'curso atribuído' : 'cursos atribuídos'}
                </Badge>
                {estatisticas.concluidos > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {estatisticas.concluidos} concluído(s)
                  </Badge>
                )}
                {estatisticas.emAndamento > 0 && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold gap-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    {estatisticas.emAndamento} em andamento
                  </Badge>
                )}
                {estatisticas.pendentes > 0 && (
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-normal">
                    {estatisticas.pendentes} pendente(s)
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Trilha de capacitação contínua durante a jornada do colaborador na empresa
              </CardDescription>
            </div>
          </div>

          {podeGerenciar && (
            <Button
              type="button"
              size="sm"
              onClick={abrirModalAssociar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs h-8 shrink-0 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Associar Curso da Grade</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {carregando ? (
          <div className="py-12 text-center text-xs text-gray-400 space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Carregando cursos associados...</p>
          </div>
        ) : colaboradorCursos.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                Nenhum curso da grade associado a este colaborador ainda
              </p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
                Associe treinamentos técnicos essenciais, recomendados ou complementares para
                acompanhar a evolução contínua da pessoa.
              </p>
            </div>
            {podeGerenciar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={abrirModalAssociar}
                className="text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Associar Primeiro Curso
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {colaboradorCursos.map((cc) => {
              const curso = cc.expand?.curso
              const setorCurso = curso?.expand?.setor
              const nivelInfo = curso?.nivel ? NIVEIS_CURSO_INFO[curso.nivel] : null
              const statusInfo = STATUS_COLABORADOR_CURSO_INFO[cc.status]

              return (
                <div
                  key={cc.id}
                  className={`rounded-xl border p-4 bg-white shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3 ${
                    cc.status === 'concluido'
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : cc.status === 'em_andamento'
                        ? 'border-blue-200 bg-blue-50/10'
                        : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header do card de curso */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 leading-snug break-words">
                            {curso?.titulo || 'Curso sem título'}
                          </h4>

                          {nivelInfo && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.2 rounded-full inline-flex items-center gap-1 ${nivelInfo.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${nivelInfo.dotClass}`} />
                              {nivelInfo.label}
                            </Badge>
                          )}

                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${statusInfo?.badgeClass || 'bg-gray-100'}`}
                          >
                            {statusInfo?.label || cc.status}
                          </Badge>
                        </div>

                        {setorCurso && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Building2 className="w-3 h-3 text-gray-400" />
                            <span>
                              Departamento: <strong>{setorCurso.nome}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Link de Acesso Externo */}
                      {curso?.link && (
                        <a
                          href={curso.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shrink-0"
                          title="Acessar conteúdo do curso"
                        >
                          <span>Acessar</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {curso?.descricao && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {curso.descricao}
                      </p>
                    )}

                    {cc.observacao && (
                      <div className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <strong>Obs:</strong> {cc.observacao}
                      </div>
                    )}

                    {/* Meta de Atribuição e Conclusão */}
                    <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
                      {cc.atribuido_em && (
                        <div className="flex items-center justify-between">
                          <span>Atribuído em:</span>
                          <span className="font-medium text-gray-700">
                            {formatShortDate(cc.atribuido_em)}{' '}
                            {cc.atribuido_por ? `por ${cc.atribuido_por}` : ''}
                          </span>
                        </div>
                      )}
                      {cc.status === 'concluido' && cc.concluido_em && (
                        <div className="flex items-center justify-between text-emerald-700 font-semibold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Concluído em:
                          </span>
                          <span>
                            {formatShortDate(cc.concluido_em)}{' '}
                            {cc.concluido_por ? `(validado por ${cc.concluido_por})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé de Ações (Apenas RH/Admin para escrita; Gestão em modo leitura) */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    {podeGerenciar ? (
                      <div className="flex items-center gap-2 flex-wrap w-full justify-between">
                        <div className="flex items-center gap-1.5">
                          {/* Atalho "Lançar como Certificado" se concluído */}
                          {cc.status === 'concluido' && onLancarComoCertificado && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onLancarComoCertificado(cc)}
                              className="h-7 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold gap-1"
                              title="Adicionar automaticamente como certificado oficial no perfil"
                            >
                              <Award className="w-3 h-3 text-blue-600" />
                              <span>Lançar como Certificado</span>
                            </Button>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalEditarStatus(cc)}
                            className="h-7 text-[11px] text-gray-700 border-gray-200 hover:bg-gray-50 font-medium"
                          >
                            <span>Alterar Status</span>
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCursoRemover(cc)
                            setModalRemoverOpen(true)
                          }}
                          className="h-7 px-2 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Remover associação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">
                        Visualização exclusiva do gestor do setor (alterações são feitas pelo
                        RH/Admin).
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog Associar Curso da Grade */}
      <Dialog open={modalAssociarOpen} onOpenChange={setModalAssociarOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSalvarAssociacao}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                <span>Associar Curso da Grade</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Selecione um treinamento do catálogo por departamento para o colaborador{' '}
                <strong>{onboarding.colaborador_nome}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              {/* Filtro por Departamento para facilitar localização */}
              <div className="space-y-1">
                <Label htmlFor="filtro-setor-modal" className="text-xs font-semibold text-gray-700">
                  Filtrar Cursos por Departamento
                </Label>
                <Select value={filtroSetorModal} onValueChange={setFiltroSetorModal}>
                  <SelectTrigger id="filtro-setor-modal" className="text-xs h-9">
                    <SelectValue placeholder="Todos os Departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Departamentos</SelectItem>
                    {setores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção do Curso */}
              <div className="space-y-1">
                <Label htmlFor="curso-selecionado" className="text-xs font-semibold text-gray-700">
                  Selecione o Curso <span className="text-red-500">*</span>
                </Label>
                <Select value={cursoSelecionadoId} onValueChange={setCursoSelecionadoId}>
                  <SelectTrigger id="curso-selecionado" className="text-xs h-9">
                    <SelectValue placeholder="Escolha um curso da grade..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {cursosParaSelecao.map((c) => {
                      const jaAssociado = idsCursosJaAssociados.has(c.id)
                      const nivelInfo = NIVEIS_CURSO_INFO[c.nivel]

                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <span>{c.titulo}</span>
                            <span className="text-[10px] text-gray-400">
                              ({nivelInfo?.label || c.nivel})
                            </span>
                            {jaAssociado && (
                              <span className="text-[10px] text-amber-600 font-bold ml-1">
                                (já associado)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {cursosParaSelecao.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Nenhum curso ativo encontrado neste departamento. Cadastre novos cursos na aba
                    Grade de Cursos.
                  </p>
                )}
              </div>

              {/* Observação */}
              <div className="space-y-1">
                <Label htmlFor="obs-associacao" className="text-xs font-semibold text-gray-700">
                  Observações / Motivo da Atribuição (Opcional)
                </Label>
                <Textarea
                  id="obs-associacao"
                  rows={2}
                  placeholder="Ex.: Recomendado para capacitação em firewalls e suporte presencial..."
                  value={observacaoAssociacao}
                  onChange={(e) => setObservacaoAssociacao(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-800">
                <strong>Uso Contínuo:</strong> A grade de cursos é independente do onboarding
                inicial e acompanha a vida funcional do colaborador na empresa.
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalAssociarOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoAssociacao || !cursoSelecionadoId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {salvandoAssociacao ? 'Associando...' : 'Confirmar Associação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Alterar Status */}
      <Dialog open={modalStatusOpen} onOpenChange={setModalStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSalvarStatus}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-brand-600" />
                <span>Atualizar Status do Curso</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Curso: <strong>{cursoEditandoStatus?.expand?.curso?.titulo}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div className="space-y-1">
                <Label htmlFor="status-curso" className="text-xs font-semibold text-gray-700">
                  Status Atualizado <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={novoStatus}
                  onValueChange={(val: StatusColaboradorCurso) => setNovoStatus(val)}
                >
                  <SelectTrigger id="status-curso" className="text-xs h-9">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">⚪ Pendente</SelectItem>
                    <SelectItem value="em_andamento">🔵 Em Andamento</SelectItem>
                    <SelectItem value="concluido">🟢 Concluído (Conferido por RH/Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {novoStatus === 'concluido' && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Marcação de Conclusão Oficial
                  </div>
                  <p>
                    A data de hoje e o seu usuário (<strong>{user?.name || user?.email}</strong>)
                    serão gravados como responsáveis pela validação da conclusão na auditoria.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="obs-status" className="text-xs font-semibold text-gray-700">
                  Anotações de Progresso (Opcional)
                </Label>
                <Textarea
                  id="obs-status"
                  rows={2}
                  placeholder="Ex.: Concluiu o módulo 1 e 2 com 100% de aproveitamento..."
                  value={observacaoStatus}
                  onChange={(e) => setObservacaoStatus(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalStatusOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoStatus}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                {salvandoStatus ? 'Salvando...' : 'Salvar Status'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação de Desassociação */}
      <AlertDialog open={modalRemoverOpen} onOpenChange={setModalRemoverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              Remover Curso Associado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500">
              Deseja desassociar o curso <strong>"{cursoRemover?.expand?.curso?.titulo}"</strong> do
              perfil de <strong>{onboarding.colaborador_nome}</strong>? O registro e histórico serão
              excluídos da ficha com auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarRemover}
              disabled={removendo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {removendo ? 'Removendo...' : 'Sim, Desassociar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
