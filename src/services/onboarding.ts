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
  ConfirmacaoColaborador,
  FaseModelo,
  LogAuditoria,
  QuestionarioModel,
  TesteQuestaoModel,
  TesteQuestaoPublica,
  TesteTentativa,
  CandidatoModel,
} from '@/types/onboarding'

function generateRandomToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

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
    setor?: string
    ativo?: boolean
    pode_editar_questionarios?: boolean
  }): Promise<User> {
    const role = data.role || (data.setor === 'RH' ? 'rh' : 'gestao')
    // Se o setor foi fornecido explicitamente, respeita o valor (ex: "Windows", "Datacenter", "RH", etc.)
    // Caso contrário, adota fallback amigável baseado no papel
    const setor = data.setor !== undefined ? data.setor.trim() : role === 'rh' ? 'RH' : ''

    return pb.collection('users').create<User>({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      passwordConfirm: data.password,
      role,
      setor,
      ativo: data.ativo ?? true,
      pode_editar_questionarios: Boolean(data.pode_editar_questionarios),
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
      setor?: string
      password?: string
      oldPassword?: string
      ativo?: boolean
      pode_editar_questionarios?: boolean
    },
    currentEmail?: string,
  ): Promise<User> {
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.email !== undefined && data.email.trim() !== '') {
      const trimmedEmail = data.email.trim()
      // No PocketBase auth collection (_pb_users_auth_), enviar o campo `email` no update
      // aciona a verificação/confirmação de alteração de e-mail e exige confirmação por senha.
      // Se o e-mail não foi alterado em relação ao atual (ou se currentEmail foi fornecido e difere),
      // só incluímos se realmente pretendemos alterar o e-mail.
      if (!currentEmail || trimmedEmail.toLowerCase() !== currentEmail.trim().toLowerCase()) {
        payload.email = trimmedEmail
      }
    }
    if (data.role !== undefined) {
      payload.role = data.role
    }
    if (data.setor !== undefined) {
      payload.setor = data.setor.trim()
    }
    if (data.ativo !== undefined) payload.ativo = data.ativo
    if (data.pode_editar_questionarios !== undefined) {
      payload.pode_editar_questionarios = Boolean(data.pode_editar_questionarios)
    }
    // Omitir password/passwordConfirm caso seja vazio, em branco ou nulo
    if (data.password && data.password.trim() !== '') {
      payload.password = data.password
      payload.passwordConfirm = data.password
      if (data.oldPassword && data.oldPassword.trim() !== '') {
        payload.oldPassword = data.oldPassword
      }
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

export const faseService = {
  async solicitarRefacaoFase(params: {
    onboardingId: string
    faseId: string
    faseTitulo: string
    motivo: string
    usuarioId: string
    usuarioNome: string
    usuarioRole: string
  }): Promise<{
    success: boolean
    message: string
    refacoesCount: number
    onboarding: Onboarding
    fases_sinalizadas: import('@/types/onboarding').FaseSinalizadaInfo[]
  }> {
    return await pb.send('/backend/v1/fase/solicitar-refacao', {
      method: 'POST',
      body: params,
    })
  },

  async listBySetor(setor: Setor, setorId?: string): Promise<FaseModelo[]> {
    const setorVal = typeof setor === 'string' ? setor : String(setor || '')
    const setorLower = setorVal.toLowerCase()
    let filter = `(setor = '${setorLower}' || setor = '${setorVal}' || setor ~ '${setorVal}'`
    if (setorId && setorId.trim()) {
      filter += ` || setor_ref = '${setorId.trim()}'`
    }
    // Caso setor passado seja o próprio id do setor
    if (setorVal.length === 15) {
      filter += ` || setor_ref = '${setorVal}'`
    }
    filter += `)`

    return pb.collection('fases_modelo').getFullList<FaseModelo>({
      filter,
      sort: 'ordem,created',
      expand: 'setor_ref',
    })
  },

  async listAll(): Promise<FaseModelo[]> {
    return pb.collection('fases_modelo').getFullList<FaseModelo>({
      sort: 'ordem,created',
      expand: 'setor_ref',
    })
  },

  async create(data: Partial<FaseModelo>): Promise<FaseModelo> {
    return pb.collection('fases_modelo').create<FaseModelo>(data, {
      expand: 'setor_ref',
    })
  },

  async update(id: string, data: Partial<FaseModelo>): Promise<FaseModelo> {
    return pb.collection('fases_modelo').update<FaseModelo>(id, data, {
      expand: 'setor_ref',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('fases_modelo').delete(id)
  },
}

export const itemIntegracaoModeloService = {
  async listAll(): Promise<import('@/types/onboarding').ItemIntegracaoModelo[]> {
    return pb
      .collection('itens_integracao_modelo')
      .getFullList<import('@/types/onboarding').ItemIntegracaoModelo>({
        sort: 'ordem,created',
      })
  },

  async create(data: {
    titulo: string
    ordem?: number
    ativo?: boolean
  }): Promise<import('@/types/onboarding').ItemIntegracaoModelo> {
    return pb
      .collection('itens_integracao_modelo')
      .create<import('@/types/onboarding').ItemIntegracaoModelo>({
        titulo: data.titulo.trim(),
        ordem: data.ordem || 1,
        ativo: data.ativo !== false,
      })
  },

  async update(
    id: string,
    data: Partial<import('@/types/onboarding').ItemIntegracaoModelo>,
  ): Promise<import('@/types/onboarding').ItemIntegracaoModelo> {
    return pb
      .collection('itens_integracao_modelo')
      .update<import('@/types/onboarding').ItemIntegracaoModelo>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('itens_integracao_modelo').delete(id)
  },
}

export const modeloService = {
  async listBySetor(setor: Setor, setorId?: string): Promise<ModeloTarefa[]> {
    // Busca por relation setor_ref ou por setor chave/string para total retrocompatibilidade
    const setorVal = typeof setor === 'string' ? setor : String(setor || '')
    const setorLower = setorVal.toLowerCase()
    let filter = `(setor = '${setorLower}' || setor = '${setorVal}' || setor ~ '${setorVal}'`
    if (setorId && setorId.trim()) {
      filter += ` || setor_ref = '${setorId.trim()}'`
    }
    // Caso setor passado seja o próprio id do setor
    if (setorVal.length === 15) {
      filter += ` || setor_ref = '${setorVal}'`
    }
    filter += `) && (etapa = 2 || etapa = null || etapa = 0)`

    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter,
      sort: 'ordem,titulo',
      expand: 'material,setor_ref,fase',
    })
  },

  async listEtapa1(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      filter: 'etapa = 1',
      sort: 'ordem,titulo',
      expand: 'material,setor_ref,fase',
    })
  },

  async listAll(): Promise<ModeloTarefa[]> {
    return pb.collection('modelo_tarefas').getFullList<ModeloTarefa>({
      sort: 'etapa,ordem,titulo',
      expand: 'material,setor_ref,fase',
    })
  },

  async create(data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').create<ModeloTarefa>(data, {
      expand: 'material,setor_ref,fase',
    })
  },

  async update(id: string, data: FormData | Partial<ModeloTarefa>): Promise<ModeloTarefa> {
    return pb.collection('modelo_tarefas').update<ModeloTarefa>(id, data, {
      expand: 'material,setor_ref,fase',
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
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref,questionario_id',
    })
  },

  async listByColaborador(nome: string, email?: string): Promise<Onboarding[]> {
    if (!nome) return []
    try {
      const nomeLimpo = nome.trim()
      let filter = `colaborador_nome ~ '${nomeLimpo}'`
      if (email && email.trim()) {
        filter = `(${filter} || colaborador_email = '${email.trim()}')`
      }
      return await pb.collection('onboardings').getFullList<Onboarding>({
        filter,
        sort: '-created',
        expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref,questionario_id',
      })
    } catch (err) {
      console.error('[onboardingService] listByColaborador erro:', err)
      return []
    }
  },

  async getById(id: string): Promise<Onboarding> {
    return pb.collection('onboardings').getOne<Onboarding>(id, {
      expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref,questionario_id',
    })
  },

  async getByTokenColaborador(token: string): Promise<Onboarding | null> {
    if (!token || !token.trim()) return null
    try {
      return await pb
        .collection('onboardings')
        .getFirstListItem<Onboarding>(`token_acesso_colaborador = '${token.trim()}'`, {
          expand: 'gestor_id,setor_ref,questionario_id',
        })
    } catch {
      return null
    }
  },

  /**
   * Garante que o onboarding possua um token e retorna o link público completo do colaborador.
   */
  async getOrGeneratePublicLink(onboarding: Onboarding): Promise<string> {
    let token = onboarding.token_acesso_colaborador
    if (!token) {
      token = generateRandomToken(32)
      try {
        await pb.collection('onboardings').update(onboarding.id, {
          token_acesso_colaborador: token,
        })
        onboarding.token_acesso_colaborador = token
      } catch (err) {
        console.error('Erro ao gerar token do colaborador:', err)
      }
    }
    const baseUrl =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'
    return `${baseUrl}/colaborador/${token}`
  },

  async create(data: {
    colaborador_nome: string
    colaborador_email: string
    cargo?: string
    setor: Setor
    setor_ref?: string
    gestor_id: string
    data_inicio: string
    cronograma_fases?: import('@/types/onboarding').CronogramaFaseItem[]
    questionario_id?: string
    questionarios_vinculados?: string[]
  }): Promise<Onboarding> {
    // Calcula data_fim = data_inicio + 15 dias
    const ymdMatch = data.data_inicio.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    let ano = 0,
      mes = 0,
      dia = 0
    if (ymdMatch) {
      ano = parseInt(ymdMatch[1], 10)
      mes = parseInt(ymdMatch[2], 10) - 1
      dia = parseInt(ymdMatch[3], 10)
    } else {
      const d = new Date(data.data_inicio)
      ano = d.getUTCFullYear()
      mes = d.getUTCMonth()
      dia = d.getUTCDate()
    }
    const dateObj = new Date(Date.UTC(ano, mes, dia))
    dateObj.setUTCDate(dateObj.getUTCDate() + 15)
    const data_fim = dateObj.toISOString().split('T')[0]

    // Resolve setor_ref se não tiver sido passado diretamente
    let setorRefId = data.setor_ref
    if (!setorRefId) {
      try {
        const setorValLower = String(data.setor || '').toLowerCase()
        const found = await pb
          .collection('setores')
          .getFirstListItem<SetorModel>(
            `chave = '${data.setor}' || chave = '${setorValLower}' || nome = '${data.setor}' || id = '${data.setor}'`,
          )
        setorRefId = found.id
      } catch {
        /* intentionally ignored */
      }
    }

    // Carrega snapshot dos itens de integracao do modelo (Etapa 1)
    let checklistSnapshot: import('@/types/onboarding').ItemChecklistIntegracao[] = []
    try {
      const itensModelo = await itemIntegracaoModeloService.listAll()
      checklistSnapshot = itensModelo
        .filter((item) => item.ativo !== false)
        .map((item) => ({
          id: item.id,
          titulo: item.titulo,
          entregue: false,
        }))
    } catch (err) {
      console.warn('Aviso ao carregar itens de integracao do modelo para novo onboarding:', err)
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
      token_acesso_colaborador: generateRandomToken(32),
      fases_concluidas: [],
      fases_sinalizadas: [],
      reavaliacoes_count: 0,
      prazo_suplementar_dias: 0,
      checklist_integracao: checklistSnapshot,
    }
    if (data.cronograma_fases && data.cronograma_fases.length > 0) {
      recordPayload.cronograma_fases = data.cronograma_fases
    }
    if (setorRefId) {
      recordPayload.setor_ref = setorRefId
    }
    if (data.questionario_id) {
      recordPayload.questionario_id = data.questionario_id
      recordPayload.questionarios_vinculados = data.questionarios_vinculados || [
        data.questionario_id,
      ]
    } else if (data.questionarios_vinculados && data.questionarios_vinculados.length > 0) {
      recordPayload.questionario_id = data.questionarios_vinculados[0]
      recordPayload.questionarios_vinculados = data.questionarios_vinculados
    }

    const record = await pb.collection('onboardings').create<Onboarding>(recordPayload, {
      expand: 'gestor_id,setor_ref,questionario_id',
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
        fase: tpl.fase || null,
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

  async concluirFase(params: {
    onboardingId: string
    faseId: string
    faseTitulo: string
    usuarioId: string
    usuarioNome: string
    usuarioRole?: string
    gestorNome?: string
    colaboradorNome?: string
    diasPlanejados?: number
    dataPlanejadaLimite?: string
  }): Promise<{
    onboarding: Onboarding
    faseInfo: import('@/types/onboarding').FaseConcluidaInfo
  }> {
    const onb = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)
    const hoje = new Date()
    const hojeIso = hoje.toISOString()

    // Cálculo se foi concluída fora do prazo
    let foraPrazo = false
    let destaquePrazo = 'Concluído no prazo planejado'
    let diasGastos = params.diasPlanejados || 1

    if (params.dataPlanejadaLimite) {
      try {
        const [ano, mes, dia] = params.dataPlanejadaLimite.split('-').map(Number)
        const limite = new Date(ano, mes - 1, dia)
        limite.setHours(23, 59, 59, 999)
        const diffDias = Math.round((hoje.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDias > 0) {
          foraPrazo = true
          destaquePrazo = `Concluído ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'} após o prazo`
        } else if (diffDias < 0) {
          const adiantado = Math.abs(diffDias)
          destaquePrazo = `Concluído ${adiantado} ${adiantado === 1 ? 'dia' : 'dias'} antes do prazo planejado`
        }
      } catch {
        /* ignore */
      }
    }

    const faseInfo: import('@/types/onboarding').FaseConcluidaInfo = {
      fase_id: params.faseId,
      titulo: params.faseTitulo,
      concluida_em: hojeIso,
      concluida_por: params.usuarioId,
      concluida_por_nome: params.usuarioNome,
      dias_planejados: params.diasPlanejados,
      dias_gastos: diasGastos,
      fora_prazo: foraPrazo,
      destaque_prazo: destaquePrazo,
    }

    const fasesExistentes = Array.isArray(onb.fases_concluidas) ? [...onb.fases_concluidas] : []
    const idx = fasesExistentes.findIndex((f) => f.fase_id === params.faseId)
    if (idx >= 0) {
      fasesExistentes[idx] = faseInfo
    } else {
      fasesExistentes.push(faseInfo)
    }

    // Registrar no log de auditoria
    await auditoriaService.registrar({
      onboardingId: params.onboardingId,
      colaboradorNome: params.colaboradorNome || onb.colaborador_nome,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      usuarioRole: params.usuarioRole || '',
      gestorNome: params.gestorNome || '',
      acao: `Fase Concluída: ${params.faseTitulo}`,
      detalhes: destaquePrazo,
      foraPrazo,
      destaquePrazo,
      metadata: { fase_id: params.faseId, dias_planejados: params.diasPlanejados },
    })

    const updated = await pb.collection('onboardings').update<Onboarding>(params.onboardingId, {
      fases_concluidas: fasesExistentes,
    })

    return { onboarding: updated, faseInfo }
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

  /**
   * Mecanismo "Sinalizar, não concluir":
   * O colaborador sinaliza que finalizou os materiais/atividades da fase.
   * Não altera o status do onboarding ou da fase (conclusão formal é ato exclusivo do gestor/RH).
   * Executa via endpoint de sistema no servidor (/backend/v1/sinalizar-fase):
   * 1. Valida o token exclusivo ou onboardingId
   * 2. Salva fases_sinalizadas com privilégio de sistema
   * 3. Registra log de auditoria na coleção logs_auditoria
   * 4. Dispara e-mail de notificação ao responsável
   */
  async sinalizarConclusaoFase(params: {
    onboardingId: string
    token?: string
    faseId: string
    faseTitulo: string
    etapa: number
    relato?: string
    colaboradorNome?: string
    colaboradorEmail?: string
  }): Promise<{
    onboarding: Onboarding
    sinalInfo: import('@/types/onboarding').FaseSinalizadaInfo
  }> {
    const res = await pb.send<{
      success: boolean
      onboarding: Onboarding
      sinalInfo: import('@/types/onboarding').FaseSinalizadaInfo
      fases_sinalizadas: import('@/types/onboarding').FaseSinalizadaInfo[]
    }>('/backend/v1/sinalizar-fase', {
      method: 'POST',
      body: {
        token: params.token || '',
        onboardingId: params.onboardingId,
        faseId: params.faseId,
        faseTitulo: params.faseTitulo,
        etapa: params.etapa,
        relato: params.relato || '',
        colaboradorNome: params.colaboradorNome || '',
        colaboradorEmail: params.colaboradorEmail || '',
      },
    })

    // Garantir busca com expands para o frontend atualizar estado completo
    let onbCompleto: Onboarding = res.onboarding
    try {
      onbCompleto = await pb.collection('onboardings').getOne<Onboarding>(res.onboarding.id, {
        expand: 'gestor_id,setor_ref,etapa1_concluida_por,etapa2_concluida_por',
      })
    } catch (_) {
      // Se a chamada de leitura pública falhar por algum motivo de rede, utiliza o retorno do endpoint
      if (res.fases_sinalizadas && Array.isArray(res.fases_sinalizadas)) {
        onbCompleto = {
          ...onbCompleto,
          fases_sinalizadas: res.fases_sinalizadas,
        }
      }
    }

    return {
      onboarding: onbCompleto,
      sinalInfo: res.sinalInfo,
    }
  },

  async atualizarTecnicoResponsavel(params: {
    onboardingId: string
    nome: string
    email?: string
    usuarioId: string
    usuarioNome: string
    usuarioRole?: string
    gestorNome?: string
    colaboradorNome?: string
  }): Promise<Onboarding> {
    const nomeLimpo = (params.nome || '').trim()
    const emailLimpo = (params.email || '').trim()

    const updated = await pb.collection('onboardings').update<Onboarding>(
      params.onboardingId,
      {
        tecnico_responsavel_nome: nomeLimpo,
        tecnico_responsavel_email: emailLimpo,
      },
      {
        expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
      },
    )

    const detalheTecnico = emailLimpo
      ? `Técnico responsável definido: ${nomeLimpo} (${emailLimpo})`
      : `Técnico responsável definido: ${nomeLimpo}`

    await auditoriaService.registrar({
      onboardingId: params.onboardingId,
      colaboradorNome: params.colaboradorNome || updated.colaborador_nome,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      usuarioRole: params.usuarioRole || '',
      gestorNome: params.gestorNome || '',
      acao: 'Definição de Técnico Responsável',
      detalhes: detalheTecnico,
      foraPrazo: false,
      metadata: {
        tecnico_responsavel_nome: nomeLimpo,
        tecnico_responsavel_email: emailLimpo,
      },
    })

    return updated
  },

  async atualizarItemChecklistIntegracao(params: {
    onboardingId: string
    itemId: string
    entregue: boolean
    observacao?: string
    usuarioId: string
    usuarioNome: string
    usuarioRole?: string
    gestorNome?: string
    colaboradorNome?: string
  }): Promise<Onboarding> {
    const onb = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)
    const checklistAtual: import('@/types/onboarding').ItemChecklistIntegracao[] = Array.isArray(
      onb.checklist_integracao,
    )
      ? [...onb.checklist_integracao]
      : []

    const idx = checklistAtual.findIndex((item) => item.id === params.itemId)
    if (idx === -1) {
      throw new Error('Item do checklist não encontrado no onboarding')
    }

    const itemAnterior = checklistAtual[idx]
    const agora = new Date().toISOString()

    const itemAtualizado: import('@/types/onboarding').ItemChecklistIntegracao = {
      ...itemAnterior,
      entregue: params.entregue,
      entregue_em: params.entregue ? agora : undefined,
      entregue_por: params.entregue ? params.usuarioId : undefined,
      entregue_por_nome: params.entregue ? params.usuarioNome : undefined,
      observacao:
        params.observacao !== undefined ? params.observacao.trim() : itemAnterior.observacao,
    }

    checklistAtual[idx] = itemAtualizado

    const updated = await pb.collection('onboardings').update<Onboarding>(
      params.onboardingId,
      {
        checklist_integracao: checklistAtual,
      },
      {
        expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
      },
    )

    // Auditoria da entrega ou observação
    const statusTxt = params.entregue ? 'marcado como entregue' : 'desmarcado'
    let detalhes = `Item "${itemAnterior.titulo}" ${statusTxt} por ${params.usuarioNome}`
    if (itemAtualizado.observacao) {
      detalhes += ` (Obs: "${itemAtualizado.observacao}")`
    }

    await auditoriaService.registrar({
      onboardingId: params.onboardingId,
      colaboradorNome: params.colaboradorNome || updated.colaborador_nome,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      usuarioRole: params.usuarioRole || '',
      gestorNome: params.gestorNome || '',
      acao: 'Checklist de Integração (Etapa 1)',
      detalhes,
      foraPrazo: false,
      metadata: {
        item_id: params.itemId,
        item_titulo: itemAnterior.titulo,
        entregue: params.entregue,
        observacao: itemAtualizado.observacao || '',
      },
    })

    return updated
  },

  async atualizarObservacaoItemChecklist(params: {
    onboardingId: string
    itemId: string
    observacao: string
    usuarioId: string
    usuarioNome: string
    usuarioRole?: string
    gestorNome?: string
    colaboradorNome?: string
  }): Promise<Onboarding> {
    const onb = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)
    const checklistAtual: import('@/types/onboarding').ItemChecklistIntegracao[] = Array.isArray(
      onb.checklist_integracao,
    )
      ? [...onb.checklist_integracao]
      : []

    const idx = checklistAtual.findIndex((item) => item.id === params.itemId)
    if (idx === -1) {
      throw new Error('Item do checklist não encontrado')
    }

    const itemAnterior = checklistAtual[idx]
    const obsLimpa = (params.observacao || '').trim()
    checklistAtual[idx] = {
      ...itemAnterior,
      observacao: obsLimpa,
    }

    const updated = await pb.collection('onboardings').update<Onboarding>(
      params.onboardingId,
      {
        checklist_integracao: checklistAtual,
      },
      {
        expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
      },
    )

    await auditoriaService.registrar({
      onboardingId: params.onboardingId,
      colaboradorNome: params.colaboradorNome || updated.colaborador_nome,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      usuarioRole: params.usuarioRole || '',
      gestorNome: params.gestorNome || '',
      acao: 'Observação no Checklist de Integração',
      detalhes: `Observação atualizada no item "${itemAnterior.titulo}": ${obsLimpa || '(limpa)'}`,
      foraPrazo: false,
      metadata: {
        item_id: params.itemId,
        item_titulo: itemAnterior.titulo,
        observacao: obsLimpa,
      },
    })

    return updated
  },

  async atualizarClientesMapeamento(params: {
    onboardingId: string
    clientes: string[]
    usuarioId: string
    usuarioNome: string
    usuarioRole?: string
    gestorNome?: string
    colaboradorNome?: string
  }): Promise<Onboarding> {
    // Limpar e filtrar até 3 clientes com strings válidas
    const clientesLimpos = (params.clientes || [])
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c) => c.length > 0)
      .slice(0, 3)

    const updated = await pb.collection('onboardings').update<Onboarding>(
      params.onboardingId,
      {
        clientes_mapeamento: clientesLimpos,
      },
      {
        expand: 'gestor_id,etapa1_concluida_por,etapa2_concluida_por,setor_ref',
      },
    )

    // Formatar detalhes para o log de auditoria
    const detalheClientes =
      clientesLimpos.length > 0
        ? `Clientes definidos (${clientesLimpos.length}/3): ${clientesLimpos.join(', ')}`
        : 'Clientes de referência limpos/removidos'

    await auditoriaService.registrar({
      onboardingId: params.onboardingId,
      colaboradorNome: params.colaboradorNome || updated.colaborador_nome,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      usuarioRole: params.usuarioRole || '',
      gestorNome: params.gestorNome || '',
      acao: 'Definição de Clientes (Fase 2 - Mapeamento)',
      detalhes: detalheClientes,
      foraPrazo: false,
      metadata: {
        clientes: clientesLimpos,
      },
    })

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('onboardings').delete(id)
  },

  /**
   * Obtém o resumo dos itens em cascata que serão removidos ao excluir o colaborador
   */
  async getResumoExclusaoColaborador(params: {
    nome?: string
    email?: string
    onboardingId?: string
  }): Promise<{
    colaboradorNome: string
    colaboradorEmail: string
    totalOnboardings: number
    onboardingIds: string[]
    tarefasCount: number
    confirmacoesCount: number
    avaliacoesCount: number
    tokensCount: number
  }> {
    const q = new URLSearchParams()
    if (params.nome) q.set('nome', params.nome)
    if (params.email) q.set('email', params.email)
    if (params.onboardingId) q.set('onboardingId', params.onboardingId)

    return pb.send<{
      colaboradorNome: string
      colaboradorEmail: string
      totalOnboardings: number
      onboardingIds: string[]
      tarefasCount: number
      confirmacoesCount: number
      avaliacoesCount: number
      tokensCount: number
    }>(`/backend/v1/colaborador-resumo-exclusao?${q.toString()}`, {
      method: 'GET',
    })
  },

  /**
   * Executa a exclusão forte em cascata do colaborador e seus vínculos
   */
  async excluirColaboradorEmCascata(params: {
    colaboradorNome: string
    colaboradorEmail?: string
    onboardingId?: string
    nomeConfirmacao: string
    motivo?: string
  }): Promise<{
    success: boolean
    colaboradorNome: string
    totalOnboardings: number
    totalTarefas: number
    totalConfirmacoes: number
    totalAvaliacoes: number
    motivo: string | null
    message: string
  }> {
    return pb.send<{
      success: boolean
      colaboradorNome: string
      totalOnboardings: number
      totalTarefas: number
      totalConfirmacoes: number
      totalAvaliacoes: number
      motivo: string | null
      message: string
    }>('/backend/v1/excluir-colaborador', {
      method: 'POST',
      body: {
        colaboradorNome: params.colaboradorNome,
        colaboradorEmail: params.colaboradorEmail || '',
        onboardingId: params.onboardingId || '',
        nomeConfirmacao: params.nomeConfirmacao,
        motivo: params.motivo || '',
      },
    })
  },
}

export const tarefaService = {
  async listByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}'`,
      sort: 'etapa,ordem,created',
      expand: 'material,fase',
    })
  },

  async listEtapa1ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && etapa = 1`,
      sort: 'ordem,created',
      expand: 'material,fase',
    })
  },

  async listEtapa2ByOnboarding(onboardingId: string): Promise<TarefaOnboarding[]> {
    return pb.collection('tarefas_onboarding').getFullList<TarefaOnboarding>({
      filter: `onboarding_id = '${onboardingId}' && (etapa = 2 || etapa = null || etapa = 0)`,
      sort: 'ordem,created',
      expand: 'material,fase',
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
        expand: 'material,fase',
      },
    )
  },

  async create(data: FormData | Partial<TarefaOnboarding>): Promise<TarefaOnboarding> {
    return pb.collection('tarefas_onboarding').create<TarefaOnboarding>(data, {
      expand: 'material,fase',
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

export const confirmacaoColaboradorService = {
  async listByOnboarding(onboardingId: string): Promise<ConfirmacaoColaborador[]> {
    if (!onboardingId) return []
    try {
      return await pb.collection('confirmacoes_colaborador').getFullList<ConfirmacaoColaborador>({
        filter: `onboarding = '${onboardingId}'`,
        sort: 'created',
      })
    } catch (err) {
      console.warn('Erro ao carregar confirmações do colaborador:', err)
      return []
    }
  },

  async confirmarItem(params: {
    onboardingId: string
    tarefaId: string
    observacao?: string
  }): Promise<ConfirmacaoColaborador> {
    const { onboardingId, tarefaId, observacao } = params

    // Idempotência: verifica se já foi confirmado
    try {
      const existing = await pb
        .collection('confirmacoes_colaborador')
        .getFirstListItem<ConfirmacaoColaborador>(
          `onboarding = '${onboardingId}' && tarefa = '${tarefaId}'`,
        )
      if (existing) {
        return existing
      }
    } catch {
      // Nenhum existente, continua para criar
    }

    const agora = new Date().toISOString()
    return pb.collection('confirmacoes_colaborador').create<ConfirmacaoColaborador>({
      onboarding: onboardingId,
      tarefa: tarefaId,
      confirmado_em: agora,
      observacao: observacao || '',
    })
  },
}

export const testeConhecimentoService = {
  /**
   * Busca as questões do teste para o portal público do colaborador.
   * Não expõe gabarito nem notas.
   */
  async getPublico(token: string): Promise<{
    liberado: boolean
    jaSubmetido?: boolean
    reteste?: boolean
    dataSubmissao?: string
    tentativaNumero?: number
    totalQuestoes?: number
    questoes?: import('../types/onboarding').TesteQuestaoPublica[]
    mensagem?: string
    motivo?: string
    colaboradorNome?: string
    cargo?: string
  }> {
    const res = await fetch(
      `${pb.baseUrl}/backend/v1/teste-conhecimento/publico?token=${encodeURIComponent(token)}`,
    )
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao carregar teste de conhecimento.')
    }
    return json
  },

  /**
   * Submete as respostas do colaborador via link público.
   * A correção é 100% server-side e não devolve a nota na resposta.
   */
  async submeterPublico(
    token: string,
    respostas: Record<string, number>,
  ): Promise<{
    success: boolean
    mensagem: string
  }> {
    const res = await fetch(`${pb.baseUrl}/backend/v1/teste-conhecimento/submeter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, respostas }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao submeter teste de conhecimento.')
    }
    return json
  },

  /**
   * Consulta o histórico de tentativas de um onboarding.
   * Se role === 'admin', inclui o mapa detalhado com gabarito e comentários.
   * Se 'gestao' ou 'rh', inclui apenas nota e percentual.
   */
  async listarTentativas(
    onboardingId: string,
    role: string,
  ): Promise<import('../types/onboarding').TesteTentativa[]> {
    const res = await fetch(
      `${pb.baseUrl}/backend/v1/teste-conhecimento/tentativas/${encodeURIComponent(onboardingId)}?role=${encodeURIComponent(role)}`,
      {
        headers: {
          Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
        },
      },
    )
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao consultar tentativas do teste.')
    }
    return json.tentativas || []
  },

  /**
   * Libera um novo reteste para o colaborador (Gestão / Admin).
   */
  async liberarReteste(params: {
    onboardingId: string
    motivo?: string
    usuarioId?: string
    usuarioNome?: string
    usuarioRole?: string
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${pb.baseUrl}/backend/v1/teste-conhecimento/liberar-reteste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
      },
      body: JSON.stringify(params),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao liberar reteste.')
    }
    return json
  },
}

export const questionarioService = {
  async listAll(filtro?: { ativo?: boolean; tipo_de_uso?: string }): Promise<QuestionarioModel[]> {
    const filters: string[] = []
    if (filtro?.ativo !== undefined) {
      filters.push(`ativo = ${filtro.ativo}`)
    }
    if (filtro?.tipo_de_uso) {
      filters.push(`tipo_de_uso = '${filtro.tipo_de_uso}'`)
    }
    return pb.collection('questionarios').getFullList<QuestionarioModel>({
      filter: filters.length > 0 ? filters.join(' && ') : '',
      sort: '-created',
    })
  },

  async listAtivos(): Promise<QuestionarioModel[]> {
    return pb.collection('questionarios').getFullList<QuestionarioModel>({
      filter: 'ativo = true',
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<QuestionarioModel> {
    return pb.collection('questionarios').getOne<QuestionarioModel>(id)
  },

  async create(data: {
    nome: string
    descricao?: string
    setor?: string
    tipo_de_uso: import('@/types/onboarding').TipoDeUsoQuestionario
    percentual_aprovacao?: number
    questoes_por_prova?: number
    ativo?: boolean
  }): Promise<QuestionarioModel> {
    return pb.collection('questionarios').create<QuestionarioModel>({
      nome: data.nome.trim(),
      descricao: data.descricao?.trim() || '',
      setor: (data.setor || '').trim().toLowerCase(),
      tipo_de_uso: data.tipo_de_uso,
      percentual_aprovacao:
        data.percentual_aprovacao !== undefined ? Number(data.percentual_aprovacao) : 95,
      questoes_por_prova:
        data.questoes_por_prova !== undefined ? Math.max(1, Number(data.questoes_por_prova)) : 20,
      ativo: data.ativo !== false,
    })
  },

  async update(
    id: string,
    data: Partial<{
      nome: string
      descricao: string
      setor: string
      tipo_de_uso: import('@/types/onboarding').TipoDeUsoQuestionario
      percentual_aprovacao: number
      questoes_por_prova: number
      ativo: boolean
    }>,
  ): Promise<QuestionarioModel> {
    const payload: Record<string, unknown> = {}
    if (data.nome !== undefined) payload.nome = data.nome.trim()
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim()
    if (data.setor !== undefined) payload.setor = data.setor.trim().toLowerCase()
    if (data.tipo_de_uso !== undefined) payload.tipo_de_uso = data.tipo_de_uso
    if (data.percentual_aprovacao !== undefined)
      payload.percentual_aprovacao = Number(data.percentual_aprovacao)
    if (data.questoes_por_prova !== undefined)
      payload.questoes_por_prova = Math.max(1, Number(data.questoes_por_prova))
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)
    return pb.collection('questionarios').update<QuestionarioModel>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('questionarios').delete(id)
  },

  /**
   * Questões do questionário
   */
  async listQuestoes(questionarioId?: string): Promise<TesteQuestaoModel[]> {
    const filter = questionarioId ? `questionario_id = '${questionarioId}'` : ''
    return pb.collection('teste_questoes').getFullList<TesteQuestaoModel>({
      filter,
      sort: 'ordem',
    })
  },

  async createQuestao(data: {
    questionario_id: string
    enunciado: string
    alternativas: string[]
    correta_index: number
    gabarito_comentario?: string
    ordem?: number
    ativo?: boolean
    tema?: string
  }): Promise<TesteQuestaoModel> {
    return pb.collection('teste_questoes').create<TesteQuestaoModel>({
      questionario_id: data.questionario_id,
      enunciado: data.enunciado.trim(),
      alternativas: data.alternativas,
      correta_index: data.correta_index,
      gabarito_comentario: data.gabarito_comentario?.trim() || '',
      ordem: data.ordem || 1,
      ativo: data.ativo !== false,
      tema: data.tema?.trim() || '',
    })
  },

  async updateQuestao(
    id: string,
    data: Partial<{
      questionario_id: string
      enunciado: string
      alternativas: string[]
      correta_index: number
      gabarito_comentario: string
      ordem: number
      ativo: boolean
      tema: string
    }>,
  ): Promise<TesteQuestaoModel> {
    return pb.collection('teste_questoes').update<TesteQuestaoModel>(id, data)
  },

  async deleteQuestao(id: string): Promise<boolean> {
    return pb.collection('teste_questoes').delete(id)
  },
}

export const avaliacaoService = {
  async getByOnboarding(onboardingId: string): Promise<Avaliacao | null> {
    try {
      const list = await pb.collection('avaliacoes').getFullList<Avaliacao>({
        filter: `onboarding_id = '${onboardingId}'`,
        sort: '-created',
        expand: 'avaliador_id',
      })
      return list.length > 0 ? list[0] : null
    } catch (_) {
      return null
    }
  },

  async listByOnboarding(onboardingId: string): Promise<Avaliacao[]> {
    if (!onboardingId) return []
    try {
      return await pb.collection('avaliacoes').getFullList<Avaliacao>({
        filter: `onboarding_id = '${onboardingId}'`,
        sort: '-created',
        expand: 'avaliador_id',
      })
    } catch (_) {
      return []
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
    faseRetornoId?: string
    prazoSuplementarDias?: number
    definitivo?: boolean
  }): Promise<{ avaliacao: Avaliacao; onboarding: Onboarding }> {
    const hoje = new Date().toISOString()
    const onb = await pb.collection('onboardings').getOne<Onboarding>(params.onboardingId)

    const reavaliacoesAtuais = onb.reavaliacoes_count || 0
    const ciclo = reavaliacoesAtuais + 1

    // Cria registro de avaliacao preservando histórico
    const avaliacao = await pb.collection('avaliacoes').create<Avaliacao>({
      onboarding_id: params.onboardingId,
      avaliador_id: params.avaliadorId,
      decisao: params.decisao,
      observacoes: params.observacoes || '',
      ciclo,
      fase_retorno_id: params.faseRetornoId || '',
      prazo_suplementar_dias: params.prazoSuplementarDias || 0,
      definitivo: Boolean(params.definitivo),
    })

    let novoStatus: Onboarding['status'] = 'concluido'
    const updatePayload: Partial<Onboarding> = {}

    if (params.decisao === 'apto') {
      novoStatus = 'concluido'
      updatePayload.status = novoStatus
      updatePayload.etapa3_concluida = true
      updatePayload.data_conclusao_etapa3 = hoje
    } else {
      // Não apto
      if (params.definitivo || ciclo > 2) {
        novoStatus = 'nao_apto'
        updatePayload.status = 'nao_apto'
        updatePayload.etapa3_concluida = true
        updatePayload.data_conclusao_etapa3 = hoje
      } else {
        // Retorno à fase escolhida com status "em_acompanhamento"
        novoStatus = 'em_acompanhamento'
        const prazoExtra = Number(params.prazoSuplementarDias) || 5
        const prazoTotal = (onb.prazo_suplementar_dias || 0) + prazoExtra

        // Calcular nova data_fim somando o prazo suplementar
        let novaDataFim = onb.data_fim
        try {
          const [a, m, d] = onb.data_fim.split('-').map(Number)
          const fimAtual = new Date(a, m - 1, d)
          fimAtual.setDate(fimAtual.getDate() + prazoExtra)
          novaDataFim = fimAtual.toISOString().split('T')[0]
        } catch {
          /* intentionally ignored */
        }

        updatePayload.status = 'em_acompanhamento'
        updatePayload.etapa_atual = 2
        updatePayload.etapa2_concluida = false
        updatePayload.etapa3_concluida = false
        updatePayload.reavaliacoes_count = ciclo
        updatePayload.prazo_suplementar_dias = prazoTotal
        updatePayload.data_fim = novaDataFim
        if (params.faseRetornoId) {
          updatePayload.fase_atual_id = params.faseRetornoId
        }
      }
    }

    const onboarding = await pb
      .collection('onboardings')
      .update<Onboarding>(params.onboardingId, updatePayload)

    return { avaliacao, onboarding }
  },
}

export const candidatoService = {
  async listAll(filtro?: {
    busca?: string
    setor?: string
    status?: string
  }): Promise<CandidatoModel[]> {
    const filters: string[] = []
    if (filtro?.busca) {
      const q = filtro.busca.trim().toLowerCase()
      filters.push(`(nome ~ '${q}' || email ~ '${q}' || cargo_pretendido ~ '${q}')`)
    }
    if (filtro?.setor) {
      filters.push(`setor ~ '${filtro.setor}'`)
    }
    if (filtro?.status) {
      filters.push(`status = '${filtro.status}'`)
    }

    try {
      return await pb.collection('candidatos').getFullList<CandidatoModel>({
        filter: filters.length > 0 ? filters.join(' && ') : '',
        sort: '-created',
        expand: 'questionario_id,decidido_por,criado_por,colaborador_id,tentativa_id',
      })
    } catch (err) {
      console.error('Erro ao listar candidatos:', err)
      return []
    }
  },

  async getById(id: string): Promise<CandidatoModel | null> {
    try {
      return await pb.collection('candidatos').getOne<CandidatoModel>(id, {
        expand: 'questionario_id,decidido_por,criado_por,colaborador_id,tentativa_id',
      })
    } catch (_) {
      return null
    }
  },

  async create(dados: {
    nome: string
    email: string
    cargo_pretendido?: string
    setor?: string
    questionario_id?: string
    criado_por?: string
  }): Promise<CandidatoModel> {
    // Gerar token público aleatório único (32 caracteres)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const record = await pb.collection('candidatos').create<CandidatoModel>({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      cargo_pretendido: dados.cargo_pretendido?.trim() || '',
      setor: dados.setor || '',
      questionario_id: dados.questionario_id || null,
      status: 'pre_selecionado',
      token_publico: token,
      criado_por: dados.criado_por || pb.authStore.record?.id || null,
    })

    // Log de auditoria
    await auditoriaService.registrar({
      colaboradorNome: record.nome,
      usuarioId: pb.authStore.record?.id || '',
      usuarioNome: pb.authStore.record?.name || pb.authStore.record?.email || 'RH',
      usuarioRole: pb.authStore.record?.role || 'rh',
      acao: 'Cadastro de Candidato Pré-selecionado',
      detalhes: `Candidato cadastrado para a vaga de ${record.cargo_pretendido || 'TI'} (Setor: ${record.setor}). Prova vinculada pronta para envio.`,
      metadata: {
        candidato_id: record.id,
        nome: record.nome,
        email: record.email,
        cargo_pretendido: record.cargo_pretendido,
        setor: record.setor,
        questionario_id: record.questionario_id,
      },
    })

    return record
  },

  async marcarProvaEnviada(candidatoId: string): Promise<CandidatoModel> {
    const agoraIso = new Date().toISOString()
    const cand = await pb.collection('candidatos').getOne<CandidatoModel>(candidatoId)

    // Se já foi enviada, concluída ou decidida, não rebaixa o status
    const updatePayload: Partial<CandidatoModel> = {
      data_envio_prova: cand.data_envio_prova || agoraIso,
    }
    if (cand.status === 'pre_selecionado') {
      updatePayload.status = 'prova_enviada'
    }

    const updated = await pb
      .collection('candidatos')
      .update<CandidatoModel>(candidatoId, updatePayload)

    await auditoriaService.registrar({
      colaboradorNome: cand.nome,
      usuarioId: pb.authStore.record?.id || '',
      usuarioNome: pb.authStore.record?.name || pb.authStore.record?.email || 'RH',
      usuarioRole: pb.authStore.record?.role || 'rh',
      acao: 'Cópia / Envio do Link da Prova do Candidato',
      detalhes: `Link público da prova técnica copiado para envio ao candidato ${cand.nome}.`,
      metadata: { candidato_id: cand.id, data_envio: agoraIso },
    })

    return updated
  },

  async decidir(params: {
    candidatoId: string
    decisao: 'aprovado' | 'reprovado'
    motivo?: string
  }): Promise<{ success: boolean; message: string; candidato: CandidatoModel }> {
    const user = pb.authStore.record
    const res = await pb.send<{
      success: boolean
      message: string
      candidato: CandidatoModel
    }>('/backend/v1/candidatos/decidir', {
      method: 'POST',
      body: {
        candidatoId: params.candidatoId,
        decisao: params.decisao,
        motivo: params.motivo || '',
        usuarioId: user?.id || '',
        usuarioNome: user?.name || user?.email || 'Gestor',
        usuarioRole: user?.role || 'gestao',
      },
    })
    return res
  },

  async registrarDesistencia(params: {
    candidatoId: string
    motivo?: string
  }): Promise<{ success: boolean; message: string; candidato: CandidatoModel }> {
    const user = pb.authStore.record
    const res = await pb.send<{
      success: boolean
      message: string
      candidato: CandidatoModel
    }>('/backend/v1/candidatos/desistencia', {
      method: 'POST',
      body: {
        candidatoId: params.candidatoId,
        motivo: params.motivo || '',
        usuarioId: user?.id || '',
        usuarioNome: user?.name || user?.email || 'RH',
        usuarioRole: user?.role || 'rh',
      },
    })
    return res
  },

  async reprovarPeloRH(params: {
    candidatoId: string
    motivo?: string
  }): Promise<{ success: boolean; message: string; candidato: CandidatoModel }> {
    const user = pb.authStore.record
    const res = await pb.send<{
      success: boolean
      message: string
      candidato: CandidatoModel
    }>('/backend/v1/candidatos/reprovar-rh', {
      method: 'POST',
      body: {
        candidatoId: params.candidatoId,
        motivo: params.motivo || '',
        usuarioId: user?.id || '',
        usuarioNome: user?.name || user?.email || 'RH',
        usuarioRole: user?.role || 'rh',
      },
    })
    return res
  },

  async converterEmColaborador(params: {
    candidatoId: string
    dataInicio: string
    gestorId: string
  }): Promise<{
    success: boolean
    message: string
    onboarding: Onboarding
    candidato: CandidatoModel
  }> {
    const user = pb.authStore.record
    const res = await pb.send<{
      success: boolean
      message: string
      onboarding: Onboarding
      candidato: CandidatoModel
    }>('/backend/v1/candidatos/converter', {
      method: 'POST',
      body: {
        candidatoId: params.candidatoId,
        dataInicio: params.dataInicio,
        gestorId: params.gestorId,
        usuarioId: user?.id || '',
        usuarioNome: user?.name || user?.email || 'RH',
        usuarioRole: user?.role || 'rh',
      },
    })
    return res
  },

  async excluir(candidatoId: string): Promise<boolean> {
    const cand = await pb.collection('candidatos').getOne<CandidatoModel>(candidatoId)
    await pb.collection('candidatos').delete(candidatoId)

    await auditoriaService.registrar({
      colaboradorNome: cand.nome,
      usuarioId: pb.authStore.record?.id || '',
      usuarioNome: pb.authStore.record?.name || pb.authStore.record?.email || 'Admin',
      usuarioRole: pb.authStore.record?.role || 'admin',
      acao: 'Exclusão de Candidato Pré-selecionado',
      detalhes: `Registro do candidato ${cand.nome} (${cand.cargo_pretendido}) removido do sistema.`,
      metadata: { candidato_id: cand.id, nome: cand.nome },
    })

    return true
  },
}

export const candidatoProvaPublicaService = {
  async getProva(token: string): Promise<{
    liberado: boolean
    jaSubmetido?: boolean
    reprovado?: boolean
    desistiu?: boolean
    candidatoNome?: string
    cargoPretendido?: string
    setor?: string
    questionarioNome?: string
    questionarioDescricao?: string
    totalQuestoes?: number
    questoes?: TesteQuestaoPublica[]
    dataConclusao?: string
    mensagem?: string
    error?: string
    duracaoMinutos?: number
    dataInicioProva?: string
    segundosRestantes?: number
    expirado?: boolean
  }> {
    return await pb.send('/backend/v1/candidato/prova/publico', {
      method: 'GET',
      query: { token },
    })
  },

  async submeterProva(
    token: string,
    respostas: Record<string, number>,
    dissertativas?: Record<string, string>,
    porExpiracaoTempo?: boolean,
  ): Promise<{ success: boolean; mensagem: string }> {
    return await pb.send('/backend/v1/candidato/prova/submeter', {
      method: 'POST',
      body: {
        token,
        respostas,
        dissertativas: dissertativas || {},
        porExpiracaoTempo: Boolean(porExpiracaoTempo),
      },
    })
  },

  async getTentativaGabarito(candidatoId: string): Promise<{
    tentativa: import('@/types/onboarding').TesteTentativa
  }> {
    return await pb.send(`/backend/v1/candidato/tentativa/${encodeURIComponent(candidatoId)}`, {
      method: 'GET',
    })
  },

  async solicitarRefacaoFase(params: {
    onboardingId: string
    faseId: string
    faseTitulo: string
    motivo: string
    usuarioId: string
    usuarioNome: string
    usuarioRole: string
  }): Promise<{
    success: boolean
    message: string
    refacoesCount: number
    onboarding: Onboarding
    fases_sinalizadas: import('@/types/onboarding').FaseSinalizadaInfo[]
  }> {
    return await pb.send('/backend/v1/fase/solicitar-refacao', {
      method: 'POST',
      body: params,
    })
  },
}

export const auditoriaService = {
  async registrar(dados: {
    onboardingId?: string
    colaboradorNome?: string
    usuarioId?: string
    usuarioNome?: string
    usuarioRole?: string
    gestorNome?: string
    acao: string
    detalhes?: string
    foraPrazo?: boolean
    destaquePrazo?: string
    metadata?: Record<string, unknown>
  }): Promise<LogAuditoria | null> {
    try {
      return await pb.collection('logs_auditoria').create<LogAuditoria>({
        onboarding_id: dados.onboardingId || null,
        colaborador_nome: dados.colaboradorNome || '',
        usuario_id: dados.usuarioId || null,
        usuario_nome: dados.usuarioNome || '',
        usuario_role: dados.usuarioRole || '',
        gestor_nome: dados.gestorNome || '',
        acao: dados.acao,
        detalhes: dados.detalhes || '',
        fora_prazo: Boolean(dados.foraPrazo),
        destaque_prazo: dados.destaquePrazo || '',
        metadata: dados.metadata || {},
      })
    } catch (err) {
      console.warn('Aviso ao registrar log de auditoria:', err)
      return null
    }
  },

  async listByOnboarding(onboardingId: string): Promise<LogAuditoria[]> {
    if (!onboardingId) return []
    try {
      return await pb.collection('logs_auditoria').getFullList<LogAuditoria>({
        filter: `onboarding_id = '${onboardingId}'`,
        sort: '-created',
      })
    } catch (_) {
      return []
    }
  },

  async list(options?: { limit?: number }): Promise<LogAuditoria[]> {
    try {
      return await pb.collection('logs_auditoria').getFullList<LogAuditoria>({
        sort: '-created',
        batch: options?.limit || 500,
      })
    } catch (_) {
      return []
    }
  },

  async listAll(filtro?: {
    buscaColaborador?: string
    buscaGestor?: string
    apenasForaPrazo?: boolean
  }): Promise<LogAuditoria[]> {
    const filters: string[] = []
    if (filtro?.buscaColaborador) {
      filters.push(`colaborador_nome ~ '${filtro.buscaColaborador}'`)
    }
    if (filtro?.buscaGestor) {
      filters.push(
        `(gestor_nome ~ '${filtro.buscaGestor}' || usuario_nome ~ '${filtro.buscaGestor}')`,
      )
    }
    if (filtro?.apenasForaPrazo) {
      filters.push(`fora_prazo = true`)
    }

    try {
      return await pb.collection('logs_auditoria').getFullList<LogAuditoria>({
        filter: filters.length > 0 ? filters.join(' && ') : '',
        sort: '-created',
      })
    } catch (_) {
      return []
    }
  },
}

import type {
  AvaliacaoColaborador,
  CertificadoColaborador,
  Curso,
  ColaboradorCurso,
  NivelCurso,
  StatusColaboradorCurso,
  ColaboradorDocumento,
  ColaboradorAnotacao,
  TipoAnotacaoColaborador,
} from '@/types/onboarding'

export const avaliacaoColaboradorService = {
  async listByColaborador(colaboradorId: string): Promise<AvaliacaoColaborador[]> {
    try {
      return await pb.collection('avaliacoes_colaborador').getFullList<AvaliacaoColaborador>({
        filter: `colaborador_id = '${colaboradorId}'`,
        sort: '-created',
        expand: 'questionario_id,aplicada_por',
      })
    } catch (err) {
      console.error('[avaliacaoColaboradorService] listByColaborador erro:', err)
      return []
    }
  },

  async aplicarAvaliacao(dados: {
    colaboradorId: string
    questionarioId: string
    tipoAvaliacao: string
    aplicadaPorId?: string
    observacoes?: string
  }): Promise<AvaliacaoColaborador> {
    // Gerar token aleatório seguro de 32 chars
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let token = 'av_'
    for (let i = 0; i < 28; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const agora = new Date().toISOString()
    const payload = {
      colaborador_id: dados.colaboradorId,
      questionario_id: dados.questionarioId,
      token: token,
      status: 'pendente',
      tipo_avaliacao: dados.tipoAvaliacao,
      aplicada_por: dados.aplicadaPorId || null,
      data_aplicacao: agora,
      observacoes: dados.observacoes || '',
    }

    const record = await pb
      .collection('avaliacoes_colaborador')
      .create<AvaliacaoColaborador>(payload, {
        expand: 'questionario_id,aplicada_por',
      })

    return record
  },

  async cancelarAvaliacao(id: string): Promise<void> {
    await pb.collection('avaliacoes_colaborador').update(id, {
      status: 'cancelada',
    })
  },
}

export const certificadoService = {
  async listByColaborador(colaboradorId: string): Promise<CertificadoColaborador[]> {
    if (!colaboradorId) return []
    try {
      return await pb.collection('certificados').getFullList<CertificadoColaborador>({
        filter: `colaborador = '${colaboradorId}'`,
        sort: '-data_emissao',
        expand: 'colaborador,registrado_por',
      })
    } catch (err) {
      console.error('[certificadoService] listByColaborador erro:', err)
      return []
    }
  },

  async listByColaboradorIds(colaboradorIds: string[]): Promise<CertificadoColaborador[]> {
    if (!colaboradorIds || colaboradorIds.length === 0) return []
    try {
      const filter = colaboradorIds.map((id) => `colaborador = '${id}'`).join(' || ')
      return await pb.collection('certificados').getFullList<CertificadoColaborador>({
        filter,
        sort: '-data_emissao',
        expand: 'colaborador,registrado_por',
      })
    } catch (err) {
      console.error('[certificadoService] listByColaboradorIds erro:', err)
      return []
    }
  },

  async create(dados: {
    colaboradorId: string
    colaboradorNome: string
    titulo: string
    emissor: string
    dataEmissao: string
    dataValidade?: string
    observacoes?: string
    arquivo?: File | null
    autor: { id: string; nome: string; role: string }
  }): Promise<CertificadoColaborador> {
    const formData = new FormData()
    formData.append('colaborador', dados.colaboradorId)
    formData.append('titulo', dados.titulo.trim())
    formData.append('emissor', dados.emissor.trim())
    formData.append('data_emissao', dados.dataEmissao)
    if (dados.dataValidade) {
      formData.append('data_validade', dados.dataValidade)
    }
    if (dados.observacoes) {
      formData.append('observacoes', dados.observacoes.trim())
    }
    if (dados.autor.id) {
      formData.append('registrado_por', dados.autor.id)
    }
    if (dados.arquivo) {
      formData.append('arquivo', dados.arquivo)
    }

    const record = await pb.collection('certificados').create<CertificadoColaborador>(formData, {
      expand: 'colaborador,registrado_por',
    })

    // Registrar na auditoria existente
    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Inclusão de Certificado',
      detalhes: `Certificado "${dados.titulo.trim()}" (Emissor: ${dados.emissor.trim()}, Emissão: ${dados.dataEmissao}${dados.dataValidade ? `, Validade: ${dados.dataValidade}` : ''}${dados.arquivo ? ', com anexo' : ''}) anexado ao perfil por ${dados.autor.nome}.`,
      metadata: {
        certificado_id: record.id,
        titulo: dados.titulo.trim(),
        emissor: dados.emissor.trim(),
        data_emissao: dados.dataEmissao,
        data_validade: dados.dataValidade || null,
        tem_arquivo: Boolean(dados.arquivo),
      },
    })

    return record
  },

  async update(
    id: string,
    dados: {
      colaboradorId: string
      colaboradorNome: string
      titulo: string
      emissor: string
      dataEmissao: string
      dataValidade?: string
      observacoes?: string
      arquivo?: File | null
      removerArquivo?: boolean
      autor: { id: string; nome: string; role: string }
      antigo?: Partial<CertificadoColaborador>
    },
  ): Promise<CertificadoColaborador> {
    const formData = new FormData()
    formData.append('titulo', dados.titulo.trim())
    formData.append('emissor', dados.emissor.trim())
    formData.append('data_emissao', dados.dataEmissao)
    formData.append('data_validade', dados.dataValidade || '')
    formData.append('observacoes', dados.observacoes ? dados.observacoes.trim() : '')
    if (dados.arquivo) {
      formData.append('arquivo', dados.arquivo)
    } else if (dados.removerArquivo) {
      formData.append('arquivo', '')
    }

    const record = await pb
      .collection('certificados')
      .update<CertificadoColaborador>(id, formData, {
        expand: 'colaborador,registrado_por',
      })

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Edição de Certificado',
      detalhes: `Certificado "${dados.titulo.trim()}" atualizado por ${dados.autor.nome}.`,
      metadata: {
        certificado_id: id,
        titulo: dados.titulo.trim(),
        emissor: dados.emissor.trim(),
        data_emissao: dados.dataEmissao,
        data_validade: dados.dataValidade || null,
      },
    })

    return record
  },

  async delete(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    titulo: string
    emissor: string
    autor: { id: string; nome: string; role: string }
  }): Promise<void> {
    await pb.collection('certificados').delete(dados.id)

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Exclusão de Certificado',
      detalhes: `Certificado "${dados.titulo}" (Emissor: ${dados.emissor}) removido do perfil por ${dados.autor.nome}.`,
      metadata: {
        certificado_id: dados.id,
        titulo: dados.titulo,
        emissor: dados.emissor,
      },
    })
  },

  getUrlArquivo(certificado: CertificadoColaborador): string | null {
    if (!certificado.arquivo) return null
    return `${import.meta.env.VITE_POCKETBASE_URL}/api/files/certificados/${certificado.id}/${certificado.arquivo}`
  },
}

export const cursoService = {
  async listAll(filter?: string): Promise<Curso[]> {
    try {
      return await pb.collection('cursos').getFullList<Curso>({
        filter,
        sort: 'nivel,titulo',
        expand: 'setor',
      })
    } catch (err) {
      console.warn('Erro ao carregar cursos:', err)
      return []
    }
  },

  async listBySetorId(setorId: string): Promise<Curso[]> {
    if (!setorId) return []
    try {
      return await pb.collection('cursos').getFullList<Curso>({
        filter: `setor = '${setorId}'`,
        sort: 'nivel,titulo',
        expand: 'setor',
      })
    } catch (err) {
      console.warn('Erro ao carregar cursos por setor:', err)
      return []
    }
  },

  async getById(id: string): Promise<Curso> {
    return await pb.collection('cursos').getOne<Curso>(id, {
      expand: 'setor',
    })
  },

  async create(dados: {
    titulo: string
    descricao?: string
    link: string
    nivel: NivelCurso
    setor: string
    ativo?: boolean
    autor?: { id: string; nome: string; role: string; setorNome?: string }
  }): Promise<Curso> {
    const record = await pb.collection('cursos').create<Curso>(
      {
        titulo: dados.titulo.trim(),
        descricao: dados.descricao?.trim() || '',
        link: dados.link.trim(),
        nivel: dados.nivel,
        setor: dados.setor,
        ativo: dados.ativo ?? true,
      },
      {
        expand: 'setor',
      },
    )

    if (dados.autor) {
      await auditoriaService.registrar({
        usuarioId: dados.autor.id,
        usuarioNome: dados.autor.nome,
        usuarioRole: dados.autor.role,
        acao: 'Criação de Curso na Grade',
        detalhes: `Curso "${dados.titulo.trim()}" (Nível: ${dados.nivel}${dados.autor.setorNome ? `, Departamento: ${dados.autor.setorNome}` : ''}) cadastrado na Grade por ${dados.autor.nome}.`,
        metadata: {
          curso_id: record.id,
          titulo: dados.titulo.trim(),
          nivel: dados.nivel,
          setor_id: dados.setor,
          link: dados.link.trim(),
        },
      })
    }

    return record
  },

  async update(
    id: string,
    dados: {
      titulo?: string
      descricao?: string
      link?: string
      nivel?: NivelCurso
      setor?: string
      ativo?: boolean
      autor?: { id: string; nome: string; role: string; setorNome?: string }
    },
  ): Promise<Curso> {
    const payload: Record<string, unknown> = {}
    if (dados.titulo !== undefined) payload.titulo = dados.titulo.trim()
    if (dados.descricao !== undefined) payload.descricao = dados.descricao.trim()
    if (dados.link !== undefined) payload.link = dados.link.trim()
    if (dados.nivel !== undefined) payload.nivel = dados.nivel
    if (dados.setor !== undefined) payload.setor = dados.setor
    if (dados.ativo !== undefined) payload.ativo = dados.ativo

    const record = await pb.collection('cursos').update<Curso>(id, payload, {
      expand: 'setor',
    })

    if (dados.autor) {
      await auditoriaService.registrar({
        usuarioId: dados.autor.id,
        usuarioNome: dados.autor.nome,
        usuarioRole: dados.autor.role,
        acao: 'Edição de Curso na Grade',
        detalhes: `Curso "${record.titulo}" atualizado por ${dados.autor.nome}.`,
        metadata: {
          curso_id: id,
          titulo: record.titulo,
          nivel: record.nivel,
          setor_id: record.setor,
        },
      })
    }

    return record
  },

  async delete(dados: {
    id: string
    titulo: string
    autor?: { id: string; nome: string; role: string }
  }): Promise<boolean> {
    const res = await pb.collection('cursos').delete(dados.id)

    if (dados.autor) {
      await auditoriaService.registrar({
        usuarioId: dados.autor.id,
        usuarioNome: dados.autor.nome,
        usuarioRole: dados.autor.role,
        acao: 'Exclusão de Curso na Grade',
        detalhes: `Curso "${dados.titulo}" excluído da Grade por ${dados.autor.nome}.`,
        metadata: {
          curso_id: dados.id,
          titulo: dados.titulo,
        },
      })
    }

    return res
  },
}

// ---------------------------------------------------------------------------
// colaboradorDocumentoService: Documentos Complementares no perfil do colaborador
// Usa UMA BIBLIOTECA ÚNICA (materiais da Etapa 1) e gera link público de confirmação.
// ---------------------------------------------------------------------------
export const colaboradorDocumentoService = {
  async listarPorColaborador(colaboradorId: string): Promise<ColaboradorDocumento[]> {
    try {
      const records = await pb
        .collection('colaborador_documentos')
        .getFullList<ColaboradorDocumento>({
          filter: `colaborador = '${colaboradorId}'`,
          sort: '-created',
          expand: 'material,colaborador',
        })
      return records
    } catch (err) {
      console.error('[colaboradorDocumentoService.listarPorColaborador] Erro:', err)
      return []
    }
  },

  async buscarPorToken(token: string): Promise<ColaboradorDocumento | null> {
    try {
      const record = await pb
        .collection('colaborador_documentos')
        .getFirstListItem<ColaboradorDocumento>(`token = '${token}'`, {
          expand: 'material,colaborador',
        })
      return record
    } catch (_) {
      return null
    }
  },

  async associarDaBiblioteca(dados: {
    colaboradorId: string
    colaboradorNome: string
    materialId: string
    materialTitulo: string
    observacao?: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorDocumento> {
    const token = crypto.randomUUID().replace(/-/g, '')
    const agoraIso = new Date().toISOString()

    const payload = {
      colaborador: dados.colaboradorId,
      material: dados.materialId,
      token,
      status: 'pendente' as const,
      observacao: dados.observacao?.trim() || '',
      atribuido_por: dados.autor.nome,
      atribuido_em: agoraIso,
    }

    const record = await pb
      .collection('colaborador_documentos')
      .create<ColaboradorDocumento>(payload, {
        expand: 'material,colaborador',
      })

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Associação de Documento Complementar',
      detalhes: `Documento complementar "${dados.materialTitulo}" associado ao colaborador a partir do acervo central por ${dados.autor.nome}.`,
      metadata: {
        colaborador_documento_id: record.id,
        material_id: dados.materialId,
        material_titulo: dados.materialTitulo,
        token,
      },
    })

    return record
  },

  async uploadPontualEAssociar(dados: {
    colaboradorId: string
    colaboradorNome: string
    setor: string
    titulo: string
    descricao?: string
    tipo: 'arquivo' | 'link' | 'video'
    url?: string
    arquivo?: File
    observacao?: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorDocumento> {
    // 1. Cadastra o material no acervo único (biblioteca central de materiais)
    const formData = new FormData()
    formData.append('titulo', dados.titulo.trim())
    formData.append('tipo', dados.tipo)
    formData.append('descricao', dados.descricao?.trim() || 'Documento pontual anexado ao perfil')
    formData.append('setor_origem', dados.setor || 'Geral')
    formData.append('obrigatorio', 'false')
    formData.append('duracao_estimada', '0')
    formData.append('ordem', '999')

    if (dados.url && (dados.tipo === 'link' || dados.tipo === 'video')) {
      formData.append('url', dados.url.trim())
    }
    if (dados.arquivo && dados.tipo === 'arquivo') {
      formData.append('arquivo', dados.arquivo)
    }

    const materialCriado = await pb.collection('materiais').create<MaterialBiblioteca>(formData)

    // 2. Associa imediatamente ao colaborador
    return await this.associarDaBiblioteca({
      colaboradorId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      materialId: materialCriado.id,
      materialTitulo: materialCriado.titulo,
      observacao: dados.observacao,
      autor: dados.autor,
    })
  },

  async confirmarLeituraViaHook(
    token: string,
  ): Promise<{ success: boolean; confirmado_em: string; message: string }> {
    return await pb.send<{ success: boolean; confirmado_em: string; message: string }>(
      '/backend/v1/colaborador/documento/confirmar',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      },
    )
  },

  async desassociar(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    documentoTitulo: string
    autor: { id: string; nome: string; role: string }
  }): Promise<boolean> {
    const res = await pb.collection('colaborador_documentos').delete(dados.id)

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Desassociação de Documento Complementar',
      detalhes: `Documento complementar "${dados.documentoTitulo}" desassociado do colaborador por ${dados.autor.nome}.`,
      metadata: {
        colaborador_documento_id: dados.id,
        documento_titulo: dados.documentoTitulo,
      },
    })

    return res
  },

  obterLinkPublico(token: string): string {
    const origin = window.location.origin
    return `${origin}/documento-complementar/${token}`
  },
}

// ---------------------------------------------------------------------------
// colaboradorAnotacaoService: Anotações & Feedbacks do Gestor (Privacidade Restrita)
// Registros internos: colaborador NUNCA visualiza.
// ---------------------------------------------------------------------------
export const colaboradorAnotacaoService = {
  async listarPorColaborador(colaboradorId: string): Promise<ColaboradorAnotacao[]> {
    try {
      const records = await pb
        .collection('colaborador_anotacoes')
        .getFullList<ColaboradorAnotacao>({
          filter: `colaborador = '${colaboradorId}'`,
          sort: '-created',
          expand: 'autor,colaborador',
        })
      return records
    } catch (err) {
      console.error('[colaboradorAnotacaoService.listarPorColaborador] Erro:', err)
      return []
    }
  },

  async criar(dados: {
    colaboradorId: string
    colaboradorNome: string
    tipo: TipoAnotacaoColaborador
    texto: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorAnotacao> {
    const payload = {
      colaborador: dados.colaboradorId,
      tipo: dados.tipo,
      texto: dados.texto.trim(),
      autor: dados.autor.id,
      autor_nome: dados.autor.nome,
      autor_role: dados.autor.role,
    }

    const record = await pb
      .collection('colaborador_anotacoes')
      .create<ColaboradorAnotacao>(payload, {
        expand: 'autor,colaborador',
      })

    const tipoLabel =
      dados.tipo === 'feedback_1_1'
        ? 'Feedback 1:1'
        : dados.tipo === 'avaliacao'
          ? 'Avaliação'
          : 'Observação Geral'

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: `Registro de Anotação (${tipoLabel})`,
      detalhes: `Anotação do tipo "${tipoLabel}" registrada no perfil por ${dados.autor.nome}: "${dados.texto.slice(0, 100)}${dados.texto.length > 100 ? '...' : ''}"`,
      metadata: {
        anotacao_id: record.id,
        tipo: dados.tipo,
      },
    })

    return record
  },

  async atualizar(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    tipo: TipoAnotacaoColaborador
    texto: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorAnotacao> {
    const payload = {
      tipo: dados.tipo,
      texto: dados.texto.trim(),
    }

    const record = await pb
      .collection('colaborador_anotacoes')
      .update<ColaboradorAnotacao>(dados.id, payload, {
        expand: 'autor,colaborador',
      })

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Edição de Anotação do Gestor',
      detalhes: `Anotação atualizada por ${dados.autor.nome}.`,
      metadata: {
        anotacao_id: dados.id,
        tipo: dados.tipo,
      },
    })

    return record
  },

  async excluir(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    autor: { id: string; nome: string; role: string }
  }): Promise<boolean> {
    const res = await pb.collection('colaborador_anotacoes').delete(dados.id)

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Exclusão de Anotação do Gestor',
      detalhes: `Anotação removida do perfil por ${dados.autor.nome}.`,
      metadata: {
        anotacao_id: dados.id,
      },
    })

    return res
  },
}

export const colaboradorCursoService = {
  async listByColaborador(colaboradorId: string): Promise<ColaboradorCurso[]> {
    if (!colaboradorId) return []
    try {
      return await pb.collection('colaborador_cursos').getFullList<ColaboradorCurso>({
        filter: `colaborador = '${colaboradorId}'`,
        sort: '-created',
        expand: 'curso,curso.setor,colaborador',
      })
    } catch (err) {
      console.warn('Erro ao carregar cursos do colaborador:', err)
      return []
    }
  },

  async listByColaboradorIds(colaboradorIds: string[]): Promise<ColaboradorCurso[]> {
    if (!colaboradorIds || colaboradorIds.length === 0) return []
    try {
      const filter = colaboradorIds.map((id) => `colaborador = '${id}'`).join(' || ')
      return await pb.collection('colaborador_cursos').getFullList<ColaboradorCurso>({
        filter,
        sort: '-created',
        expand: 'curso,curso.setor,colaborador',
      })
    } catch (err) {
      console.warn('Erro ao carregar cursos por ids de colaboradores:', err)
      return []
    }
  },

  async associar(dados: {
    colaboradorId: string
    colaboradorNome: string
    cursoId: string
    cursoTitulo: string
    cursoNivel: string
    observacao?: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorCurso> {
    const record = await pb.collection('colaborador_cursos').create<ColaboradorCurso>(
      {
        colaborador: dados.colaboradorId,
        curso: dados.cursoId,
        status: 'pendente',
        atribuido_em: new Date().toISOString(),
        observacao: dados.observacao?.trim() || '',
        atribuido_por: dados.autor.nome,
      },
      {
        expand: 'curso,curso.setor,colaborador',
      },
    )

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Associação de Curso da Grade',
      detalhes: `Curso "${dados.cursoTitulo}" (${dados.cursoNivel.toUpperCase()}) associado ao colaborador por ${dados.autor.nome}.${dados.observacao ? ` Obs: ${dados.observacao}` : ''}`,
      metadata: {
        colaborador_curso_id: record.id,
        curso_id: dados.cursoId,
        curso_titulo: dados.cursoTitulo,
        curso_nivel: dados.cursoNivel,
        status: 'pendente',
      },
    })

    return record
  },

  async atualizarStatus(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    cursoTitulo: string
    cursoNivel: string
    novoStatus: StatusColaboradorCurso
    observacao?: string
    autor: { id: string; nome: string; role: string }
  }): Promise<ColaboradorCurso> {
    const payload: Record<string, unknown> = {
      status: dados.novoStatus,
    }

    if (dados.observacao !== undefined) {
      payload.observacao = dados.observacao.trim()
    }

    if (dados.novoStatus === 'concluido') {
      payload.concluido_em = new Date().toISOString()
      payload.concluido_por = dados.autor.nome
    } else {
      payload.concluido_em = null
      payload.concluido_por = ''
    }

    const record = await pb
      .collection('colaborador_cursos')
      .update<ColaboradorCurso>(dados.id, payload, {
        expand: 'curso,curso.setor,colaborador',
      })

    const acaoLabel =
      dados.novoStatus === 'concluido'
        ? 'Conclusão de Curso da Grade'
        : 'Atualização de Status de Curso'

    const detalhes =
      dados.novoStatus === 'concluido'
        ? `Curso "${dados.cursoTitulo}" (${dados.cursoNivel.toUpperCase()}) marcado como CONCLUÍDO por ${dados.autor.nome}.`
        : `Status do curso "${dados.cursoTitulo}" alterado para ${dados.novoStatus.toUpperCase()} por ${dados.autor.nome}.`

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: acaoLabel,
      detalhes,
      metadata: {
        colaborador_curso_id: dados.id,
        curso_titulo: dados.cursoTitulo,
        novo_status: dados.novoStatus,
      },
    })

    return record
  },

  async desassociar(dados: {
    id: string
    colaboradorId: string
    colaboradorNome: string
    cursoTitulo: string
    autor: { id: string; nome: string; role: string }
  }): Promise<boolean> {
    const res = await pb.collection('colaborador_cursos').delete(dados.id)

    await auditoriaService.registrar({
      onboardingId: dados.colaboradorId,
      colaboradorNome: dados.colaboradorNome,
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      usuarioRole: dados.autor.role,
      acao: 'Remoção de Curso Associado',
      detalhes: `Associação do curso "${dados.cursoTitulo}" removida do perfil por ${dados.autor.nome}.`,
      metadata: {
        colaborador_curso_id: dados.id,
        curso_titulo: dados.cursoTitulo,
      },
    })

    return res
  },
}
