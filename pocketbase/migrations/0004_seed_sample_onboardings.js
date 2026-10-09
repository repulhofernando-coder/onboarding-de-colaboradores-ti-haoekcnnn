migrate(
  (app) => {
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
    const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes')
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')

    // Buscar gestor de TI
    let gestor
    try {
      gestor = app.findFirstRecordByData('users', 'email', 'projetos@mundoopen.com.br')
    } catch (_) {
      try {
        gestor = app.findFirstRecordByData('users', 'email', 'gestor@empresa.com.br')
      } catch (_) {
        return
      }
    }

    let rhUser
    try {
      rhUser = app.findFirstRecordByData('users', 'email', 'rh@empresa.com.br')
    } catch (_) {
      rhUser = gestor
    }

    const samples = [
      {
        colaborador_nome: 'Gabriel Pires Ribeiro',
        colaborador_email: 'gabriel.ribeiro@empresa.com.br',
        cargo: 'Analista de Suporte N1',
        setor: 'windows',
        data_inicio: '2026-10-01',
        data_fim: '2026-10-16',
        status: 'em_andamento',
        etapa_atual: 2,
        etapa1_concluida: true,
        data_conclusao_etapa1: '2026-10-02 14:30:00.000Z',
        etapa1_concluida_por: rhUser.id,
        etapa2_concluida: false,
      },
      {
        colaborador_nome: 'Lucas Martins Ferreira',
        colaborador_email: 'lucas.martins@empresa.com.br',
        cargo: 'Técnico de Redes & Linux',
        setor: 'linux_rede',
        data_inicio: '2026-09-24',
        data_fim: '2026-10-09',
        status: 'avaliacao_pendente',
        etapa_atual: 3,
        etapa1_concluida: true,
        data_conclusao_etapa1: '2026-09-25 10:00:00.000Z',
        etapa1_concluida_por: rhUser.id,
        etapa2_concluida: true,
        data_conclusao_etapa2: '2026-10-08 17:00:00.000Z',
        etapa2_concluida_por: gestor.id,
      },
      {
        colaborador_nome: 'Rodrigo Augusto Santos',
        colaborador_email: 'rodrigo.santos@empresa.com.br',
        cargo: 'Especialista em Datacenter',
        setor: 'datacenter',
        data_inicio: '2026-09-15',
        data_fim: '2026-09-30',
        status: 'concluido',
        etapa_atual: 3,
        etapa1_concluida: true,
        data_conclusao_etapa1: '2026-09-16 11:00:00.000Z',
        etapa1_concluida_por: rhUser.id,
        etapa2_concluida: true,
        data_conclusao_etapa2: '2026-09-27 16:00:00.000Z',
        etapa2_concluida_por: gestor.id,
        etapa3_concluida: true,
        data_conclusao_etapa3: '2026-09-29 15:30:00.000Z',
        avaliacaoDecisao: 'apto',
        avaliacaoObs:
          'Excelente desempenho na virtualização de servidores Proxmox e VMware. 100% apto.',
      },
      {
        colaborador_nome: 'Mateus Oliveira Cunha',
        colaborador_email: 'mateus.cunha@empresa.com.br',
        cargo: 'Técnico de Campo N1',
        setor: 'campo',
        data_inicio: '2026-10-05',
        data_fim: '2026-10-20',
        status: 'novo',
        etapa_atual: 1,
        etapa1_concluida: false,
        etapa2_concluida: false,
      },
      {
        colaborador_nome: 'Bruno Henrique Costa',
        colaborador_email: 'bruno.costa@empresa.com.br',
        cargo: 'Técnico de Cabeamento e Infra',
        setor: 'infraestrutura',
        data_inicio: '2026-09-18',
        data_fim: '2026-10-03',
        status: 'avaliacao_pendente',
        etapa_atual: 3,
        etapa1_concluida: true,
        data_conclusao_etapa1: '2026-09-19 14:00:00.000Z',
        etapa1_concluida_por: rhUser.id,
        etapa2_concluida: true,
        data_conclusao_etapa2: '2026-10-02 18:00:00.000Z',
        etapa2_concluida_por: gestor.id,
      },
    ]

    for (const s of samples) {
      let onbRecord
      try {
        onbRecord = app.findFirstRecordByData(
          'onboardings',
          'colaborador_email',
          s.colaborador_email,
        )
        continue // Já existe
      } catch (_) {
        onbRecord = new Record(onboardingsCol)
        onbRecord.set('colaborador_nome', s.colaborador_nome)
        onbRecord.set('colaborador_email', s.colaborador_email)
        onbRecord.set('cargo', s.cargo)
        onbRecord.set('setor', s.setor)
        onbRecord.set('gestor_id', gestor.id)
        onbRecord.set('data_inicio', s.data_inicio)
        onbRecord.set('data_fim', s.data_fim)
        onbRecord.set('status', s.status)
        onbRecord.set('etapa_atual', s.etapa_atual)
        onbRecord.set('etapa1_concluida', s.etapa1_concluida)
        if (s.data_conclusao_etapa1) onbRecord.set('data_conclusao_etapa1', s.data_conclusao_etapa1)
        if (s.etapa1_concluida_por) onbRecord.set('etapa1_concluida_por', s.etapa1_concluida_por)
        onbRecord.set('etapa2_concluida', s.etapa2_concluida)
        if (s.data_conclusao_etapa2) onbRecord.set('data_conclusao_etapa2', s.data_conclusao_etapa2)
        if (s.etapa2_concluida_por) onbRecord.set('etapa2_concluida_por', s.etapa2_concluida_por)
        if (s.etapa3_concluida) {
          onbRecord.set('etapa3_concluida', s.etapa3_concluida)
          onbRecord.set('data_conclusao_etapa3', s.data_conclusao_etapa3)
        }
        app.save(onbRecord)
      }

      // Copiar templates para tarefas_onboarding
      const templates = app.findRecordsByFilter(
        'modelo_tarefas',
        `setor = '${s.setor}'`,
        'ordem',
        10,
        0,
      )

      for (let i = 0; i < templates.length; i++) {
        const t = templates[i]
        const tarefaRec = new Record(tarefasCol)
        tarefaRec.set('onboarding_id', onbRecord.id)
        tarefaRec.set('titulo', t.getString('titulo'))
        tarefaRec.set('tipo', t.getString('tipo'))
        tarefaRec.set('conteudo_link', '')
        const estaConcluida = s.etapa2_concluida || (s.etapa_atual === 2 && i === 0)
        tarefaRec.set('concluida', estaConcluida)
        if (estaConcluida) {
          tarefaRec.set('concluida_em', '2026-10-02 12:00:00.000Z')
        }
        tarefaRec.set('criado_automaticamente', true)
        app.save(tarefaRec)
      }

      // Se tiver avaliação concluída
      if (s.avaliacaoDecisao) {
        const avaliacaoRec = new Record(avaliacoesCol)
        avaliacaoRec.set('onboarding_id', onbRecord.id)
        avaliacaoRec.set('avaliador_id', gestor.id)
        avaliacaoRec.set('decisao', s.avaliacaoDecisao)
        avaliacaoRec.set('observacoes', s.avaliacaoObs)
        app.save(avaliacaoRec)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('onboardings')
      app.truncateCollection(col)
    } catch (_) {}
  },
)
