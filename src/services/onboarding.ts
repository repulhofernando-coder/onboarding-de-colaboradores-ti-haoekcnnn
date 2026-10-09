import pb from '@/lib/pocketbase/client'
import type {
  Onboarding,
  TarefaOnboarding,
  ModeloTarefa,
  MaterialBiblioteca,
  Avaliacao,
  User,
  UserRole,
  UserSetor,
  Setor,
  AvaliacaoDecisao,
  SetorModel,
} from '@/types/onboarding'

export const setorService = {
  async listAll(): Promise<SetorModel[]> {
    try {
      return await pb.collection('setores').getFullList<SetorModel>({
        sort: 'ordem,nome',
      })
    } catch (err) {
      console.warn('Erro ao carregar setores da API:', err)
      return []
    }
  },

  async listAtivos(): Promise<SetorModel[]> {
    try {
      return await pb.collection('setores').getFullList<SetorModel>({
        filter: 'ativo = true',
        sort: 'ordem,nome',
      })
    } catch (err) {
      console.warn('Erro ao carregar setores ativos da API:', err)
      return []
    }
  },

  async getById(id: string): Promise<SetorModel> {
    return pb.collection('setores').getOne<SetorModel>(id)
  },

  async create(data: {
    nome: string
    descricao?: string
    cor?: string
    ativo?: boolean
    ordem?: number
  }): Promise<SetorModel> {
    const nomeTrimmed = data.nome.trim()
    const chave = nomeTrimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return pb.collection('setores').create<SetorModel>({
      nome: nomeTrimmed,
      chave,
      descricao: data.descricao?.trim() || '',
      cor: data.cor || '#4F46E5',
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 10,
    })
  },

  async update(
    id: string,
    data: {
      nome?: string
      descricao?: string
      cor?: string
      ativo?: boolean
      ordem?: number
    },
  ): Promise<SetorModel> {
    const payload: Record<string, unknown> = {}
    if (data.nome !== undefined) {
      payload.nome = data.nome.trim()
    }
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim()
    if (data.cor !== undefined) payload.cor = data.cor
    if (data.ativo !== undefined) payload.ativo = data.ativo
    if (data.ordem !== undefined) payload.ordem = data.ordem

    return pb.collection('setores').update<SetorModel>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('setores').delete(id)
  },

  async countUsage(
    setorId: string,
    setorChaveOuNome?: string,
  ): Promise<{
    modelosCount: number
    onboardingsCount: number
  }> {
    let modelosCount = 0
    let onboardingsCount = 0

    // Filtro abrangente: por relation setor_ref ou pelos campos legado setor
    const filterParts = [`setor_ref = '${setorId}'`]
    if (setorChaveOuNome) {
      filterParts.push(`setor = '${setorChaveOuNome}'`)
    }
    const filter = filterParts.join(' || ')

    try {
      const resModelos = await pb.collection('modelo_tarefas').getList(1, 1, { filter })
      modelosCount = resModelos.totalItems
    } catch {
      /* intentionally ignored */
    }

    try {
      const resOnboardings = await pb.collection('onboardings').getList(1, 1, { filter })
      onboardingsCount = resOnboardings.totalItems
    } catch {
      /* intentionally ignored */
    }

    return { modelosCount, onboardingsCount }
  },
}

export const userService = {
  async getGestores(): Promise<User[]> {
    // Gestores elegíveis para liderar onboardings (role = 'gestao' ou role = 'admin', ou fallback antigo setor = 'Gestão')
    const records = await pb.collection('users').getFullList<User>({
      filter:
        "(role = 'gestao' || role = 'admin' || (role = null && setor = 'Gestão')) && ativo != false",
      sort: 'name',
    })
    return records
  },

  async getAllUsers(): Promise<User[]> {
    return pb.collection('users').getFullList<User>({
      sort: 'name',
    })
  },

  async create(data: {
    name: string
    email: string
    password: string
    role?: UserRole
    setor?: UserSetor
    ativo?: boolean
  }): Promise<User> {
    const role = data.role || (data.setor === 'RH' ? 'rh' : 'gestao')
    const setor: UserSetor = role === 'rh' ? 'RH' : 'Gestão'

    return pb.collection('users').create<User>({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      passwordConfirm: data.password,
      role,
      setor,
      ativo: data.ativo ?? true,
      emailVisibility: true,
      verified: true,
    })
  },

  async update(
    id: string,
    data: {
      name?: string
      email?: string
      role?: UserRole
      setor?: UserSetor
      password?: string
      ativo?: boolean
    },
  ): Promise<User> {
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.email !== undefined) payload.email = data.email.trim()
    if (data.role !== undefined) {
      payload.role = data.role
      payload.setor = data.role === 'rh' ? 'RH' : 'Gestão'
    } else if (data.setor !== undefined) {
      payload.setor = data.setor
    }
    if (data.ativo !== undefined) payload.ativo = data.ativo
    if (data.password && data.password.trim() !== '') {
      payload.password = data.password
      payload.passwordConfirm = data.password
    }
    return pb.collection('users').update<User>(id, payload)
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<User> {
    return pb.collection('users').update<User>(id, { ativo })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('users').delete(id)
  },
}

export const materialService = {
  async listAll(filter?: string): Promise<MaterialBiblioteca[]> {
    return pb.collection('materiais').getFullList<MaterialBiblioteca>({
      filter,
      sort: '-created',
      expand: 'criado_por,setor_ref',
    })
  },

  async getById(id: string): Promise<MaterialBiblioteca> {
    return pb.collection('materiais').getOne<MaterialBiblioteca>(id, {
      expand: 'criado_por,setor_ref',
    })
  },

  async create(data: FormData | Partial<MaterialBiblioteca>): Promise<MaterialBiblioteca> {
    return pb.collection('materiais').create<MaterialBiblioteca>(data, {
      expand: 'criado_por,setor_ref',
    })
  },

  async update(
    id: string,
    data: FormData | Partial<MaterialBiblioteca>,
  ): Promise<MaterialBiblioteca> {
    return pb.collection('materiais').update<MaterialBiblioteca>(id, data, {
      expand: 'criado_por,setor_ref',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('materiais').delete(id)
  },

  getFileUrl(record: MaterialBiblioteca, filename?: string): string {
    const fn = filename || record.arquivo
    if (!fn) return ''
    return pb.files.getURL(record, fn)
  },

  async countModelosUsingMaterial(materialId: string): Promise<number> {
    const res = await pb.collection('modelo_tarefas').getList(1, 1, {
      filter: `material = '${materialId}'`,
    })
    return res.totalItems
  },
}

export const modeloService = {
  async listBySetor(setor: Setor, setorId?: string): Promise<ModeloTarefa[]> {
    // Busca por relation setor_ref ou por setor chave/string para total retrocompatibilidade
    let filter = `(setor = '${setor}'`
    if (setorId) {
      filter += ` || setor_ref = '${setorId}'`
    }
    filter += `) && (etapa = 2 || etapa = null || etapa = 0)`

    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter,
      sort: 'ordem,titulo',
      expand: 'material,setor_ref',
    })
  },

  async listEtapa1(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter: 'etapa = 1',
      sort: 'ordem,titulo',
      expand: 'material,setor_ref',
    })
  },

  async listAll(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      sort: 'etapa,ordem,titulo',
      expand: 'material,setor_ref',
    })
  },

  async create(data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').create<ModeloTarefa>(data, {
      expand: 'material,setor_ref',
    })
  },

  async update(id: string, data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').update<ModeloTarefa>(id, data, {
      expand: 'material,setor_ref',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('modelo_tarefas').delete(id)
  },

  getFileUrl(record: ModeloTarefa, filename?: string): string {
    // Se tiver arquivo próprio, usa o arquivo próprio
    if (filename || record.conteudo_url) {
      return pb.files.getURL(record, filename || record.conteudo_url!)
    }
    // Caso contrário, se tiver material associado expandido com arquivo, usa a URL do material
    if (record.expand?.material && record.expand.material.arquivo) {
      return pb.files.getURL(record.expand.material, record.expand.material.arquivo)
    }
    return ''
  },
}

export const onboardingService = {
  async list(filter?: string, sort = '-created'): Promise<Onboarding[]> {
    return pb.collection('onboardings').getFullList<Onboarding>({
      filter,
      sort,
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
    })
  },

  async getById(id: string): Promise<Onboarding> {
    return pb.collection('onboardings').getOne<Onboarding>(id, {
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
    })
  },

  async create(data: {
    colaborador_nome: string
    colaborador_email: string
    cargo?: string
    setor: Setor
    setor_ref?: string
    gestor_id: string
    data_inicio: string
  }): Promise<Onboarding> {
    // Calcula data_fim = data_inicio + 15 dias
    const [ano, mes, dia] = data.data_inicio.split('-').map(Number)
    const dateObj = new Date(Date.UTC(ano, mes - 1, dia))
    dateObj.setUTCDate(dateObj.getUTCDate() + 15)
    const data_fim = dateObj.toISOString().split('T')[0]

    // Resolve setor_ref se não tiver sido passado diretamente
    let setorRefId = data.setor_ref
    if (!setorRefId) {
      try {
        const found = await pb
          .collection('setores')
          .getFirstListItem<SetorModel>(
            `chave = '${data.setor}' || nome = '${data.setor}' || id = '${data.setor}'`,
          )
        setorRefId = found.id
      } catch {
        /* intentionally ignored */
      }
    }

    // Cria o registro do onboarding
    const recordPayload: Record<string, unknown> = {
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
    }
    if (setorRefId) {
      recordPayload.setor_ref = setorRefId
    }

    const record = await pb.collection('onboardings').create<Onboarding>(recordPayload, {
      expand: 'gestor_id,setor_ref',
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
        material: tpl.material || null,
        concluida: false,
        criado_automaticamente: true,
      })
    }

    // 2. Copia os templates do setor para tarefas_onboarding (Etapa 2 - Vivência Técnica)
    // Se o setor não tiver templates pré-configurados, a Etapa 2 nasce vazia e permite adicionar itens
    const templates = await modeloService.listBySetor(data.setor, setorRefId)
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
        material: tpl.material || null,
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
      expand: 'material',
    })
  },

  async listEtapa1ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && etapa = 1`,
      sort: 'ordem,created',
      expand: 'material',
    })
  },

  async listEtapa2ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && (etapa = 2 || etapa = null || etapa = 0)`,
      sort: 'ordem,created',
      expand: 'material',
    })
  },

  async toggleConcluida(id: string, concluida: boolean): Promise<TarefaOnboarding> {
    return pb.collection('tarefas_onboarding').update<TarefaOnboarding>(
      id,
      {
        concluida,
        concluida_em: concluida ? new Date().toISOString() : null,
      },
      {
        expand: 'material',
      },
    )
  },

  async create(data: FormData | Partial<TarefaOnboarding>): Promise<TarefaOnboarding> {
    return pb.collection('tarefas_onboarding').create<TarefaOnboarding>(data, {
      expand: 'material',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('tarefas_onboarding').delete(id)
  },

  getFileUrl(record: TarefaOnboarding, filename?: string): string {
    // Prioridade: arquivo próprio do item do onboarding
    if (filename || record.conteudo_url) {
      return pb.files.getURL(record, filename || record.conteudo_url!)
    }
    // Se não tiver arquivo próprio, verifica se há material vinculado
    if (record.expand?.material && record.expand.material.arquivo) {
      return pb.files.getURL(record.expand.material, record.expand.material.arquivo)
    }
    return ''
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
