/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. modelo_tarefas: setor -> text
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    const oldSetorModelo = modeloCol.fields.getByName('setor')
    if (oldSetorModelo && oldSetorModelo.type !== 'text') {
      modeloCol.fields.removeByName('setor')
      modeloCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(modeloCol)
    }

    // 2. onboardings: setor -> text
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const oldSetorOnb = onboardingsCol.fields.getByName('setor')
    if (oldSetorOnb && oldSetorOnb.type !== 'text') {
      onboardingsCol.fields.removeByName('setor')
      onboardingsCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(onboardingsCol)
    }

    // 3. materiais: setor_origem -> text
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const oldSetorOrigemMat = materiaisCol.fields.getByName('setor_origem')
    if (oldSetorOrigemMat && oldSetorOrigemMat.type !== 'text') {
      materiaisCol.fields.removeByName('setor_origem')
      materiaisCol.fields.add(
        new TextField({
          name: 'setor_origem',
          required: false,
        }),
      )
      app.save(materiaisCol)
    }

    // 4. fases_modelo: garantir setor como text
    const fasesCol = app.findCollectionByNameOrId('fases_modelo')
    const oldSetorFase = fasesCol.fields.getByName('setor')
    if (oldSetorFase && oldSetorFase.type !== 'text') {
      fasesCol.fields.removeByName('setor')
      fasesCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(fasesCol)
    }
  },
  (app) => {
    // Reverter não é necessário/desejado
  },
)
