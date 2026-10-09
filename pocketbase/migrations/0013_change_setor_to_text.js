migrate(
  (app) => {
    // Para modelo_tarefas, onboardings e materiais:
    // O tipo select com lista estrita de values ('windows'..'infraestrutura') rejeita qualquer
    // nova área (RH, Comercial, Laboratório ou futuras áreas criadas pelo usuário via Gerenciar Áreas).
    // A migration 0009 já adicionou o campo relation 'setor_ref' -> setores para gerenciar isso dinamicamente.
    // Convertemos o campo legado 'setor'/'setor_origem' para TextField opcional (ou mantemos select aberto).
    // No PocketBase v0.36, alterar o tipo de um campo existente não é permitido diretamente, mas
    // podemos remover o campo select 'setor' e recriar como TextField ('setor') preservando os dados,
    // OU simplesmente atualizar os options/values do SelectField.

    // Vamos testar se remover e recriar como TextField resolve de vez para todas as áreas futuras:
    // Primeiro guardamos os dados atuais de setor em uma coluna temporária via SQL se necessário,
    // ou usamos a API do PocketBase para substituir o SelectField por TextField.

    // 1. modelo_tarefas
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    const oldSetorField = modeloCol.fields.getByName('setor')
    if (oldSetorField && oldSetorField.type === 'select') {
      modeloCol.fields.removeByName('setor')
      modeloCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(modeloCol)
    }

    // 2. onboardings
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const oldSetorOnb = onboardingsCol.fields.getByName('setor')
    if (oldSetorOnb && oldSetorOnb.type === 'select') {
      onboardingsCol.fields.removeByName('setor')
      onboardingsCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(onboardingsCol)
    }

    // 3. materiais
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const oldSetorMat = materiaisCol.fields.getByName('setor_origem')
    if (oldSetorMat && oldSetorMat.type === 'select') {
      materiaisCol.fields.removeByName('setor_origem')
      materiaisCol.fields.add(
        new TextField({
          name: 'setor_origem',
          required: false,
        }),
      )
      app.save(materiaisCol)
    }
  },
  (app) => {
    // Reverter para SelectField
    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      modeloCol.fields.removeByName('setor')
      modeloCol.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
        }),
      )
      app.save(modeloCol)
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      onboardingsCol.fields.removeByName('setor')
      onboardingsCol.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
        }),
      )
      app.save(onboardingsCol)
    } catch (_) {}

    try {
      const materiaisCol = app.findCollectionByNameOrId('materiais')
      materiaisCol.fields.removeByName('setor_origem')
      materiaisCol.fields.add(
        new SelectField({
          name: 'setor_origem',
          required: false,
          values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
        }),
      )
      app.save(materiaisCol)
    } catch (_) {}
  },
)
