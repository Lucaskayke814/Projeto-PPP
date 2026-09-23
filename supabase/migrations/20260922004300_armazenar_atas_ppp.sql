-- Envio de ata ao Storage privado e registro transacional no banco.
begin;
create or replace function app.pode_enviar_ata_ppp(caminho_arquivo text)
returns boolean language plpgsql stable security definer set search_path=public,app as $$
declare versao_id uuid;
begin
 if auth.uid() is null or caminho_arquivo !~ '^atas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+\.(pdf|jpg|jpeg|png|docx)$' then return false; end if;
 versao_id:=split_part(caminho_arquivo,'/',2)::uuid;
 return exists(select 1 from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id where v.id=versao_id and v.situacao='em_assinatura' and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id,true));
end;
$$;
drop policy if exists "enviar ata de ppp acessivel" on storage.objects;
create policy "enviar ata de ppp acessivel" on storage.objects for insert to authenticated with check(bucket_id='ppp-private' and app.pode_enviar_ata_ppp(name));
drop policy if exists "remover ata de ppp acessivel" on storage.objects;
create policy "remover ata de ppp acessivel" on storage.objects for delete to authenticated using(bucket_id='ppp-private' and app.pode_enviar_ata_ppp(name));
create or replace function public.registrar_ata_ppp(versao_ppp_destino_id uuid,caminho_storage_destino text,nome_original_destino text,tipo_mime_destino text,tamanho_bytes_destino bigint,hash_sha256_destino text,data_reuniao_destino date,identificacao_destino text default '')
returns jsonb language plpgsql security definer set search_path=public,app,storage as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; e public.escolas%rowtype; anterior public.atas_reunioes_aprovacao_ppp%rowtype; arquivo_id uuid; agora timestamptz:=now();
begin
 if tamanho_bytes_destino<1 or tamanho_bytes_destino>12582912 then raise exception 'Tamanho de arquivo invalido'; end if;
 if hash_sha256_destino !~ '^[0-9a-f]{64}$' or caminho_storage_destino !~ '^atas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+\.(pdf|jpg|jpeg|png|docx)$' then raise exception 'Metadados da ata invalidos'; end if;
 select * into v from public.versoes_ppp where id=versao_ppp_destino_id for update; if not found or v.situacao<>'em_assinatura' then raise exception 'PPP indisponivel para registrar ata'; end if;
 select * into p from public.ppps where id=v.ppp_id; select * into e from public.escolas where id=p.escola_id;
 if not app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id,true) then raise exception 'Sem permissao para registrar esta ata'; end if;
 if split_part(caminho_storage_destino,'/',2)::uuid<>v.id or not exists(select 1 from storage.objects where bucket_id='ppp-private' and name=caminho_storage_destino) then raise exception 'Arquivo da ata nao encontrado no Storage'; end if;
 if exists(select 1 from public.participantes_ppp where versao_ppp_id=v.id and assinado_em is not null) then raise exception 'A ata nao pode ser substituida apos a primeira assinatura'; end if;
 select * into anterior from public.atas_reunioes_aprovacao_ppp where versao_ppp_id=v.id and substituida_em is null for update;
 if found then update public.atas_reunioes_aprovacao_ppp set substituida_em=agora where id=anterior.id; update public.arquivos_ppp set removido_em=agora where id=anterior.arquivo_ppp_id; end if;
 insert into public.arquivos_ppp(versao_ppp_id,tipo,caminho_storage,nome_original,tipo_mime,tamanho_bytes,hash_sha256,criado_por) values(v.id,'ata',caminho_storage_destino,nome_original_destino,tipo_mime_destino,tamanho_bytes_destino,hash_sha256_destino,auth.uid()) returning id into arquivo_id;
 insert into public.atas_reunioes_aprovacao_ppp(versao_ppp_id,arquivo_ppp_id,data_reuniao,identificacao,substitui_ata_id,registrada_por) values(v.id,arquivo_id,data_reuniao_destino,trim(coalesce(identificacao_destino,'')),case when anterior.id is null then null else anterior.id end,auth.uid());
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id) values(v.id,case when anterior.id is null then 'ata_registrada' else 'ata_substituida' end,nome_original_destino,auth.uid());
 return jsonb_build_object('ok',true,'arquivoId',arquivo_id,'nome',nome_original_destino,'dataReuniao',to_char(data_reuniao_destino,'DD/MM/YYYY'));
end;
$$;
grant execute on function app.pode_enviar_ata_ppp(text) to authenticated;
grant execute on function public.registrar_ata_ppp(uuid,text,text,text,bigint,text,date,text) to authenticated;
commit;
