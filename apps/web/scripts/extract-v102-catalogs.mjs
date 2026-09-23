import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '../../..');
const sourcePath = resolve(projectRoot, 'Gerador de PPP V6.5', 'Gerador de PPP v10.2', 'App.html');
const outputPath = resolve(projectRoot, 'supabase', 'migrations', '20260922002300_importar_catalogos_v102.sql');

function trechoDaConstante(source, nome) {
  const inicio = source.indexOf(`const ${nome} = [`);
  if (inicio < 0) throw new Error(`Catálogo ${nome} não encontrado na referência v10.2.`);
  const abre = source.indexOf('[', inicio);
  let nivel = 0;
  let aspas = '';
  let escape = false;
  for (let indice = abre; indice < source.length; indice += 1) {
    const caractere = source[indice];
    if (aspas) {
      if (escape) escape = false;
      else if (caractere === '\\') escape = true;
      else if (caractere === aspas) aspas = '';
      continue;
    }
    if (caractere === "'" || caractere === '"' || caractere === '`') { aspas = caractere; continue; }
    if (caractere === '[') nivel += 1;
    if (caractere === ']') {
      nivel -= 1;
      if (nivel === 0) return source.slice(inicio, indice + 1) + ';';
    }
  }
  throw new Error(`Fim do catálogo ${nome} não encontrado.`);
}

function lerCatalogo(source, nome) {
  const contexto = {};
  vm.runInNewContext(`${trechoDaConstante(source, nome)}; globalThis.resultado = ${nome};`, contexto);
  return contexto.resultado;
}

function literalSql(valor) {
  return `'${String(valor ?? '').replaceAll("'", "''")}'`;
}

const fonte = await readFile(sourcePath, 'utf8');
const catalogos = [
  ['ETAPAS', 'etapas', 'Etapas de ensino'],
  ['MODALIDADES', 'modalidades', 'Modalidades e formas de oferta'],
  ['INFRA', 'infraestrutura', 'Infraestrutura escolar'],
  ['TEMAS', 'temas', 'Temas pedagógicos'],
  ['PRINCIPIOS', 'principios', 'Princípios norteadores'],
  ['METODOS', 'metodos', 'Métodos e estratégias pedagógicas'],
];

const linhas = [
  '-- Gerado por apps/web/scripts/extract-v102-catalogs.mjs a partir da referência v10.2.',
  '-- Não edite manualmente: altere a referência aprovada e gere uma nova publicação de catálogo.',
];

for (const [constante, codigo, nome] of catalogos) {
  const itens = lerCatalogo(fonte, constante);
  linhas.push(`insert into public.catalogos(codigo,nome,descricao) values (${literalSql(codigo)},${literalSql(nome)},${literalSql(`Catálogo importado da referência PPP v10.2`)}) on conflict(codigo) do update set nome=excluded.nome,descricao=excluded.descricao;`);
  linhas.push(`delete from public.orientacoes_itens_catalogo where catalogo_codigo=${literalSql(codigo)};`);
  for (const [ordem, item] of itens.entries()) {
    linhas.push(
      `insert into public.itens_catalogo(catalogo_codigo,codigo,rotulo,ordem,referencia,texto_documento,texto_formativo,ativo) values (${literalSql(codigo)},${literalSql(item.id)},${literalSql(item.label)},${ordem + 1},${literalSql(item.ref)},${literalSql(item.texto)},${literalSql(item.formativo)},true) on conflict(catalogo_codigo,codigo) do update set rotulo=excluded.rotulo,ordem=excluded.ordem,referencia=excluded.referencia,texto_documento=excluded.texto_documento,texto_formativo=excluded.texto_formativo,ativo=true;`,
    );
    for (const [indice, orientacao] of (item.noPPP ?? []).entries()) {
      linhas.push(`insert into public.orientacoes_itens_catalogo(catalogo_codigo,item_codigo,ordem,texto) values (${literalSql(codigo)},${literalSql(item.id)},${indice + 1},${literalSql(orientacao)});`);
    }
  }
}

linhas.push('');
await writeFile(outputPath, linhas.join('\n'), 'utf8');
console.log(`Migration de catálogos v10.2 gerada: ${outputPath}`);
