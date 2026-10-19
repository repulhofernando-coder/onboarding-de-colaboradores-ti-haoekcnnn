export type Setor = 'windows' | 'linux_rede' | 'datacenter' | 'campo' | 'infraestrutura' | string

export type UserRole = 'admin' | 'rh' | 'gestao'

export type UserSetor = 'RH' | 'Gestão' | string

export type OnboardingStatus =
  | 'novo'
  | 'em_andamento'
  | 'avaliacao_pendente'
  | 'concluido'
  | 'nao_apto'
  | 'em_acompanhamento'

export type CandidatoStatus =
  | 'pre_selecionado'
  | 'prova_enviada'
  | 'prova_concluida'
  | 'aprovado_aguardando_rh'
  | 'aprovado'
  | 'reprovado'
  | 'desistiu'
  | 'convertido'

export type TarefaTipo = 'video' | 'manual'

export type AvaliacaoDecisao = 'apto' | 'nao_apto'

import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name: string
  role?: UserRole
  setor?: UserSetor
  avatar?: string
  ativo?: boolean
  verified?: boolean
  pode_editar_questionarios?: boolean
}

export const ROLES_INFO: Record<
  UserRole,
  {
    nome: string
    descricao: string
    badgeClass: string
  }
> = {
  admin: {
    nome: 'Administrador',
    descricao: 'Acesso total a todas as configurações, usuários e etapas',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  rh: {
    nome: 'RH',
    descricao: 'Cria usuários e onboardings, conduz e conclui a Etapa 1',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  gestao: {
    nome: 'Gestão',
    descricao: 'Acompanha desde a Etapa 1, conduz Etapa 2 e realiza Avaliação Final',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
}

export interface SetorModel extends RecordModel {
  nome: string
  chave?: string
  descricao?: string
  cor?: string
  ativo: boolean
  ordem?: number
}

export interface SetorVisualInfo {
  id?: string
  chave?: string
  nome: string
  cor: string
  corBg: string
  corBorder: string
  descricao: string
  ativo?: boolean
}

export interface MaterialBiblioteca extends RecordModel {
  titulo: string
  tipo: TarefaTipo
  descricao?: string
  arquivo?: string
  setor_origem?: Setor | ''
  setor_ref?: string
  criado_por?: string
  expand?: {
    criado_por?: User
    setor_ref?: SetorModel
  }
}

export interface FaseModelo extends RecordModel {
  titulo: string
  descricao?: string
  ordem?: number
  dias_previstos?: number
  setor_ref?: string
  setor?: string
  etapa?: number
  expand?: {
    setor_ref?: SetorModel
  }
}

export interface FaseConcluidaInfo {
  fase_id: string
  titulo?: string
  concluida_em: string
  concluida_por: string
  concluida_por_nome?: string
  dias_planejados?: number
  dias_gastos?: number
  fora_prazo?: boolean
  destaque_prazo?: string
}

export interface HistoricoRefacaoItem {
  ciclo: number
  solicitado_em: string
  solicitado_por: string
  solicitado_por_id?: string
  solicitado_por_role?: string
  motivo: string
  relato_anterior?: string
}

export interface FaseSinalizadaInfo {
  fase_id: string
  titulo?: string
  etapa: number
  relato?: string
  sinalizado_em: string | null
  colaborador_nome?: string
  colaborador_email?: string
  refacoes_count?: number
  historico_refacoes?: HistoricoRefacaoItem[]
  status_sinalizacao?: 'sinalizada' | 'refacao_solicitada'
  motivo_refacao_atual?: string
  refacao_solicitada_em?: string
  refacao_solicitada_por?: string
}

export interface CronogramaFaseItem {
  fase_id: string
  titulo: string
  ordem: number
  dias: number
  data_inicio: string
  data_limite: string
}

export interface LogAuditoria extends RecordModel {
  onboarding_id?: string
  colaborador_nome?: string
  usuario_id?: string
  usuario_nome?: string
  usuario_role?: string
  gestor_nome?: string
  acao: string
  detalhes?: string
  fora_prazo?: boolean
  destaque_prazo?: string
  metadata?: Record<string, unknown>
}

export interface ModeloTarefa extends RecordModel {
  setor?: Setor
  setor_ref?: string
  titulo: string
  tipo: TarefaTipo
  descricao?: string
  etapa?: number // 1: Apresentação da Empresa (RH), 2: Vivência Técnica (Setor)
  conteudo_url?: string
  conteudo_link?: string
  obrigatorio?: boolean
  ordem?: number
  material?: string
  fase?: string
  expand?: {
    material?: MaterialBiblioteca
    setor_ref?: SetorModel
    fase?: FaseModelo
  }
}

export interface ConfirmacaoColaborador extends RecordModel {
  onboarding: string
  tarefa: string
  confirmado_em?: string
  ip?: string
  observacao?: string
  expand?: {
    onboarding?: Onboarding
    tarefa?: TarefaOnboarding
  }
}

export interface ItemIntegracaoModelo extends RecordModel {
  titulo: string
  ordem?: number
  ativo?: boolean
}

export interface ItemChecklistIntegracao {
  id: string
  titulo: string
  entregue: boolean
  entregue_em?: string
  entregue_por?: string
  entregue_por_nome?: string
  observacao?: string
}

export interface Onboarding extends RecordModel {
  colaborador_nome: string
  colaborador_email: string
  cargo?: string
  setor: Setor
  setor_ref?: string
  gestor_id: string
  data_inicio: string
  data_fim: string
  status: OnboardingStatus
  etapa_atual: number
  etapa1_concluida?: boolean
  data_conclusao_etapa1?: string
  etapa1_concluida_por?: string
  etapa2_concluida?: boolean
  data_conclusao_etapa2?: string
  etapa2_concluida_por?: string
  etapa3_concluida?: boolean
  data_conclusao_etapa3?: string
  email_etapa1_enviado?: boolean
  email_etapa2_enviado?: boolean
  email_avaliacao_enviado?: boolean
  token_acesso_colaborador?: string
  fases_concluidas?: FaseConcluidaInfo[]
  fases_sinalizadas?: FaseSinalizadaInfo[]
  fase_atual_id?: string
  reavaliacoes_count?: number
  prazo_suplementar_dias?: number
  cronograma_fases?: CronogramaFaseItem[]
  clientes_mapeamento?: string[]
  tecnico_responsavel_nome?: string
  tecnico_responsavel_email?: string
  checklist_integracao?: ItemChecklistIntegracao[]
  teste_conhecimento_status?:
    | 'bloqueado'
    | 'liberado'
    | 'aprovado'
    | 'reprovado'
    | 'reteste_liberado'
  teste_ultima_nota?: number
  teste_ultimo_percentual?: number
  teste_tentativas_count?: number
  questionarios_vinculados?: string[] | { id: string; nome?: string }[]
  questionario_id?: string
  expand?: {
    gestor_id?: User
    etapa1_concluida_por?: User
    etapa2_concluida_por?: User
    setor_ref?: SetorModel
    questionario_id?: QuestionarioModel
  }
}

export type TipoDeUsoQuestionario =
  | 'onboarding'
  | 'reciclagem'
  | 'mudanca_area'
  | 'avaliacao'
  | 'contratacao'

export interface QuestionarioModel extends RecordModel {
  nome: string
  descricao?: string
  setor?: string
  tipo_de_uso: TipoDeUsoQuestionario
  percentual_aprovacao: number // padrão 95
  questoes_por_prova?: number // padrão 20
  ativo: boolean
}

export type Questionario = QuestionarioModel

export type TipoQuestao = 'objetiva' | 'dissertativa'

export interface TesteQuestaoModel extends RecordModel {
  questionario_id?: string
  tipo?: TipoQuestao
  enunciado: string
  alternativas: string[]
  correta_index?: number | null
  gabarito_comentario?: string
  ordem: number
  ativo: boolean
  tema?: string
}

export interface TesteQuestaoPublica {
  id: string
  tipo?: TipoQuestao
  ordem: number
  tema?: string
  enunciado: string
  alternativas: string[]
}

export interface TesteRespostaItem {
  questao_id: string
  tipo?: TipoQuestao
  ordem: number
  tema?: string
  enunciado: string
  alternativas?: string[]
  resposta_escolhida?: number
  correta_index?: number
  correta?: boolean | null
  texto_respondido?: string
  gabarito_comentario?: string
}

export interface TesteTentativa extends RecordModel {
  onboarding_id?: string
  candidato_id?: string
  tentativa_numero: number
  total_questoes: number
  acertos: number
  percentual: number
  aprovado: boolean
  data_submissao: string
  reteste_liberado?: boolean
  reteste_liberado_em?: string
  reteste_liberado_por?: string
  questoes_sorteadas?: string[]
  respostas_detalhe?: TesteRespostaItem[]
}

export interface TarefaOnboarding extends RecordModel {
  onboarding_id: string
  titulo: string
  tipo: TarefaTipo
  descricao?: string
  etapa?: number // 1: Apresentação RH, 2: Vivência Técnica
  ordem?: number
  conteudo_url?: string
  conteudo_link?: string
  concluida: boolean
  concluida_em?: string
  criado_automaticamente?: boolean
  material?: string
  fase?: string
  expand?: {
    material?: MaterialBiblioteca
    fase?: FaseModelo
  }
}

export interface Avaliacao extends RecordModel {
  onboarding_id: string
  avaliador_id: string
  decisao: AvaliacaoDecisao
  observacoes?: string
  ciclo?: number
  fase_retorno_id?: string
  prazo_suplementar_dias?: number
  definitivo?: boolean
  expand?: {
    avaliador_id?: User
    onboarding_id?: Onboarding
  }
}
export const SETORES_INFO: Record<
  string,
  {
    nome: string
    cor: string
    corBg: string
    corBorder: string
    descricao: string
  }
> = {
  windows: {
    nome: 'Windows',
    cor: '#2563EB',
    corBg: 'bg-blue-50 text-blue-700 border-blue-200',
    corBorder: 'border-blue-500',
    descricao: 'Suporte helpdesk geral e estações Windows',
  },
  linux_rede: {
    nome: 'Linux / Rede',
    cor: '#16A34A',
    corBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corBorder: 'border-emerald-500',
    descricao: 'Firewalls, hospedagens de sites, e-mails cPanel e Postfix',
  },
  datacenter: {
    nome: 'Datacenter',
    cor: '#7C3AED',
    corBg: 'bg-purple-50 text-purple-700 border-purple-200',
    corBorder: 'border-purple-500',
    descricao: 'Virtualização de máquinas e serviços em estrutura própria',
  },
  campo: {
    nome: 'Campo',
    cor: '#D97706',
    corBg: 'bg-amber-50 text-amber-700 border-amber-200',
    corBorder: 'border-amber-500',
    descricao: 'Atendimento helpdesk presencial de Nível 1',
  },
  infraestrutura: {
    nome: 'Infraestrutura',
    cor: '#0891B2',
    corBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    corBorder: 'border-cyan-500',
    descricao: 'Cabeamento estruturado e infra em clientes',
  },
  rh: {
    nome: 'RH',
    cor: '#059669',
    corBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corBorder: 'border-emerald-500',
    descricao: 'Recursos Humanos, departamento pessoal e gestão de pessoas',
  },
  comercial: {
    nome: 'Comercial',
    cor: '#EA580C',
    corBg: 'bg-orange-50 text-orange-700 border-orange-200',
    corBorder: 'border-orange-500',
    descricao: 'Vendas, relacionamento com clientes e prospecção',
  },
  laboratorio: {
    nome: 'Laboratório',
    cor: '#4F46E5',
    corBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    corBorder: 'border-indigo-500',
    descricao: 'Bancada técnica, testes de hardware e reparos',
  },
}

/**
 * Retorna dados visuais para qualquer setor (cadastrado ou fallback).
 * Garante nunca quebrar a interface mesmo se uma nova área for cadastrada.
 */
/**
 * Converte de forma tolerante qualquer valor de setor legado ou novo (string, array, JSON serializado)
 * em uma string simples, segura para comparações, lookup e toLowerCase().
 */
export function setorToString(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (Array.isArray(valor)) {
    return valor.length > 0 ? setorToString(valor[0]) : ''
  }
  if (typeof valor === 'string') {
    const trimmed = valor.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.length > 0 ? setorToString(parsed[0]) : ''
        }
      } catch {
        // Se não for JSON válido, continua usando a string
      }
    }
    return trimmed
  }
  if (typeof valor === 'object') {
    return ''
  }
  return String(valor).trim()
}

/**
 * Retorna dados visuais para qualquer setor (cadastrado ou fallback).
 * Garante nunca quebrar a interface mesmo se uma nova área for cadastrada.
 */
export function getSetorVisual(
  identificador?: unknown,
  setorModel?: SetorModel | null,
): SetorVisualInfo {
  if (setorModel) {
    const cor = setorModel.cor || '#4F46E5'
    return {
      id: setorModel.id,
      chave: setorModel.chave || setorModel.id,
      nome: setorModel.nome,
      cor,
      corBg: 'bg-blue-50 text-blue-700 border-blue-200',
      corBorder: 'border-blue-500',
      descricao: setorModel.descricao || 'Área da empresa',
      ativo: setorModel.ativo,
    }
  }

  const strId = setorToString(identificador)

  if (!strId) {
    return {
      nome: 'Geral',
      cor: '#6B7280',
      corBg: 'bg-gray-50 text-gray-700 border-gray-200',
      corBorder: 'border-gray-500',
      descricao: 'Área geral',
    }
  }

  const staticInfo = SETORES_INFO[strId] || SETORES_INFO[strId.toLowerCase()]
  if (staticInfo) {
    return {
      chave: strId,
      nome: staticInfo.nome,
      cor: staticInfo.cor,
      corBg: staticInfo.corBg,
      corBorder: staticInfo.corBorder,
      descricao: staticInfo.descricao,
    }
  }

  // Fallback dinâmico para nome ou ID não mapeado
  return {
    chave: strId,
    nome: strId,
    cor: '#4F46E5',
    corBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    corBorder: 'border-indigo-500',
    descricao: 'Área da empresa',
  }
}

export interface CandidatoModel extends RecordModel {
  nome: string
  email: string
  cargo_pretendido?: string
  setor?: string
  questionario_id?: string
  status: CandidatoStatus
  token_publico?: string
  tentativa_id?: string
  nota_acertos?: number
  total_questoes?: number
  percentual_obtido?: number
  aprovado_teste?: boolean
  data_envio_prova?: string
  data_inicio_prova?: string
  data_conclusao_prova?: string
  decidido_por?: string
  data_decisao?: string
  motivo_reprovacao?: string
  motivo_desistencia?: string
  rh_responsavel?: string
  data_formalizacao_rh?: string
  criado_por?: string
  colaborador_id?: string
  expand?: {
    questionario_id?: QuestionarioModel
    decidido_por?: User
    rh_responsavel?: User
    criado_por?: User
    colaborador_id?: Onboarding
    tentativa_id?: TesteTentativa
  }
}

export const CANDIDATO_STATUS_INFO: Record<
  CandidatoStatus,
  {
    nome: string
    corBg: string
    corDot: string
  }
> = {
  pre_selecionado: {
    nome: 'Pré-selecionado',
    corBg: 'bg-slate-100 text-slate-700 border-slate-200',
    corDot: 'bg-slate-400',
  },
  prova_enviada: {
    nome: 'Prova enviada',
    corBg: 'bg-blue-50 text-blue-700 border-blue-200',
    corDot: 'bg-blue-500',
  },
  prova_concluida: {
    nome: 'Prova concluída',
    corBg: 'bg-amber-50 text-amber-700 border-amber-200',
    corDot: 'bg-amber-500',
  },
  aprovado_aguardando_rh: {
    nome: 'Aprovado pelo Gestor — Aguardando RH',
    corBg: 'bg-sky-50 text-sky-800 border-sky-300',
    corDot: 'bg-sky-500',
  },
  aprovado: {
    nome: 'Aprovado',
    corBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corDot: 'bg-emerald-500',
  },
  reprovado: {
    nome: 'Reprovado',
    corBg: 'bg-red-50 text-red-700 border-red-200',
    corDot: 'bg-red-500',
  },
  desistiu: {
    nome: 'Desistência registrada',
    corBg: 'bg-stone-100 text-stone-700 border-stone-300',
    corDot: 'bg-stone-500',
  },
  convertido: {
    nome: 'Convertido em colaborador',
    corBg: 'bg-purple-50 text-purple-700 border-purple-200',
    corDot: 'bg-purple-500',
  },
}

export type AvaliacaoColaboradorStatus = 'pendente' | 'concluida' | 'cancelada'

export interface AvaliacaoColaborador {
  id: string
  colaborador_id: string
  questionario_id: string
  token: string
  status: AvaliacaoColaboradorStatus
  tipo_avaliacao?: string
  nota?: number
  total_questoes?: number
  percentual?: number
  aprovado?: boolean
  regua_aprovacao?: number
  questoes_sorteadas?: string[]
  tentativa_id?: string
  aplicada_por?: string
  data_aplicacao?: string
  data_conclusao?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    colaborador_id?: Onboarding
    questionario_id?: Questionario
    aplicada_por?: User
  }
}

export interface CertificadoColaborador {
  id: string
  colaborador: string
  titulo: string
  emissor: string
  data_emissao: string
  data_validade?: string
  arquivo?: string
  registrado_por?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    colaborador?: Onboarding
    registrado_por?: User
  }
}

export const STATUS_INFO: Record<
  OnboardingStatus,
  {
    nome: string
    corBg: string
    corDot: string
  }
> = {
  novo: {
    nome: 'Novo',
    corBg: 'bg-slate-100 text-slate-700 border-slate-200',
    corDot: 'bg-slate-400',
  },
  em_andamento: {
    nome: 'Em andamento',
    corBg: 'bg-blue-50 text-blue-700 border-blue-200',
    corDot: 'bg-blue-500',
  },
  avaliacao_pendente: {
    nome: 'Aguardando avaliação',
    corBg: 'bg-amber-50 text-amber-700 border-amber-200',
    corDot: 'bg-amber-500',
  },
  concluido: {
    nome: 'Concluído (Apto)',
    corBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corDot: 'bg-emerald-500',
  },
  nao_apto: {
    nome: 'Não apto',
    corBg: 'bg-red-50 text-red-700 border-red-200',
    corDot: 'bg-red-500',
  },
  em_acompanhamento: {
    nome: 'Em acompanhamento',
    corBg: 'bg-amber-50 text-amber-800 border-amber-300',
    corDot: 'bg-amber-500',
  },
}
