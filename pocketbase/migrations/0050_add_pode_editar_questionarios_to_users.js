/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0050: Adiciona o campo booleano 'pode_editar_questionarios' na coleção 'users' (_pb_users_auth_)
 * e atualiza as regras de API (RLS) nas coleções 'questionarios' e 'teste_questoes'.
 *
 * Regras de Negócio:
 * 1. Campo booleano 'pode_editar_questionarios' em 'users', default false, backfill false para existentes.
 * 2. Coleção 'questionarios':
 *    - create/update/delete: Admin e RH sempre podem; Gestão pode somente se pode_editar_questionarios = true
 *      e (para update/delete) o questionário for do mesmo setor do gestor.
 *      RLS: @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (@request.auth.role = 'gestao' && @request.auth.pode_editar_questionarios = true && @request.auth.setor != '' && (setor = '' || setor ~ @request.auth.setor)))
 * 3. Coleção 'teste_questoes':
 *    - create/update/delete: Admin e RH sempre podem; Gestão pode somente se pode_editar_questionarios = true
 *      e questionario_id.setor for do setor do gestor.
 *      RLS: @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (@request.auth.role = 'gestao' && @request.auth.pode_editar_questionarios = true && @request.auth.setor != '' && (questionario_id.setor = '' || questionario_id.setor ~ @request.auth.setor)))
 * 4. Leitura permanece como estava: gestor continua vendo questionários e questões do próprio setor.
 */
migrate(
  (app) => {
    // 1. Adicionar campo 'pode_editar_questionarios' em 'users'
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('pode_editar_questionarios')) {
      usersCol.fields.add(
        new BoolField({
          name: 'pode_editar_questionarios',
          required: false,
        }),
      )
      app.save(usersCol)
      console.log('[Migration 0050] Campo pode_editar_questionarios adicionado na coleção users.')
    }

    // Backfill defensivo: garantir que usuários existentes fiquem com false se null
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET pode_editar_questionarios = 0 WHERE pode_editar_questionarios IS NULL OR pode_editar_questionarios = ''",
        )
        .execute()
    } catch (e) {
      console.warn('[Migration 0050] Aviso no backfill de pode_editar_questionarios:', e)
    }

    // 2. Atualizar regras da coleção 'questionarios'
    try {
      const colQuest = app.findCollectionByNameOrId('questionarios')
      if (colQuest) {
        // create, update e delete rule para questionários
        const writeRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.pode_editar_questionarios = true && @request.auth.setor != '' && (setor = '' || setor ~ @request.auth.setor))" +
          ')'

        colQuest.createRule = writeRule
        colQuest.updateRule = writeRule
        colQuest.deleteRule = writeRule

        app.save(colQuest)
        console.log('[Migration 0050] Regras de escrita de questionarios atualizadas com sucesso.')
      }
    } catch (e) {
      console.warn('[Migration 0050] Aviso ao atualizar regras de questionarios:', e)
    }

    // 3. Atualizar regras da coleção 'teste_questoes'
    try {
      const colQuestoes = app.findCollectionByNameOrId('teste_questoes')
      if (colQuestoes) {
        const questoesWriteRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.pode_editar_questionarios = true && @request.auth.setor != '' && (questionario_id.setor = '' || questionario_id.setor ~ @request.auth.setor))" +
          ')'

        colQuestoes.createRule = questoesWriteRule
        colQuestoes.updateRule = questoesWriteRule
        colQuestoes.deleteRule = questoesWriteRule

        app.save(colQuestoes)
        console.log('[Migration 0050] Regras de escrita de teste_questoes atualizadas com sucesso.')
      }
    } catch (e) {
      console.warn('[Migration 0050] Aviso ao atualizar regras de teste_questoes:', e)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('pode_editar_questionarios')) {
        usersCol.fields.removeByName('pode_editar_questionarios')
        app.save(usersCol)
      }
    } catch (_) {}

    try {
      const colQuest = app.findCollectionByNameOrId('questionarios')
      if (colQuest) {
        colQuest.createRule = "@request.auth.role = 'admin'"
        colQuest.updateRule = "@request.auth.role = 'admin'"
        colQuest.deleteRule = "@request.auth.role = 'admin'"
        app.save(colQuest)
      }
    } catch (_) {}

    try {
      const colQuestoes = app.findCollectionByNameOrId('teste_questoes')
      if (colQuestoes) {
        colQuestoes.createRule = "@request.auth.role = 'admin'"
        colQuestoes.updateRule = "@request.auth.role = 'admin'"
        colQuestoes.deleteRule = "@request.auth.role = 'admin'"
        app.save(colQuestoes)
      }
    } catch (_) {}
  },
)
