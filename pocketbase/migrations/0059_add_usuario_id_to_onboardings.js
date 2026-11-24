/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0059: Campo de vínculo 'usuario_id' na coleção 'onboardings' (ficha do colaborador).
 *
 * Objetivo: UMA ficha por pessoa — colaboradores que também são usuários do sistema
 * (conta em users) ficam vinculados à conta, evitando fichas duplicadas.
 *
 * Regras:
 * - Campo relation opcional (não obrigatório), sem cascade delete: desligar/excluir
 *   o usuário do sistema NÃO apaga a ficha do colaborador.
 * - Backfill idempotente: vincula por e-mail (colaborador_email = users.email,
 *   comparação em minúsculas) apenas quando usuario_id está vazio.
 * - Eventos manuais de vinculação/desvinculação são registrados na auditoria pelo app.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('onboardings')

    if (!col.fields.getByName('usuario_id')) {
      const usersCol = app.findCollectionByNameOrId('users')
      col.fields.add(
        new RelationField({
          name: 'usuario_id',
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(col)
      console.log(
        '[Migration 0059] Campo usuario_id (relation users) adicionado à coleção onboardings.',
      )
    }

    // Backfill idempotente: só afeta fichas sem vínculo e com e-mail preenchido.
    try {
      const usuarios = app.findRecordsByFilter('users', '', '', 0, 0)
      const idPorEmail = {}
      for (const u of usuarios) {
        const email = String(u.email() || '')
          .trim()
          .toLowerCase()
        if (email && !idPorEmail[email]) idPorEmail[email] = u.id
      }

      const fichas = app.findRecordsByFilter(
        'onboardings',
        "usuario_id = '' && colaborador_email != ''",
        '',
        0,
        0,
      )
      let vinculadas = 0
      for (const f of fichas) {
        const email = String(f.colaborador_email() || '')
          .trim()
          .toLowerCase()
        const uid = idPorEmail[email]
        if (uid) {
          f.set('usuario_id', uid)
          app.save(f)
          vinculadas++
        }
      }
      if (vinculadas > 0) {
        console.log(
          '[Migration 0059] Backfill: ' + vinculadas + ' ficha(s) vinculada(s) por e-mail.',
        )
      }
    } catch (e) {
      console.warn('[Migration 0059] Aviso no backfill por e-mail:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('onboardings')
      if (col.fields.getByName('usuario_id')) {
        col.fields.removeByName('usuario_id')
        app.save(col)
      }
    } catch (_) {}
  },
)
