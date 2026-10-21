import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { cursoService, setorService } from '@/services/onboarding'
import { podeVisualizarSetor, getSetorUsuarioNome } from '@/lib/gestaoVisibility'
import { AvisoSetorGestor } from '@/components/AvisoSetorGestor'
import type { Curso, SetorModel, NivelCurso } from '@/types/onboarding'
import { NIVEIS_CURSO_INFO } from '@/types/onboarding'
import { toast } from 'sonner'
import {
  GraduationCap,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  FolderOpen,
  Filter,
  Search,
  BookOpen,
  Layers,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

export default function GradeCursos() {
  const { user, isAdmin, isRH, isGestao } = useAuth()
  const podeEscrever = isAdmin || isRH

  const [cursos, setCursos] = useState<Curso[]>([])
  const [setores, setSetores] = useState<SetorModel[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [filtroSetor, setFiltroSetor] = useState<string>('todos')
  const [filtroNivel, setFiltroNivel] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState('')

  // Modal Criação / Edição
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editandoCurso, setEditandoCurso] = useState<Curso | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [link, setLink] = useState('')
  const [nivel, setNivel] = useState<NivelCurso>('essencial')
  const [setorId, setSetorId] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // Modal Exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cursoParaExcluir, setCursoParaExcluir] = useState<Curso | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const carregarDados = async () => {
    try {
      setCarregando(true)
      const [listaCursos, listaSetores] = await Promise.all([
        cursoService.listAll(),
        setorService.listAtivos(),
      ])
      setCursos(listaCursos)
      setSetores(listaSetores)
    } catch (err) {
      console.error('[GradeCursos] Erro ao carregar dados:', err)
      toast.error('Não foi possível carregar a Grade de Cursos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Filtrar setores visíveis conforme o papel Gestão
  const setoresVisiveis = useMemo(() => {
    return setores.filter((s) =>
      podeVisualizarSetor({
        role: user?.role,
        userSetor: user?.setor,
        itemSetor: s.nome,
        itemSetorRef: s.id,
        setoresCadastrados: setores,
      }),
    )
  }, [setores, user])

  // Map de cursos agrupados por setorId
  const cursosPorSetor = useMemo(() => {
    const map = new Map<string, Curso[]>()
    for (const c of cursos) {
      // Checar se o curso é visível para o usuário atual
      const setorDoCurso = setores.find((s) => s.id === c.setor)
      const visivel = podeVisualizarSetor({
        role: user?.role,
        userSetor: user?.setor,
        itemSetor: setorDoCurso?.nome,
        itemSetorRef: c.setor,
        setoresCadastrados: setores,
      })
      if (!visivel) continue

      // Filtro de busca textual
      if (buscaTexto.trim()) {
        const b = buscaTexto.toLowerCase()
        const matchTitulo = c.titulo.toLowerCase().includes(b)
        const matchDesc = c.descricao?.toLowerCase().includes(b)
        if (!matchTitulo && !matchDesc) continue
      }

      // Filtro por nível
      if (filtroNivel !== 'todos' && c.nivel !== filtroNivel) {
        continue
      }

      const arr = map.get(c.setor) || []
      arr.push(c)
      map.set(c.setor, arr)
    }
    return map
  }, [cursos, setores, user, buscaTexto, filtroNivel])

  // Totalizadores
  const estatisticasGerais = useMemo(() => {
    let essenciais = 0
    let recomendados = 0
    let complementares = 0
    let totalVisiveis = 0

    cursosPorSetor.forEach((lista) => {
      lista.forEach((c) => {
        totalVisiveis++
        if (c.nivel === 'essencial') essenciais++
        else if (c.nivel === 'recomendado') recomendados++
        else if (c.nivel === 'complementar') complementares++
      })
    })

    return { totalVisiveis, essenciais, recomendados, complementares }
  }, [cursosPorSetor])

  const abrirDialogCriar = (setorPreselecionado?: string) => {
    setEditandoCurso(null)
    setTitulo('')
    setDescricao('')
    setLink('')
    setNivel('essencial')
    setSetorId(setorPreselecionado || setoresVisiveis[0]?.id || '')
    setAtivo(true)
    setDialogOpen(true)
  }

  const abrirDialogEditar = (c: Curso) => {
    setEditandoCurso(c)
    setTitulo(c.titulo)
    setDescricao(c.descricao || '')
    setLink(c.link)
    setNivel(c.nivel)
    setSetorId(c.setor)
    setAtivo(c.ativo !== false)
    setDialogOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !link.trim() || !setorId) {
      toast.error('Preencha os campos obrigatórios (Título, Link e Departamento).')
      return
    }

    // Validação básica de URL
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      toast.error('O link deve começar com http:// ou https://')
      return
    }

    try {
      setSalvando(true)
      const setorObj = setores.find((s) => s.id === setorId)
      const autor = {
        id: user?.id || '',
        nome: user?.name || user?.email || 'Admin / RH',
        role: user?.role || 'rh',
        setorNome: setorObj?.nome,
      }

      if (editandoCurso) {
        await cursoService.update(editandoCurso.id, {
          titulo,
          descricao,
          link,
          nivel,
          setor: setorId,
          ativo,
          autor,
        })
        toast.success(`Curso "${titulo}" atualizado com sucesso!`)
      } else {
        await cursoService.create({
          titulo,
          descricao,
          link,
          nivel,
          setor: setorId,
          ativo,
          autor,
        })
        toast.success(`Curso "${titulo}" cadastrado na Grade com sucesso!`)
      }

      setDialogOpen(false)
      carregarDados()
    } catch (err) {
      console.error('[GradeCursos] Erro ao salvar curso:', err)
      toast.error('Erro ao salvar curso na Grade.')
    } finally {
      setSalvando(false)
    }
  }

  const handleConfirmarExcluir = async () => {
    if (!cursoParaExcluir) return
    try {
      setExcluindo(true)
      await cursoService.delete({
        id: cursoParaExcluir.id,
        titulo: cursoParaExcluir.titulo,
        autor: {
          id: user?.id || '',
          nome: user?.name || user?.email || 'Admin / RH',
          role: user?.role || 'rh',
        },
      })
      toast.success(`Curso "${cursoParaExcluir.titulo}" removido com sucesso.`)
      setDeleteDialogOpen(false)
      setCursoParaExcluir(null)
      carregarDados()
    } catch (err) {
      console.error('[GradeCursos] Erro ao excluir curso:', err)
      toast.error('Falha ao excluir o curso da Grade.')
    } finally {
      setExcluindo(false)
    }
  }

  const setoresFiltrados = useMemo(() => {
    if (filtroSetor === 'todos') {
      return setoresVisiveis
    }
    return setoresVisiveis.filter((s) => s.id === filtroSetor)
  }, [setoresVisiveis, filtroSetor])

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner de Identificação */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Grade de Cursos por Departamento</h1>
              <Badge
                variant="outline"
                className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
              >
                Uso Contínuo na Empresa
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Catálogo central de treinamentos e formações providenciais para cada área de TI. Os
              cursos são recomendados e associados ao colaborador a qualquer momento de sua jornada
              através do <strong>Perfil do Colaborador</strong>.
            </p>
          </div>
        </div>

        {podeEscrever && (
          <Button
            type="button"
            onClick={() => abrirDialogCriar()}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs h-9 shrink-0 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Curso</span>
          </Button>
        )}
      </div>

      {/* Alerta de Visibilidade / Gestão */}
      <AvisoSetorGestor setoresList={setores} moduloNome="cursos da grade" />

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar curso por título ou descrição..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro de Departamento (apenas para Admin/RH ou múltiplos setores) */}
          <div>
            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Filtrar por Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">
                  Todos os Departamentos ({setoresVisiveis.length})
                </SelectItem>
                {setoresVisiveis.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Nível */}
          <div>
            <Select value={filtroNivel} onValueChange={setFiltroNivel}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Filtrar por Relevância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Níveis</SelectItem>
                <SelectItem value="essencial">Essencial (Prioridade Máxima)</SelectItem>
                <SelectItem value="recomendado">Recomendado</SelectItem>
                <SelectItem value="complementar">Complementar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resumo Rápido */}
          <div className="flex items-center gap-2 justify-start sm:justify-end text-xs text-gray-500 font-medium">
            <Badge
              variant="outline"
              className="text-[11px] bg-red-50 text-red-700 border-red-200 gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {estatisticasGerais.essenciais} essenciais
            </Badge>
            <Badge
              variant="outline"
              className="text-[11px] bg-amber-50 text-amber-800 border-amber-200 gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {estatisticasGerais.recomendados} recomendados
            </Badge>
            <Badge
              variant="outline"
              className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {estatisticasGerais.complementares} compl.
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid de Cards dos Departamentos */}
      {carregando ? (
        <div className="py-20 text-center text-xs text-gray-400 space-y-2">
          <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Carregando departamentos e grade de cursos...</p>
        </div>
      ) : setoresFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Nenhum departamento disponível</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Não há departamentos cadastrados ou você não tem permissão para visualizar o setor
            especificado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {setoresFiltrados.map((setor) => {
            const cursosDoSetor = cursosPorSetor.get(setor.id) || []
            const corDestaque = setor.cor || '#4F46E5'

            return (
              <Card
                key={setor.id}
                className="border border-gray-200/90 shadow-2xs hover:shadow-sm transition-all overflow-hidden flex flex-col justify-between bg-white"
              >
                {/* Header do Card do Departamento */}
                <CardHeader
                  className="pb-3 border-b border-gray-100"
                  style={{
                    borderTop: `4px solid ${corDestaque}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs"
                        style={{ backgroundColor: corDestaque }}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold text-gray-900 truncate">
                            {setor.nome}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-semibold bg-gray-50 text-gray-600 border-gray-200"
                          >
                            {cursosDoSetor.length} {cursosDoSetor.length === 1 ? 'curso' : 'cursos'}
                          </Badge>
                        </div>
                        {setor.descricao && (
                          <CardDescription className="text-[11px] text-gray-500 truncate mt-0.5">
                            {setor.descricao}
                          </CardDescription>
                        )}
                      </div>
                    </div>

                    {podeEscrever && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => abrirDialogCriar(setor.id)}
                        className="h-7 text-[11px] text-brand-700 border-brand-200 hover:bg-brand-50 shrink-0 gap-1 font-semibold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Adicionar Curso</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {/* Conteúdo: Lista de Cursos do Departamento */}
                <CardContent className="p-4 flex-1">
                  {cursosDoSetor.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-6 space-y-2">
                      <BookOpen className="w-6 h-6 text-gray-300 mx-auto" />
                      <p className="text-xs text-gray-500 font-medium">
                        Nenhum curso pontuado para este departamento ainda.
                      </p>
                      {podeEscrever && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirDialogCriar(setor.id)}
                          className="text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50 font-semibold h-7"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Adicionar primeiro curso para {setor.nome}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cursosDoSetor.map((c) => {
                        const nivelInfo = NIVEIS_CURSO_INFO[c.nivel]

                        return (
                          <div
                            key={c.id}
                            className="group p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-slate-50/50 transition-all space-y-2 bg-white"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-gray-900 group-hover:text-brand-700 transition-colors">
                                    {c.titulo}
                                  </span>

                                  {/* Badge de Nível de Relevância */}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-2 py-0.2 rounded-full inline-flex items-center gap-1 ${nivelInfo.badgeClass}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${nivelInfo.dotClass}`}
                                    />
                                    {nivelInfo.label}
                                  </Badge>

                                  {c.ativo === false && (
                                    <Badge className="text-[10px] bg-gray-200 text-gray-700 border-gray-300">
                                      Inativo
                                    </Badge>
                                  )}
                                </div>

                                {c.descricao && (
                                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                    {c.descricao}
                                  </p>
                                )}
                              </div>

                              {/* Ações (RH/Admin ou Acessar Link) */}
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={c.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors border border-brand-200"
                                  title="Abrir link do curso em nova aba"
                                >
                                  <span>Acessar</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>

                                {podeEscrever && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => abrirDialogEditar(c)}
                                      className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                      title="Editar Curso"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setCursoParaExcluir(c)
                                        setDeleteDialogOpen(true)
                                      }}
                                      className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                      title="Excluir Curso"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog Criação / Edição de Curso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSalvar}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">
                {editandoCurso ? 'Editar Curso da Grade' : 'Cadastrar Novo Curso na Grade'}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Defina o título, link de acesso, nível de relevância e o departamento ao qual o
                treinamento pertence.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Título */}
              <div className="space-y-1.5">
                <Label htmlFor="titulo" className="text-xs font-semibold text-gray-700">
                  Título do Curso / Treinamento <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="titulo"
                  required
                  placeholder="Ex: Administração de Servidores Linux & Firewalls"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Link */}
              <div className="space-y-1.5">
                <Label htmlFor="link" className="text-xs font-semibold text-gray-700">
                  Link de Acesso (URL) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="link"
                    required
                    type="url"
                    placeholder="https://exemplo.com.br/curso-linux"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>
              </div>

              {/* Departamento & Nível (em 2 colunas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Departamento */}
                <div className="space-y-1.5">
                  <Label htmlFor="setor" className="text-xs font-semibold text-gray-700">
                    Departamento <span className="text-red-500">*</span>
                  </Label>
                  <Select value={setorId} onValueChange={setSetorId}>
                    <SelectTrigger id="setor" className="text-xs h-9">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nível de Relevância */}
                <div className="space-y-1.5">
                  <Label htmlFor="nivel" className="text-xs font-semibold text-gray-700">
                    Nível de Relevância <span className="text-red-500">*</span>
                  </Label>
                  <Select value={nivel} onValueChange={(val: NivelCurso) => setNivel(val)}>
                    <SelectTrigger id="nivel" className="text-xs h-9">
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essencial">🔴 Essencial (Obrigatório / Base)</SelectItem>
                      <SelectItem value="recomendado">🟡 Recomendado (Importante)</SelectItem>
                      <SelectItem value="complementar">🔵 Complementar (Opcional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <Label htmlFor="descricao" className="text-xs font-semibold text-gray-700">
                  Descrição / Conteúdo Programático
                </Label>
                <Textarea
                  id="descricao"
                  rows={3}
                  placeholder="Explique os tópicos abordados, público-alvo ou pré-requisitos..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <Label htmlFor="ativo" className="text-xs text-gray-700 cursor-pointer">
                  Curso ativo e disponível para recomendação
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                {salvando ? 'Salvando...' : editandoCurso ? 'Salvar Alterações' : 'Cadastrar Curso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              Excluir Curso da Grade?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500">
              Tem certeza que deseja remover o curso <strong>"{cursoParaExcluir?.titulo}"</strong>?
              Esta ação é irreversível e será registrada nos logs de auditoria.
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
    </div>
  )
}
