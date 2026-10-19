/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0048: Converte o campo 'setor' da coleção 'users' de SelectField restrito (RH | Gestão)
 * para TextField opcional.
 *
 * Isso permite armazenar qualquer setor real cadastrado dinamicamente no sistema (ex: "Windows",
 * "Linux / Rede", "Datacenter", "Infraestrutura", "RH", ou novas áreas cadastradas pelo usuário),
 * alinhando com as regras de visibilidade e desvinculando o campo 'setor' do antigo valor fixo 'Gestão'.
 */
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const oldSetorField = usersCol.fields.getByName('setor')

    if (oldSetorField && oldSetorField.type === 'select') {
      usersCol.fields.removeByName('setor')
      usersCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      // Garantir o índice idx_users_setor
      usersCol.addIndex('idx_users_setor', false, 'setor', '')
      app.save(usersCol)
      console.log('[Migration 0048] users.setor convertido com sucesso para TextField.')
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.fields.removeByName('setor')
      usersCol.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          values: ['RH', 'Gestão'],
          maxSelect: 1,
        }),
      )
      usersCol.addIndex('idx_users_setor', false, 'setor', '')
      app.save(usersCol)
    } catch (_) {}
  },
)
