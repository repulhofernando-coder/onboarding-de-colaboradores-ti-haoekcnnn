export type Setor = 'windows' | 'linux_rede' | 'datacenter' | 'campo' | 'infraestrutura'

export type UserSetor = 'RH' | 'Gestão'

export type OnboardingStatus =
  | 'novo'
  | 'em_andamento'
  | 'avaliacao_pendente'
  | 'concluido'
  | 'nao_apto'

export type TarefaTipo = 'video' | 'manual'

export type AvaliacaoDecisao = 'apto' | 'nao_apto'

import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name: string
  setor?: UserSetor
  avatar?: string
}

export interface ModeloTarefa extends RecordModel {
  setor: Setor
  titulo: string
  tipo: TarefaTipo
  conteudo_url?: string
  conteudo_link?: string
  obrigatorio?: boolean
  ordem?: number
}

export interface Onboarding extends RecordModel {
  colaborador_nome: string
  colaborador_email: string
  cargo?: string
  setor: Setor
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
}

export interface TarefaOnboarding extends RecordModel {
  onboarding_id: string
  titulo: string
  tipo: TarefaTipo
  conteudo_url?: string
  conteudo_link?: string
  concluida: boolean
  concluida_em?: string
  criado_automaticamente?: boolean
}

export interface Avaliacao extends RecordModel {
  onboarding_id: string
  avaliador_id: string
  decisao: AvaliacaoDecisao
  observacoes?: string
}
export const SETORES_INFO: Record<
  Setor,
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
}
