import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';

const BUCKET_PREVIAS = 'ppp-private';

type PreviaGerada = {
  arquivo: Blob;
  nomeArquivo: string;
  caminhoStorage: string;
  hashSha256: string;
};

function nomeSeguro(protocolo: string): string {
  return protocolo.replace(/[^A-Za-z0-9-]/g, '_');
}

async function calcularSha256(arquivo: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function gerarPdf(documentoHtml: string, titulo: string): Promise<Blob> {
  /* O HTML é a fonte semântica; o PDF recebe texto nativo, sem páginas-imagem. */
  const origem = new DOMParser().parseFromString(`<main>${documentoHtml}</main>`, 'text/html');
  const raiz = origem.querySelector('main');
  if (!raiz) throw new Error('Não foi possível preparar o documento para o PDF.');

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pagina = { largura: 210, altura: 297, margemX: 18, margemY: 18 };
  const larguraUtil = pagina.largura - (pagina.margemX * 2);
  const limiteY = pagina.altura - pagina.margemY;
  let y = pagina.margemY;
  let numeroPagina = 1;

  const novaPagina = () => {
    pdf.addPage();
    numeroPagina += 1;
    y = pagina.margemY;
  };
  const garantirEspaco = (altura: number) => {
    if (y + altura > limiteY) novaPagina();
  };
  const escreverLinhas = (texto: string, tamanho: number, negrito = false, alinhamento: 'left' | 'center' = 'left', espacamento = 1.25) => {
    const conteudo = texto.replace(/\s+/g, ' ').trim();
    if (!conteudo) return;
    pdf.setFont('helvetica', negrito ? 'bold' : 'normal');
    pdf.setFontSize(tamanho);
    const linhas = pdf.splitTextToSize(conteudo, larguraUtil) as string[];
    const alturaLinha = tamanho * 0.42 * espacamento;
    for (const linha of linhas) {
      garantirEspaco(alturaLinha);
      pdf.text(linha, alinhamento === 'center' ? pagina.largura / 2 : pagina.margemX, y, { align: alinhamento });
      y += alturaLinha;
    }
  };
  const espaco = (altura: number) => { garantirEspaco(altura); y += altura; };
  const textoDo = (elemento: Element) => elemento.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';

  const escreverCapa = (capa: Element) => {
    const linhasOrgao = Array.from(capa.querySelectorAll('.doc-org > div')).map(textoDo).filter(Boolean);
    espaco(18);
    linhasOrgao.forEach((linha, indice) => escreverLinhas(linha, indice < 2 ? 11 : 9.5, indice < 2, 'center', 1.1));
    espaco(5);
    pdf.setDrawColor(27, 31, 36);
    pdf.setLineWidth(0.45);
    pdf.line(pagina.margemX + 5, y, pagina.largura - pagina.margemX - 5, y);
    espaco(16);
    const tituloCapa = capa.querySelector('.doc-title h1');
    const escola = capa.querySelector('.doc-title .school');
    const metadados = Array.from(capa.querySelectorAll('.doc-title .meta'));
    if (tituloCapa) escreverLinhas(textoDo(tituloCapa), 18, true, 'center', 1.15);
    espaco(5);
    if (escola) escreverLinhas(textoDo(escola), 12, true, 'center');
    metadados.forEach((meta) => escreverLinhas(textoDo(meta), 10, false, 'center', 1.1));
  };
  const escreverTabela = (tabela: HTMLTableElement) => {
    for (const linha of Array.from(tabela.querySelectorAll('tr'))) {
      const celulas = Array.from(linha.querySelectorAll('th, td')).map(textoDo).filter(Boolean);
      if (!celulas.length) continue;
      escreverLinhas(celulas.join(' · '), linha.parentElement?.tagName === 'THEAD' ? 8.5 : 8.2, linha.parentElement?.tagName === 'THEAD');
      espaco(1);
    }
  };
  const escreverElemento = (elemento: Element) => {
    if (elemento.classList.contains('quebra')) {
      novaPagina();
      return;
    }
    if (elemento.classList.contains('capa')) {
      escreverCapa(elemento);
      return;
    }
    if (elemento.tagName === 'H3') {
      garantirEspaco(14);
      escreverLinhas(textoDo(elemento), 11, true);
      espaco(2.5);
      return;
    }
    if (elemento.tagName === 'P') {
      escreverLinhas(textoDo(elemento), elemento.classList.contains('ident') ? 9.2 : 10);
      espaco(elemento.classList.contains('ident') ? 1.1 : 2.2);
      return;
    }
    if (elemento.tagName === 'TABLE') {
      escreverTabela(elemento as HTMLTableElement);
      espaco(2);
      return;
    }
    if (elemento.classList.contains('doc-sign')) {
      garantirEspaco(26);
      espaco(11);
      pdf.setLineWidth(0.2);
      pdf.line(65, y, 145, y);
      espaco(5);
      escreverLinhas(textoDo(elemento), 9.5, false, 'center');
      espaco(5);
      return;
    }
    Array.from(elemento.children).forEach(escreverElemento);
  };

  Array.from(raiz.children).forEach(escreverElemento);
  for (let indice = 1; indice <= numeroPagina; indice += 1) {
    pdf.setPage(indice);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Página ${indice} de ${numeroPagina}`, pagina.largura / 2, pagina.altura - 9, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }
  pdf.setProperties({ title: titulo, subject: 'Prévia do Projeto Político-Pedagógico' });
  return pdf.output('blob');
}

export class PdfPreviewService {
  async gerarEArmazenar(versaoPppId: string, protocolo: string, documentoHtml: string): Promise<PreviaGerada> {
    const nomeArquivo = `${nomeSeguro(protocolo)}-previa.pdf`;
    const arquivo = await gerarPdf(documentoHtml, `Prévia do PPP ${protocolo}`);
    const caminhoStorage = `previas/${versaoPppId}/${crypto.randomUUID()}.pdf`;
    const { error: erroEnvio } = await supabase.storage.from(BUCKET_PREVIAS).upload(caminhoStorage, arquivo, {
      contentType: 'application/pdf', upsert: false,
    });
    if (erroEnvio) throw erroEnvio;

    const hashSha256 = await calcularSha256(arquivo);
    const { error: erroRegistro } = await supabase.rpc('registrar_previa_pdf_ppp', {
      versao_ppp_destino_id: versaoPppId,
      caminho_storage_destino: caminhoStorage,
      nome_original_destino: nomeArquivo,
      tamanho_bytes_destino: arquivo.size,
      hash_sha256_destino: hashSha256,
    });
    if (erroRegistro) {
      await supabase.storage.from(BUCKET_PREVIAS).remove([caminhoStorage]);
      throw erroRegistro;
    }
    return { arquivo, nomeArquivo, caminhoStorage, hashSha256 };
  }
}
