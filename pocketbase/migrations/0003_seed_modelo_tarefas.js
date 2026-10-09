migrate(
  (app) => {
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')

    const templates = [
      // Windows
      { setor: 'windows', titulo: 'Introdução ao Suporte Windows', tipo: 'video', ordem: 1 },
      { setor: 'windows', titulo: 'Manual de Atendimento Movidesk', tipo: 'manual', ordem: 2 },
      { setor: 'windows', titulo: 'Boas Práticas de Atendimento', tipo: 'manual', ordem: 3 },

      // Linux / Rede
      { setor: 'linux_rede', titulo: 'Noções de Redes', tipo: 'video', ordem: 1 },
      { setor: 'linux_rede', titulo: 'Manual do Passportal', tipo: 'manual', ordem: 2 },
      { setor: 'linux_rede', titulo: 'Boas Práticas de Atendimento', tipo: 'manual', ordem: 3 },

      // Datacenter
      { setor: 'datacenter', titulo: 'Visão Geral do Datacenter', tipo: 'video', ordem: 1 },
      { setor: 'datacenter', titulo: 'Manual de Operação do Datacenter', tipo: 'manual', ordem: 2 },
      { setor: 'datacenter', titulo: 'Boas Práticas de Atendimento', tipo: 'manual', ordem: 3 },

      // Campo
      { setor: 'campo', titulo: 'Protocolos de Campo', tipo: 'video', ordem: 1 },
      { setor: 'campo', titulo: 'Manual de Atendimento em Campo', tipo: 'manual', ordem: 2 },
      { setor: 'campo', titulo: 'Boas Práticas de Atendimento', tipo: 'manual', ordem: 3 },

      // Infraestrutura
      {
        setor: 'infraestrutura',
        titulo: 'Infraestrutura e Monitoramento',
        tipo: 'video',
        ordem: 1,
      },
      { setor: 'infraestrutura', titulo: 'Manual do Passportal', tipo: 'manual', ordem: 2 },
      { setor: 'infraestrutura', titulo: 'Boas Práticas de Atendimento', tipo: 'manual', ordem: 3 },
    ]

    for (const item of templates) {
      // Idempotência por setor + título
      const existing = app.findRecordsByFilter(
        'modelo_tarefas',
        `setor = '${item.setor}' && titulo = '${item.titulo}'`,
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        const record = new Record(modeloCol)
        record.set('setor', item.setor)
        record.set('titulo', item.titulo)
        record.set('tipo', item.tipo)
        record.set('conteudo_link', '')
        record.set('obrigatorio', true)
        record.set('ordem', item.ordem)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('modelo_tarefas')
      app.truncateCollection(col)
    } catch (_) {}
  },
)
