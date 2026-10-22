import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Palmtree,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Plus,
  Trash2,
  Lock,
  Edit2,
  Info,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatShortDate, formatDateTime } from '@/lib/dateUtils'
import {
  feriasService,
  avaliarStatusFerias,
  calcularVencimentoFerias,
  type FeriasCalculoInfo,
} from '@/services/ferias'
import type { Onboarding, FeriasConcessaoModel, TipoConcessaoFerias } from '@/types/onboarding'
import { toast } from 'sonner'

export interface SecaoFeriasProps {
  onboarding: Onboarding
  todosOnboardings: Onboarding[]
  onFeriasAlterada?: () => void
}

export function SecaoFerias({ onboarding, todosOnboardings, onFeriasAlterada }: SecaoFeriasProps) {
  const { user, isAdmin, isRH } = useAuth()
  const podeGerenciar = isAdmin || isRH // Somente RH e Admin

  const [concessoes, setConcessoes] = useState<FeriasConcessaoModel[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Concessão de Férias
  const [modalConcessaoAberto, setModalConcessaoAberto] = useState(false)
  const [dataInicioConcessao, setDataInicioConcessao] = useState('')
  const [tipoConcessao, setTipoConcessao] = useState<TipoConcessaoFerias>('integral')
  const [obsConcessao, setObsConcessao] = useState('')
  const [salvandoConcessao, setSalvandoConcessao] = useState(false)

  // Modal de Edição da Data de Admissão
  const [modalAdmissaoAberto, setModalAdmissaoAberto] = useState(false)
  const [novaDataAdmissao, setNovaDataAdmissao] = useState('')
  const [salvandoAdmissao, setSalvandoAdmissao] = useState(false)

  // Carrega histórico de concessões
  const carregarConcessoes = async () => {
    try {
      setLoading(true)
      const lista = await feriasService.listByOnboarding(onboarding.id)
      setConcessoes(lista)
    } catch (err) {
      console.error('[SecaoFerias] Erro ao carregar concessões:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarConcessoes()
  }, [onboarding.id])

  // Avaliação de status atual do colaborador
  const infoFerias: FeriasCalculoInfo = useMemo(() => {
    const ultima = concessoes.length > 0 ? concessoes[0] : null
    return avaliarStatusFerias(onboarding, ultima)
  }, [onboarding, concessoes])

  const dataAdmissaoEfetiva = onboarding.data_admissao || onboarding.data_inicio || ''

  // Abrir modal de admissão com valor pré-carregado
  const handleAbrirModalAdmissao = () => {
    setNovaDataAdmissao(dataAdmissaoEfetiva.slice(0, 10))
    setModalAdmissaoAberto(true)
  }

  // Salvar nova data de admissão
  const handleSalvarAdmissao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaDataAdmissao) {
      toast.error('Informe a data de contratação/admissão.')
      return
    }
    setSalvandoAdmissao(true)
    try {
      await feriasService.atualizarDataAdmissao({
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        novaDataAdmissao,
        autorId: user?.id || '',
        autorNome: user?.name || user?.email || 'RH',
        autorRole: user?.role || 'rh',
      })
      toast.success(
        `Data de admissão atualizada para ${formatShortDate(novaDataAdmissao)}. Vencimento de férias recalculado!`,
      )
      setModalAdmissaoAberto(false)
      onFeriasAlterada?.()
    } catch (err: any) {
      console.error('[SecaoFerias] Erro ao atualizar admissão:', err)
      toast.error(err?.message || 'Erro ao atualizar data de admissão.')
    } finally {
      setSalvandoAdmissao(false)
    }
  }

  // Abrir modal de concessão
  const handleAbrirModalConcessao = () => {
    const hojeYmd = new Date().toISOString().slice(0, 10)
    setDataInicioConcessao(hojeYmd)
    setTipoConcessao('integral')
    setObsConcessao('')
    setModalConcessaoAberto(true)
  }

  // Salvar concessão de férias
  const handleSalvarConcessao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dataInicioConcessao) {
      toast.error('Informe a data de início das férias.')
      return
    }
    setSalvandoConcessao(true)
    try {
      const res = await feriasService.registrarConcessao({
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        colaboradorSetor: onboarding.setor || '',
        dataInicio: dataInicioConcessao,
        tipo: tipoConcessao,
        observacao: obsConcessao,
        autorId: user?.id || '',
        autorNome: user?.name || user?.email || 'RH',
        autorRole: user?.role || 'rh',
      })

      toast.success(
        `Concessão registrada! Novo vencimento de férias calculado: ${formatShortDate(res.novoVencimento)}.`,
      )
      setModalConcessaoAberto(false)
      carregarConcessoes()
      onFeriasAlterada?.()
    } catch (err: any) {
      console.error('[SecaoFerias] Erro ao registrar concessão:', err)
      toast.error(err?.message || 'Erro ao registrar concessão de férias.')
    } finally {
      setSalvandoConcessao(false)
    }
  }

  // Excluir concessão (em caso de engano)
  const handleExcluirConcessao = async (concessaoId: string) => {
    if (
      !window.confirm(
        'Tem certeza que deseja remover este registro de concessão de férias? O ciclo aquisitivo será recalculado.',
      )
    ) {
      return
    }
    try {
      await feriasService.excluirConcessao({
        concessaoId,
        onboardingId: onboarding.id,
        colaboradorNome: onboarding.colaborador_nome,
        autorId: user?.id || '',
        autorNome: user?.name || user?.email || 'RH',
        autorRole: user?.role || 'rh',
      })
      toast.success('Registro de concessão removido e vencimento recalculado.')
      carregarConcessoes()
      onFeriasAlterada?.()
    } catch (err: any) {
      console.error('[SecaoFerias] Erro ao excluir concessão:', err)
      toast.error('Erro ao excluir concessão.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Card Principal: Situação Aquisitiva & Vencimento Calculado */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                infoFerias.status === 'vencido'
                  ? 'bg-red-100 text-red-700'
                  : infoFerias.status === 'vencendo'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Palmtree className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-gray-900">
                  Data de Contratação & Vencimento de Férias
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${infoFerias.corBg} ${infoFerias.corBorder}`}
                >
                  <span className={`w-2 h-2 rounded-full ${infoFerias.corDot}`} />
                  {infoFerias.labelBadge}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Acompanhamento do período aquisitivo de 12 meses conforme normas da CLT.
              </p>
            </div>
          </div>

          {/* Botões de Ação para RH e Admin */}
          {podeGerenciar ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAbrirModalAdmissao}
                className="h-9 text-xs font-semibold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 border-gray-300 rounded-lg gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Alterar Admissão</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleAbrirModalConcessao}
                className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar concessão de férias</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span>Gestão do Setor: Apenas visualização</span>
            </div>
          )}
        </div>

        {/* Grade de Informações Chave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Data de Admissão */}
          <div className="p-4 rounded-xl border border-gray-200 bg-slate-50/60 space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Data de Contratação (Admissão)
            </span>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-xl font-black text-gray-900">
                {formatShortDate(dataAdmissaoEfetiva) || 'Não definida'}
              </span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-500 pt-1">
              Cadastrada na ficha da pessoa técnica.{' '}
              {podeGerenciar ? 'Editável por RH/Admin.' : 'Visível para a Gestão.'}
            </p>
          </div>

          {/* 2. Vencimento Calculado */}
          <div
            className={`p-4 rounded-xl border space-y-1 ${
              infoFerias.status === 'vencido'
                ? 'bg-red-50/70 border-red-200'
                : infoFerias.status === 'vencendo'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-emerald-50/60 border-emerald-200'
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wider block text-gray-700">
              Férias vencem em
            </span>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span
                className={`text-xl font-black ${
                  infoFerias.status === 'vencido'
                    ? 'text-red-700'
                    : infoFerias.status === 'vencendo'
                      ? 'text-amber-800'
                      : 'text-emerald-800'
                }`}
              >
                {infoFerias.vencimentoFormatado}
              </span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-600 pt-1">
              <strong>Calculado automaticamente</strong> (12 meses após a admissão ou última
              concessão).
            </p>
          </div>

          {/* 3. Situação do Período Aquisitivo */}
          <div className="p-4 rounded-xl border border-gray-200 bg-slate-50/60 space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Sinalização do Período
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span className={`w-3 h-3 rounded-full ${infoFerias.corDot}`} />
              <span className={`text-base font-bold ${infoFerias.corTexto}`}>
                {infoFerias.status === 'vencido' && '🔴 Vencido'}
                {infoFerias.status === 'vencendo' && '🟡 Vence em até 30 dias'}
                {infoFerias.status === 'em_dia' && '🟢 Em dia (> 30 dias)'}
                {infoFerias.status === 'sem_admissao' && '⚪ Sem admissão'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 pt-1">
              {infoFerias.diasRestantes !== null
                ? infoFerias.diasRestantes < 0
                  ? `Vencido há ${Math.abs(infoFerias.diasRestantes)} dias.`
                  : `Faltam ${infoFerias.diasRestantes} dias para o limite aquisitivo.`
                : 'Defina a admissão para iniciar o ciclo.'}
            </p>
          </div>
        </div>

        {/* Alerta de urgência caso esteja vencido ou vencendo */}
        {infoFerias.status === 'vencido' && (
          <Alert className="border-red-300 bg-red-50 text-red-900">
            <Flame className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Atenção:</strong> As férias deste colaborador estão{' '}
              <strong>vencidas desde {infoFerias.vencimentoFormatado}</strong>. O RH deve formalizar
              a concessão imediata para evitar pagamento em dobro previsto no Art. 137 da CLT.
            </AlertDescription>
          </Alert>
        )}

        {infoFerias.status === 'vencendo' && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Alerta:</strong> As férias vencerão em{' '}
              <strong>
                {infoFerias.diasRestantes} dias ({infoFerias.vencimentoFormatado})
              </strong>
              . Recomenda-se alinhar com o gestor e com o técnico a programação das datas de
              descanso.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Histórico de Concessões de Férias */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-emerald-600" />
              <span>Histórico de Concessões de Férias</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Registros de férias gozadas pelo técnico. Cada concessão reinicia o ciclo aquisitivo
              por 12 meses.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 self-start sm:self-center">
            Total: {concessoes.length} {concessoes.length === 1 ? 'concessão' : 'concessões'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
            Carregando histórico de férias...
          </div>
        ) : concessoes.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 bg-slate-50/50 rounded-xl border border-dashed border-gray-200">
            <Palmtree className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-600">
              Nenhuma concessão de férias registrada ainda.
            </p>
            <p className="mt-1 text-gray-400">
              O ciclo aquisitivo está contando a partir da admissão (
              {formatShortDate(dataAdmissaoEfetiva)}).
            </p>
            {podeGerenciar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAbrirModalConcessao}
                className="mt-3 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar primeira concessão
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
            {concessoes.map((item, index) => {
              const isIntegral = item.tipo === 'integral'
              const novoVenc = calcularVencimentoFerias(item.data_inicio)

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-900">
                        Início em {formatShortDate(item.data_inicio)}
                      </span>

                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${
                          isIntegral
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isIntegral ? 'Férias Integrais (30d)' : 'Férias Fracionadas'}
                      </Badge>

                      {index === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          Ciclo Vigente
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>
                        Próximo vencimento gerado:{' '}
                        <strong className="text-gray-800">{formatShortDate(novoVenc)}</strong>
                      </p>
                      {item.observacao && (
                        <p className="text-gray-500 italic bg-gray-50 p-1.5 rounded border border-gray-200/80 text-[11px]">
                          &quot;{item.observacao}&quot;
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center gap-2 pt-0.5">
                      <span>
                        Registrado por <strong>{item.registrado_por_nome || 'RH/Admin'}</strong>
                      </span>
                      <span>•</span>
                      <span>{formatDateTime(item.created)}</span>
                    </div>
                  </div>

                  {podeGerenciar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExcluirConcessao(item.id)}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 px-2 text-xs shrink-0"
                      title="Excluir este lançamento de concessão de férias"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Registrar Concessão de Férias */}
      <Dialog open={modalConcessaoAberto} onOpenChange={setModalConcessaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Palmtree className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Registrar Concessão de Férias
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {onboarding.colaborador_nome} • {onboarding.cargo || 'TI'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvarConcessao} className="space-y-4 py-2">
            {/* Data de Início das Férias */}
            <div className="space-y-1.5">
              <Label htmlFor="ferias-data-inicio" className="text-xs font-semibold text-gray-700">
                Data de Início das Férias <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ferias-data-inicio"
                type="date"
                required
                value={dataInicioConcessao}
                onChange={(e) => setDataInicioConcessao(e.target.value)}
                disabled={salvandoConcessao}
                className="text-sm"
              />
              <p className="text-[11px] text-gray-500">
                Data em que o colaborador entra em gozo de descanso.
              </p>
            </div>

            {/* Tipo de Concessão: Integral ou Fracionada */}
            <div className="space-y-1.5">
              <Label htmlFor="ferias-tipo" className="text-xs font-semibold text-gray-700">
                Modalidade de Gozo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={tipoConcessao}
                onValueChange={(val) => setTipoConcessao(val as TipoConcessaoFerias)}
                disabled={salvandoConcessao}
              >
                <SelectTrigger id="ferias-tipo" className="text-sm">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="integral">Integral (30 dias de descanso)</SelectItem>
                  <SelectItem value="fracionada">Fracionada (em períodos menores)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="ferias-obs" className="text-xs font-semibold text-gray-700">
                Observações / Período (opcional)
              </Label>
              <Textarea
                id="ferias-obs"
                rows={2}
                value={obsConcessao}
                onChange={(e) => setObsConcessao(e.target.value)}
                placeholder="Ex: 1º período fracionado de 15 dias; abono pecuniário de 10 dias, etc."
                disabled={salvandoConcessao}
                className="text-xs resize-none"
              />
            </div>

            {/* Prévia do cálculo do novo ciclo */}
            {dataInicioConcessao && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Reinício do Ciclo Aquisitivo (Regra Fechada)</span>
                </div>
                <p>
                  O novo vencimento das férias será calculado automaticamente para:{' '}
                  <strong>{formatShortDate(calcularVencimentoFerias(dataInicioConcessao))}</strong>{' '}
                  (12 meses após a data de início registrada).
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalConcessaoAberto(false)}
                disabled={salvandoConcessao}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoConcessao}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {salvandoConcessao ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar Concessão'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Alterar Data de Admissão */}
      <Dialog open={modalAdmissaoAberto} onOpenChange={setModalAdmissaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Alterar Data de Contratação (Admissão)
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {onboarding.colaborador_nome} • Exclusivo RH e Admin
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvarAdmissao} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nova-admissao-input" className="text-xs font-semibold text-gray-700">
                Data Oficial de Admissão <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nova-admissao-input"
                type="date"
                required
                value={novaDataAdmissao}
                onChange={(e) => setNovaDataAdmissao(e.target.value)}
                disabled={salvandoAdmissao}
                className="text-sm"
              />
            </div>

            {novaDataAdmissao && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                <p>
                  <strong>Novo vencimento aquisitivo previsto:</strong>{' '}
                  <span className="font-bold text-gray-900">
                    {formatShortDate(calcularVencimentoFerias(novaDataAdmissao))}
                  </span>
                </p>
                <p className="text-[11px] text-gray-500">
                  O vencimento nunca é digitado manualmente, garantindo a integridade dos 12 meses
                  do período aquisitivo.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalAdmissaoAberto(false)}
                disabled={salvandoAdmissao}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoAdmissao}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                {salvandoAdmissao ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Data de Admissão'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
