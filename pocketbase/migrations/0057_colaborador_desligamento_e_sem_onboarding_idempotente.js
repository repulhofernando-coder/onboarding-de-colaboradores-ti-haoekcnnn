/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const onboardings = app.findCollectionByNameOrId('onboardings')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Campo sem_onboarding
    if (!onboardings.fields.getByName('sem_onboarding')) {
      onboardings.fields.add(new BoolField({ name: 'sem_onboarding' }))
    }

    // 2. Campos de Desligamento
    if (!onboardings.fields.getByName('desligado')) {
      onboardings.fields.add(new BoolField({ name: 'desligado' }))
    }

    if (!onboardings.fields.getByName('desligado_em')) {
      onboardings.fields.add(new DateField({ name: 'desligado_em' }))
    }

    if (!onboardings.fields.getByName('desligamento_motivo')) {
      onboardings.fields.add(new TextField({ name: 'desligamento_motivo' }))
    }

    if (!onboardings.fields.getByName('desligamento_obs')) {
      onboardings.fields.add(new TextField({ name: 'desligamento_obs' }))
    }

    if (!onboardings.fields.getByName('desligado_por')) {
      onboardings.fields.add(
        new RelationField({
          name: 'desligado_por',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // 3. Atualizar status enum para incluir sem_onboarding se necessário
    const statusField = onboardings.fields.getByName('status')
    if (statusField && statusField.type === 'select') {
      const vals = statusField.values || []
      if (!vals.includes('sem_onboarding')) {
        vals.push('sem_onboarding')
      }
      statusField.values = vals
    }

    app.save(onboardings)
  },
  (app) => {
    // Reversão no-op idempotente
  },
)
