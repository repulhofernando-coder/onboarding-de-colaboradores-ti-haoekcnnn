// pocketbase/hooks/users_verified.js
// Garante que todo usuário criado por Admin ou RH pela aplicação já nasça com verified: true.
// Usuários comuns não podem enviar 'verified' via API diretamente, então o servidor atribui
// o status antes de persistir o novo registro quando a requisição vem de um admin ou rh.

onRecordCreate((e) => {
  try {
    const record = e.record
    if (!record) {
      e.next()
      return
    }

    // Identificar o usuário autenticado na requisição
    // No PocketBase v0.23+ / v0.36+, a informação de autenticação do contexto da requisição
    // pode ser acessada via e.auth (se for um request event) ou através do helper e.requestInfo()
    let authRecord = null

    if (e.auth) {
      authRecord = e.auth
    } else if (typeof e.requestInfo === 'function') {
      try {
        const info = e.requestInfo()
        if (info && info.auth) {
          authRecord = info.auth
        }
      } catch (_) {}
    }

    if (authRecord) {
      let role = ''
      try {
        role =
          typeof authRecord.getString === 'function'
            ? authRecord.getString('role')
            : authRecord.role || (authRecord.get && authRecord.get('role')) || ''
      } catch (_) {
        role = authRecord.role || ''
      }

      // Verificar se o criador possui papel 'admin' ou 'rh'
      // Também suporta superusuário do PocketBase
      const isSuperuser = typeof authRecord.isSuperuser === 'function' && authRecord.isSuperuser()
      const isAdminOrRh = role === 'admin' || role === 'rh' || isSuperuser

      if (isAdminOrRh) {
        if (typeof record.setVerified === 'function') {
          record.setVerified(true)
        } else if (typeof record.set === 'function') {
          record.set('verified', true)
        }
      }
    }
  } catch (err) {
    console.error('[users_verified hook] Erro ao definir verified no novo usuário:', err)
  }

  e.next()
}, 'users')
