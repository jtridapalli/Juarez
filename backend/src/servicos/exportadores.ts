import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatarBRL } from '../lib/money.js';
import type { Coluna, Tabela } from './anexos.js';

function valorFormatado(coluna: Coluna, valor: string | number | undefined): string {
  if (valor === undefined || valor === null) return '';
  if (coluna.tipo === 'moeda') return formatarBRL(Number(valor));
  if (coluna.tipo === 'numero') return Number(valor).toFixed(2).replace('.', ',');
  return String(valor);
}

/** Exporta a tabela em CSV delimitado por ponto-e-virgula (padrao pt-BR). */
export function paraCsv(tabela: Tabela): string {
  const escapar = (v: string) => (v.includes(';') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = [
    tabela.colunas.map((c) => escapar(c.titulo)).join(';'),
    ...tabela.linhas.map((linha) => tabela.colunas.map((c) => escapar(valorFormatado(c, linha[c.chave]))).join(';')),
  ];

  const totais = tabela.colunas.map((c) =>
    c.tipo === 'moeda'
      ? escapar(formatarBRL(tabela.linhas.reduce((t, l) => t + Number(l[c.chave] ?? 0), 0)))
      : c === tabela.colunas[0]
        ? 'TOTAL'
        : '',
  );
  linhas.push(totais.join(';'));
  return `\uFEFF${linhas.join('\r\n')}\r\n`;
}

export interface CabecalhoDocumento {
  exercicio: number;
  titulo: string;
  subtitulo?: string;
  geradoEm?: Date;
}

/** Exporta uma ou mais tabelas em planilha XLSX, uma aba por tabela. */
export async function paraXlsx(tabelas: Tabela[], cabecalho: CabecalhoDocumento): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = 'Sistema de Elaboracao da LOA - Governo do Estado do Parana';
  livro.created = cabecalho.geradoEm ?? new Date();

  for (const tabela of tabelas) {
    const aba = livro.addWorksheet(tabela.codigo.slice(0, 31));
    aba.addRow([`GOVERNO DO ESTADO DO PARANA - LEI ORCAMENTARIA ANUAL ${cabecalho.exercicio}`]);
    aba.addRow([tabela.titulo]);
    if (tabela.fundamento) aba.addRow([`Fundamento: ${tabela.fundamento}`]);
    aba.addRow([]);

    const linhaCabecalho = aba.addRow(tabela.colunas.map((c) => c.titulo));
    linhaCabecalho.font = { bold: true };
    linhaCabecalho.eachCell((celula) => {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celula.alignment = { vertical: 'middle', wrapText: true };
    });

    for (const linha of tabela.linhas) {
      const valores = tabela.colunas.map((c) => {
        const bruto = linha[c.chave];
        return c.tipo === 'texto' ? (bruto ?? '') : Number(bruto ?? 0);
      });
      aba.addRow(valores);
    }

    const totais = tabela.colunas.map((c, i) => {
      if (c.tipo === 'moeda') return tabela.linhas.reduce((t, l) => t + Number(l[c.chave] ?? 0), 0);
      return i === 0 ? 'TOTAL' : '';
    });
    const linhaTotal = aba.addRow(totais);
    linhaTotal.font = { bold: true };

    tabela.colunas.forEach((c, i) => {
      const coluna = aba.getColumn(i + 1);
      coluna.width = c.largura ?? 20;
      if (c.tipo === 'moeda') coluna.numFmt = '#,##0.00';
      if (c.tipo === 'numero') coluna.numFmt = '#,##0.00';
    });
    aba.getRow(1).font = { bold: true, size: 12 };
    aba.getRow(2).font = { bold: true, size: 11 };
    aba.views = [{ state: 'frozen', ySplit: 5 }];
  }

  const buffer = await livro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Exporta uma tabela em PDF paisagem, com cabecalho institucional e paginacao. */
export function paraPdf(tabela: Tabela, cabecalho: CabecalhoDocumento): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pesoTotal = tabela.colunas.reduce((t, c) => t + (c.largura ?? 20), 0);
    const larguras = tabela.colunas.map((c) => ((c.largura ?? 20) / pesoTotal) * larguraUtil);
    const geradoEm = cabecalho.geradoEm ?? new Date();

    const escreverCabecalho = () => {
      doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold');
      doc.text(`GOVERNO DO ESTADO DO PARANA`, { align: 'center' });
      doc.fontSize(10).text(`LEI ORCAMENTARIA ANUAL - EXERCICIO DE ${cabecalho.exercicio}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor('#111827').fontSize(10).text(tabela.titulo, { align: 'center' });
      if (tabela.fundamento) {
        doc.fillColor('#4b5563').fontSize(7).font('Helvetica').text(tabela.fundamento, { align: 'center' });
      }
      doc.moveDown(0.5);
    };

    const escreverLinha = (valores: string[], negrito: boolean, fundo?: string) => {
      const altura = 14;
      if (doc.y + altura > doc.page.height - doc.page.margins.bottom - 16) {
        doc.addPage();
        escreverCabecalho();
        escreverLinha(
          tabela.colunas.map((c) => c.titulo),
          true,
          '#1e3a8a',
        );
      }
      const y = doc.y;
      let x = doc.page.margins.left;
      if (fundo) {
        doc.rect(doc.page.margins.left, y - 1, larguraUtil, altura).fill(fundo);
      }
      doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
      doc.fillColor(fundo === '#1e3a8a' ? '#ffffff' : '#111827');
      valores.forEach((valor, i) => {
        const coluna = tabela.colunas[i];
        doc.text(valor, x + 2, y + 2, {
          width: larguras[i] - 4,
          align: coluna.tipo === 'texto' ? 'left' : 'right',
          ellipsis: true,
          lineBreak: false,
        });
        x += larguras[i];
      });
      doc.fillColor('#111827');
      doc.y = y + altura;
      doc
        .moveTo(doc.page.margins.left, doc.y - 1)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y - 1)
        .strokeColor('#e5e7eb')
        .lineWidth(0.3)
        .stroke();
    };

    escreverCabecalho();
    escreverLinha(
      tabela.colunas.map((c) => c.titulo),
      true,
      '#1e3a8a',
    );
    tabela.linhas.forEach((linha, indice) => {
      escreverLinha(
        tabela.colunas.map((c) => valorFormatado(c, linha[c.chave])),
        false,
        indice % 2 === 1 ? '#f9fafb' : undefined,
      );
    });
    escreverLinha(
      tabela.colunas.map((c, i) =>
        c.tipo === 'moeda'
          ? formatarBRL(tabela.linhas.reduce((t, l) => t + Number(l[c.chave] ?? 0), 0))
          : i === 0
            ? 'TOTAL'
            : '',
      ),
      true,
      '#e5e7eb',
    );

    doc.moveDown(0.5);
    doc
      .fontSize(6)
      .fillColor('#6b7280')
      .text(
        `Documento gerado pelo Sistema de Elaboracao da LOA em ${geradoEm.toLocaleString('pt-BR')} - ${tabela.linhas.length} registro(s).`,
        { align: 'right' },
      );

    doc.end();
  });
}
