migrate(
  (app) => {
    // 1. Atualizar valores permitidos do select legado 'setor' em modelo_tarefas
    // para incluir os setores 'rh', 'comercial', 'laboratorio' e quaisquer novos
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    const setorFieldModelo = modeloCol.fields.getByName('setor')
    if (setorFieldModelo) {
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
      if (typeof setorFieldModelo.setValues === 'function') {
        setorFieldModelo.setValues(allowed)
      } else {
        setorFieldModelo.values = allowed
      }
      setorFieldModelo.required = false
      setorFieldModelo.maxSelect = allowed.length
      app.save(modeloCol)
    }

    // 2. Atualizar valores permitidos do select legado 'setor' em onboardings
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const setorFieldOnboardings = onboardingsCol.fields.getByName('setor')
    if (setorFieldOnboardings) {
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
      if (typeof setorFieldOnboardings.setValues === 'function') {
        setorFieldOnboardings.setValues(allowed)
      } else {
        setorFieldOnboardings.values = allowed
      }
      setorFieldOnboardings.required = false
      setorFieldOnboardings.maxSelect = allowed.length
      app.save(onboardingsCol)
    }

    // 3. Atualizar valores permitidos do select legado 'setor_origem' em materiais
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const setorOrigemField = materiaisCol.fields.getByName('setor_origem')
    if (setorOrigemField) {
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
      if (typeof setorOrigemField.setValues === 'function') {
        setorOrigemField.setValues(allowed)
      } else {
        setorOrigemField.values = allowed
      }
      setorOrigemField.required = false
      setorOrigemField.maxSelect = allowed.length
      app.save(materiaisCol)
    }

    // 4. Backfill retroativo em modelo_tarefas: garantir setor_ref preenchido se setor existir e vice-versa
    const allSetores = app.findRecordsByFilter('setores', '', 'ordem', 100, 0)
    const mapChaveToId = {}
    const mapIdToChave = {}
    for (const s of allSetores) {
      const c = s.getString('chave')
      const n = s.getString('nome').toLowerCase()
      if (c) {
        mapChaveToId[c] = s.id
        mapIdToChave[s.id] = c
      }
      mapChaveToId[n] = s.id
    }

    const modelos = app.findRecordsByFilter('modelo_tarefas', '', '', 1000, 0)
    for (const m of modelos) {
      let changed = false
      const sRef = m.getString('setor_ref')
      const sVal = m.getString('setor')

      // Se tem setor texto mas não tem setor_ref
      if (!sRef && sVal) {
        const targetId = mapChaveToId[sVal] || mapChaveToId[sVal.toLowerCase()]
        if (targetId) {
          m.set('setor_ref', targetId)
          changed = true
        }
      }

      // Se tem setor_ref mas setor texto está vazio ou nulo
      if (sRef && !sVal) {
        const targetChave = mapIdToChave[sRef]
        if (targetChave) {
          m.set('setor', targetChave)
          changed = true
        }
      }

      if (changed) {
        app.save(m)
      }
    }
  },
  (app) => {
    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      const setorFieldModelo = modeloCol.fields.getByName('setor')
      if (setorFieldModelo) {
        setorFieldModelo.values = ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura']
        app.save(modeloCol)
      }
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      const setorFieldOnb = onboardingsCol.fields.getByName('setor')
      if (setorFieldOnb) {
        setorFieldOnb.values = ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura']
        app.save(onboardingsCol)
      }
    } catch (_) {}

    try {
      const materiaisCol = app.findCollectionByNameOrId('materiais')
      const setorOrigemField = materiaisCol.fields.getByName('setor_origem')
      if (setorOrigemField) {
        setorOrigemField.values = ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura']
        app.save(materiaisCol)
      }
    } catch (_) {}
  },
)
