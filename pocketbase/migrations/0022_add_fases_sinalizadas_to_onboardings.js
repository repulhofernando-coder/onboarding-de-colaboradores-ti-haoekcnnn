/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('onboardings')

    if (!col.fields.getByName('fases_sinalizadas')) {
      col.fields.add(
        new JSONField({
          name: 'fases_sinalizadas',
          required: false,
        }),
      )
    }

    // Permitir atualização pública de fases_sinalizadas via token do colaborador
    // se houver updateRule restritiva, ajustamos para incluir token_acesso_colaborador ou permitir atualização segura
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('onboardings')
      if (col.fields.getByName('fases_sinalizadas')) {
        col.fields.removeByName('fases_sinalizadas')
        app.save(col)
      }
    } catch (_) {}
  },
)
