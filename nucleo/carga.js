/**
 * Carga — o ancestral único de tudo que a tela mostra.
 *
 * Esta é a decisão estrutural do painel. `montaCarga` roda UMA vez por mudança de
 * premissa ou de recorte, e todas as oito abas leem o mesmo objeto. Nenhuma aba
 * recalcula nada.
 *
 * A razão é um defeito concreto: a consulta auditada publicava R$ 25,41 bi no
 * quadro 13 e R$ 25,50 bi no quadro 22, ambos rotulados como projeção de 2026 do
 * Poder Executivo. Eram duas posições da mesma grandeza — o arquivo de premissas
 * de 31/08 e a carga de 25/09 — e nenhum dos dois quadros declarava a sua régua.
 * Com um ancestral só, essa classe de divergência deixa de ser possível: dois
 * números diferentes para a mesma coisa exigiriam dois cálculos diferentes, e só
 * existe um.
 */

import { PARAMETROS_PADRAO } from './regras.js';
import { projeta2026 } from './projecao2026.js';
import { composicao2027, decompoeCrescimento2027, projeta2027 } from './projecao2027.js';
import { creditoAAbrir, todasAsAgregacoes } from './agregacao.js';
import { aplicaRecorte, dimensoes, ehEstadoInteiro, saneia } from './recorte.js';
import {
  leBacktest, pisoIndiceZero, pisoSemIntra, recortaArima, serieDo8778, vegetativoDaTela,
} from './comparacao.js';
import { sensibilidade } from './sensibilidade.js';
import { confere } from './conferencia.js';

/**
 * @param {object} base conteúdo de `dados/modelo.json`
 * @param {object} [par] premissas
 * @param {object} [sel] recorte
 * @param {object} [publicado] números da consulta, para a classe de aderência
 */
export function montaCarga(base, par = PARAMETROS_PADRAO, sel = null, publicado = null) {
  const todas = base.modelo;
  const recorte = saneia(todas, sel);
  const modelo = aplicaRecorte(todas, recorte);

  const p26 = projeta2026(modelo, par);
  const p27 = projeta2027(modelo, par, p26);

  // A leitura literal de D6 roda SEMPRE, e não sob demanda. A distância entre as
  // duas leituras do mesmo enunciado passa do crédito a abrir do exercício
  // corrente: ela é produto da tela, não uma opção escondida num menu.
  const p27Literal = projeta2027(modelo, { ...par, modoD6: par.modoD6 === 'mes' ? 'ano' : 'mes' }, p26);

  const agregados = todasAsAgregacoes(modelo, p26, p27, base.catalogo);
  const credito = creditoAAbrir(agregados, p26);
  const crescimento = decompoeCrescimento2027(modelo, par, p26, p27);
  const comp27 = composicao2027(p27);

  const veg = vegetativoDaTela(modelo, par, p26);
  const piso = pisoIndiceZero(modelo, par, p26);
  const pisoLimpo = pisoSemIntra(modelo, par, p26);
  const arima = recortaArima(base.arima, modelo, todas);
  const backtest = leBacktest(base.arima);
  const oito = serieDo8778(base.oito, modelo, todas);

  const carga = {
    base,
    modelo,
    todas,
    par,
    recorte,
    estadoInteiro: ehEstadoInteiro(recorte),
    dimensoes: dimensoes(todas, recorte, base.catalogo),
    catalogo: base.catalogo ?? {},
    p26,
    p27,
    p27Literal,
    agregados,
    credito,
    crescimento,
    comp27,
    veg,
    piso,
    pisoLimpo,
    arima,
    backtest,
    oito,
  };

  carga.sens = sensibilidade(modelo, par);
  carga.conferencia = confere(carga, publicado);
  return carga;
}
