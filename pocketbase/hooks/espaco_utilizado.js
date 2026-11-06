/**
 * Hook: agregação do espaço de armazenamento utilizado no PocketBase.
 *
 * GET /backend/v1/espaco-utilizado
 *
 * Percorre o filesystem de uploads (storage do PocketBase) e soma os tamanhos
 * reais dos arquivos, agrupando por coleção de origem (cada upload é gravado em
 * `{nome_da_colecao}/{id_do_registro}/{arquivo}`, então o prefixo da coleção
 * identifica a origem):
 *  - materiais/            -> "Materiais (Biblioteca)" (inclui docs complementares)
 *  - certificados/         -> "Certificados"
 *  - tarefas_onboarding/   -> "Tarefas de onboarding (upload direto)"
 *  - modelo_tarefas/       -> "Modelos (upload direto)"
 *  - users/                -> "Avatares de usuários"
 *
 * Acesso: apenas Admin e RH (eAuth). O papel Gestão recebe 403.
 * A contagem é feita sobre o storage físico, portanto reflete exatamente o que
 * está gravado (inclusive eventuais arquivos órfãos de registros removidos).
 */

routerAdd('GET', '/backend/v1/espaco-utilizado', (e) => {
  const app = e.app || $app

  // Acesso restrito a Admin e RH (gestão do espaço é função de quem gere a biblioteca)
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }
  const role = (authRecord.getString('role') || '').trim().toLowerCase()
  if (role !== 'admin' && role !== 'rh') {
    return e.json(403, { error: 'Acesso restrito a Admin e RH.' })
  }

  let fs = null
  try {
    fs = app.newFilesystem()
  } catch (errFs) {
    console.error('[EspacoUtilizado] Erro ao abrir filesystem:', errFs)
    return e.json(500, { error: 'Erro ao acessar o storage de arquivos.' })
  }

  const origens = [
    { chave: 'materiais', rotulo: 'Materiais (Biblioteca)', prefixo: 'materiais/' },
    { chave: 'certificados', rotulo: 'Certificados', prefixo: 'certificados/' },
    {
      chave: 'tarefas_onboarding',
      rotulo: 'Tarefas de onboarding (upload direto)',
      prefixo: 'tarefas_onboarding/',
    },
    { chave: 'modelo_tarefas', rotulo: 'Modelos (upload direto)', prefixo: 'modelo_tarefas/' },
    { chave: 'users', rotulo: 'Avatares de usuários', prefixo: 'users/' },
  ]

  let totalBytes = 0
  let totalArquivos = 0
  const porOrigem = []

  for (const origem of origens) {
    let bytes = 0
    let arquivos = 0
    try {
      const lista = fs.list(origem.prefixo) || []
      for (const obj of lista) {
        if (obj && obj.size > 0) {
          bytes += Number(obj.size) || 0
          arquivos += 1
        }
      }
    } catch (errLista) {
      // Prefixo pode não existir ainda (nenhum upload nessa origem) — segue com zero.
      console.warn('[EspacoUtilizado] Falha ao listar prefixo:', origem.prefixo, errLista)
    }
    totalBytes += bytes
    totalArquivos += arquivos
    porOrigem.push({
      chave: origem.chave,
      rotulo: origem.rotulo,
      bytes: bytes,
      arquivos: arquivos,
    })
  }

  try {
    fs.close()
  } catch (_) {}

  return e.json(200, {
    total_bytes: totalBytes,
    total_arquivos: totalArquivos,
    por_origem: porOrigem,
    gerado_em: new Date().toISOString(),
  })
})
