migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Adicionar o campo 'role' se não existir (valores: 'admin', 'rh', 'gestao')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          maxSelect: 1,
          values: ['admin', 'rh', 'gestao'],
        }),
      )
    }

    // 2. Garantir regras de acesso da coleção users para usuários autenticados
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = "@request.auth.id != ''"
    usersCol.updateRule = "@request.auth.id != ''"
    usersCol.deleteRule = "@request.auth.id != ''"

    app.save(usersCol)

    // 3. Atualizar índice se necessário
    try {
      usersCol.addIndex('idx_users_role', false, 'role', '')
      app.save(usersCol)
    } catch (_) {}

    // 4. Migrar usuários existentes conforme solicitado pelo usuário
    // - projetos@mundoopen.com.br -> admin
    // - rh@empresa.com.br -> rh
    // - gestor@empresa.com.br -> gestao
    // E definir fallback com base no setor antigo caso haja outros registros
    app
      .db()
      .newQuery("UPDATE users SET role = 'admin' WHERE email = 'projetos@mundoopen.com.br'")
      .execute()
    app.db().newQuery("UPDATE users SET role = 'rh' WHERE email = 'rh@empresa.com.br'").execute()
    app
      .db()
      .newQuery("UPDATE users SET role = 'gestao' WHERE email = 'gestor@empresa.com.br'")
      .execute()

    // Fallbacks para outros usuários se houver
    app
      .db()
      .newQuery("UPDATE users SET role = 'rh' WHERE (role IS NULL OR role = '') AND setor = 'RH'")
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE users SET role = 'gestao' WHERE (role IS NULL OR role = '') AND (setor = 'Gestão' OR setor IS NULL)",
      )
      .execute()
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('role')) {
        usersCol.fields.removeByName('role')
      }
      try {
        usersCol.removeIndex('idx_users_role')
      } catch (_) {}
      app.save(usersCol)
    } catch (_) {}
  },
)
