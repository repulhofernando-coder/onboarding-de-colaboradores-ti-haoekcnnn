import pb from '@/lib/pocketbase/client'
import type { Onboarding, FeriasConcessaoModel, TipoConcessaoFerias } from '@/types/onboarding'
import { formatShortDate } from '@/lib/dateUtils'

export type FeriasStatus = 'em_dia' | 'vencendo' | 'vencido' | 'sem_admissao'

export interface FeriasCalculoInfo {
  dataAdmissao: string | null
  dataVencimento: string | null
  vencimentoFormatado: string
  status: FeriasStatus
  diasRestantes: number | null
  labelBadge: string
  corDot: string
  corBg: string
  corBorder: string
  corTexto: string
  iconeCor: string
  descricao: string
}

/**
 * Calcula a data de vencimento de férias (admissão ou última concessão + 12 meses / 1 ano).
 * Preserva o mesmo dia do mês; se o ano seguinte não tiver o dia (ex: 29 de fev), ajusta para o último dia do mês.
 */
export function calcularVencimentoFerias(dataBaseIsoOuYmd: string): string {
  if (!dataBaseIsoOuYmd) return ''
  const limpo = dataBaseIsoOuYmd.slice(0, 10)
  const partes = limpo.split('-').map(Number)
  if (partes.length < 3 || isNaN(partes[0]) || isNaN(partes[1]) || isNaN(partes[2])) {
    return ''
  }
  const [ano, mes, dia] = partes
  const novoAno = ano + 1
  // Tratamento seguro para bissexto: se dia 29 de fevereiro for para ano comum, cai no dia 28
  const ultimoDiaNovoMes = new Date(Date.UTC(novoAno, mes, 0)).getUTCDate()
  const diaFinal = Math.min(dia, ultimoDiaNovoMes)

  const mesStr = String(mes).padStart(2, '0')
  const diaStr = String(diaFinal).padStart(2, '0')
  return `${novoAno}-${mesStr}-${diaStr}`
}

/**
 * Determina o status de férias segundo a regra de negócio fechada:
 * - 🟢 em dia: faltam mais de 30 dias para o vencimento
 * - 🟡 vence nos próximos 30 dias: faltam entre 0 e 30 dias (inclusive)
 * - 🔴 vencido: data de vencimento no passado (< 0 dias)
 */
export function avaliarStatusFerias(
  onboarding: Pick<Onboarding, 'data_admissao' | 'ferias_vencimento' | 'data_inicio'>,
  ultimaConcessao?: Pick<FeriasConcessaoModel, 'data_inicio'> | null,
): FeriasCalculoInfo {
  const admissao = onboarding.data_admissao || onboarding.data_inicio || null

  // Se houver concessão recente de férias, ela reinicia o ciclo aquisitivo (12 meses a partir do início das férias)
  let vencimento = onboarding.ferias_vencimento ? onboarding.ferias_vencimento.slice(0, 10) : null

  if (ultimaConcessao?.data_inicio) {
    vencimento = calcularVencimentoFerias(ultimaConcessao.data_inicio)
  } else if (!vencimento && admissao) {
    vencimento = calcularVencimentoFerias(admissao)
  }

  if (!admissao || !vencimento) {
    return {
      dataAdmissao: admissao ? admissao.slice(0, 10) : null,
      dataVencimento: null,
      vencimentoFormatado: 'Não informado',
      status: 'sem_admissao',
      diasRestantes: null,
      labelBadge: 'Sem admissão',
      corDot: 'bg-gray-400',
      corBg: 'bg-gray-50 text-gray-600 border-gray-200',
      corBorder: 'border-gray-300',
      corTexto: 'text-gray-600',
      iconeCor: 'text-gray-400',
      descricao: 'Data de contratação/admissão ainda não cadastrada.',
    }
  }

  // Compara vencimento com a data de "hoje" à meia-noite (UTC / data local)
  const hoje = new Date()
  const hojeAno = hoje.getFullYear()
  const hojeMes = hoje.getMonth()
  const hojeDia = hoje.getDate()
  const dataHojeUtc = new Date(Date.UTC(hojeAno, hojeMes, hojeDia))

  const [vAno, vMes, vDia] = vencimento.split('-').map(Number)
  const dataVencUtc = new Date(Date.UTC(vAno, vMes - 1, vDia))

  const diffMs = dataVencUtc.getTime() - dataHojeUtc.getTime()
  const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24))

  const vencimentoFormatado = formatShortDate(vencimento)

  if (diasRestantes < 0) {
    const diasAtraso = Math.abs(diasRestantes)
    return {
      dataAdmissao: admissao.slice(0, 10),
      dataVencimento: vencimento,
      vencimentoFormatado,
      status: 'vencido',
      diasRestantes,
      labelBadge: `Vencido há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}`,
      corDot: 'bg-red-500',
      corBg: 'bg-red-50 text-red-700 border-red-200',
      corBorder: 'border-red-400',
      corTexto: 'text-red-700',
      iconeCor: 'text-red-600',
      descricao: `Férias venceram em ${vencimentoFormatado}. Concessão imediata necessária.`,
    }
  }

  if (diasRestantes <= 30) {
    return {
      dataAdmissao: admissao.slice(0, 10),
      dataVencimento: vencimento,
      vencimentoFormatado,
      status: 'vencendo',
      diasRestantes,
      labelBadge:
        diasRestantes === 0
          ? 'Vence hoje'
          : `Vence em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`,
      corDot: 'bg-amber-500',
      corBg: 'bg-amber-50 text-amber-800 border-amber-200',
      corBorder: 'border-amber-400',
      corTexto: 'text-amber-800',
      iconeCor: 'text-amber-600',
      descricao: `Férias vencem em ${vencimentoFormatado} (dentro dos próximos 30 dias).`,
    }
  }

  return {
    dataAdmissao: admissao.slice(0, 10),
    dataVencimento: vencimento,
    vencimentoFormatado,
    status: 'em_dia',
    diasRestantes,
    labelBadge: `Em dia • Vence em ${vencimentoFormatado}`,
    corDot: 'bg-emerald-500',
    corBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corBorder: 'border-emerald-300',
    corTexto: 'text-emerald-700',
    iconeCor: 'text-emerald-600',
    descricao: `Férias em dia. Vencem em ${vencimentoFormatado} (${diasRestantes} dias restantes).`,
  }
}

export const feriasService = {
  /**
   * Lista todas as concessões de férias de um colaborador (onboarding_id ou lista de ids).
   */
  async listByOnboarding(onboardingId: string): Promise<FeriasConcessaoModel[]> {
    if (!onboardingId) return []
    try {
      return await pb.collection('ferias_concessoes').getFullList<FeriasConcessaoModel>({
        filter: `onboarding = '${onboardingId}'`,
        sort: '-data_inicio',
        expand: 'registrado_por,onboarding',
      })
    } catch (err) {
      console.error('[feriasService] listByOnboarding erro:', err)
      return []
    }
  },

  /**
   * Lista todas as concessões de férias do sistema (usado para agregar histórico por pessoa).
   */
  async listAll(): Promise<FeriasConcessaoModel[]> {
    try {
      return await pb.collection('ferias_concessoes').getFullList<FeriasConcessaoModel>({
        sort: '-data_inicio',
        expand: 'registrado_por,onboarding',
      })
    } catch (err) {
      console.error('[feriasService] listAll erro:', err)
      return []
    }
  },

  /**
   * Atualiza a Data de Contratação (Admissão) do colaborador.
   * Restrito a RH e Admin (validado no componente e no backend).
   * O sistema recalcula automaticamente o vencimento de férias (admissão + 12 meses)
   * caso o colaborador não possua concessões posteriores, ou mantém a lógica vigente.
   * Registra a alteração em logs_auditoria.
   */
  async atualizarDataAdmissao(params: {
    onboardingId: string
    colaboradorNome: string
    novaDataAdmissao: string // YYYY-MM-DD
    autorId: string
    autorNome: string
    autorRole: string
  }): Promise<Onboarding> {
    const dataYmd = params.novaDataAdmissao.slice(0, 10)
    const onbAtual = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)
    const antigaAdmissao = onbAtual.data_admissao
      ? onbAtual.data_admissao.slice(0, 10)
      : onbAtual.data_inicio?.slice(0, 10) || '(não definida)'

    // Verifica se já existem concessões registradas
    const concessoes = await this.listByOnboarding(params.onboardingId)
    let novoVencimento: string

    if (concessoes.length > 0) {
      // Ciclo atual baseado na concessão mais recente
      novoVencimento = calcularVencimentoFerias(concessoes[0].data_inicio)
    } else {
      // Ciclo inicial: 12 meses a partir da nova admissão
      novoVencimento = calcularVencimentoFerias(dataYmd)
    }

    const atualizado = await pb.collection('onboardings').update<Onboarding>(params.onboardingId, {
      data_admissao: dataYmd,
      ferias_vencimento: novoVencimento,
    })

    // Registrar auditoria
    try {
      await pb.collection('logs_auditoria').create({
        onboarding_id: params.onboardingId,
        colaborador_nome: params.colaboradorNome,
        usuario_id: params.autorId || null,
        usuario_nome: params.autorNome,
        usuario_role: params.autorRole,
        acao: 'Alteração da Data de Admissão',
        detalhes: `Data de admissão alterada de "${formatShortDate(antigaAdmissao)}" para "${formatShortDate(dataYmd)}" por ${params.autorNome} (${params.autorRole.toUpperCase()}). Novo vencimento de férias calculado: ${formatShortDate(novoVencimento)}.`,
        fora_prazo: false,
        destaque_prazo: '',
        metadata: {
          tipo: 'admissao_alterada',
          data_admissao_anterior: antigaAdmissao,
          data_admissao_nova: dataYmd,
          ferias_vencimento_novo: novoVencimento,
        },
      })
    } catch (errAudit) {
      console.warn('[feriasService] Erro ao registrar auditoria de admissão:', errAudit)
    }

    return atualizado
  },

  /**
   * Registra a CONCESSÃO de férias tiradas pelo colaborador.
   * - data_inicio: início do gozo
   * - tipo: 'integral' | 'fracionada'
   * - REINICIA o ciclo: novo vencimento = 12 meses após a data de início da concessão
   * - Atualiza onboarding.ferias_vencimento
   * - Grava registro na coleção ferias_concessoes
   * - Alimenta logs_auditoria e a Trajetória
   */
  async registrarConcessao(params: {
    onboardingId: string
    colaboradorNome: string
    colaboradorSetor?: string
    dataInicio: string // YYYY-MM-DD
    tipo: TipoConcessaoFerias
    observacao?: string
    autorId: string
    autorNome: string
    autorRole: string
  }): Promise<{ concessao: FeriasConcessaoModel; onboarding: Onboarding; novoVencimento: string }> {
    const dataInicioYmd = params.dataInicio.slice(0, 10)
    const novoVencimento = calcularVencimentoFerias(dataInicioYmd)

    // 1. Cria o registro na coleção ferias_concessoes
    const concessao = await pb.collection('ferias_concessoes').create<FeriasConcessaoModel>({
      onboarding: params.onboardingId,
      colaborador_setor: params.colaboradorSetor || '',
      data_inicio: dataInicioYmd,
      tipo: params.tipo,
      registrado_por: params.autorId || null,
      registrado_por_nome: params.autorNome,
      observacao: params.observacao?.trim() || '',
    })

    // 2. Reinicia o ciclo no onboarding: novo vencimento = 12 meses após o início das férias
    const onboardingAtualizado = await pb
      .collection('onboardings')
      .update<Onboarding>(params.onboardingId, {
        ferias_vencimento: novoVencimento,
      })

    // 3. Registrar na auditoria oficial (logs_auditoria)
    const tipoLabel = params.tipo === 'integral' ? 'Integral (30 dias)' : 'Fracionada'
    try {
      await pb.collection('logs_auditoria').create({
        onboarding_id: params.onboardingId,
        colaborador_nome: params.colaboradorNome,
        usuario_id: params.autorId || null,
        usuario_nome: params.autorNome,
        usuario_role: params.autorRole,
        acao: 'Concessão de Férias',
        detalhes: `Concessão de férias (${tipoLabel}) iniciada em ${formatShortDate(dataInicioYmd)} registrada por ${params.autorNome} (${params.autorRole.toUpperCase()}). Ciclo aquisitivo reiniciado — próximo vencimento: ${formatShortDate(novoVencimento)}.${params.observacao ? ` Obs: ${params.observacao}` : ''}`,
        fora_prazo: false,
        destaque_prazo: '',
        metadata: {
          concessao_id: concessao.id,
          tipo: params.tipo,
          data_inicio: dataInicioYmd,
          novo_vencimento: novoVencimento,
          observacao: params.observacao || '',
        },
      })
    } catch (errAudit) {
      console.warn('[feriasService] Erro ao registrar auditoria de concessao de férias:', errAudit)
    }

    return {
      concessao,
      onboarding: onboardingAtualizado,
      novoVencimento,
    }
  },

  /**
   * Exclui um registro de concessão de férias (caso lançado por engano por RH/Admin)
   * e recalcula o vencimento de férias para o estado anterior.
   */
  async excluirConcessao(params: {
    concessaoId: string
    onboardingId: string
    colaboradorNome: string
    autorId: string
    autorNome: string
    autorRole: string
  }): Promise<Onboarding> {
    await pb.collection('ferias_concessoes').delete(params.concessaoId)

    // Recalcula o vencimento após remoção: concessão mais recente restante ou admissão original
    const restantes = await this.listByOnboarding(params.onboardingId)
    const onb = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)

    let novoVencimento: string
    if (restantes.length > 0) {
      novoVencimento = calcularVencimentoFerias(restantes[0].data_inicio)
    } else {
      const base = onb.data_admissao || onb.data_inicio
      novoVencimento = calcularVencimentoFerias(base)
    }

    const atualizado = await pb.collection('onboardings').update<Onboarding>(params.onboardingId, {
      ferias_vencimento: novoVencimento,
    })

    try {
      await pb.collection('logs_auditoria').create({
        onboarding_id: params.onboardingId,
        colaborador_nome: params.colaboradorNome,
        usuario_id: params.autorId || null,
        usuario_nome: params.autorNome,
        usuario_role: params.autorRole,
        acao: 'Exclusão de Concessão de Férias',
        detalhes: `Registro de concessão de férias removido por ${params.autorNome} (${params.autorRole.toUpperCase()}). Vencimento recalculado para ${formatShortDate(novoVencimento)}.`,
        fora_prazo: false,
        destaque_prazo: '',
        metadata: {
          concessao_excluida_id: params.concessaoId,
          novo_vencimento: novoVencimento,
        },
      })
    } catch (errAudit) {
      console.warn('[feriasService] Erro ao auditar exclusão de concessão:', errAudit)
    }

    return atualizado
  },
}
