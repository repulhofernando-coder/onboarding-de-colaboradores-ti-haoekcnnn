/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0047: Atualização das regras de coleção para filtro por setor no papel Gestão.
 *
 * Decisões de negócio:
 * 1. Admin e RH visualizam tudo (@request.auth.role = 'admin' || @request.auth.role = 'rh')
 * 2. Gestão (@request.auth.role = 'gestao') lê registros filtrados pelo campo setor do próprio usuário:
 *    - Se o usuário não tiver setor configurado (@request.auth.setor = '' || @request.auth.setor = null),
 *      nenhum registro de setor é retornado.
 *    - Se tiver setor, compara contra o campo setor do registro.
 * 3. Acesso público (links de tokens, confirmação sem login, prova pública) NÃO é bloqueado:
 *    - onboardings: list e view vazios ("") para suportar busca de token no portal público.
 *    - candidatos: a prova pública é servida pelo hook sem login (/backend/v1/candidato/prova/publico);
 *      a listagem autenticada fica filtrada para gestão.
 *    - questionarios, avaliacoes, avaliacoes_colaborador: atualizadas de acordo.
 */

migrate(
  (app) => {
    // 1. Atualizar regras da coleção 'candidatos'
    try {
      const colCandidatos = app.findCollectionByNameOrId('candidatos')
      if (colCandidatos) {
        colCandidatos.listRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && setor ~ @request.auth.setor)" +
          ')'

        colCandidatos.viewRule = colCandidatos.listRule

        app.save(colCandidatos)
        console.log('[Migration 0047] Regras de candidatos atualizadas.')
      }
    } catch (e) {
      console.warn('[Migration 0047] Aviso ao atualizar candidatos:', e)
    }

    // 2. Atualizar regras da coleção 'questionarios'
    try {
      const colQuest = app.findCollectionByNameOrId('questionarios')
      if (colQuest) {
        colQuest.listRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && (setor = '' || setor ~ @request.auth.setor))" +
          ')'

        colQuest.viewRule = colQuest.listRule

        app.save(colQuest)
        console.log('[Migration 0047] Regras de questionarios atualizadas.')
      }
    } catch (e) {
      console.warn('[Migration 0047] Aviso ao atualizar questionarios:', e)
    }

    // 3. Atualizar regras da coleção 'avaliacoes'
    try {
      const colAvals = app.findCollectionByNameOrId('avaliacoes')
      if (colAvals) {
        colAvals.listRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && onboarding_id.setor ~ @request.auth.setor)" +
          ')'

        colAvals.viewRule = colAvals.listRule

        app.save(colAvals)
        console.log('[Migration 0047] Regras de avaliacoes atualizadas.')
      }
    } catch (e) {
      console.warn('[Migration 0047] Aviso ao atualizar avaliacoes:', e)
    }

    // 4. Atualizar regras da coleção 'avaliacoes_colaborador'
    try {
      const colAvalsColab = app.findCollectionByNameOrId('avaliacoes_colaborador')
      if (colAvalsColab) {
        colAvalsColab.listRule =
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && onboarding_id.setor ~ @request.auth.setor)" +
          ')'

        colAvalsColab.viewRule = colAvalsColab.listRule

        app.save(colAvalsColab)
        console.log('[Migration 0047] Regras de avaliacoes_colaborador atualizadas.')
      }
    } catch (e) {
      console.warn('[Migration 0047] Aviso ao atualizar avaliacoes_colaborador:', e)
    }
  },
  (app) => {
    try {
      const colCandidatos = app.findCollectionByNameOrId('candidatos')
      if (colCandidatos) {
        colCandidatos.listRule = "@request.auth.id != ''"
        colCandidatos.viewRule = "@request.auth.id != ''"
        app.save(colCandidatos)
      }

      const colQuest = app.findCollectionByNameOrId('questionarios')
      if (colQuest) {
        colQuest.listRule = "@request.auth.id != ''"
        colQuest.viewRule = "@request.auth.id != ''"
        app.save(colQuest)
      }

      const colAvals = app.findCollectionByNameOrId('avaliacoes')
      if (colAvals) {
        colAvals.listRule = "@request.auth.id != ''"
        colAvals.viewRule = "@request.auth.id != ''"
        app.save(colAvals)
      }

      const colAvalsColab = app.findCollectionByNameOrId('avaliacoes_colaborador')
      if (colAvalsColab) {
        colAvalsColab.listRule = "@request.auth.id != ''"
        colAvalsColab.viewRule = "@request.auth.id != ''"
        app.save(colAvalsColab)
      }
    } catch (_) {}
  },
)
