export interface Escala {
  /** Valor no pé do eixo Y. */
  base: number;
  passo: number;
  secoes: number;
  /** Valores de cada marca do eixo, de baixo para cima (secoes + 1 itens). */
  marcas: number[];
}

/** Passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) mais próximo acima de `bruto`. */
function passoRedondo(bruto: number): number {
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

const arredondar = (n: number) => Math.round(n * 1e6) / 1e6;

/** Eixo Y que cobre todos os valores com ~`secoes` divisões de passo redondo. */
export function escalaGrafico(valores: number[], secoes = 4, inteiro = false): Escala {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min || Math.abs(max) * 0.2 || 1;

  let passo = passoRedondo(amplitude / secoes);
  if (inteiro) passo = Math.max(1, Math.ceil(passo));

  const base = arredondar(Math.floor(min / passo) * passo);
  const n = Math.max(1, Math.ceil(arredondar((max - base) / passo)));
  const marcas = Array.from({ length: n + 1 }, (_, i) => arredondar(base + passo * i));
  return { base, passo, secoes: n, marcas };
}
