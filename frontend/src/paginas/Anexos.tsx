import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, EXERCICIO, enderecoDownload, type Anexo, type ProjetoLei, type TabelaAnexo } from '../api';
import { Aviso, Botao, Cartao, Carregando, Indicador, TituloPagina } from '../componentes/base';
import { formatarMoeda } from '../formato';

function celula(tipo: 'texto' | 'moeda' | 'numero', valor: string | number | undefined) {
  if (valor === undefined || valor === null) return '';
  if (tipo === 'moeda') return formatarMoeda(Number(valor));
  if (tipo === 'numero') return Number(valor).toFixed(2).replace('.', ',');
  return String(valor);
}

export function PaginaAnexos() {
  const [selecionado, setSelecionado] = useState('anexo-01');
  const [projetoVisivel, setProjetoVisivel] = useState(false);

  const anexos = useQuery({ queryKey: ['anexos', EXERCICIO], queryFn: () => api.get<Anexo[]>(`/exercicios/${EXERCICIO}/anexos`) });
  const tabela = useQuery({
    queryKey: ['anexo', EXERCICIO, selecionado],
    queryFn: () => api.get<TabelaAnexo>(`/exercicios/${EXERCICIO}/anexos/${selecionado}`),
  });
  const projeto = useQuery({
    queryKey: ['projeto-lei', EXERCICIO],
    queryFn: () => api.get<ProjetoLei>(`/exercicios/${EXERCICIO}/projeto-lei`),
    enabled: projetoVisivel,
  });

  const totalMoeda = tabela.data
    ? tabela.data.colunas
        .filter((c) => c.tipo === 'moeda')
        .map((c) => ({ titulo: c.titulo, total: tabela.data!.linhas.reduce((t, l) => t + Number(l[c.chave] ?? 0), 0) }))
    : [];

  return (
    <>
      <TituloPagina
        titulo="Anexos da lei orçamentária e projeto de lei"
        descricao="Geração dos anexos exigidos pela Lei 4.320/1964, dos demonstrativos da Lei de Responsabilidade Fiscal e do texto do projeto de lei, em formato aberto (CSV), planilha (XLSX) e publicação (PDF)."
        acoes={
          <>
            <a href={enderecoDownload(`/exercicios/${EXERCICIO}/anexos-completos.xlsx`)}>
              <Botao>Baixar todos os anexos (XLSX)</Botao>
            </a>
            <a href={enderecoDownload(`/exercicios/${EXERCICIO}/projeto-lei?formato=txt`)}>
              <Botao tipo="secundario">Baixar projeto de lei</Botao>
            </a>
            <Botao tipo="secundario" onClick={() => setProjetoVisivel((v) => !v)}>
              {projetoVisivel ? 'Ocultar texto da lei' : 'Visualizar texto da lei'}
            </Botao>
          </>
        }
      />

      {projetoVisivel && (
        <Cartao className="mb-4" titulo="Texto do projeto de lei orçamentária anual">
          {projeto.isLoading && <Carregando mensagem="Redigindo o texto a partir dos valores consolidados..." />}
          {projeto.data && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-slate-800">
              {projeto.data.texto}
            </pre>
          )}
        </Cartao>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        <Cartao titulo="Anexos disponíveis" className="xl:col-span-1">
          {anexos.isLoading && <Carregando />}
          <ul className="divide-y divide-slate-100">
            {anexos.data?.map((a) => (
              <li key={a.codigo}>
                <button
                  type="button"
                  onClick={() => setSelecionado(a.codigo)}
                  className={`block w-full px-4 py-2 text-left text-xs transition ${
                    selecionado === a.codigo ? 'bg-parana-50 font-semibold text-parana-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {a.titulo}
                </button>
              </li>
            ))}
          </ul>
        </Cartao>

        <div className="xl:col-span-3">
          {tabela.isLoading && (
            <Cartao>
              <Carregando />
            </Cartao>
          )}
          {tabela.error && <Aviso>Não foi possível gerar o anexo selecionado.</Aviso>}
          {tabela.data && (
            <>
              {totalMoeda.length > 0 && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {totalMoeda.slice(0, 3).map((t) => (
                    <Indicador key={t.titulo} rotulo={`Total · ${t.titulo}`} valor={`R$ ${formatarMoeda(t.total)}`} tom="destaque" />
                  ))}
                </div>
              )}

              <Cartao
                titulo={tabela.data.titulo}
                descricao={tabela.data.fundamento}
                acoes={
                  <>
                    <span className="text-[0.6875rem] text-slate-500">{tabela.data.linhas.length} registro(s)</span>
                    {(['csv', 'xlsx', 'pdf'] as const).map((formato) => (
                      <a
                        key={formato}
                        href={enderecoDownload(`/exercicios/${EXERCICIO}/anexos/${selecionado}?formato=${formato}`)}
                        target={formato === 'pdf' ? '_blank' : undefined}
                        rel="noreferrer"
                      >
                        <Botao tipo="secundario">{formato.toUpperCase()}</Botao>
                      </a>
                    ))}
                  </>
                }
              >
                <div className="max-h-[32rem] overflow-auto">
                  <table className="tabela-orcamento">
                    <thead>
                      <tr>
                        {tabela.data.colunas.map((c) => (
                          <th key={c.chave} className={c.tipo === 'texto' ? '' : 'text-right'}>
                            {c.titulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.data.linhas.map((linha, indice) => (
                        <tr key={indice}>
                          {tabela.data!.colunas.map((c) => (
                            <td key={c.chave} className={c.tipo === 'texto' ? '' : 'numero'}>
                              {celula(c.tipo, linha[c.chave])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Cartao>
            </>
          )}
        </div>
      </div>
    </>
  );
}
