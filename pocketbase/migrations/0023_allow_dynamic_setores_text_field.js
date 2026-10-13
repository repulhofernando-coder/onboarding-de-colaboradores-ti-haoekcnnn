/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Converter campo 'setor' em modelo_tarefas para TextField opcional
    // Isso permite gravar qualquer slug ou chave de setor (inclusive áreas criadas dinamicamente como 'projetos_ativacao')
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    const oldSetorModelo = modeloCol.fields.getByName('setor')
    if (oldSetorModelo && oldSetorModelo.type === 'select') {
      modeloCol.fields.removeByName('setor')
      modeloCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(modeloCol)
    }

    // 2. Converter campo 'setor' em onboardings para TextField opcional
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

    // 3. Converter campo 'setor_origem' em materiais para TextField opcional
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    const oldSetorOrigemMat = materiaisCol.fields.getByName('setor_origem')
    if (oldSetorOrigemMat && oldSetorOrigemMat.type === 'select') {
      materiaisCol.fields.removeByName('setor_origem')
      materiaisCol.fields.add(
        new TextField({
          name: 'setor_origem',
          required: false,
        }),
      )
      app.save(materiaisCol)
    }

    // 4. Backfill e normalização:
    // Mapeamento de chave/nome para id e vice-versa a partir de setores existentes
    const allSetores = app.findRecordsByFilter('setores', '', 'ordem', 200, 0)
    const mapChaveToId = {}
    const mapIdToChave = {}
    for (const s of allSetores) {
      const id = s.id
      const chave = s.getString('chave')
      const nome = s.getString('nome')
      if (chave) {
        mapChaveToId[chave.toLowerCase()] = id
        mapIdToChave[id] = chave.toLowerCase()
      }
      if (nome) {
        mapChaveToId[nome.toLowerCase()] = id
        if (!mapIdToChave[id]) {
          mapIdToChave[id] = nome.toLowerCase()
        }
      }
    }

    // Sincronizar modelo_tarefas: garantir setor_ref preenchido e setor em formato string limpa
    try {
      const modelos = app.findRecordsByFilter('modelo_tarefas', '', '', 1000, 0)
      for (const m of modelos) {
        let changed = false
        let sVal = m.getString('setor')
        const sRef = m.getString('setor_ref')

        // Limpar caso venha como JSON de array ["windows"]
        if (sVal.startsWith('[') && sVal.endsWith(']')) {
          try {
            const parsed = JSON.parse(sVal)
            if (Array.isArray(parsed) && parsed.length > 0) {
              sVal = String(parsed[0])
              m.set('setor', sVal)
              changed = true
            }
          } catch (_) {}
        }

        if (sVal && !sRef) {
          const targetId = mapChaveToId[sVal.toLowerCase()]
          if (targetId) {
            m.set('setor_ref', targetId)
            changed = true
          }
        } else if (sRef && !sVal) {
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
    } catch (e) {
      console.log('Aviso ao sincronizar modelo_tarefas:', e)
    }

    // Sincronizar onboardings
    try {
      const onbs = app.findRecordsByFilter('onboardings', '', '', 1000, 0)
      for (const o of onbs) {
        let changed = false
        let sVal = o.getString('setor')
        const sRef = o.getString('setor_ref')

        if (sVal.startsWith('[') && sVal.endsWith(']')) {
          try {
            const parsed = JSON.parse(sVal)
            if (Array.isArray(parsed) && parsed.length > 0) {
              sVal = String(parsed[0])
              o.set('setor', sVal)
              changed = true
            }
          } catch (_) {}
        }

        if (sVal && !sRef) {
          const targetId = mapChaveToId[sVal.toLowerCase()]
          if (targetId) {
            o.set('setor_ref', targetId)
            changed = true
          }
        } else if (sRef && !sVal) {
          const targetChave = mapIdToChave[sRef]
          if (targetChave) {
            o.set('setor', targetChave)
            changed = true
          }
        }

        if (changed) {
          app.save(o)
        }
      }
    } catch (e) {
      console.log('Aviso ao sincronizar onboardings:', e)
    }

    // Sincronizar materiais
    try {
      const mats = app.findRecordsByFilter('materiais', '', '', 1000, 0)
      for (const mat of mats) {
        let changed = false
        let sVal = mat.getString('setor_origem')
        const sRef = mat.getString('setor_ref')

        if (sVal.startsWith('[') && sVal.endsWith(']')) {
          try {
            const parsed = JSON.parse(sVal)
            if (Array.isArray(parsed) && parsed.length > 0) {
              sVal = String(parsed[0])
              mat.set('setor_origem', sVal)
              changed = true
            }
          } catch (_) {}
        }

        if (sVal && !sRef) {
          const targetId = mapChaveToId[sVal.toLowerCase()]
          if (targetId) {
            mat.set('setor_ref', targetId)
            changed = true
          }
        } else if (sRef && !sVal) {
          const targetChave = mapIdToChave[sRef]
          if (targetChave) {
            mat.set('setor_origem', targetChave)
            changed = true
          }
        }

        if (changed) {
          app.save(mat)
        }
      }
    } catch (e) {
      console.log('Aviso ao sincronizar materiais:', e)
    }
  },
  (app) => {
    // Reverter para SelectField caso necessário
    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      modeloCol.fields.removeByName('setor')
      modeloCol.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          maxSelect: 1,
          values: [
            'windows',
            'linux_rede',
            'datacenter',
            'campo',
            'infraestrutura',
            'rh',
            'comercial',
            'laboratorio',
          ],
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
          maxSelect: 1,
          values: [
            'windows',
            'linux_rede',
            'datacenter',
            'campo',
            'infraestrutura',
            'rh',
            'comercial',
            'laboratorio',
          ],
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
          maxSelect: 1,
          values: [
            'windows',
            'linux_rede',
            'datacenter',
            'campo',
            'infraestrutura',
            'rh',
            'comercial',
            'laboratorio',
          ],
        }),
      )
      app.save(materiaisCol)
    } catch (_) {}
  },
)
