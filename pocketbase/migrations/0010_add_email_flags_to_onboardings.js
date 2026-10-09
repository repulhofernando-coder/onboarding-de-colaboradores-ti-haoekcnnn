migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('onboardings')

    if (!col.fields.getByName('email_etapa1_enviado')) {
      col.fields.add(
        new BoolField({
          name: 'email_etapa1_enviado',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('email_etapa2_enviado')) {
      col.fields.add(
        new BoolField({
          name: 'email_etapa2_enviado',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('email_avaliacao_enviado')) {
      col.fields.add(
        new BoolField({
          name: 'email_avaliacao_enviado',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('onboardings')
      if (col.fields.getByName('email_etapa1_enviado')) {
        col.fields.removeByName('email_etapa1_enviado')
      }
      if (col.fields.getByName('email_etapa2_enviado')) {
        col.fields.removeByName('email_etapa2_enviado')
      }
      if (col.fields.getByName('email_avaliacao_enviado')) {
        col.fields.removeByName('email_avaliacao_enviado')
      }
      app.save(col)
    } catch (_) {}
  },
)
