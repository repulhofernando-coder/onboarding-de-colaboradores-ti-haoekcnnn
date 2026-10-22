/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0055: Data de Contratação (Admissão) e Vencimento de Férias.
 *
 * 1. Coleção 'onboardings' (cadastro/ficha do colaborador técnico):
 *    - data_admissao (date, opcional) — preenchida SOMENTE por RH/Admin
 *    - ferias_vencimento (date, opcional) — CALCULADA pelo sistema:
 *      data de admissão + 12 meses (período aquisitivo), reiniciada para
 *      data_inicio_ferias + 12 meses a cada concessão de férias.
 *      Nunca digitada diretamente.
 *
 * 2. Nova coleção 'ferias_concessoes' — registro de concessão de férias:
 *    - onboarding (relation → onboardings, required, cascade)
 *    - colaborador_setor (text) — copiado para permitir matching direto de setor
 *    - data_inicio (date, required) — início do gozo; reinicia o ciclo aquisitivo
 *    - tipo (select: 'integral' | 'fracionada', required)
 *    - registrado_por (relation → users) / registrado_por_nome (text)
 *    - observacao (text)
 *    - created (autodate) / updated (autodate)
 *    - RLS: leitura Admin/RH + Gestão do próprio setor (onboarding.setor ~ @request.auth.setor);
 *      escrita (create/update/delete) exclusiva de Admin/RH.
 *
 * 3. Backfill idempotente: colaboradores com data_inicio e sem data_admissao
 *    recebem data_admissao = data_inicio e ferias_vencimento = admissão + 12 meses.
 *
 * 4. Índices para filtro/ordenação por vencimento, admissão e concessões.
 */
migrate(
  (app) => {
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')

    // ---- 1. Novos campos no cadastro do colaborador --------------------------
    if (!onboardingsCol.fields.getByName('data_admissao')) {
      onboardingsCol.fields.add(new DateField({ name: 'data_admissao' }))
    }
    if (!onboardingsCol.fields.getByName('ferias_vencimento')) {
      onboardingsCol.fields.add(new DateField({ name: 'ferias_vencimento' }))
    }
    app.save(onboardingsCol)

    // ---- 2. Coleção de concessões de férias ---------------------------------
    let feriasCol
    try {
      feriasCol = app.findCollectionByNameOrId('ferias_concessoes')
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

      // RLS: Admin/RH leitura e escrita total;
      // Gestão: visualiza apenas se o colaborador for do seu setor (onboarding.setor ~ @request.auth.setor)
      const regraLeitura =
        "@request.auth.id != '' && (" +
        "@request.auth.role = 'admin' || " +
        "@request.auth.role = 'rh' || " +
        "(@request.auth.role = 'gestao' && @request.auth.setor != '' && onboarding.setor ~ @request.auth.setor)" +
        ')'
      const regraEscrita =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"

      feriasCol = new Collection({
        name: 'ferias_concessoes',
        type: 'base',
        listRule: regraLeitura,
        viewRule: regraLeitura,
        createRule: regraEscrita,
        updateRule: regraEscrita,
        deleteRule: regraEscrita,
        fields: [
          {
            name: 'onboarding',
            type: 'relation',
            required: true,
            collectionId: onboardingsCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'colaborador_setor',
            type: 'text',
          },
          {
            name: 'data_inicio',
            type: 'date',
            required: true,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['integral', 'fracionada'],
            maxSelect: 1,
          },
          {
            name: 'registrado_por',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'registrado_por_nome',
            type: 'text',
          },
          {
            name: 'observacao',
            type: 'text',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ferias_conc_onboarding ON ferias_concessoes (onboarding)',
          'CREATE INDEX idx_ferias_conc_setor ON ferias_concessoes (colaborador_setor)',
          'CREATE INDEX idx_ferias_conc_data_inicio ON ferias_concessoes (data_inicio)',
        ],
      })
      app.save(feriasCol)
      console.log('[Migration 0055] Coleção "ferias_concessoes" criada com sucesso.')
    }

    // ---- 3. Backfill idempotente de admissão e vencimento --------------------
    app
      .db()
      .newQuery(`
      UPDATE onboardings
      SET data_admissao = substr(data_inicio, 1, 10),
          ferias_vencimento = date(substr(data_inicio, 1, 10), '+12 months')
      WHERE (data_admissao IS NULL OR data_admissao = '')
        AND data_inicio IS NOT NULL AND data_inicio != ''
    `)
      .execute()

    // ---- 4. Índices de consulta nos novos campos -----------------------------
    onboardingsCol.addIndex('idx_onboardings_data_admissao', false, 'data_admissao', '')
    onboardingsCol.addIndex('idx_onboardings_ferias_venc', false, 'ferias_vencimento', '')
    app.save(onboardingsCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ferias_concessoes')
      app.delete(col)
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      if (onboardingsCol.fields.getByName('data_admissao')) {
        onboardingsCol.fields.removeByName('data_admissao')
      }
      if (onboardingsCol.fields.getByName('ferias_vencimento')) {
        onboardingsCol.fields.removeByName('ferias_vencimento')
      }
      onboardingsCol.removeIndex('idx_onboardings_data_admissao')
      onboardingsCol.removeIndex('idx_onboardings_ferias_venc')
      app.save(onboardingsCol)
    } catch (_) {}
  },
)
