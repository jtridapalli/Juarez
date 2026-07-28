import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { centavos, distribuir } from '../src/lib/money.js';
import { ANEXOS, anexo1, anexo9, quadroDetalhamentoDespesa, totalizacoes } from '../src/servicos/anexos.js';
import { paraCsv } from '../src/servicos/exportadores.js';
import { gerarProjetoLei, valorEmPalavras } from '../src/servicos/projeto-lei.js';
import { carregarSnapshot } from '../src/servicos/snapshot.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('utilitarios monetarios', () => {
  it('arredonda valores para centavos no criterio comercial', () => {
    expect(centavos(1.005)).toBe(1.01);
    expect(centavos(2_500_000.555)).toBe(2_500_000.56);
    expect(centavos(-1.005)).toBe(-1.01);
    expect(centavos(0)).toBe(0);
    expect(centavos(84_922_027_040)).toBe(84_922_027_040);
  });

  it('distribui um total entre pesos sem perda de centavos', () => {
    const parcelas = distribuir(100, [1, 1, 1]);
    expect(parcelas.reduce((t, v) => t + v, 0)).toBe(100);
    expect(parcelas).toEqual([33.33, 33.33, 33.34]);
  });
});

describe('valor por extenso do projeto de lei', () => {
  it.each([
    [0, 'zero real'],
    [1, 'um real'],
    [1.01, 'um real e um centavo'],
    [100, 'cem reais'],
    [1_000, 'mil reais'],
    [2_021, 'dois mil e vinte e um reais'],
    [1_000_000, 'um milhao de reais'.replace(' de', '')],
    [84_922_027_040, 'oitenta e quatro bilhoes e novecentos e vinte e dois milhoes e vinte e sete mil e quarenta reais'],
  ])('converte %s', (valor, esperado) => {
    expect(valorEmPalavras(valor as number)).toBe(esperado);
  });
});

describe('anexos da LOA 2027', () => {
  it('mantem a identidade entre receita e despesa no Anexo I', async () => {
    const snapshot = await carregarSnapshot(2027);
    const tabela = anexo1(snapshot);
    const total = tabela.linhas.at(-1)!;
    expect(total.receita).toBe(total.valorDespesa);
    expect(Number(total.receita)).toBeGreaterThan(80_000_000_000);
  });

  it('reproduz a despesa total em cada anexo consolidado', async () => {
    const snapshot = await carregarSnapshot(2027);
    const totais = totalizacoes(snapshot);
    const somar = (linhas: Record<string, string | number>[], chave: string) =>
      centavos(linhas.reduce((t, l) => t + Number(l[chave] ?? 0), 0));

    expect(somar(anexo9(snapshot).linhas, 'valor')).toBe(totais.despesaTotal);
    expect(somar(quadroDetalhamentoDespesa(snapshot).linhas, 'valor')).toBe(totais.despesaTotal);
  });

  it('gera todos os anexos com colunas e linhas preenchidas', async () => {
    const snapshot = await carregarSnapshot(2027);
    for (const anexo of ANEXOS) {
      const tabela = anexo.gerar(snapshot);
      expect(tabela.colunas.length, anexo.codigo).toBeGreaterThan(1);
      expect(tabela.linhas.length, anexo.codigo).toBeGreaterThan(0);
      for (const coluna of tabela.colunas) {
        expect(Object.keys(tabela.linhas[0]), `${anexo.codigo}/${coluna.chave}`).toContain(coluna.chave);
      }
    }
  });

  it('exporta CSV com separador ponto-e-virgula, BOM e linha de totais', async () => {
    const snapshot = await carregarSnapshot(2027);
    const csv = paraCsv(anexo9(snapshot));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const linhas = csv.trim().split('\r\n');
    expect(linhas[0]).toContain('Orgao;Denominacao');
    expect(linhas.at(-1)!.startsWith('TOTAL;')).toBe(true);
  });

  it('escreve o projeto de lei com valores identicos aos consolidados', async () => {
    const snapshot = await carregarSnapshot(2027);
    const totais = totalizacoes(snapshot);
    const projeto = gerarProjetoLei(snapshot);
    expect(projeto.artigos).toHaveLength(9);
    expect(projeto.texto).toContain(valorEmPalavras(totais.receitaTotal));
    expect(projeto.texto).toContain(valorEmPalavras(totais.reservaContingencia));
  });
});
