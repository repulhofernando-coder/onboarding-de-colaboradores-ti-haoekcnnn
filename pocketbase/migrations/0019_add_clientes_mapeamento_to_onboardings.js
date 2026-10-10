/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      if (!onboardingsCol.fields.getByName('clientes_mapeamento')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'clientes_mapeamento',
            type: 'json',
            required: false,
          }),
        )
        app.save(onboardingsCol)
      }
    } catch (err) {
      console.log('Erro ao adicionar clientes_mapeamento em onboardings:', err)
      throw err
    }
  },
  (app) => {
    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      const field = onboardingsCol.fields.getByName('clientes_mapeamento')
      if (field) {
        onboardingsCol.fields.removeByName('clientes_mapeamento')
        app.save(onboardingsCol)
      }
    } catch (err) {
      console.log('Erro ao reverter clientes_mapeamento em onboardings:', err)
    }
  },
)
