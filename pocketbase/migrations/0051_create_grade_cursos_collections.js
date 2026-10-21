/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0051: Criação das coleções 'cursos' e 'colaborador_cursos' para a Grade de Cursos.
 *
 * Decisões de negócio e requisitos:
 * 1. Coleção 'cursos':
 *    - titulo (text, required)
 *    - descricao (text)
 *    - link (url, required)
 *    - nivel (select: 'essencial', 'recomendado', 'complementar', required, maxSelect 1)
 *    - setor (relation para setores cadastrados, maxSelect 1)
 *    - ativo (bool, default true)
 *    - Regras de API (RLS):
 *      - list / view: Admin/RH leitura total; Gestão leitura somente se tiver setor e coincidir com o setor do curso
 *        RLS: @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (@request.auth.role = 'gestao' && @request.auth.setor != '' && (setor.chave ~ @request.auth.setor || setor.nome ~ @request.auth.setor || setor = @request.auth.setor)))
 *      - create / update / delete: Admin e RH apenas (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh'))
 *
 * 2. Coleção 'colaborador_cursos':
 *    - colaborador (relation para onboardings, required, maxSelect 1, cascadeDelete: true)
 *    - curso (relation para cursos, required, maxSelect 1, cascadeDelete: false)
 *    - status (select: 'pendente', 'em_andamento', 'concluido', required, maxSelect 1)
 *    - atribuido_em (date)
 *    - concluido_em (date)
 *    - observacao (text)
 *    - atribuido_por (text)
 *    - concluido_por (text)
 *    - Regras de API (RLS):
 *      - list / view: Admin/RH leitura total; Gestão leitura do próprio setor do colaborador
 *        RLS: @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (@request.auth.role = 'gestao' && @request.auth.setor != '' && colaborador.setor ~ @request.auth.setor))
 *      - create / update / delete: Admin e RH apenas (Gestão NÃO escreve, marcação é RH/Admin)
 *        RLS: @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')
 */
migrate(
  (app) => {
    const setoresCol = app.findCollectionByNameOrId('setores')
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')

    // 1. Criar coleção 'cursos'
    let cursosCol
    try {
      cursosCol = app.findCollectionByNameOrId('cursos')
    } catch (_) {
      cursosCol = new Collection({
        name: 'cursos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && (setor.chave ~ @request.auth.setor || setor.nome ~ @request.auth.setor || setor = @request.auth.setor))" +
          ')',
        viewRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && (setor.chave ~ @request.auth.setor || setor.nome ~ @request.auth.setor || setor = @request.auth.setor))" +
          ')',
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        fields: [
          {
            name: 'titulo',
            type: 'text',
            required: true,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'link',
            type: 'url',
            required: true,
          },
          {
            name: 'nivel',
            type: 'select',
            required: true,
            values: ['essencial', 'recomendado', 'complementar'],
            maxSelect: 1,
          },
          {
            name: 'setor',
            type: 'relation',
            required: true,
            collectionId: setoresCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
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
          'CREATE INDEX idx_cursos_setor ON cursos (setor)',
          'CREATE INDEX idx_cursos_nivel ON cursos (nivel)',
          'CREATE INDEX idx_cursos_ativo ON cursos (ativo)',
        ],
      })
      app.save(cursosCol)
      console.log('[Migration 0051] Coleção "cursos" criada com sucesso.')
    }

    const cursosId = cursosCol.id

    // 2. Criar coleção 'colaborador_cursos'
    let colabCursosCol
    try {
      colabCursosCol = app.findCollectionByNameOrId('colaborador_cursos')
    } catch (_) {
      colabCursosCol = new Collection({
        name: 'colaborador_cursos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && colaborador.setor ~ @request.auth.setor)" +
          ')',
        viewRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && colaborador.setor ~ @request.auth.setor)" +
          ')',
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        fields: [
          {
            name: 'colaborador',
            type: 'relation',
            required: true,
            collectionId: onboardingsCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'curso',
            type: 'relation',
            required: true,
            collectionId: cursosId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'em_andamento', 'concluido'],
            maxSelect: 1,
          },
          {
            name: 'atribuido_em',
            type: 'date',
            required: false,
          },
          {
            name: 'concluido_em',
            type: 'date',
            required: false,
          },
          {
            name: 'observacao',
            type: 'text',
            required: false,
          },
          {
            name: 'atribuido_por',
            type: 'text',
            required: false,
          },
          {
            name: 'concluido_por',
            type: 'text',
            required: false,
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
          'CREATE INDEX idx_colab_cursos_colab ON colaborador_cursos (colaborador)',
          'CREATE INDEX idx_colab_cursos_curso ON colaborador_cursos (curso)',
          'CREATE INDEX idx_colab_cursos_status ON colaborador_cursos (status)',
        ],
      })
      app.save(colabCursosCol)
      console.log('[Migration 0051] Coleção "colaborador_cursos" criada com sucesso.')
    }
  },
  (app) => {
    try {
      const colabCursosCol = app.findCollectionByNameOrId('colaborador_cursos')
      app.delete(colabCursosCol)
    } catch (_) {}

    try {
      const cursosCol = app.findCollectionByNameOrId('cursos')
      app.delete(cursosCol)
    } catch (_) {}
  },
)
