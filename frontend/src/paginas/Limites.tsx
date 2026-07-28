import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, EXERCICIO, type Limite } from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, BarraProgresso, Botao, Cartao, Carregando, Indicador, TituloPagina, Vazio } from '../componentes/base';
import { formatarMoeda, formatarResumo } from '../formato';

export function PaginaLimites() {
  const { usuario } = useAutenticacao();
  const clienteQuery = useQueryClient();
  const [filtro, setFiltro] = useState('');
  const [emEdicao, setEmEdicao] = useState<number | null>(null);
  const [novoValor, setNovoValor] = useState('');
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);

  const podeAjustar = usuario ? ['ADMIN', 'ORGAO_CENTRAL'].includes(usuario.perfil) : false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['limites', EXERCICIO],
    queryFn: () => api.get<Limite[]>(`/exercicios/${EXERCICIO}/limites`),
  });

  const ajuste = useMutation({
    mutationFn: ({ id, valor }: { id: number; valor: number }) =>
      api.put(`/limites/${id}`, { valor, observacao: 'Teto revisto pelo órgão central de orçamento.' }),
    onSuccess: () => {
      setMensagem({ tom: 'sucesso', texto: 'Teto atualizado e comunicado à unidade orçamentária.' });
      setEmEdicao(null);
      clienteQuery.invalidateQueries({ queryKey: ['limites'] });
      clienteQuery.invalidateQueries({ queryKey: ['propostas'] });
    },
    onError: (erro: Error) => setMensagem({ tom: 'erro', texto: erro.message }),
  });

  const filtrados = useMemo(() => {
    if (!data) return [];
    const termo = filtro.trim().toLowerCase();
    return data
      .filter((l) => !termo || l.unidade.nome.toLowerCase().includes(termo) || l.unidade.codigo.includes(termo) || l.unidade.sigla.toLowerCase().includes(termo))
      .sort((a, b) => b.utilizacao - a.utilizacao);
  }, [data, filtro]);

  const resumo = useMemo(() => {
    const itens = data ?? [];
    return {
      teto: itens.reduce((t, l) => t + l.valor, 0),
      proposto: itens.reduce((t, l) => t + l.proposto, 0),
      excedidos: itens.filter((l) => l.saldo < 0).length,
      criticos: itens.filter((l) => l.utilizacao >= 99 && l.saldo >= 0).length,
    };
  }, [data]);

  if (isLoading) return <Carregando />;
  if (error || !data) return <Aviso>Não foi possível carregar os tetos orçamentários.</Aviso>;

  return (
    <>
      <TituloPagina
        titulo="Tetos orçamentários"
        descricao="Limites comunicados pelo órgão central às unidades orçamentárias e o respectivo grau de utilização pelas propostas apresentadas."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Soma dos tetos" valor={formatarResumo(resumo.teto)} />
        <Indicador rotulo="Despesa proposta" valor={formatarResumo(resumo.proposto)} tom="destaque" />
        <Indicador rotulo="Unidades com teto excedido" valor={String(resumo.excedidos)} tom={resumo.excedidos > 0 ? 'negativo' : 'positivo'} />
        <Indicador rotulo="Unidades acima de 99% do teto" valor={String(resumo.criticos)} tom={resumo.criticos > 0 ? 'atencao' : 'positivo'} />
      </div>

      {mensagem && (
        <div className="mt-3">
          <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>
        </div>
      )}

      <Cartao
        className="mt-4"
        titulo={`Limites por unidade orçamentária (${filtrados.length})`}
        descricao="Ordenados pelo maior grau de utilização do teto."
        acoes={
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por unidade"
            className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
        }
      >
        <div className="max-h-[36rem] overflow-auto">
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>U.O.</th>
                <th>Unidade orçamentária</th>
                <th className="numero">Teto (R$)</th>
                <th className="numero">Proposto (R$)</th>
                <th className="numero">Saldo (R$)</th>
                <th>Utilização</th>
                {podeAjustar && <th>Ação</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono">{l.unidade.codigo}</td>
                  <td>
                    {l.unidade.sigla}
                    <p className="text-[0.6875rem] text-slate-500">{l.unidade.nome}</p>
                  </td>
                  <td className="numero">
                    {emEdicao === l.id ? (
                      <input
                        value={novoValor}
                        onChange={(e) => setNovoValor(e.target.value)}
                        className="w-36 rounded border border-slate-300 px-1 py-0.5 text-right text-xs"
                      />
                    ) : (
                      formatarMoeda(l.valor)
                    )}
                  </td>
                  <td className="numero">{formatarMoeda(l.proposto)}</td>
                  <td className={`numero ${l.saldo < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatarMoeda(l.saldo)}</td>
                  <td>
                    <BarraProgresso percentual={l.utilizacao} />
                  </td>
                  {podeAjustar && (
                    <td>
                      {emEdicao === l.id ? (
                        <div className="flex gap-1">
                          <Botao onClick={() => ajuste.mutate({ id: l.id, valor: Number(novoValor) })} disabled={ajuste.isPending}>
                            Salvar
                          </Botao>
                          <Botao tipo="secundario" onClick={() => setEmEdicao(null)}>
                            Cancelar
                          </Botao>
                        </div>
                      ) : (
                        <Botao
                          tipo="secundario"
                          onClick={() => {
                            setEmEdicao(l.id);
                            setNovoValor(String(l.valor));
                          }}
                        >
                          Ajustar teto
                        </Botao>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <Vazio mensagem="Nenhuma unidade orçamentária atende ao filtro informado." />}
        </div>
      </Cartao>
    </>
  );
}
