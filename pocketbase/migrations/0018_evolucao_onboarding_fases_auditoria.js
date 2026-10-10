/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar valores permitidos do status em onboardings (adicionar 'em_acompanhamento')
    // e adicionar campos para acompanhamento de fases e reavaliações
    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      const statusField = onboardingsCol.fields.getByName('status')
      if (statusField) {
        statusField.values = [
          'novo',
          'em_andamento',
          'avaliacao_pendente',
          'concluido',
          'nao_apto',
          'em_acompanhamento',
        ]
      }

      // Campo fases_concluidas (json): array de { fase_id, concluida_em, concluida_por, dias_planejados, dias_gastos, fora_prazo }
      if (!onboardingsCol.fields.getByName('fases_concluidas')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'fases_concluidas',
            type: 'json',
            required: false,
          }),
        )
      }

      // Campo fase_atual_id (relation para fases_modelo ou text)
      if (!onboardingsCol.fields.getByName('fase_atual_id')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'fase_atual_id',
            type: 'text',
            required: false,
          }),
        )
      }

      // Campo reavaliacoes_count (number)
      if (!onboardingsCol.fields.getByName('reavaliacoes_count')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'reavaliacoes_count',
            type: 'number',
            required: false,
          }),
        )
      }

      // Campo prazo_suplementar_dias (number total somado)
      if (!onboardingsCol.fields.getByName('prazo_suplementar_dias')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'prazo_suplementar_dias',
            type: 'number',
            required: false,
          }),
        )
      }

      // Campo cronograma_fases (json): guarda snapshot dos dias previstos e datas calculadas
      if (!onboardingsCol.fields.getByName('cronograma_fases')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'cronograma_fases',
            type: 'json',
            required: false,
          }),
        )
      }

      app.save(onboardingsCol)
    } catch (err) {
      console.log('Aviso ao atualizar coleção onboardings:', err)
    }

    // 2. Atualizar fases_modelo com campo dias_previstos
    try {
      const fasesCol = app.findCollectionByNameOrId('fases_modelo')
      if (!fasesCol.fields.getByName('dias_previstos')) {
        fasesCol.fields.add(
          new Field({
            name: 'dias_previstos',
            type: 'number',
            required: false,
          }),
        )
        app.save(fasesCol)
      }
    } catch (err) {
      console.log('Aviso ao atualizar coleção fases_modelo:', err)
    }

    // 3. Remover restrição de unique em avaliacoes (se houver) para suportar reavaliações
    // e adicionar campos historico em avaliacoes
    try {
      const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes')
      // Se houver unique index idx_avaliacoes_onboarding_id, tentar remover para permitir múltiplas avaliações
      try {
        avaliacoesCol.removeIndex('idx_avaliacoes_onboarding_id')
      } catch (_) {}

      // Adicionar campos extras na avaliação: ciclo (número da tentativa 1, 2, 3), fase_retorno_id, prazo_suplementar_dias
      if (!avaliacoesCol.fields.getByName('ciclo')) {
        avaliacoesCol.fields.add(
          new Field({
            name: 'ciclo',
            type: 'number',
            required: false,
          }),
        )
      }
      if (!avaliacoesCol.fields.getByName('fase_retorno_id')) {
        avaliacoesCol.fields.add(
          new Field({
            name: 'fase_retorno_id',
            type: 'text',
            required: false,
          }),
        )
      }
      if (!avaliacoesCol.fields.getByName('prazo_suplementar_dias')) {
        avaliacoesCol.fields.add(
          new Field({
            name: 'prazo_suplementar_dias',
            type: 'number',
            required: false,
          }),
        )
      }
      if (!avaliacoesCol.fields.getByName('definitivo')) {
        avaliacoesCol.fields.add(
          new Field({
            name: 'definitivo',
            type: 'bool',
            required: false,
          }),
        )
      }
      app.save(avaliacoesCol)
    } catch (err) {
      console.log('Aviso ao atualizar avaliacoes:', err)
    }

    // 4. Criar coleção logs_auditoria
    let logsCol
    try {
      logsCol = app.findCollectionByNameOrId('logs_auditoria')
    } catch (_) {
      logsCol = null
    }

    if (!logsCol) {
      const usersCol = app.findCollectionByNameOrId('users')
      const usersId = usersCol ? usersCol.id : '_pb_users_auth_'
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      const onboardingsId = onboardingsCol ? onboardingsCol.id : 'onboardings'

      logsCol = new Collection({
        name: 'logs_auditoria',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'onboarding_id',
            type: 'relation',
            required: false,
            collectionId: onboardingsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'colaborador_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'usuario_id',
            type: 'relation',
            required: false,
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'usuario_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'usuario_role',
            type: 'text',
            required: false,
          },
          {
            name: 'gestor_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'acao',
            type: 'text',
            required: true,
          },
          {
            name: 'detalhes',
            type: 'text',
            required: false,
          },
          {
            name: 'fora_prazo',
            type: 'bool',
            required: false,
          },
          {
            name: 'destaque_prazo',
            type: 'text',
            required: false,
          },
          {
            name: 'metadata',
            type: 'json',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_logs_onboarding ON logs_auditoria (onboarding_id)',
          'CREATE INDEX idx_logs_usuario ON logs_auditoria (usuario_id)',
          'CREATE INDEX idx_logs_created ON logs_auditoria (created)',
          'CREATE INDEX idx_logs_fora_prazo ON logs_auditoria (fora_prazo)',
        ],
      })
      app.save(logsCol)
    }

    // 5. Inserir/Atualizar Nova Fase 1 "Configuração e Acessos" em cada uma das 5 áreas técnicas
    // e atualizar os dias previstos de todas as fases conforme distribuição oficial:
    // Etapa 1 RH: 1d
    // Fase 1 "Configuração e Acessos": 1d
    // Fase 2 "Mapeamento de Ambientes": 2d
    // Fase 3 "Shadowing Ativo": 2d
    // Fase 4 "Atendimento Invertido": 3d
    // Fase 5 "Atendimento Solo N1": 3d
    // Fase 6 "Consolidação Prática": 2d
    // Total das 6 fases: 1 + 2 + 2 + 3 + 3 + 2 = 13 dias. (Com Etapa 1 = 1d e Etapa 3 = 1d => 15 dias exatos)
    const setoresCol = app.findCollectionByNameOrId('setores')
    const setoresTecnicos = ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura']

    const distribuicao = [
      {
        titulo: 'Configuração e Acessos',
        descricao:
          'Configuração e Teoria: Configuração da autenticação multifator (MFA), validação dos acessos ao Movidesk, Passportal e TeamViewer. Visualização integral dos vídeos tutoriais.',
        dias: 1,
      },
      {
        titulo: 'Mapeamento de Ambientes',
        descricao:
          'Estudo aprofundado da documentação de 3 clientes de referência no Passportal. Identificação de topologia de rede, faixas de IP e particularidades de sistemas legados.',
        dias: 2,
      },
      {
        titulo: 'Shadowing Ativo',
        descricao:
          'Acompanhamento em tempo real da tela de um técnico sênior. Observação prática do fluxo de triagem, realização mandatória do contato telefônico inicial com o cliente, consulta de credenciais no Passportal e uso do TeamViewer.',
        dias: 2,
      },
      {
        titulo: 'Atendimento Invertido',
        descricao:
          'O técnico em formação assume o teclado para conduzir os chamados reais, executando obrigatoriamente a etapa de contato telefônico prévio com o usuário antes de conectar via TeamViewer, enquanto o sênior atua como copiloto e supervisor.',
        dias: 3,
      },
      {
        titulo: 'Atendimento Solo N1',
        descricao:
          'Execução individual de chamados de Nível 1 (baixa complexidade: redefinição de acessos, impressoras, softwares padrão), cumprindo rigorosamente a realização do contato telefônico inicial de alinhamento com o usuário antes do acesso remoto.',
        dias: 3,
      },
      {
        titulo: 'Consolidação Prática',
        descricao:
          'Aumento de volumetria de atendimento de chamados N1 e início de contato com demandas de complexidade média sob supervisão sob demanda.',
        dias: 2,
      },
    ]

    const fasesModeloCol = app.findCollectionByNameOrId('fases_modelo')

    for (const setorChave of setoresTecnicos) {
      // Localizar o registro do setor para pegar o ID de referência
      let setorRefId = ''
      try {
        const setorRecord = app.findFirstRecordByFilter('setores', `chave = '${setorChave}'`)
        if (setorRecord) setorRefId = setorRecord.id
      } catch (_) {}

      // Buscar fases existentes deste setor
      const existentes = app.findRecordsByFilter(
        'fases_modelo',
        `setor = '${setorChave}' || setor_ref = '${setorRefId}'`,
        'ordem',
      )

      // Verificar se já existe a fase "Configuração e Acessos"
      let configFase = existentes.find(
        (f) =>
          f.get('titulo') === 'Configuração e Acessos' ||
          f.get('titulo') === 'Configuração e Teoria' ||
          f.get('titulo').toLowerCase().includes('configuraç'),
      )

      if (!configFase) {
        configFase = new Record(fasesModeloCol)
        configFase.set('titulo', distribuicao[0].titulo)
        configFase.set('descricao', distribuicao[0].descricao)
        configFase.set('setor', setorChave)
        if (setorRefId) configFase.set('setor_ref', setorRefId)
        configFase.set('etapa', 2)
        configFase.set('ordem', 1)
        configFase.set('dias_previstos', distribuicao[0].dias)
        app.save(configFase)
      } else {
        configFase.set('titulo', distribuicao[0].titulo)
        configFase.set('descricao', distribuicao[0].descricao)
        configFase.set('ordem', 1)
        configFase.set('dias_previstos', distribuicao[0].dias)
        if (setorRefId) configFase.set('setor_ref', setorRefId)
        app.save(configFase)
      }

      // Reordenar as demais fases existentes para 2, 3, 4, 5, 6 e setar dias previstos
      const outrasFases = existentes.filter((f) => f.id !== configFase.id)
      for (const f of outrasFases) {
        const tit = (f.get('titulo') || '').toLowerCase()
        let match = null
        if (tit.includes('mapeamento')) match = distribuicao[1]
        else if (tit.includes('shadowing')) match = distribuicao[2]
        else if (tit.includes('invertido')) match = distribuicao[3]
        else if (tit.includes('solo')) match = distribuicao[4]
        else if (tit.includes('consolida')) match = distribuicao[5]

        if (match) {
          const targetIndex = distribuicao.indexOf(match)
          f.set('ordem', targetIndex + 1)
          f.set('dias_previstos', match.dias)
          f.set('descricao', match.descricao)
          if (setorRefId) f.set('setor_ref', setorRefId)
          app.save(f)
        }
      }

      // Se faltar alguma das 6 fases na área, criá-la
      for (let i = 1; i < distribuicao.length; i++) {
        const itemDist = distribuicao[i]
        const jaTem = app.findRecordsByFilter(
          'fases_modelo',
          `(setor = '${setorChave}' || setor_ref = '${setorRefId}') && titulo = '${itemDist.titulo}'`,
        )
        if (jaTem.length === 0) {
          const novaFase = new Record(fasesModeloCol)
          novaFase.set('titulo', itemDist.titulo)
          novaFase.set('descricao', itemDist.descricao)
          novaFase.set('setor', setorChave)
          if (setorRefId) novaFase.set('setor_ref', setorRefId)
          novaFase.set('etapa', 2)
          novaFase.set('ordem', i + 1)
          novaFase.set('dias_previstos', itemDist.dias)
          app.save(novaFase)
        }
      }
    }

    // 6. Atualizar onboardings existentes para incluir a Fase 1 "Configuração e Acessos"
    // e inicializar cronograma/fases se vazio
    try {
      const todosOnboardings = app.findRecordsByFilter('onboardings', '1=1')
      for (const onb of todosOnboardings) {
        let dirty = false
        const setor = onb.get('setor')
        const setorRef = onb.get('setor_ref')
        const setorKey = Array.isArray(setor) ? setor[0] : setor || ''

        // Inicializar campos nulos se necessário
        if (onb.get('reavaliacoes_count') === undefined || onb.get('reavaliacoes_count') === null) {
          onb.set('reavaliacoes_count', 0)
          dirty = true
        }
        if (
          onb.get('prazo_suplementar_dias') === undefined ||
          onb.get('prazo_suplementar_dias') === null
        ) {
          onb.set('prazo_suplementar_dias', 0)
          dirty = true
        }
        if (!onb.get('fases_concluidas')) {
          onb.set('fases_concluidas', [])
          dirty = true
        }

        if (dirty) {
          app.save(onb)
        }
      }
    } catch (err) {
      console.log('Aviso ao atualizar onboardings existentes:', err)
    }
  },
  (app) => {
    // Reversão básica segura
  },
)
