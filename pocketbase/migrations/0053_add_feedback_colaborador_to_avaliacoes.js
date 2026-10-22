/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0053: Adição de campos para "Feedback ao Colaborador" na coleção 'avaliacoes'.
 *
 * Campos adicionados:
 * - feedback_colaborador (text): Texto oficial redigido pelo gestor destinado ao colaborador
 * - feedback_token (text): Token único de acesso público sem login (idx único)
 * - feedback_lido_em (date): Carimbo de data/hora do primeiro acesso/leitura
 * - feedback_lido_ip (text): Endereço IP registrado no primeiro acesso
 * - feedback_acessos_count (number): Quantidade total de visualizações
 */
migrate(
  (app) => {
    const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes')

    if (!avaliacoesCol.fields.getByName('feedback_colaborador')) {
      avaliacoesCol.fields.add(
        new TextField({
          name: 'feedback_colaborador',
          required: false,
        }),
      )
    }

    if (!avaliacoesCol.fields.getByName('feedback_token')) {
      avaliacoesCol.fields.add(
        new TextField({
          name: 'feedback_token',
          required: false,
        }),
      )
    }

    if (!avaliacoesCol.fields.getByName('feedback_lido_em')) {
      avaliacoesCol.fields.add(
        new DateField({
          name: 'feedback_lido_em',
          required: false,
        }),
      )
    }

    if (!avaliacoesCol.fields.getByName('feedback_lido_ip')) {
      avaliacoesCol.fields.add(
        new TextField({
          name: 'feedback_lido_ip',
          required: false,
        }),
      )
    }

    if (!avaliacoesCol.fields.getByName('feedback_acessos_count')) {
      avaliacoesCol.fields.add(
        new NumberField({
          name: 'feedback_acessos_count',
          required: false,
          onlyInt: true,
        }),
      )
    }

    // Criar índice para o token de feedback
    try {
      avaliacoesCol.addIndex('idx_avaliacoes_feedback_token', false, 'feedback_token', '')
    } catch (_) {}

    app.save(avaliacoesCol)
    console.log(
      '[Migration 0053] Campos de Feedback ao Colaborador adicionados com sucesso à coleção "avaliacoes".',
    )
  },
  (app) => {
    const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes')
    try {
      avaliacoesCol.removeIndex('idx_avaliacoes_feedback_token')
    } catch (_) {}

    const fieldsToRemove = [
      'feedback_colaborador',
      'feedback_token',
      'feedback_lido_em',
      'feedback_lido_ip',
      'feedback_acessos_count',
    ]

    for (const f of fieldsToRemove) {
      if (avaliacoesCol.fields.getByName(f)) {
        avaliacoesCol.fields.removeByName(f)
      }
    }

    app.save(avaliacoesCol)
  },
)
