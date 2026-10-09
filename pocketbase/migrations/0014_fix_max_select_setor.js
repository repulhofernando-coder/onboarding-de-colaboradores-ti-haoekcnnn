migrate(
  (app) => {
    // 1. modelo_tarefas
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    const setorFieldModelo = modeloCol.fields.getByName('setor')
    if (setorFieldModelo && setorFieldModelo.type === 'select') {
      const allowed = [
        'windows',
        'linux_rede',
        'datacenter',
        'campo',
        'infraestrutura',
        'rh',
        'comercial',
        'laboratorio',
      ]
      setorFieldModelo.values = allowed
      setorFieldModelo.maxSelect = 1
      setorFieldModelo.required = false
      app.save(modeloCol)
    }

    // 2. onboardings
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const setorFieldOnb = onboardingsCol.fields.getByName('setor')
    if (setorFieldOnb && setorFieldOnb.type === 'select') {
      const allowed = [
        'windows',
        'linux_rede',
        'datacenter',
        'campo',
        'infraestrutura',
        'rh',
        'comercial',
        'laboratorio',
      ]
      setorFieldOnb.values = allowed
      setorFieldOnb.maxSelect = 1
      setorFieldOnb.required = false
      app.save(onboardingsCol)
    }

    // 3. materiais
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const setorOrigemField = materiaisCol.fields.getByName('setor_origem')
    if (setorOrigemField && setorOrigemField.type === 'select') {
      const allowed = [
        'windows',
        'linux_rede',
        'datacenter',
        'campo',
        'infraestrutura',
        'rh',
        'comercial',
        'laboratorio',
      ]
      setorOrigemField.values = allowed
      setorOrigemField.maxSelect = 1
      setorOrigemField.required = false
      app.save(materiaisCol)
    }
  },
  (app) => {
    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      const setorFieldModelo = modeloCol.fields.getByName('setor')
      if (setorFieldModelo) {
        setorFieldModelo.values = ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura']
        setorFieldModelo.maxSelect = 1
        app.save(modeloCol)
      }
    } catch (_) {}
  },
)
