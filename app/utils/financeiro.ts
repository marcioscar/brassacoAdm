

export function calcularSaudeFinanceira(dados: { faturamento: number, compras: number, variaveis: number, fixas: number, estoqueAtual: number, estoqueAnterior: number, despesasCompras: number, despesasComprasAnterior: number }) {
  const { faturamento, compras, variaveis, fixas, estoqueAtual, estoqueAnterior, despesasCompras, despesasComprasAnterior } = dados;
  
  
  // 1. Margem de Contribuição

  const margemRS = faturamento - (despesasCompras + variaveis);
  const margemPerc = faturamento > 0 ? (margemRS / faturamento) : 0;

  // 2. Ponto de Equilíbrio
  const pontoEquilibrio = margemPerc > 0 ? (fixas / margemPerc) : 0;

  // 3. Lucro Líquido = Receitas - Despesas totais
  const lucro = faturamento - (despesasCompras + variaveis + fixas);
  const lucratividade = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  
  //usando o estoque metricas Competência
  // 4. Calculamos o CMV (O custo real do que saiu)
  const cmv = estoqueAnterior + compras - estoqueAtual;
// 5. Margem de Contribuição Real
  const margemRSReal = faturamento - (cmv + variaveis);
  const margemPercReal = faturamento > 0 ? (margemRSReal / faturamento) : 0;
// 6. Lucro Líquido Real
  const lucroReal = margemRSReal - fixas;
  const lucratividadeReal = faturamento > 0 ? (lucroReal / faturamento) * 100 : 0;

  return {
    margemContribuicao: margemRS,
    margemContribuicaoPerc: margemPerc.toFixed(2),
    pontoEquilibrio: pontoEquilibrio,
    lucroLiquido: lucro,
    lucratividade: lucratividade,
    cmv: cmv,
    margemRSReal: margemRSReal,
    margemPercReal: margemPercReal.toFixed(2),
    lucroLiquidoReal: lucroReal,
    lucratividadeReal: lucratividadeReal,
    status: lucro > 0 ? "LUCRO" : "PREJUÍZO"
  };
}