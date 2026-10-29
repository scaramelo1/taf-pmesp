const pad = (n: number) => String(n).padStart(2, '0');

/** Data local de hoje em AAAA-MM-DD. */
export function hojeISO(agora = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

/** "28/10/2026" → "2026-10-28"; null se incompleta ou inexistente (ex.: 31/02). */
export function lerData(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1900 || ano > 2100) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** "2026-10-28" → "28/10/2026" */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Máscara DD/MM/AAAA aplicada enquanto o usuário digita. */
export function mascararData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Dias de `de` até `ate` (ambos AAAA-MM-DD); negativo se `ate` já passou. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** Idade completa (anos) na data `em`; ambos AAAA-MM-DD. */
export function idadeEm(nascimento: string, em: string): number {
  const [an, mn, dn] = nascimento.split('-').map(Number);
  const [ae, me, de] = em.split('-').map(Number);
  return ae - an - (me < mn || (me === mn && de < dn) ? 1 : 0);
}

/** "2026-10-28" → "28/10" */
export function formatarDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** Erro da data do treino: inválida, no futuro ou antes do nascimento; undefined se ok. */
export function erroDataTreino(texto: string, hoje: string, nascimento: string | null = null): string | undefined {
  const iso = lerData(texto);
  if (!iso) return 'Data inválida (DD/MM/AAAA)';
  if (iso > hoje) return 'A data não pode estar no futuro';
  if (nascimento && iso <= nascimento) return 'A data é anterior ao seu nascimento';
  return undefined;
}
