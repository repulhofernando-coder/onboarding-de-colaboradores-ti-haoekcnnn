/**
 * Migração 0060 — Ressincroniza `setor_ref` a partir do texto `setor`.
 *
 * Contexto: edições antigas de colaborador gravavam apenas o texto do setor,
 * deixando `setor_ref` desatualizado (ou vazio). Isso fazia o badge do card
 * exibir o fallback "Windows" em vez do setor real.
 *
 * Estratégia (idempotente, no-op em base vazia):
 * - Para cada onboarding com `setor` (texto) preenchido:
 *   - Localiza o setor cadastrado por nome/chave (case-insensitive, na JSVM).
 *   - Grava `setor_ref` somente quando divergir do valor encontrado.
 */
migrate((app) => {
  const setores = app.findRecordsByFilter('setores', '', '', 0, 0)
  if (setores.length === 0) {
    console.log('0060: nenhuma coleção/registro de setores — no-op')
    return
  }

  const norm = (v) =>
    (v || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const indice = new Map()
  for (const s of setores) {
    const nome = s.getString('nome')
    const chave = s.getString('chave')
    if (nome) indice.set(norm(nome), s.id)
    if (chave) indice.set(norm(chave), s.id)
  }

  const onboardings = app.findRecordsByFilter('onboardings', '', '', 0, 0)
  let corrigidos = 0
  for (const o of onboardings) {
    const texto = o.getString('setor').trim()
    if (!texto) continue

    const refAtual = o.getString('setor_ref').trim()
    const refEsperado = indice.get(norm(texto)) || ''
    if (!refEsperado) continue // texto não corresponde a setor cadastrado — mantém como está
    if (refAtual === refEsperado) continue // já sincronizado

    o.set('setor_ref', refEsperado)
    app.save(o)
    corrigidos++
  }

  console.log(`0060: setor_ref ressincronizado em ${corrigidos} onboarding(s)`)
}, (app) => {
  // down: não reverte dados (ressincronização é correção de dado, não schema)
  console.log('0060 down: no-op')
})
