import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, EXERCICIO, type Receita } from '../api';
import { Aviso, Cartao, Carregando, Etiqueta, Indicador, TituloPagina, Vazio } from '../componentes/base';
import { formatarMoeda, formatarResumo, rotuloEsfera } from '../formato';

const CATEGORIAS: Record<string, string> = {
  '1': 'Receitas Correntes',
  '2': 'Receitas de Capital',
  '7': 'Correntes Intraorçamentárias',
  '8': 'Capital Intraorçamentárias',
  '9': 'Deduções da Receita',
};

export function PaginaReceita() {
  const [filtro, setFiltro] = useState('');
  const [categoria, setCategoria] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['receitas', EXERCICIO],
    queryFn: () => api.get<Receita[]>(`/exercicios/${EXERCICIO}/receitas`),
  });

  const filtradas = useMemo(() => {
    if (!data) return [];
    const termo = filtro.trim().toLowerCase();
    return data.filter((r) => {
      const combinaCategoria = !categoria || r.natureza.categoria === categoria;
      const combinaTermo =
        !termo ||
        r.natureza.nome.toLowerCase().includes(termo) ||
        r.natureza.codigo.includes(termo) ||
        r.fonte.codigo.includes(termo) ||
        r.fonte.nome.toLowerCase().includes(termo);
      return combinaCategoria && combinaTermo;
    });
  }, [data, filtro, categoria]);

  const totais = useMemo(() => {
    const itens = data ?? [];
    const somar = (predicado: (r: Receita) => boolean) => itens.filter(predicado).reduce((t, r) => t + r.valor, 0);
    return {
      total: itens.reduce((t, r) => t + r.valor, 0),
      correntes: somar((r) => ['1', '7'].includes(r.natureza.categoria)),
      capital: somar((r) => ['2', '8'].includes(r.natureza.categoria)),
      deducoes: somar((r) => r.natureza.deducao),
      filtrado: filtradas.reduce((t, r) => t + r.valor, 0),
    };
  }, [data, filtradas]);

  if (isLoading) return <Carregando />;
  if (error || !data) return <Aviso>Não foi possível carregar a previsão da receita.</Aviso>;

  return (
    <>
      <TituloPagina
        titulo="Previsão da receita"
        descricao="Estimativa da receita para o exercício, classificada por natureza e fonte de recursos, com a respectiva memória de cálculo (art. 12 da LC 101/2000)."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Receita líquida prevista" valor={formatarResumo(totais.total)} tom="destaque" />
        <Indicador rotulo="Receitas correntes" valor={formatarResumo(totais.correntes)} />
        <Indicador rotulo="Receitas de capital" valor={formatarResumo(totais.capital)} />
        <Indicador rotulo="Deduções da receita" valor={formatarResumo(totais.deducoes)} tom="atencao" />
      </div>

      <Cartao
        className="mt-4"
        titulo={`Naturezas de receita (${filtradas.length} de ${data.length})`}
        descricao={`Soma das linhas exibidas: R$ ${formatarMoeda(totais.filtrado)}`}
        acoes={
          <>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORIAS).map(([codigo, nome]) => (
                <option key={codigo} value={codigo}>
                  {nome}
                </option>
              ))}
            </select>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por natureza ou fonte"
              className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </>
        }
      >
        <div className="max-h-[32rem] overflow-auto">
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>Natureza</th>
                <th>Especificação</th>
                <th>Categoria econômica</th>
                <th>Fonte</th>
                <th>Esfera</th>
                <th className="numero">Valor previsto (R$)</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[0.75rem]">{r.natureza.codigo}</td>
                  <td>
                    <span className={r.natureza.deducao ? 'text-rose-700' : ''}>{r.natureza.nome}</span>
                    {r.memoriaCalculo && (
                      <p className="mt-0.5 max-w-2xl text-[0.6875rem] leading-snug text-slate-500">{r.memoriaCalculo}</p>
                    )}
                  </td>
                  <td>{CATEGORIAS[r.natureza.categoria] ?? r.natureza.categoria}</td>
                  <td>
                    <span className="font-mono">{r.fonte.codigo}</span>
                    <p className="text-[0.6875rem] text-slate-500">{r.fonte.nome}</p>
                  </td>
                  <td>{rotuloEsfera(r.esfera)}</td>
                  <td className={`numero ${r.valor < 0 ? 'text-rose-700' : ''}`}>{formatarMoeda(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && <Vazio mensagem="Nenhuma natureza de receita atende ao filtro informado." />}
        </div>
      </Cartao>

      <Cartao className="mt-4" titulo="Composição por fonte de recursos">
        <div className="max-h-80 overflow-auto">
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Denominação</th>
                <th className="numero">Receita líquida (R$)</th>
                <th className="numero">Participação</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(
                data.reduce<Record<string, { codigo: string; nome: string; valor: number }>>((acumulado, r) => {
                  const atual = acumulado[r.fonte.codigo] ?? { codigo: r.fonte.codigo, nome: r.fonte.nome, valor: 0 };
                  atual.valor += r.valor;
                  acumulado[r.fonte.codigo] = atual;
                  return acumulado;
                }, {}),
              )
                .sort((a, b) => b.valor - a.valor)
                .map((fonte) => (
                  <tr key={fonte.codigo}>
                    <td className="font-mono">{fonte.codigo}</td>
                    <td>{fonte.nome}</td>
                    <td className="numero">{formatarMoeda(fonte.valor)}</td>
                    <td className="numero">
                      <Etiqueta tom="info">{((fonte.valor / totais.total) * 100).toFixed(2).replace('.', ',')}%</Etiqueta>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}
