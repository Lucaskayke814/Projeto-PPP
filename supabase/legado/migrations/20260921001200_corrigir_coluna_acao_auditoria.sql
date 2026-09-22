-- Corrige a última coluna em inglês usada pela auditoria dos rascunhos.
alter table public.eventos_auditoria rename column action to acao;
