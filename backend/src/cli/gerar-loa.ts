/**
 * Geracao completa do pacote da Lei Orcamentaria Anual.
 *
 * Uso: npm run loa:gerar -- [--ano 2027] [--saida ./output]
 *
 * Produz, no diretorio de saida:
 *  - validacao.json ......... resultado do motor de regras legais;
 *  - resumo.json ............ totalizacoes consolidadas;
 *  - projeto-de-lei.txt ..... texto do projeto de lei;
 *  - anexos/*.csv ........... anexos em formato aberto;
 *  - anexos/*.pdf ........... anexos em formato de publicacao;
 *  - LOA<ano>-anexos-completos.xlsx .. planilha unica com todos os anexos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { formatarBRL } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { validarOrcamento } from '../dominio/validacao.js';
import { ANEXOS, totalizacoes } from '../servicos/anexos.js';
import { paraCsv, paraPdf, paraXlsx } from '../servicos/exportadores.js';
import { gerarProjetoLei } from '../servicos/projeto-lei.js';
import { carregarSnapshot } from '../servicos/snapshot.js';

function argumento(nome: string, padrao: string): string {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice >= 0 && process.argv[indice + 1] ? process.argv[indice + 1] : padrao;
}

async function main() {
  const ano = Number(argumento('ano', '2027'));
  const saida = resolve(argumento('saida', './output'));
  const diretorioAnexos = join(saida, 'anexos');
  await mkdir(diretorioAnexos, { recursive: true });

  console.log(`Gerando o pacote da LOA ${ano} em ${saida}`);
  const snapshot = await carregarSnapshot(ano);
  const totais = totalizacoes(snapshot);
  const validacao = validarOrcamento(snapshot);
  const projeto = gerarProjetoLei(snapshot);

  await writeFile(join(saida, 'validacao.json'), JSON.stringify(validacao, null, 2), 'utf-8');
  await writeFile(join(saida, 'resumo.json'), JSON.stringify({ exercicio: ano, ...totais }, null, 2), 'utf-8');
  await writeFile(join(saida, 'projeto-de-lei.txt'), projeto.texto, 'utf-8');

  const tabelas = ANEXOS.map((anexo) => anexo.gerar(snapshot));
  for (const tabela of tabelas) {
    await writeFile(join(diretorioAnexos, `${tabela.codigo}.csv`), paraCsv(tabela), 'utf-8');
    const pdf = await paraPdf(tabela, { exercicio: ano, titulo: tabela.titulo });
    await writeFile(join(diretorioAnexos, `${tabela.codigo}.pdf`), pdf);
    console.log(`  ${tabela.codigo.padEnd(26)} ${String(tabela.linhas.length).padStart(5)} linha(s)`);
  }

  const planilha = await paraXlsx(tabelas, { exercicio: ano, titulo: `Anexos da LOA ${ano}` });
  await writeFile(join(saida, `LOA${ano}-anexos-completos.xlsx`), planilha);

  console.log('---');
  console.log(`Receita prevista ....: R$ ${formatarBRL(totais.receitaTotal)}`);
  console.log(`Despesa fixada ......: R$ ${formatarBRL(totais.despesaTotal)}`);
  console.log(`Diferenca ...........: R$ ${formatarBRL(totais.diferenca)}`);
  console.log(`Regras avaliadas ....: ${validacao.totalRegras}`);
  console.log(`Erros ...............: ${validacao.totalErros}`);
  console.log(`Alertas .............: ${validacao.totalAlertas}`);
  console.log(`Situacao ............: ${validacao.aprovado ? 'APTA PARA ENVIO A ASSEMBLEIA LEGISLATIVA' : 'PENDENTE DE CORRECOES'}`);

  for (const resultado of validacao.resultados) {
    const marca = resultado.aprovado ? 'OK  ' : resultado.severidade === 'ERRO' ? 'ERRO' : 'ALER';
    console.log(`  [${marca}] ${resultado.regra} ${resultado.titulo}`);
    console.log(`         ${resultado.mensagem}`);
  }

  if (!validacao.aprovado) process.exitCode = 2;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
