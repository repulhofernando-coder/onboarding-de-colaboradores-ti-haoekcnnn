/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0052: Criação das coleções 'colaborador_documentos' e 'colaborador_anotacoes'.
 *
 * 1. Coleção 'colaborador_documentos' (Documentos Complementares do Colaborador):
 *    - colaborador (relation para onboardings, required, maxSelect 1, cascadeDelete: true)
 *    - material (relation para materiais - acervo único, required, maxSelect 1, cascadeDelete: false)
 *    - token (text, required, index único) -> link público sem login para o colaborador
 *    - status (select: 'pendente' | 'confirmado', default 'pendente')
 *    - confirmado_em (date)
 *    - confirmado_ip (text)
 *    - observacao (text)
 *    - atribuido_por (text)
 *    - atribuido_em (date)
 *    - RLS:
 *      - list / view: público (para consulta por token no link público sem login) OU usuários autenticados Admin/RH/Gestão do setor
 *      - create / update: Admin e RH gerenciam diretamente; colaboradores via link público atualizam confirmação (ou via hook público)
 *      - delete: Admin e RH apenas
 *
 * 2. Coleção 'colaborador_anotacoes' (Anotações & Feedbacks do Gestor):
 *    - colaborador (relation para onboardings, required, maxSelect 1, cascadeDelete: true)
 *    - tipo (select: 'feedback_1_1' | 'avaliacao' | 'observacao_geral', required, maxSelect 1)
 *    - texto (text, required)
 *    - autor (relation para users, required, maxSelect 1)
 *    - autor_nome (text)
 *    - autor_role (text)
 *    - RLS (PRIVACIDADE RESTRITA: estritamente interna, colaborador NUNCA vê):
 *      - list / view: Admin/RH leitura total; Gestão leitura apenas se colaborador for do seu setor
 *      - create: Admin/RH escrita total; Gestão escrita para colaborador do seu setor
 *      - update / delete: Admin/RH total; autor original pode atualizar
 */
migrate(
  (app) => {
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Criar coleção 'colaborador_documentos'
    let colabDocsCol
    try {
      colabDocsCol = app.findCollectionByNameOrId('colaborador_documentos')
    } catch (_) {
      colabDocsCol = new Collection({
        name: 'colaborador_documentos',
        type: 'base',
        // list / view liberadas para permitir validação pública via token ou acompanhamento autenticado
        listRule: '',
        viewRule: '',
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
        updateRule: '',
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
            name: 'material',
            type: 'relation',
            required: true,
            collectionId: materiaisCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'token',
            type: 'text',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'confirmado'],
            maxSelect: 1,
          },
          {
            name: 'confirmado_em',
            type: 'date',
            required: false,
          },
          {
            name: 'confirmado_ip',
            type: 'text',
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
            name: 'atribuido_em',
            type: 'date',
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
          'CREATE UNIQUE INDEX idx_colab_docs_token ON colaborador_documentos (token)',
          'CREATE INDEX idx_colab_docs_colaborador ON colaborador_documentos (colaborador)',
          'CREATE INDEX idx_colab_docs_material ON colaborador_documentos (material)',
          'CREATE INDEX idx_colab_docs_status ON colaborador_documentos (status)',
        ],
      })
      app.save(colabDocsCol)
      console.log('[Migration 0052] Coleção "colaborador_documentos" criada com sucesso.')
    }

    // 2. Criar coleção 'colaborador_anotacoes'
    let colabAnotacoesCol
    try {
      colabAnotacoesCol = app.findCollectionByNameOrId('colaborador_anotacoes')
    } catch (_) {
      colabAnotacoesCol = new Collection({
        name: 'colaborador_anotacoes',
        type: 'base',
        // RLS restrito: Admin/RH total; Gestão do mesmo setor
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
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          "(@request.auth.role = 'gestao' && @request.auth.setor != '' && colaborador.setor ~ @request.auth.setor)" +
          ')',
        updateRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          'autor = @request.auth.id' +
          ')',
        deleteRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || " +
          "@request.auth.role = 'rh' || " +
          'autor = @request.auth.id' +
          ')',
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
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['feedback_1_1', 'avaliacao', 'observacao_geral'],
            maxSelect: 1,
          },
          {
            name: 'texto',
            type: 'text',
            required: true,
          },
          {
            name: 'autor',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'autor_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'autor_role',
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
          'CREATE INDEX idx_colab_anot_colaborador ON colaborador_anotacoes (colaborador)',
          'CREATE INDEX idx_colab_anot_tipo ON colaborador_anotacoes (tipo)',
          'CREATE INDEX idx_colab_anot_autor ON colaborador_anotacoes (autor)',
        ],
      })
      app.save(colabAnotacoesCol)
      console.log('[Migration 0052] Coleção "colaborador_anotacoes" criada com sucesso.')
    }
  },
  (app) => {
    try {
      const colabAnotacoesCol = app.findCollectionByNameOrId('colaborador_anotacoes')
      app.delete(colabAnotacoesCol)
    } catch (_) {}

    try {
      const colabDocsCol = app.findCollectionByNameOrId('colaborador_documentos')
      app.delete(colabDocsCol)
    } catch (_) {}
  },
)
