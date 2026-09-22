# Pontos temporários para remover ou revisar após os testes

## Sugestões de protocolo na tela inicial

**Status:** temporário para testes internos.

A aplicação adiciona sugestões automáticas ao campo de protocolo da tela inicial, por meio da RPC `listar_protocolos_para_teste`.

Antes de produção, substituir esta experiência por uma lista oficial de PPPs autorizados, com filtros por contexto, paginação, situação, escola e regional. Não manter a apresentação nativa de `datalist` como solução definitiva sem validação de acessibilidade e experiência.

A RPC pode permanecer, desde que seja renomeada e evoluída para a consulta oficial, com testes de RLS para escola, regional e órgão central.

## Rede e escola de demonstração

**Status:** exclusivamente desenvolvimento.

Remover ou substituir os dados `demonstracao`, a escola de INEP `31123456`, catálogos mínimos e vínculos criados pelo seed de desenvolvimento antes de homologação ou produção.

## Provisionamento de e-mail de teste

**Status:** exclusivamente desenvolvimento.

Remover o provisionamento específico de `lucaskayke06@gmail.com` antes de produção. Em seu lugar, importar os usuários e vínculos aprovados por carga controlada.

## Prévia por impressão do navegador

**Status:** solução transitória.

A prévia atual abre a caixa de impressão do navegador depois de salvar a revisão. Antes de produção, substituir por geração de PDF reproduzível no servidor ou Edge Function e armazenar o documento final privado com hash verificável.

## Protocolo de desenvolvimento

**Status:** revisar.

A sequência atual gera protocolos sequenciais para desenvolvimento. Confirmar o formato institucional final, regras de versão e necessidade de dígito ou identificador de rede antes de produção.
