import pb from '@/lib/pocketbase/client'
import type {
  Onboarding,
  TarefaOnboarding,
  ModeloTarefa,
  Avaliacao,
  User,
  Setor,
  AvaliacaoDecisao,
} from '@/types/onboarding'

export const userService = {
  async getGestores(): Promise<User[]> {
    const records = await pb.collection('users').getFullList<User>({
      filter: "setor = 'Gestão'",
      sort: 'name',
    })
    return records
  },

  async getAllUsers(): Promise<User[]> {
    return pb.collection('users').getFullList<User>({
      sort: 'name',
    })
  },
}

export const modeloService = {
  async listBySetor(setor: Setor): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter: `setor = '${setor}' && (etapa = 2 || etapa = null || etapa = 0)`,
      sort: 'ordem,titulo',
    })
  },

  async listEtapa1(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter: 'etapa = 1',
      sort: 'ordem,titulo',
    })
  },

  async listAll(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      sort: 'etapa,setor,ordem,titulo',
    })
  },

  async create(data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').create<ModeloTarefa>(data)
  },

  async update(id: string, data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').update<ModeloTarefa>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('modelo_tarefas').delete(id)
  },

  getFileUrl(record: ModeloTarefa, filename?: string): string {
    const fn = filename || record.conteudo_url
    if (!fn) return ''
    return pb.files.getURL(record, fn)
  },
}

export const onboardingService = {
  async list(filter?: string, sort = '-created'): Promise<Onboarding[]> {
    return pb.collection('onboardings').getFullList<Onboarding>({
      filter,
      sort,
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por',
    })
  },

  async getById(id: string): Promise<Onboarding> {
    return pb.collection('onboardings').getOne<Onboarding>(id, {
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por',
    })
  },

  async create(data: {
    colaborador_nome: string
    colaborador_email: string
    cargo?: string
    setor: Setor
    gestor_id: string
    data_inicio: string
  }): Promise<Onboarding> {
    // Calcula data_fim = data_inicio + 15 dias
    const [ano, mes, dia] = data.data_inicio.split('-').map(Number)
    const dateObj = new Date(Date.UTC(ano, mes - 1, dia))
    dateObj.setUTCDate(dateObj.getUTCDate() + 15)
    const data_fim = dateObj.toISOString().split('T')[0]

    // Cria o registro do onboarding
    const record = await pb.collection('onboardings').create<Onboarding>({
      colaborador_nome: data.colaborador_nome.trim(),
      colaborador_email: data.colaborador_email.trim(),
      cargo: data.cargo ? data.cargo.trim() : '',
      setor: data.setor,
      gestor_id: data.gestor_id,
      data_inicio: data.data_inicio,
      data_fim,
      status: 'novo',
      etapa_atual: 1,
      etapa1_concluida: false,
      etapa2_concluida: false,
      etapa3_concluida: false,
    })

    // 1. Copia os templates da Etapa 1 (Apresentação RH) para tarefas_onboarding
    const templatesEtapa1 = await modeloService.listEtapa1()
    for (const tpl of templatesEtapa1) {
      await pb.collection('tarefas_onboarding').create({
        onboarding_id: record.id,
        titulo: tpl.titulo,
        tipo: tpl.tipo,
        descricao: tpl.descricao || '',
        etapa: 1,
        ordem: tpl.ordem || 1,
        conteudo_url: tpl.conteudo_url || null,
        conteudo_link: tpl.conteudo_link || '',
        concluida: false,
        criado_automaticamente: true,
      })
    }

    // 2. Copia os templates do setor para tarefas_onboarding (Etapa 2 - Vivência Técnica)
    const templates = await modeloService.listBySetor(data.setor)
    for (const tpl of templates) {
      await pb.collection('tarefas_onboarding').create({
        onboarding_id: record.id,
        titulo: tpl.titulo,
        tipo: tpl.tipo,
        descricao: tpl.descricao || '',
        etapa: 2,
        ordem: tpl.ordem || 1,
        conteudo_url: tpl.conteudo_url || null,
        conteudo_link: tpl.conteudo_link || '',
        concluida: false,
        criado_automaticamente: true,
      })
    }

    return record
  },

  async concluirEtapa1(onboardingId: string, userId: string): Promise<Onboarding> {
    const hoje = new Date().toISOString()
    return pb.collection('onboardings').update<Onboarding>(onboardingId, {
      etapa1_concluida: true,
      data_conclusao_etapa1: hoje,
      etapa1_concluida_por: userId,
      etapa_atual: 2,
      status: 'em_andamento',
    })
  },

  async concluirEtapa2(onboardingId: string, userId: string): Promise<Onboarding> {
    const hoje = new Date().toISOString()
    return pb.collection('onboardings').update<Onboarding>(onboardingId, {
      etapa2_concluida: true,
      data_conclusao_etapa2: hoje,
      etapa2_concluida_por: userId,
      etapa_atual: 3,
      status: 'avaliacao_pendente',
    })
  },

  async update(id: string, data: Partial<Onboarding>): Promise<Onboarding> {
    return pb.collection('onboardings').update<Onboarding>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('onboardings').delete(id)
  },
}

export const tarefaService = {
  async listByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}'`,
      sort: 'etapa,ordem,created',
    })
  },

  async listEtapa1ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && etapa = 1`,
      sort: 'ordem,created',
    })
  },

  async listEtapa2ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && (etapa = 2 || etapa = null || etapa = 0)`,
      sort: 'ordem,created',
    })
  },

  async toggleConcluida(id: string, concluida: boolean): Promise<TarefaOnboarding> {
    return pb.collection('tarefas_onboarding').update<TarefaOnboarding>(id, {
      concluida,
      concluida_em: concluida ? new Date().toISOString() : null,
    })
  },

  async create(data: FormData | Partial<TarefaOnboarding>): Promise<TarefaOnboarding> {
    return pb.collection('tarefas_onboarding').create<TarefaOnboarding>(data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('tarefas_onboarding').delete(id)
  },

  getFileUrl(record: TarefaOnboarding, filename?: string): string {
    const fn = filename || record.conteudo_url
    if (!fn) return ''
    return pb.files.getURL(record, fn)
  },
}

export const avaliacaoService = {
  async getByOnboarding(onboardingId: string): Promise<Avaliacao | null> {
    try {
      return await pb
        .collection('avaliacoes')
        .getFirstListItem<Avaliacao>(`onboarding_id = '${onboardingId}'`, {
          expand: 'avaliador_id',
        })
    } catch (_) {
      return null
    }
  },

  async listAll(): Promise<Avaliacao[]> {
    return pb.collection('avaliacoes').getFullList<Avaliacao>({
      sort: '-created',
      expand: 'avaliador_id,onboarding_id',
    })
  },

  async registrarDecisao(params: {
    onboardingId: string
    avaliadorId: string
    decisao: AvaliacaoDecisao
    observacoes?: string
  }): Promise<{ avaliacao: Avaliacao; onboarding: Onboarding }> {
    const hoje = new Date().toISOString()

    // Cria registro de avaliacao
    const avaliacao = await pb.collection('avaliacoes').create<Avaliacao>({
      onboarding_id: params.onboardingId,
      avaliador_id: params.avaliadorId,
      decisao: params.decisao,
      observacoes: params.observacoes || '',
    })

    // Atualiza status do onboarding
    const novoStatus: Onboarding['status'] = params.decisao === 'apto' ? 'concluido' : 'nao_apto'

    const onboarding = await pb.collection('onboardings').update<Onboarding>(params.onboardingId, {
      status: novoStatus,
      etapa3_concluida: true,
      data_conclusao_etapa3: hoje,
    })

    return { avaliacao, onboarding }
  },
}
