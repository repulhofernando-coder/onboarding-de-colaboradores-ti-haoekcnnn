/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('modelo_tarefas')

    // Verificar se já existe algum modelo de teste para Comercial
    let existing = null
    try {
      existing = app.findFirstRecordByFilter(
        'modelo_tarefas',
        "titulo = '__teste_validacao_comercial__'",
      )
    } catch (e) {
      existing = null
    }

    if (!existing) {
      // Buscar id do setor Comercial e id de um material da biblioteca
      let setorComercial = null
      try {
        setorComercial = app.findFirstRecordByFilter('setores', "chave = 'comercial'")
      } catch (e) {
        setorComercial = null
      }

      let materialItem = null
      try {
        materialItem = app.findFirstRecordByFilter('materiais', "id != ''")
      } catch (e) {
        materialItem = null
      }

      const record = new Record(collection)
      record.set('titulo', '__teste_validacao_comercial__')
      record.set('descricao', 'Item de validação de material associado ao setor Comercial')
      record.set('tipo', 'manual')
      record.set('etapa', 2)
      record.set('setor', 'comercial')
      if (setorComercial) {
        record.set('setor_ref', setorComercial.id)
      }
      if (materialItem) {
        record.set('material', materialItem.id)
      }
      record.set('obrigatoria', true)
      record.set('ordem', 1)

      app.save(record)

      // Agora simula o update associando outro material ou mantendo para validar que update funciona sem erro 400
      record.set('descricao', 'Item de validação atualizado com sucesso - sem erro 400')
      app.save(record)

      // Limpar o registro de teste após a validação
      app.delete(record)
    }
  },
  (app) => {
    // down migration vazia
  },
)
