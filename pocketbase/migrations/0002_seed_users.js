migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const seedUsers = [
      {
        email: 'projetos@mundoopen.com.br',
        name: 'Administrador TI',
        password: 'Skip@Pass',
        setor: 'Gestão',
      },
      {
        email: 'rh@empresa.com.br',
        name: 'Mariana Silva (RH)',
        password: 'Skip@Pass',
        setor: 'RH',
      },
      {
        email: 'gestor@empresa.com.br',
        name: 'Carlos Mendes (Gestor TI)',
        password: 'Skip@Pass',
        setor: 'Gestão',
      },
    ]

    for (const u of seedUsers) {
      try {
        const existing = app.findAuthRecordByEmail('_pb_users_auth_', u.email)
        if (u.setor && (!existing.getString('setor') || existing.getString('setor') !== u.setor)) {
          existing.set('setor', u.setor)
          existing.set('name', u.name)
          app.save(existing)
        }
      } catch (_) {
        const record = new Record(users)
        record.setEmail(u.email)
        record.setPassword(u.password)
        record.setVerified(true)
        record.set('name', u.name)
        record.set('setor', u.setor)
        app.save(record)
      }
    }
  },
  (app) => {
    const emails = ['projetos@mundoopen.com.br', 'rh@empresa.com.br', 'gestor@empresa.com.br']
    for (const email of emails) {
      try {
        const record = app.findAuthRecordByEmail('_pb_users_auth_', email)
        app.delete(record)
      } catch (_) {}
    }
  },
)
