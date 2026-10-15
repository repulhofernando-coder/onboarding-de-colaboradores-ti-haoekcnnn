migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidatos')

    // 1. Atualizar campo status para incluir novos valores:
    // 'aprovado_aguardando_rh', 'desistiu'
    // Valores totais:
    // 'pre_selecionado', 'prova_enviada', 'prova_concluida', 'aprovado_aguardando_rh', 'aprovado', 'reprovado', 'desistiu', 'convertido'
    const statusField = col.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'pre_selecionado',
        'prova_enviada',
        'prova_concluida',
        'aprovado_aguardando_rh',
        'aprovado',
        'reprovado',
        'desistiu',
        'convertido',
      ]
      statusField.maxSelect = 1
    }

    // 2. Adicionar campos opcionais de rastro do RH caso não existam
    if (!col.fields.getByName('motivo_desistencia')) {
      col.fields.add(
        new TextField({
          name: 'motivo_desistencia',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('rh_responsavel')) {
      col.fields.add(
        new RelationField({
          name: 'rh_responsavel',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('data_formalizacao_rh')) {
      col.fields.add(
        new DateField({
          name: 'data_formalizacao_rh',
          required: false,
        }),
      )
    }

    // Migrar registros existentes que estejam em 'aprovado' para 'aprovado_aguardando_rh' se ainda não foram convertidos
    app.save(col)

    try {
      app
        .db()
        .newQuery(
          "UPDATE candidatos SET status = 'aprovado_aguardando_rh' WHERE status = 'aprovado' AND (colaborador_id IS NULL OR colaborador_id = '')",
        )
        .execute()
    } catch (e) {
      console.log('[Migration 0033] Aviso ao atualizar registros existentes:', e)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidatos')
    const statusField = col.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'pre_selecionado',
        'prova_enviada',
        'prova_concluida',
        'aprovado',
        'reprovado',
        'convertido',
      ]
      statusField.maxSelect = 1
    }
    const fDesistencia = col.fields.getByName('motivo_desistencia')
    if (fDesistencia) col.fields.remove(fDesistencia)

    const fRh = col.fields.getByName('rh_responsavel')
    if (fRh) col.fields.remove(fRh)

    const fData = col.fields.getByName('data_formalizacao_rh')
    if (fData) col.fields.remove(fData)

    app.save(col)
  },
)
