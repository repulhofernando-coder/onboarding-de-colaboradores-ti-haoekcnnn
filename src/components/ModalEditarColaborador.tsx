import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, UserCog, AlertCircle, BookOpen, Palmtree, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import {
  onboardingService,
  userService,
  setorService,
  questionarioService,
} from '@/services/onboarding'
import { calcularVencimentoFerias } from '@/services/ferias'
import { formatShortDate } from '@/lib/dateUtils'
import pb from '@/lib/pocketbase/client'
import type { Onboarding, User, SetorModel, Questionario } from '@/types/onboarding'

export interface ModalEditarColaboradorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onboarding: Onboarding
  onSucesso: (onboardingAtualizado: Onboarding) => void
  onSugerirProvaMudancaSetor?: (info: {
    onboarding: Onboarding
    setorAntigo: string
    setorNovo: string
    questionarioSugerido: Questionario | null
  }) => void
}

export function ModalEditarColaborador({
  open,
  onOpenChange,
  onboarding,
  onSucesso,
  onSugerirProvaMudancaSetor,
}: ModalEditarColaboradorProps) {
  const { user, isAdmin, isRH } = useAuth()
  const podeEditarAdmissao = isAdmin || isRH
  const [cargo, setCargo] = useState(onboarding.cargo || '')
  const [setor, setSetor] = useState(onboarding.setor || '')
  const [gestorId, setGestorId] = useState(onboarding.gestor_id || '')
  const [dataAdmissao, setDataAdmissao] = useState(
    onboarding.data_admissao
      ? onboarding.data_admissao.slice(0, 10)
      : onboarding.data_inicio
        ? onboarding.data_inicio.slice(0, 10)
        : '',
  )

  const [gestores, setGestores] = useState<User[]>([])
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<SetorModel[]>([])
  const [carregandoDados, setCarregandoDados] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Resetar campos ao abrir ou mudar onboarding
  useEffect(() => {
    if (open) {
      setCargo(onboarding.cargo || '')
      setSetor(onboarding.setor || '')
      setGestorId(onboarding.gestor_id || '')
      setDataAdmissao(
        onboarding.data_admissao
          ? onboarding.data_admissao.slice(0, 10)
          : onboarding.data_inicio
            ? onboarding.data_inicio.slice(0, 10)
            : '',
      )
      setErro(null)

      setCarregandoDados(true)
      Promise.all([
        userService.getGestores().catch(() => []),
        setorService.listAtivos().catch(() => []),
      ])
        .then(([listaGestores, listaSetores]: [User[], SetorModel[]]) => {
          setGestores(listaGestores)
          setSetoresDisponiveis(listaSetores)
        })
        .finally(() => setCarregandoDados(false))
    }
  }, [open, onboarding])

  const setorMudou = setor.trim() !== (onboarding.setor || '').trim()

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!cargo.trim()) {
      setErro('O cargo é obrigatório.')
      return
    }
    if (!setor.trim()) {
      setErro('O setor/área é obrigatório.')
      return
    }
    if (!gestorId) {
      setErro('Selecione um gestor responsável.')
      return
    }

    const alteracoes: { campo: string; antigo: string; novo: string }[] = []
    const antigoCargo = onboarding.cargo || ''
    const novoCargo = cargo.trim()
    if (antigoCargo !== novoCargo) {
      alteracoes.push({ campo: 'Cargo', antigo: antigoCargo || '(não definido)', novo: novoCargo })
    }

    const antigoSetor = onboarding.setor || ''
    const novoSetor = setor.trim()
    if (antigoSetor !== novoSetor) {
      alteracoes.push({
        campo: 'Setor / Área',
        antigo: antigoSetor || '(não definido)',
        novo: novoSetor,
      })
    }

    const antigoGestorId = onboarding.gestor_id || ''
    const novoGestorId = gestorId
    if (antigoGestorId !== novoGestorId) {
      const gAntigo =
        gestores.find((g) => g.id === antigoGestorId)?.name || antigoGestorId || '(não definido)'
      const gNovo = gestores.find((g) => g.id === novoGestorId)?.name || novoGestorId
      alteracoes.push({ campo: 'Gestor Responsável', antigo: gAntigo, novo: gNovo })
    }

    const antigaAdmissao = onboarding.data_admissao
      ? onboarding.data_admissao.slice(0, 10)
      : onboarding.data_inicio
        ? onboarding.data_inicio.slice(0, 10)
        : ''
    const novaAdmissao = dataAdmissao ? dataAdmissao.slice(0, 10) : ''
    const admissaoMudou = podeEditarAdmissao && novaAdmissao && antigaAdmissao !== novaAdmissao
    if (admissaoMudou) {
      alteracoes.push({
        campo: 'Data de Admissão',
        antigo: antigaAdmissao ? formatShortDate(antigaAdmissao) : '(não definida)',
        novo: formatShortDate(novaAdmissao),
      })
    }

    if (alteracoes.length === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Nenhum dado foi modificado.',
      })
      onOpenChange(false)
      return
    }

    setSalvando(true)
    try {
      // 1. Atualizar o onboarding no backend
      const payloadUpdate: Partial<Onboarding> = {
        cargo: novoCargo,
        setor: novoSetor,
        gestor_id: novoGestorId,
      }
      if (admissaoMudou) {
        payloadUpdate.data_admissao = novaAdmissao
        payloadUpdate.ferias_vencimento = calcularVencimentoFerias(novaAdmissao)
      }

      const dadosAtualizados = await onboardingService.update(onboarding.id, payloadUpdate)

      // Se admissão mudou, auditar via feriasService para enriquecer detalhes
      if (admissaoMudou) {
        // auditoria de férias já inclusa na lista geral abaixo
      }

      // 2. Registrar no Histórico & Auditoria (logs_auditoria) cada mudança com valor antigo → novo
      const agoraIso = new Date().toISOString()
      const autorNome = user?.name || user?.email || 'Usuário'
      const autorRole = user?.role || 'admin'
      const colabNome = onboarding.colaborador_nome

      const textoMudancas = alteracoes
        .map((a) => `• ${a.campo}: "${a.antigo}" → "${a.novo}"`)
        .join('\n')

      try {
        await pb.collection('logs_auditoria').create({
          onboarding_id: onboarding.id,
          colaborador_nome: colabNome,
          usuario_id: user?.id || null,
          usuario_nome: autorNome,
          usuario_role: autorRole,
          gestor_nome: gestores.find((g) => g.id === novoGestorId)?.name || '',
          acao: 'Edição de Dados do Colaborador',
          detalhes: `Colaborador(a) ${colabNome} atualizado(a) por ${autorNome} (${autorRole.toUpperCase()}):\n${textoMudancas}`,
          fora_prazo: false,
          destaque_prazo: '',
          metadata: {
            alteracoes: alteracoes,
            onboarding_id: onboarding.id,
            colaborador_nome: colabNome,
            cargo_anterior: antigoCargo,
            cargo_novo: novoCargo,
            setor_anterior: antigoSetor,
            setor_novo: novoSetor,
            gestor_anterior_id: antigoGestorId,
            gestor_novo_id: novoGestorId,
            data_edicao: agoraIso,
          },
        })
      } catch (errLog) {
        console.error('[ModalEditarColaborador] Erro ao gravar log de auditoria:', errLog)
      }

      toast({
        title: 'Colaborador atualizado',
        description: 'Os dados foram atualizados e registrados na trilha de auditoria.',
      })

      onSucesso(dadosAtualizados)
      onOpenChange(false)

      // Item 6: Caso especial de mudança de setor
      if (antigoSetor !== novoSetor && onSugerirProvaMudancaSetor) {
        // Buscar questionário do NOVO setor:
        // Prioridade 1: tipo mudanca_area com setor compatível
        // Prioridade 2: tipo onboarding com setor compatível
        let questionarioSugerido: Questionario | null = null
        try {
          const todosQuestionarios = await questionarioService.listAtivos()
          const qMudanca = todosQuestionarios.find(
            (q) =>
              q.tipo_de_uso === 'mudanca_area' &&
              (q.setor === novoSetor ||
                (q.setor && novoSetor.toLowerCase().includes(q.setor.toLowerCase()))),
          )
          if (qMudanca) {
            questionarioSugerido = qMudanca
          } else {
            const qOnb = todosQuestionarios.find(
              (q) =>
                q.tipo_de_uso === 'onboarding' &&
                (q.setor === novoSetor ||
                  (q.setor && novoSetor.toLowerCase().includes(q.setor.toLowerCase()))),
            )
            if (qOnb) {
              questionarioSugerido = qOnb
            }
          }
        } catch (errQ) {
          console.error(
            '[ModalEditarColaborador] Erro ao buscar questionário para novo setor:',
            errQ,
          )
        }

        onSugerirProvaMudancaSetor({
          onboarding: dadosAtualizados,
          setorAntigo: antigoSetor,
          setorNovo: novoSetor,
          questionarioSugerido,
        })
      }
    } catch (err: any) {
      console.error('[ModalEditarColaborador] Erro ao salvar:', err)
      setErro(err?.message || 'Falha ao salvar as alterações do colaborador.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Editar Colaborador
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {onboarding.colaborador_nome} • {onboarding.colaborador_email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSalvar} className="space-y-4 py-2">
          {/* Cargo */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-cargo" className="text-xs font-semibold text-gray-700">
              Cargo / Função <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Analista de Suporte N1"
              required
              disabled={salvando || carregandoDados}
              className="text-sm"
            />
          </div>

          {/* Setor / Área */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-setor" className="text-xs font-semibold text-gray-700">
              Setor / Área <span className="text-red-500">*</span>
            </Label>
            <Select value={setor} onValueChange={setSetor} disabled={salvando || carregandoDados}>
              <SelectTrigger id="edit-setor" className="text-sm">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setoresDisponiveis.map((s) => (
                  <SelectItem key={s.id} value={s.nome}>
                    {s.nome}
                  </SelectItem>
                ))}
                {/* Fallback caso o setor atual não esteja na lista de modelos */}
                {setor && !setoresDisponiveis.some((s) => s.nome === setor) && (
                  <SelectItem value={setor}>{setor}</SelectItem>
                )}
              </SelectContent>
            </Select>

            {setorMudou && (
              <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Mudança de área detectada:</span> Ao salvar, o
                  sistema verificará se há prova específica para o novo setor e sugerirá a aplicação
                  da avaliação.
                </div>
              </div>
            )}
          </div>

          {/* Gestor Responsável */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-gestor" className="text-xs font-semibold text-gray-700">
              Gestor Responsável <span className="text-red-500">*</span>
            </Label>
            <Select
              value={gestorId}
              onValueChange={setGestorId}
              disabled={salvando || carregandoDados}
            >
              <SelectTrigger id="edit-gestor" className="text-sm">
                <SelectValue placeholder="Selecione o gestor" />
              </SelectTrigger>
              <SelectContent>
                {gestores.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} {g.setor ? `(${g.setor})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de Contratação (Admissão) - SOMENTE RH E ADMIN PODEM EDITAR */}
          <div className="space-y-1.5 p-3 rounded-lg border border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="edit-admissao"
                className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5"
              >
                <Palmtree className="w-3.5 h-3.5 text-emerald-700" />
                <span>Data de Contratação (Admissão)</span>
              </Label>
              {!podeEditarAdmissao && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-400" />
                  Somente RH/Admin
                </span>
              )}
            </div>

            <Input
              id="edit-admissao"
              type="date"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
              disabled={!podeEditarAdmissao || salvando || carregandoDados}
              className="text-sm bg-white"
            />

            <div className="text-[11px] text-emerald-800 space-y-0.5 pt-0.5">
              <p>
                <strong>Vencimento de Férias:</strong> Calculado automaticamente pelo sistema como{' '}
                <strong>12 meses após a admissão</strong> (período aquisitivo). Nunca digitável.
              </p>
              {dataAdmissao && (
                <p className="font-semibold text-emerald-900">
                  Novo vencimento previsto:{' '}
                  {formatShortDate(calcularVencimentoFerias(dataAdmissao))}
                </p>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
            <strong>Trilha de Auditoria:</strong> Cada alteração de cargo, setor, gestor ou admissão
            é registrada permanentemente no Histórico & Auditoria com valores anteriores e novos.
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || carregandoDados}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando alterações...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
