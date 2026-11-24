/// <reference path="../pb_data/types.d.ts" />

// Migração 0058 — Garante que o select "status" da coleção onboardings aceite
// o valor "sem_onboarding" (usado pelo cadastro direto de colaborador sem
// processo de onboarding, em /colaboradores → Novo Colaborador).
//
// A migração 0057 tentou o mesmo ajuste, mas o guard `statusField.type ===
// 'select'` nunca era verdadeiro no JSVM do PocketBase (Type() é método Go,
// não propriedade JS), então o valor não foi persistido e toda tentativa de
// cadastro direto falhava com 400 validation_invalid_value. Aqui o ajuste é
// feito incondicionalmente (idempotente: evita duplicar o valor).

migrate(
  (app) => {
    const onboardings = app.findCollectionByNameOrId('onboardings')
    const statusField = onboardings.fields.getByName('status')

    if (!statusField) {
      throw new Error('Campo "status" não encontrado na coleção onboardings')
    }

    const vals = statusField.values || []
    if (!vals.includes('sem_onboarding')) {
      vals.push('sem_onboarding')
    }
    statusField.values = vals

    app.save(onboardings)
  },
  (app) => {
    // Reversão: remove o valor do select, preservando registros existentes
    const onboardings = app.findCollectionByNameOrId('onboardings')
    const statusField = onboardings.fields.getByName('status')
    if (statusField) {
      const vals = statusField.values || []
      const semOnboardingIdx = vals.indexOf('sem_onboarding')
      if (semOnboardingIdx >= 0) {
        vals.splice(semOnboardingIdx, 1)
      }
      statusField.values = vals
      app.save(onboardings)
    }
  },
)
