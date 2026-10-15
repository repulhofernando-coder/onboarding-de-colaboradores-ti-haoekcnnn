migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('teste_questoes')

    // Verificar se já foram semeadas
    const existing = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 20, 0)
    if (existing && existing.length >= 20) {
      return
    }

    // 20 Questões oficiais sobre atendimento/suporte de TI Mundo Open:
    // Temas: reinício de servidor, backup em horário comercial, DNS, software pirata, senha de terceiros, SLA, WhatsApp particular, plantão, etc.
    // Com 4 alternativas por questão e gabarito comentado.
    // Distribuição balanceada das alternativas corretas: exatamente 5 em cada posição (5 em A [0], 5 em B [1], 5 em C [2], 5 em D [3]).
    // Textos das questões 5 e 8 mantidos com fidelidade estrita.
    const questoes = [
      {
        ordem: 1,
        tema: 'Reinício de Servidores',
        enunciado:
          'Durante o expediente de trabalho, um servidor de arquivos de um cliente corporativo apresenta lentidão excessiva no acesso a pastas compartilhadas. Qual é a conduta técnica correta que o analista de suporte deve adotar?',
        alternativas: [
          'Agendar ou solicitar janela de manutenção após o horário comercial ou alinhar imediatamente com o gestor/responsável técnico do cliente antes de qualquer reinicialização.',
          'Reiniciar imediatamente o servidor via comando remoto para restabelecer a velocidade dos serviços, comunicando os usuários após a reinicialização.',
          'Orientar todos os colaboradores do cliente a desligarem seus computadores simultaneamente para limpar a fila de conexões TCP.',
          'Desconectar fisicamente o cabo de rede do servidor para forçar o fechamento de arquivos abertos e reconectar em seguida.',
        ],
        correta_index: 0, // A
        gabarito_comentario:
          'Gabarito A: Servidores corporativos em produção nunca devem ser reiniciados durante horário comercial sem prévio alinhamento formal e autorização do responsável do cliente, sob risco de corromper arquivos abertos, abortar rotinas de banco de dados e paralisar a operação.',
      },
      {
        ordem: 2,
        tema: 'Backup em Horário Comercial',
        enunciado:
          'Um colaborador de um cliente solicita que seja executada imediatamente uma cópia de segurança completa (Full Backup) de uma base de dados de 500 GB às 14h30, alegando urgência. Como o suporte de TI deve proceder?',
        alternativas: [
          'Iniciar o backup imediatamente na prioridade máxima para atender ao pedido do colaborador no menor tempo possível.',
          'Explicar que rotinas pesadas de backup pleno durante horário comercial degradam a rede e os discos em produção, alinhando um backup incremental pontual ou agendando a rotina completa para fora do expediente com o gestor.',
          'Recusar o atendimento e encerrar o chamado sumariamente sem dar explicações ou alternativas ao usuário.',
          'Executar o backup diretamente na máquina local do usuário via pendrive pessoal para não consumir a rede da empresa.',
        ],
        correta_index: 1, // B
        gabarito_comentario:
          'Gabarito B: Backups integrais volumosos em horário de pico geram concorrência de I/O em disco e consumo excessivo de largura de banda, degradando a performance para todos os usuários. Deve-se avaliar alternativas seguras (como cópia diferencial/incremental) ou programar a execução fora do expediente.',
      },
      {
        ordem: 3,
        tema: 'Diagnóstico e Resolução de DNS',
        enunciado:
          'Vários computadores de uma mesma rede local relatam perda repentina de acesso à internet e a sistemas internos, mas o gateway padrão responde normalmente a pacotes ICMP (ping). Qual é a principal suspeita técnica e o primeiro teste recomendado?',
        alternativas: [
          'Substituir fisicamente todos os cabos de rede e switches da infraestrutura para descartar oxidação dos conectores RJ45.',
          'Formatar o computador principal da empresa, pois o sintoma indica infecção irreversível por ransomware na camada de enlace.',
          'Falha ou indisponibilidade de resolução de nomes (DNS); deve-se testar a resolução via nslookup e o ping para um IP externo direto (ex.: 8.8.8.8).',
          'Bloqueio do provedor de internet devido a download não autorizado de arquivos torrent por algum usuário.',
        ],
        correta_index: 2, // C
        gabarito_comentario:
          'Gabarito C: Quando o gateway local responde e o tráfego IP direto flui mas endereços web e nomes de host não abrem, o problema clássico é a falha no serviço de DNS (Domain Name System). O teste com nslookup e ping por endereço IP valida essa hipótese imediatamente.',
      },
      {
        ordem: 4,
        tema: 'Software Pirata e Licenciamento',
        enunciado:
          'Um diretor de um cliente solicita ao suporte técnico a instalação de um software de edição gráfica crakeado/pirata em seu notebook corporativo, afirmando que assume a responsabilidade pela instalação. Qual deve ser o posicionamento do analista?',
        alternativas: [
          'Instalar o software crakeado desde que o diretor envie uma mensagem de texto autorizando a quebra de segurança.',
          'Baixar o crack através de sites de compartilhamento P2P utilizando uma VPN para não expor o IP da empresa.',
          'Instalar uma versão de teste de 30 dias e aplicar um patch não oficial após o vencimento do período demonstrativo.',
          'Recusar educadamente a instalação de softwares não licenciados ou crakeados, esclarecendo os graves riscos de segurança (malwares, backdoors) e conformidade jurídica, orientando sobre licenciamento oficial ou alternativas homologadas.',
        ],
        correta_index: 3, // D
        gabarito_comentario:
          'Gabarito D: A política de segurança da Mundo Open e as diretrizes de compliance proíbem expressamente a instalação de softwares sem licença ou crakeados. O suporte técnico é guardião da integridade do ambiente e responde civil e tecnicamente pela infraestrutura gerenciada.',
      },
      {
        ordem: 5,
        tema: 'Compartilhamento de Senha de Terceiros',
        enunciado:
          'Um funcionário liga para o suporte informando que seu colega de equipe saiu em viagem e deixou pendente uma aprovação financeira crítica no ERP. Ele solicita que o analista redefina a senha do colega ausente ou informe a senha cadastrada para que ele possa acessar a conta. Qual é o procedimento padronizado?',
        alternativas: [
          'Informar a senha temporária ao solicitante por telefone após checar o nome do funcionário no organograma.',
          'Não repassar, redefinir ou compartilhar senhas de terceiros para outro colaborador; orientar o solicitante a buscar autorização formal da diretoria/gestor imediato e acionar o fluxo institucional de delegação de acessos.',
          'Redefinir a senha imediatamente para "MundoOpen123" e enviar a nova credencial para o e-mail pessoal do solicitante.',
          'Acessar remotamente a máquina do colega ausente e executar a aprovação com privilégios de superadministrador do suporte.',
        ],
        correta_index: 1, // B
        gabarito_comentario:
          'Gabarito B: Credenciais de acesso são estritamente pessoais e intransferíveis. O suporte jamais deve repassar dados de acesso ou quebrar autenticações a pedido de colegas sem aprovação formal do gestor responsável e trilha de auditoria documentada.',
      },
      {
        ordem: 6,
        tema: 'Gestão de SLA e Priorização de Chamados',
        enunciado:
          'Dois incidentes chegam simultaneamente à fila de atendimento N1: (1) A impressora individual da sala de descanso parou de imprimir; (2) O link de dados principal da filial caiu, impossibilitando a emissão de notas fiscais pelo faturamento. De acordo com as boas práticas de ITIL e SLA, como deve ser a ordem de atuação?',
        alternativas: [
          'Priorizar imediatamente a queda do link de dados por se tratar de incidente crítico de alto impacto na operação e no faturamento da empresa, mantendo o incidente da impressora na fila conforme seu prazo de SLA.',
          'Atender primeiro a impressora porque a resolução é rápida e reduz o número total de tickets em aberto na fila.',
          'Dividir a atenção do técnico simultaneamente em ambas as tarefas para não estourar o SLA de primeiro contato de nenhum ticket.',
          'Aguardar o gestor de suporte definir formalmente qual chamado deve ser iniciado antes de qualquer intervenção técnica.',
        ],
        correta_index: 0, // A
        gabarito_comentario:
          'Gabarito A: Na gestão de incidentes (ITIL), a prioridade decorre da matriz de Urgência x Impacto no negócio. Queda de faturamento é incidente crítico de alto impacto financeiro e operacional, demandando resposta imediata.',
      },
      {
        ordem: 7,
        tema: 'Comunicação por WhatsApp Particular',
        enunciado:
          'Um usuário atendido anteriormente pelo suporte envia uma mensagem direta no WhatsApp particular do técnico às 21h30 relatando lentidão no e-mail corporativo. Como o técnico de suporte deve agir?',
        alternativas: [
          'Iniciar o acesso remoto imediato pelo celular para resolver o problema e garantir a satisfação do cliente.',
          'Bloquear o contato do usuário no telefone sem prestar nenhuma resposta.',
          'Orientar gentilmente o usuário a registrar a solicitação nos canais oficiais de suporte (Portal de Chamados / E-mail de Suporte / Telefone da Central), esclarecendo que os canais oficiais garantem rastreabilidade, cumprimento de SLA e escala de plantão.',
          'Cobrar uma taxa adicional particular diretamente do usuário via PIX para resolver o chamado fora do horário.',
        ],
        correta_index: 2, // C
        gabarito_comentario:
          'Gabarito C: O atendimento deve ocorrer exclusivamente pelos canais institucionais homologados. Mensagens em canais privados inviabilizam o registro de métricas, geram desvio de função, quebram a trilha de auditoria e desrespeitam as escalas de atendimento formal.',
      },
      {
        ordem: 8,
        tema: 'Escala de Plantão e Chamados Críticos',
        enunciado:
          'Durante o regime de plantão no final de semana, o técnico de escala recebe um alerta automatizado de parada crítica em um servidor de banco de dados de um cliente com contrato de suporte 24x7. Qual é a postura operacional exigida?',
        alternativas: [
          'Desligar o telefone corporativo de plantão até a manhã da segunda-feira para evitar ligações repetidas de usuários.',
          'Aguardar o início do expediente comercial de segunda-feira às 08h00 para abrir o chamado internamente.',
          'Encaminhar o chamado para a equipe de recursos humanos para que eles verifiquem se o cliente pagou a fatura do mês.',
          'Reconhecer o alerta dentro do tempo de resposta estipulado em contrato, iniciar imediatamente os procedimentos de diagnóstico e contenção, documentar as ações no sistema de chamados e escalonar para N2/N3 se necessário.',
        ],
        correta_index: 3, // D
        gabarito_comentario:
          'Gabarito D: O regime de plantão existe para assegurar a continuidade dos serviços críticos sob contrato 24x7. A resposta rápida, registro cronológico de ações e acionamento dos níveis superiores nos prazos previstos em SLA são imperativos.',
      },
      {
        ordem: 9,
        tema: 'Boas Práticas de Acesso Remoto',
        enunciado:
          'Ao conectar na estação de trabalho de um cliente via software de acesso remoto (TeamViewer / AnyDesk), qual é o primeiro cuidado ético e operacional que o analista deve tomar?',
        alternativas: [
          'Identificar-se cordialmente ao usuário, informar o motivo da conexão, solicitar autorização para iniciar o manuseio e pedir que o usuário feche documentos pessoais e confidenciais abertos.',
          'Ocultar a barra de tarefas e fechar todas as janelas do usuário sem aviso prévio para acelerar o diagnóstico.',
          'Copiar os arquivos da área de trabalho do usuário para um servidor temporário antes de investigar o problema.',
          'Mudar o papel de parede da máquina para um aviso de "Suporte Técnico Conectado" antes de falar com o cliente.',
        ],
        correta_index: 0, // A
        gabarito_comentario:
          'Gabarito A: O acesso remoto invade o espaço visual de trabalho do usuário. Transparência, consentimento prévio, postura respeitosa e preservação da privacidade e de dados pessoais/confidenciais são requisitos inegociáveis de atendimento.',
      },
      {
        ordem: 10,
        tema: 'Segurança da Informação e Phishing',
        enunciado:
          'Um colaborador de um cliente relata ter recebido um e-mail com logotipo do banco da empresa solicitando recadastramento de token urgente sob pena de cancelamento da conta. Qual deve ser a instrução imediata do suporte?',
        alternativas: [
          'Orientar o usuário a clicar no link para verificar se a página possui certificado digital HTTPS válido.',
          'Instruir o usuário a NÃO clicar no link nem fornecer quaisquer dados, isolar a mensagem, orientar a confirmação direta com o gerente bancário por telefone oficial e encaminhar o e-mail à equipe de segurança para bloqueio do remetente.',
          'Solicitar que o colaborador envie a senha atual para o suporte testar se já houve vazamento de dados.',
          'Pedir que o colaborador responda ao e-mail questionando se o banco realmente enviou aquele comunicado.',
        ],
        correta_index: 1, // B
        gabarito_comentario:
          'Gabarito B: Trata-se do clássico golpe de phishing. Instituições financeiras não solicitam tokens nem senhas por e-mail. A ação preventiva requer bloqueio do link, não interação e conscientização imediata do usuário.',
      },
      {
        ordem: 11,
        tema: 'Alteração em Equipamento de Rede Core',
        enunciado:
          'Para testar uma melhoria de desempenho, um técnico decide alterar as configurações de rota padrão (gateway) e VLANs no roteador de borda principal de uma empresa durante a tarde. Essa atitude é considerada:',
        alternativas: [
          'Adequada, pois testes de rede devem ser executados com carga real de tráfego de usuários para medir o impacto.',
          'Recomendada apenas se o analista tiver mais de 5 anos de experiência no mercado de redes de computadores.',
          'Incorreta e perigosa, pois alterações estruturais na topologia de rede exigem plano de mudança aprovado, janela programada fora do expediente e procedimento documentado de rollback.',
          'Indiferente, contanto que o analista salve as alterações na memória flash do equipamento antes de reiniciar.',
        ],
        correta_index: 2, // C
        gabarito_comentario:
          'Gabarito C: Qualquer modificação em infraestrutura central e equipamentos de borda pode provocar indisponibilidade generalizada de conexões. Exige-se rigoroso processo de gestão de mudanças (Change Management) com janela aprovada e plano de retorno (rollback).',
      },
      {
        ordem: 12,
        tema: 'Documentação Técnica no Passportal',
        enunciado:
          'Após finalizar com sucesso a troca de um roteador em um cliente e redefinir as credenciais administrativas e faixas de DHCP, o que o técnico obrigatoriamente deve realizar no sistema de documentação (Passportal)?',
        alternativas: [
          'Apenas salvar as senhas antigas em um bloco de notas pessoal no computador da bancada do suporte.',
          'Aguardar o fechamento do mês para atualizar todos os clientes de uma única vez em relatório consolidado.',
          'Informar as senhas e faixas de IP no grupo de WhatsApp geral da equipe para que todos fiquem cientes.',
          'Atualizar imediatamente o ativo no Passportal com as novas credenciais, faixas de IP configuradas, data da alteração e observações pertinentes, garantindo integridade e continuidade do suporte.',
        ],
        correta_index: 3, // D
        gabarito_comentario:
          'Gabarito D: A base de conhecimento e documentação (Passportal) é o coração da operação de TI gerenciada. Um ambiente desatualizado impede o atendimento ágil por outros membros da equipe e causa incidentes graves em emergências.',
      },
      {
        ordem: 13,
        tema: 'Postura em Atendimento Telefônico',
        enunciado:
          'Ao atender uma ligação de um cliente visivelmente irritado com a lentidão generalizada de seu sistema, qual deve ser a abordagem do profissional de suporte N1?',
        alternativas: [
          'Manter a calma, escutar atentamente sem interromper o relato, demonstrar empatia com o impacto no trabalho do usuário, assumir o compromisso de investigar a causa e registrar o incidente formalmente.',
          'Interromper a fala do cliente e argumentar que a lentidão é culpa do provedor de telecomunicações contratado por ele.',
          'Desligar o telefone imediatamente e esperar que o cliente ligue novamente com os ânimos mais calmos.',
          'Ironizar a reclamação do usuário dizendo que para todos os outros clientes o sistema está perfeitamente rápido.',
        ],
        correta_index: 0, // A
        gabarito_comentario:
          'Gabarito A: O atendimento de excelência exige inteligência emocional, escuta ativa e empatia profissional. Demonstrar que o problema do cliente é compreendido e que medidas técnicas estão sendo tomadas acalma o interlocutor e estabelece relação de confiança.',
      },
      {
        ordem: 14,
        tema: 'Política de Backup 3-2-1',
        enunciado:
          'No contexto de proteção de dados e continuidade de negócios, o que preceitua a consagrada regra de backup 3-2-1?',
        alternativas: [
          'Fazer backup a cada 3 horas, salvar em 2 pastas locais e manter 1 cópia na lixeira do sistema operacional.',
          'Manter 3 cópias dos dados importantes, armazenadas em 2 tipos diferentes de mídias/dispositivos, sendo ao menos 1 cópia mantida fora do local físico (offsite / nuvem).',
          'Utilizar no máximo 3 fitas magnéticas, com rotação em 2 dias da semana e 1 restauração por semestre.',
          'Realizar backup apenas de 3 extensões de arquivos (.docx, .xlsx, .pdf), em 2 discos rígidos idênticos e 1 pendrive.',
        ],
        correta_index: 1, // B
        gabarito_comentario:
          'Gabarito B: A regra 3-2-1 é padrão global em segurança: 3 cópias dos dados (original + 2 backups), em pelo menos 2 tipos de mídias distintas, com 1 cópia geográfica externa (offsite/nuvem) para proteger contra desastres físicos, roubos ou ransomware local.',
      },
      {
        ordem: 15,
        tema: 'Escalonamento de Chamados N1 para N2/N3',
        enunciado:
          'Quando um analista N1 esgota as tentativas de resolução de primeiro nível com base nos manuais operacionais e o tempo de SLA de primeiro contato está se aproximando do limite, qual é a ação correta?',
        alternativas: [
          'Continuar tentando novas soluções aleatórias encontradas na internet até conseguir resolver sozinho sem pedir ajuda.',
          'Cancelar o chamado no sistema para que o SLA pare de correr e orientar o cliente a abrir um novo chamado.',
          'Documentar detalhadamente no chamado todos os testes já realizados, resultados obtidos, mensagens de erro e logs coletados, escalonando o ticket formalmente para o N2/N3.',
          'Orientar o cliente a contratar uma consultoria externa especializada para aquele software específico.',
        ],
        correta_index: 2, // C
        gabarito_comentario:
          'Gabarito C: O escalonamento eficiente depende de histórico claro. Documentar o que já foi testado evita retrabalho pelos especialistas de N2/N3, economiza tempo do cliente e preserva o cumprimento dos prazos contratuais de SLA.',
      },
      {
        ordem: 16,
        tema: 'Compartilhamento de Pastas em Rede (Windows Server)',
        enunciado:
          'Ao configurar o compartilhamento de uma pasta de departamento em um servidor Windows, qual é a melhor prática recomendada de permissões NTFS e de Compartilhamento (Share)?',
        alternativas: [
          'Conceder permissão NTFS de "Controle Total" individualmente para o usuário "Todos" (Everyone) sem autenticação.',
          'Configurar senhas compartilhadas e idênticas para todos os colaboradores do setor em uma conta genérica.',
          'Desativar o firewall do Windows Server para evitar bloqueios de autenticação Kerberos entre as estações.',
          'Conceder permissão de Compartilhamento para o grupo e gerenciar as restrições granulares de acesso através de Grupos de Segurança do Active Directory associados às permissões NTFS.',
        ],
        correta_index: 3, // D
        gabarito_comentario:
          'Gabarito D: O modelo de segurança recomendado pela Microsoft baseia-se na atribuição de permissões a grupos de segurança no Active Directory aplicados nas ACLs do sistema NTFS, evitando permissões atribuídas a usuários avulsos ou senhas genéricas.',
      },
      {
        ordem: 17,
        tema: 'Identificação e Resolução de Conflito de IP',
        enunciado:
          'Um usuário relata que sua máquina perde a conexão com a rede de forma intermitente e o Windows exibe a notificação "Existe um conflito de endereço IP com outro sistema na rede". Qual é a provável causa e solução?',
        alternativas: [
          'Há dois dispositivos configurados com o mesmo endereço IP estático ou um IP estático configurado dentro do escopo dinâmico do servidor DHCP; a solução é identificar o dispositivo duplicado e atribuir um IP único ou configurar para obter via DHCP.',
          'O cabo de rede da máquina está com problema de blindagem eletromagnética contra lâmpadas fluorescentes.',
          'O computador do usuário atingiu o limite máximo de pacotes de dados permitidos pelo sistema operacional de 32 bits.',
          'A placa-mãe do computador queimou e deve ser substituída imediatamente pelo setor de compras.',
        ],
        correta_index: 0, // A
        gabarito_comentario:
          'Gabarito A: O conflito de IP ocorre quando duas interfaces de rede disputam o mesmo endereço na mesma subnet. Isso costuma acontecer quando alguém fixa manualmente um IP sem reserva no servidor DHCP.',
      },
      {
        ordem: 18,
        tema: 'Acesso Físico a Ambientes Críticos (Datacenter)',
        enunciado:
          'Durante uma visita técnica presencial ao datacenter/rack de um cliente, qual regra de segurança básica deve ser rigorosamente respeitada pelo técnico?',
        alternativas: [
          'Permitir a entrada de acompanhantes não autorizados no rack para auxiliar a carregar equipamentos pesados.',
          'Estar formalmente identificado com crachá e uniforme, acessar apenas os equipamentos do escopo de trabalho autorizado, manter portas do rack trancadas ao finalizar e registrar entrada/saída no livro de ocorrências.',
          'Desligar o nobreak principal da sala para evitar riscos de choque elétrico durante a vistoria visual.',
          'Aproveitar a visita para consumir bebidas e alimentos dentro da sala fria para manter a hidratação.',
        ],
        correta_index: 1, // B
        gabarito_comentario:
          'Gabarito B: Salas de servidores e racks contêm o patrimônio de dados mais crítico das empresas. Identificação formal, disciplina operacional, respeito ao escopo autorizado e registro de auditoria física são indispensáveis.',
      },
      {
        ordem: 19,
        tema: 'Atualizações de Sistema Operacional (Patch Management)',
        enunciado:
          'Por que não se deve aplicar atualizações cumulativas do Windows Update ou patches críticos em lote em servidores de produção em pleno horário de pico de trabalho?',
        alternativas: [
          'Porque os servidores consomem muita eletricidade durante a instalação de pacotes de atualização.',
          'Porque a Microsoft cobra tarifas adicionais por atualizações realizadas entre as 09h00 e as 17h00.',
          'Porque patches de sistema podem exigir reinicialização obrigatória, degradar a CPU/memória durante a compilação e, em casos imprevistos, causar incompatibilidade com serviços essenciais de banco ou ERP.',
          'Porque o Windows Update apaga automaticamente todas as senhas dos usuários ao término da instalação.',
        ],
        correta_index: 2, // C
        gabarito_comentario:
          'Gabarito C: Atualizações de patches corporativos exigem testes prévios ou aplicação controlada em janelas de manutenção fora do horário de pico, pois além de consumirem recursos pesados, com frequência demandam reboot ou causam regressões de software.',
      },
      {
        ordem: 20,
        tema: 'Encerramento e Registro de Chamados',
        enunciado:
          'Qual é o procedimento completo e profissional exigido para o encerramento de um chamado no sistema de Helpdesk (Movidesk)?',
        alternativas: [
          'Fechar o ticket silenciosamente assim que o script terminar de rodar, sem precisar avisar o usuário.',
          'Colocar o status como cancelado e pedir ao cliente que abra outro chamado se o problema voltar a acontecer.',
          'Inserir no parecer final apenas a palavra "Resolvido" para economizar tempo do suporte na digitação.',
          'Confirmar com o usuário que a solicitação foi plenamente atendida e funciona corretamente, descrever detalhadamente a causa raiz e a solução aplicada no ticket, classificar categoria/serviço e encerrar com cordialidade.',
        ],
        correta_index: 3, // D
        gabarito_comentario:
          'Gabarito D: O encerramento de chamado consolida a experiência do cliente e alimenta a base de conhecimento técnica. Exige validação prévia com o usuário, descrição técnica objetiva da causa e solução adotada, e correta tipificação para relatórios gerenciais.',
      },
    ]

    // Atualizar campo correta_index em teste_questoes para required: false (caso já tenha sido criado)
    try {
      const f = col.fields.getByName('correta_index')
      if (f && f.required) {
        f.required = false
        app.save(col)
      }
    } catch (_) {}

    for (const q of questoes) {
      const rec = new Record(col)
      rec.set('ordem', q.ordem)
      rec.set('tema', q.tema)
      rec.set('enunciado', q.enunciado)
      rec.set('alternativas', q.alternativas)
      rec.set('correta_index', q.correta_index)
      rec.set('gabarito_comentario', q.gabarito_comentario)
      rec.set('ativo', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('teste_questoes')
      const records = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 50, 0)
      for (const r of records) {
        app.delete(r)
      }
    } catch (_) {}
  },
)
