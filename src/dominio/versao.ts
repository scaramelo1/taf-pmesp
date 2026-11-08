// Versões do app no formato 1.2.3. Funções puras: o app e o servidor usam as mesmas.

const partes = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10) || 0);

export const versaoValida = (v: unknown): v is string => typeof v === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(v);

/** Negativo se a < b, zero se iguais, positivo se a > b. */
export function compararVersoes(a: string, b: string): number {
  const [x, y] = [partes(a), partes(b)];
  for (let i = 0; i < 3; i++) {
    const diferenca = (x[i] ?? 0) - (y[i] ?? 0);
    if (diferenca !== 0) return diferenca;
  }
  return 0;
}

/** True quando existe versão publicada mais nova que a instalada. */
export const precisaAtualizar = (instalada: string | null | undefined, publicada: string | null | undefined) =>
  versaoValida(publicada) && versaoValida(instalada) && compararVersoes(instalada, publicada) < 0;
