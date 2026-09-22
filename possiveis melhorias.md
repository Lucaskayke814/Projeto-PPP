# Possíveis melhorias — Gerador de PPP

Documento de avaliação para orientar a evolução do sistema antes de produção. Não representa alterações aprovadas nem deve substituir validação pedagógica, jurídica, de segurança ou de infraestrutura.

## Situação atual observada

A aplicação preserva o HTML de referência como especificação e executa uma cópia de trabalho modular conectada ao Supabase. O banco já possui identidade organizacional, usuários vinculados, PPPs, versões, revisões, respostas estruturadas do formulário, progresso, auditoria, participantes e rascunhos. O percurso de criação, salvamento, retomada, prévia para impressão e congelamento para assinatura está em evolução.

Ainda há fluxos do protótipo que não estão completos no Supabase: assinatura efetiva, convites, ata, anexos, homologação, painéis regional e central, curadoria institucional, controle de acessos administrativo e geração de arquivo final verificável.

## Prioridade 0 — indispensável antes de produção

### 1. Revisar a arquitetura de autenticação e provisionamento

- Usar Google como provedor de identidade, com domínios, contas externas e regras institucionais formalmente definidos.
- Remover provisionamentos de teste vinculados a e-mails pessoais antes da produção.
- Importar usuários e vínculos por carga controlada, com validação de rede, regional, escola, perfil, situação e vigência.
- Permitir múltiplos vínculos por usuário e mostrar seleção de contexto somente quando houver mais de uma opção válida.
- Definir desativação, transferência de escola, revogação de acesso e desligamento de servidores.
- Registrar cada concessão, alteração e revogação de acesso na auditoria.

Critério de aceite: uma pessoa só acessa os dados permitidos por seus vínculos atuais e um vínculo revogado perde efeito imediatamente.

### 2. Completar o fluxo documental antes de marcar o PPP como concluído

- Implementar assinatura da direção, membros do colegiado, ressalvas, remoção e reenvio de convite.
- Usar token de convite aleatório, de uso único, com hash no banco, expiração e revogação. Nunca gravar token bruto.
- Definir regra institucional para quantidade de membros, segmentos obrigatórios, quórum, ressalvas e transição de situação.
- Registrar ata no Storage privado, com metadados, hash, responsável e relação com a versão congelada.
- Implementar homologação pela regional com histórico, responsável e eventual devolução para nova versão.
- Somente a versão selada deve gerar documento final e permitir assinatura.

Critério de aceite: uma versão assinada ou homologada não pode ser alterada, e toda mudança posterior cria uma nova versão rastreável.

### 3. Geração e preservação do documento final

- Definir um gerador de PDF reproduzível no servidor ou Edge Function; impressão pelo navegador é adequada para prévia, mas não é evidência final.
- Armazenar documento final, hash SHA-256, data de geração, versão e publicação institucional usada.
- Usar bucket privado no Supabase Storage e URLs assinadas de curta duração.
- Separar prévia transitória de documento final, assinado e homologado.
- Testar se o PDF reproduz o conteúdo, páginas, cabeçalhos e assinaturas exigidos institucionalmente.

Critério de aceite: qualquer versão congelada pode ser reaberta, conferida pelo hash e baixada apenas por usuários autorizados.

### 4. Segurança e LGPD

- Revisar todas as políticas RLS com pelo menos duas escolas, duas regionais e um usuário central.
- Testar acesso anônimo, escola A tentando consultar escola B, regional A tentando consultar regional B e usuários revogados.
- Impedir que `service_role`, senha PostgreSQL, tokens administrativos ou chaves privadas entrem no frontend, Git ou GitHub Pages.
- Definir retenção, descarte, backup, restauração e tratamento de anexos com dados pessoais.
- Minimizar dados pessoais: não cadastrar estudantes individualmente e orientar que textos pedagógicos usem dados agregados.
- Definir quem é controlador, operador, encarregado e responsável por atendimento de titulares.

Critério de aceite: testes de autorização automatizados cobrem leitura e escrita por escopo; nenhum segredo aparece no repositório ou no bundle web.

### 5. Operação, backup e recuperação

- Configurar projeto de homologação separado do desenvolvimento e produção separada da homologação.
- Estabelecer RPO, RTO, rotina de backup e ensaios de restauração em ambiente isolado.
- Incluir banco, objetos privados do Storage, hashes, versões de migration e publicação institucional no plano de recuperação.
- Criar alertas para falha de migration, erro de autenticação, upload interrompido e indisponibilidade do Supabase.
- Manter migrações imutáveis depois de aplicadas; toda correção deve ser uma nova migration.

Critério de aceite: restauração de uma versão congelada é comprovada em ambiente separado, sem envio de e-mails ou alteração de produção.

## Prioridade 1 — necessária para o uso diário

### 6. Encontrar PPPs sem depender de protocolo exato

- Abrir automaticamente o último PPP em edição para a escola autenticada.
- Exibir lista de PPPs permitidos para a escola, com situação, versão, última atualização e protocolo copiável.
- Normalizar a busca por protocolo: ignorar maiúsculas, espaços, pontos e hífens.
- Permitir busca por escola, INEP, município e situação apenas dentro do escopo autorizado.
- Criar índices para protocolo normalizado, INEP, escola, regional, situação e data de atualização.

Recomendação: implementar primeiro a lista da própria escola. Painéis regional e central devem usar a mesma API autorizada, com filtros adicionais.

### 7. Gestão de conflitos de edição

- Mostrar claramente quando outro salvamento atualizou o PPP.
- Oferecer recarregar a revisão mais recente, comparar alterações ou criar cópia local antes de descartar texto.
- Persistir somente o necessário para retomar: protocolo, tela e contexto; não guardar conteúdo completo em `localStorage`.
- Exibir hora do último salvamento e estado de sincronização de forma acessível.

### 8. Validações do formulário

- Preservar regras existentes no protótipo e transferi-las gradualmente para validações reutilizáveis.
- Validar INEP, datas, quórum, tamanho de textos, formatos de e-mail e arquivos permitidos.
- Distinguir aviso pedagógico, campo obrigatório e bloqueio legal/processual.
- Registrar a versão das regras usadas ao concluir um PPP.

### 9. Catálogos e conteúdo institucional

- Completar seed de catálogos com todas as opções realmente aprovadas no protótipo.
- Versionar publicações institucionais e registrar autoria, revisão, publicação e vigência.
- Garantir que PPPs congelados apontem para a publicação usada na sua criação.
- Criar curadoria somente após definir responsáveis, revisão pedagógica e processo de publicação.

## Prioridade 2 — qualidade, manutenção e escala

### 10. Qualidade técnica

- Separar testes de unidade, integração com Supabase, RLS, navegador e comparação visual com o protótipo.
- Criar massa de dados descartável para testes, sem dados reais de escolas ou pessoas.
- Automatizar `build`, testes, validação SQL, lint do banco e verificação de que o HTML de referência não mudou.
- Usar monitoramento de erros no frontend e rastreamento de requisições sem gravar textos pedagógicos ou dados sensíveis em logs.

### 11. Acessibilidade e experiência

- Testar navegação por teclado, leitores de tela, foco, contraste, mensagens de erro e responsividade com a interface fiel ao protótipo.
- Informar claramente quando o salvamento está pendente, em andamento, concluído ou falhou.
- Garantir que a retomada abra na tela correta e recupere todos os grupos de dados.
- Definir comportamento para conexão lenta, perda de internet e sessão expirada.

### 12. Desempenho

- Paginar painéis regional e central.
- Não carregar anexos, documentos completos ou catálogos extensos antes de serem necessários.
- Usar índices baseados nas consultas reais, após observar volume e filtros.
- Evitar gerar PDF ou carregar conteúdo de múltiplas versões na abertura inicial.

## Decisões que precisam ser formalizadas

1. Quem pode criar, editar, concluir, assinar, devolver, homologar e consultar cada PPP?
2. Um PPP por escola pode estar em edição simultânea com outro? Como tratar revisão anual ou bienal?
3. Qual regra de quórum e quais segmentos do colegiado são obrigatórios?
4. Assinatura terá valor de aceite eletrônico interno, assinatura avançada ou integração com assinatura institucional?
5. Qual provedor enviará e-mails de convite e como serão tratados falhas, reenvios e privacidade?
6. Onde o documento final será publicado, por quanto tempo será guardado e quem pode baixá-lo?
7. Como será a migração de eventuais dados de Apps Script, Sheets ou Drive?
8. Quais catálogos e textos possuem aprovação pedagógica e jurídica para publicação?
9. Qual ambiente e processo serão usados para homologação, produção, backup e resposta a incidentes?

## Sequência recomendada

1. Estabilizar login Google, vínculos por carga e escolha de contexto.
2. Finalizar a busca/lista de PPP da escola e retomada confiável.
3. Implementar assinaturas, participantes e convites.
4. Implementar ata, anexos privados e documento final verificável.
5. Implementar homologação regional.
6. Implementar painel regional, central e administração de acessos.
7. Implementar curadoria e publicação de conteúdo institucional.
8. Executar testes de segurança, recuperação, carga, acessibilidade e homologação funcional.
9. Fazer piloto controlado com escolas autorizadas antes de produção.
