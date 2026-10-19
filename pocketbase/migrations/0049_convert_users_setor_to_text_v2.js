/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0049: Converte o campo 'setor' da coleção 'users' (_pb_users_auth_)
 * de SelectField ('RH' | 'Gestão') para TextField opcional.
 *
 * Preserva integralmente os valores existentes dos usuários ("RH", "Gestão", etc.)
 * e permite que gestores e demais usuários possam ser vinculados a qualquer setor cadastrado
 * dinamicamente no sistema (ex.: "Windows", "Linux / Rede", "Datacenter", "Infraestrutura",
 * "Projetos/Ativação", etc.).
 */
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const setorField = usersCol.fields.getByName('setor')

    if (setorField && setorField.type !== 'text') {
      usersCol.fields.removeByName('setor')
      usersCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      try {
        usersCol.addIndex('idx_users_setor', false, 'setor', '')
      } catch (_) {}
      app.save(usersCol)
      console.log('[Migration 0049] Campo users.setor convertido com sucesso para TextField.')
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
      try {
        usersCol.addIndex('idx_users_setor', false, 'setor', '')
      } catch (_) {}
      app.save(usersCol)
    } catch (_) {}
  },
)
