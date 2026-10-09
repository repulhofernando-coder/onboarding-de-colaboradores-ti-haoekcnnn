/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Normaliza registros em onboardings, modelo_tarefas e materiais onde setor/setor_origem
    // possa estar armazenado como array JSON serializado (ex: ["windows"] ou ["linux_rede"])
    // para um valor de texto/select simples (ex: "windows").

    // 1. onboardings
    try {
      const onboardings = app.findRecordsByFilter('onboardings', 'id != ""', '', 500, 0)
      for (const record of onboardings) {
        let changed = false
        const raw = record.get('setor')
        let setorStr = ''

        if (Array.isArray(raw)) {
          setorStr = raw.length > 0 ? String(raw[0]) : ''
          changed = true
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (Array.isArray(parsed)) {
                setorStr = parsed.length > 0 ? String(parsed[0]) : ''
                changed = true
              }
            } catch (_) {}
          }
        }

        if (changed) {
          record.set('setor', setorStr)
          app.save(record)
        }
      }
    } catch (e) {
      console.log('Erro ao normalizar onboardings:', e)
    }

    // 2. modelo_tarefas
    try {
      const modelos = app.findRecordsByFilter('modelo_tarefas', 'id != ""', '', 500, 0)
      for (const record of modelos) {
        let changed = false
        const raw = record.get('setor')
        let setorStr = ''

        if (Array.isArray(raw)) {
          setorStr = raw.length > 0 ? String(raw[0]) : ''
          changed = true
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (Array.isArray(parsed)) {
                setorStr = parsed.length > 0 ? String(parsed[0]) : ''
                changed = true
              }
            } catch (_) {}
          }
        }

        if (changed) {
          record.set('setor', setorStr)
          app.save(record)
        }
      }
    } catch (e) {
      console.log('Erro ao normalizar modelo_tarefas:', e)
    }

    // 3. materiais
    try {
      const materiais = app.findRecordsByFilter('materiais', 'id != ""', '', 500, 0)
      for (const record of materiais) {
        let changed = false
        const raw = record.get('setor_origem')
        let setorStr = ''

        if (Array.isArray(raw)) {
          setorStr = raw.length > 0 ? String(raw[0]) : ''
          changed = true
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (Array.isArray(parsed)) {
                setorStr = parsed.length > 0 ? String(parsed[0]) : ''
                changed = true
              }
            } catch (_) {}
          }
        }

        if (changed) {
          record.set('setor_origem', setorStr)
          app.save(record)
        }
      }
    } catch (e) {
      console.log('Erro ao normalizar materiais:', e)
    }
  },
  (app) => {
    // down migration vazia — normalização é idempotente e retrocompatível
  },
)
