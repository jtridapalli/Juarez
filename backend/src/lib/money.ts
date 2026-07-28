/**
 * Arredonda para centavos no criterio comercial (meio para cima, simetrico em
 * relacao ao zero).
 *
 * A multiplicacao por 100 introduz residuos de ponto flutuante que fazem
 * valores como 1,005 serem representados como 1,00499...; sem a correcao pela
 * tolerancia relativa, o arredondamento resultaria em 1,00 em vez de 1,01.
 */
export function centavos(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  const escalado = Math.abs(valor) * 100;
  const tolerancia = Math.max(escalado * Number.EPSILON * 4, 1e-9);
  return (Math.sign(valor) * Math.round(escalado + tolerancia)) / 100;
}

export function somar(valores: number[]): number {
  return centavos(valores.reduce((total, v) => total + v, 0));
}

const formatador = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarBRL(valor: number): string {
  return formatador.format(valor);
}

/**
 * Distribui um total entre pesos, garantindo que a soma das parcelas
 * seja exatamente igual ao total (a diferenca de arredondamento e
 * lancada na ultima parcela).
 */
export function distribuir(total: number, pesos: number[]): number[] {
  const somaPesos = pesos.reduce((t, p) => t + p, 0);
  if (somaPesos <= 0) return pesos.map(() => 0);

  const parcelas = pesos.map((p) => centavos((total * p) / somaPesos));
  const diferenca = centavos(total - parcelas.reduce((t, v) => t + v, 0));
  if (parcelas.length > 0) {
    const ultimo = parcelas.length - 1;
    parcelas[ultimo] = centavos(parcelas[ultimo] + diferenca);
  }
  return parcelas;
}
