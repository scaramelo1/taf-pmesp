// Página de admin do ReadyTAF: quantas pessoas se cadastraram e se estão lançando treinos.
// Entra com a senha ADMIN_SENHA de /etc/readytaf.env; a sessão fica num cookie que só o servidor lê.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { ContaAdmin } from './banco.ts';

const DIA_MS = 86_400_000;
const DIAS_GRAFICO = 30;
const VALIDADE_SESSAO_MS = 12 * 3_600_000;
const MAXIMO_ERROS = 5;
const JANELA_ERROS_MS = 15 * 60_000;
const FUSO = 'America/Sao_Paulo';

export interface ConfigAdmin {
  /** Senha da página do site; sem ela a página fica desligada (o painel do app continua). */
  senha?: string;
  /** Contas Google que veem o painel dentro do app. */
  emails: string[];
  /** Contador da página de download (downloads.txt); opcional. */
  lerDownloads?: () => number | null;
}

/** Sessões e tentativas de senha ficam na memória: reiniciar o servidor pede a senha de novo. */
export class AcessoAdmin {
  private sessoes = new Map<string, number>();
  private erros = new Map<string, { quantos: number; desde: number }>();
  private hashSenha: Buffer;
  private relogio: () => number;

  constructor(senha: string, relogio: () => number) {
    this.hashSenha = createHash('sha256').update(senha).digest();
    this.relogio = relogio;
  }

  bloqueado(ip: string) {
    const e = this.erros.get(ip);
    return !!e && e.quantos >= MAXIMO_ERROS && this.relogio() - e.desde < JANELA_ERROS_MS;
  }

  /** Devolve o token da sessão, ou null se a senha estiver errada ou o IP bloqueado. */
  entrar(ip: string, senha: string): string | null {
    if (this.bloqueado(ip)) return null;
    const certo = timingSafeEqual(createHash('sha256').update(senha).digest(), this.hashSenha);
    if (!certo) {
      const agora = this.relogio();
      const e = this.erros.get(ip);
      if (!e || agora - e.desde >= JANELA_ERROS_MS) this.erros.set(ip, { quantos: 1, desde: agora });
      else e.quantos += 1;
      if (this.erros.size > 5_000) this.erros.clear();
      return null;
    }
    this.erros.delete(ip);
    const agora = this.relogio();
    for (const [t, expira] of this.sessoes) if (expira <= agora) this.sessoes.delete(t);
    const token = randomBytes(32).toString('base64url');
    this.sessoes.set(token, agora + VALIDADE_SESSAO_MS);
    return token;
  }

  valido(token: string | null) {
    const expira = token ? this.sessoes.get(token) : undefined;
    return expira !== undefined && expira > this.relogio();
  }

  sair(token: string | null) {
    if (token) this.sessoes.delete(token);
  }
}

// ---------- Números ----------

export interface LinhaAdmin {
  nome: string;
  email: string | null;
  foto: string | null;
  modo: string | null;
  criadaEm: number;
  ultimoAcesso: number | null;
  treinos: number;
  treinos7: number;
  ultimoTreino: number | null;
  sessoes: number;
}

export interface ResumoAdmin {
  contas: number;
  novas7: number;
  novas30: number;
  ativos1: number;
  ativos7: number;
  ativos30: number;
  comTreino: number;
  lancaram7: number;
  treinos: number;
  treinos7: number;
  treinos30: number;
  modos: { candidato: number; efetivo: number; semPerfil: number };
  /** Dia (AAAA-MM-DD no horário de Brasília), treinos lançados e cadastros, do mais antigo ao de hoje. */
  dias: { dia: string; treinos: number; cadastros: number }[];
  linhas: LinhaAdmin[];
}

/** O SQLite grava "AAAA-MM-DD HH:MM:SS" em UTC. */
const lerUtc = (texto: unknown) => {
  if (typeof texto !== 'string') return null;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(texto) ? texto : `${texto.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms : null;
};

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const diaDe = (ms: number) => formatoDia.format(ms);

export function resumirAdmin(contas: ContaAdmin[], agora: number): ResumoAdmin {
  const dias = Array.from({ length: DIAS_GRAFICO }, (_, i) => ({
    dia: diaDe(agora - (DIAS_GRAFICO - 1 - i) * DIA_MS),
    treinos: 0,
    cadastros: 0,
  }));
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const dentro = (ms: number | null, dias: number) => ms !== null && agora - ms < dias * DIA_MS;

  const r: ResumoAdmin = {
    contas: contas.length, novas7: 0, novas30: 0, ativos1: 0, ativos7: 0, ativos30: 0,
    comTreino: 0, lancaram7: 0, treinos: 0, treinos7: 0, treinos30: 0,
    modos: { candidato: 0, efetivo: 0, semPerfil: 0 },
    dias,
    linhas: [],
  };

  for (const c of contas) {
    const criadaEm = lerUtc(c.criadaEm) ?? 0;
    if (dentro(criadaEm, 7)) r.novas7 += 1;
    if (dentro(criadaEm, 30)) r.novas30 += 1;
    if (dentro(c.ultimoAcesso, 1)) r.ativos1 += 1;
    if (dentro(c.ultimoAcesso, 7)) r.ativos7 += 1;
    if (dentro(c.ultimoAcesso, 30)) r.ativos30 += 1;
    const cadastro = porDia.get(diaDe(criadaEm));
    if (cadastro) cadastro.cadastros += 1;

    let treinos: { criadoEm?: unknown }[] = [];
    let modo: string | null = null;
    try {
      const dados = c.dados ? (JSON.parse(c.dados) as { treinos?: unknown; perfil?: { modo?: unknown } | null }) : null;
      if (Array.isArray(dados?.treinos)) treinos = dados.treinos as { criadoEm?: unknown }[];
      if (typeof dados?.perfil?.modo === 'string') modo = dados.perfil.modo;
    } catch {
      // Backup ilegível: conta sem treinos.
    }
    if (modo === 'candidato') r.modos.candidato += 1;
    else if (modo === 'efetivo') r.modos.efetivo += 1;
    else r.modos.semPerfil += 1;

    let treinos7 = 0;
    let ultimoTreino: number | null = null;
    for (const t of treinos) {
      const quando = lerUtc(t.criadoEm);
      if (quando === null) continue;
      if (dentro(quando, 7)) treinos7 += 1;
      if (dentro(quando, 30)) r.treinos30 += 1;
      if (ultimoTreino === null || quando > ultimoTreino) ultimoTreino = quando;
      const dia = porDia.get(diaDe(quando));
      if (dia) dia.treinos += 1;
    }
    r.treinos += treinos.length;
    r.treinos7 += treinos7;
    if (treinos.length > 0) r.comTreino += 1;
    if (treinos7 > 0) r.lancaram7 += 1;

    r.linhas.push({
      nome: c.nomeCompleto || c.nome,
      email: c.email,
      foto: c.foto,
      modo,
      criadaEm,
      ultimoAcesso: c.ultimoAcesso,
      treinos: treinos.length,
      treinos7,
      ultimoTreino,
      sessoes: c.sessoes,
    });
  }
  // Quem usou o app por último aparece primeiro.
  r.linhas.sort((a, b) => (b.ultimoAcesso ?? 0) - (a.ultimoAcesso ?? 0));
  return r;
}

// ---------- HTML ----------

const esc = (texto: unknown) =>
  String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
});
const quando = (ms: number | null) => (ms ? formatoDataHora.format(ms) : '—');
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : '—');

function ha(ms: number | null, agora: number) {
  if (!ms) return 'nunca';
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

const ESTILO = `
:root{color-scheme:light;--fundo:#F4F6F8;--cartao:#fff;--texto:#1B2430;--suave:#5F6B7A;--linha:#E2E7ED;--topo:#12223A;--serie:#2a78d6;--grade:#EDF0F3;--erro:#C62828}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--fundo:#10151C;--cartao:#1A212B;--texto:#EEF1F5;--suave:#A3AEBC;--linha:#2A3441;--topo:#0B1626;--serie:#3987e5;--grade:#232C38;--erro:#EF6C6C}}
:root[data-theme="dark"]{color-scheme:dark;--fundo:#10151C;--cartao:#1A212B;--texto:#EEF1F5;--suave:#A3AEBC;--linha:#2A3441;--topo:#0B1626;--serie:#3987e5;--grade:#232C38;--erro:#EF6C6C}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:var(--topo);color:#fff;padding:16px;display:flex;align-items:center;gap:12px}
header img{width:40px;height:40px;border-radius:10px}
header h1{font-size:18px;margin:0;flex:1}
header form{margin:0}
header button{background:transparent;color:#C9D3E0;border:1px solid #3A4B63;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}
main{max-width:1100px;margin:0 auto;padding:20px 16px 48px}
h2{font-size:16px;margin:28px 0 12px}
.atualizado{color:var(--suave);font-size:13px;margin:0}
.cartoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.cartao{background:var(--cartao);border:1px solid var(--linha);border-radius:12px;padding:14px 16px}
.cartao .valor{font-size:28px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}
.cartao .nome{color:var(--suave);font-size:13px}
.cartao .extra{color:var(--suave);font-size:12px;margin-top:4px}
.grafico{background:var(--cartao);border:1px solid var(--linha);border-radius:12px;padding:16px}
.grafico h3{margin:0 0 2px;font-size:14px}
.grafico p{margin:0 0 12px;color:var(--suave);font-size:12px}
.barras{display:flex;align-items:flex-end;gap:2px;height:140px;border-bottom:1px solid var(--linha);background:repeating-linear-gradient(to top,var(--grade) 0 1px,transparent 1px 35px)}
.barra{flex:1;height:100%;display:flex;align-items:flex-end;position:relative;outline:none}
.barra span{display:block;width:100%;background:var(--serie);border-radius:4px 4px 0 0;min-height:0}
.barra:hover span,.barra:focus span{filter:brightness(1.15)}
.barra[data-tip]:hover::after,.barra[data-tip]:focus::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--texto);color:var(--cartao);font-size:12px;white-space:nowrap;padding:4px 8px;border-radius:6px;z-index:2;pointer-events:none}
.eixo{display:flex;justify-content:space-between;color:var(--suave);font-size:11px;margin-top:4px}
.dois{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.tabela{overflow-x:auto;background:var(--cartao);border:1px solid var(--linha);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--linha);vertical-align:middle}
th{color:var(--suave);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
.pessoa{display:flex;align-items:center;gap:10px}
.pessoa img,.pessoa .sem-foto{width:34px;height:34px;border-radius:50%;flex:none;object-fit:cover}
.pessoa .sem-foto{background:var(--linha);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--suave)}
.pessoa small{display:block;color:var(--suave);font-size:12px}
.selo{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--linha);color:var(--suave)}
details{margin-top:10px;font-size:13px}
details table{min-width:0}
.entrar{max-width:360px;margin:12vh auto;background:var(--cartao);border:1px solid var(--linha);border-radius:14px;padding:24px;text-align:center}
.entrar img{width:72px;height:72px;border-radius:16px}
.entrar input{width:100%;padding:12px;border:1px solid var(--linha);border-radius:10px;font:inherit;background:var(--fundo);color:var(--texto);margin:14px 0 10px}
.entrar button{width:100%;padding:12px;border:0;border-radius:10px;background:#1E88E5;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.erro{color:var(--erro);font-size:14px}
`;

function pagina(corpo: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin ReadyTAF</title>
<style>${ESTILO}</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

export function paginaEntrarAdmin(erro?: string) {
  return pagina(`<form class="entrar" method="post" action="admin/entrar">
<img src="icone.png" alt="">
<h1 style="font-size:20px;margin:12px 0 0">Admin ReadyTAF</h1>
<input type="password" name="senha" placeholder="Senha" autocomplete="current-password" required autofocus>
${erro ? `<p class="erro">${esc(erro)}</p>` : ''}
<button type="submit">Entrar</button>
</form>`);
}

export const paginaAdminDesligado = () =>
  pagina('<div class="entrar"><p>A página de admin está desligada: falta ADMIN_SENHA em /etc/readytaf.env.</p></div>');

function cartao(nome: string, valor: number | string, extra = '') {
  return `<div class="cartao"><div class="valor">${esc(valor)}</div><div class="nome">${esc(nome)}</div>${extra ? `<div class="extra">${esc(extra)}</div>` : ''}</div>`;
}

function grafico(titulo: string, legenda: string, dias: ResumoAdmin['dias'], campo: 'treinos' | 'cadastros', unidade: [string, string]) {
  const maior = Math.max(1, ...dias.map((d) => d[campo]));
  const barras = dias.map((d) => {
    const v = d[campo];
    const altura = v ? Math.max(3, (v / maior) * 100) : 0;
    const tip = `${diaCurto(d.dia)}: ${v} ${v === 1 ? unidade[0] : unidade[1]}`;
    return `<div class="barra" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span style="height:${altura.toFixed(1)}%"></span></div>`;
  }).join('');
  const linhas = dias.filter((d) => d[campo] > 0).reverse()
    .map((d) => `<tr><td>${diaCurto(d.dia)}</td><td class="n">${d[campo]}</td></tr>`).join('');
  return `<div class="grafico">
<h3>${esc(titulo)}</h3>
<p>${esc(legenda)} · maior dia: ${Math.max(0, ...dias.map((d) => d[campo]))}</p>
<div class="barras" role="img" aria-label="${esc(titulo)}">${barras}</div>
<div class="eixo"><span>${diaCurto(dias[0].dia)}</span><span>${diaCurto(dias[Math.floor(dias.length / 2)].dia)}</span><span>hoje</span></div>
<details><summary>Ver em tabela</summary>${linhas ? `<table><tbody>${linhas}</tbody></table>` : '<p>Nenhum nos últimos 30 dias.</p>'}</details>
</div>`;
}

const MODOS: Record<string, string> = { candidato: 'Candidato', efetivo: 'Policial' };

function linhaPessoa(l: LinhaAdmin, agora: number) {
  const inicial = esc((l.nome || '?').trim().charAt(0).toUpperCase());
  const foto = l.foto
    ? `<img src="${esc(l.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
    : `<span class="sem-foto">${inicial}</span>`;
  return `<tr>
<td><div class="pessoa">${foto}<div>${esc(l.nome)}<small>${l.email ? esc(l.email) : 'e-mail após o próximo login'}</small></div></div></td>
<td>${l.modo ? `<span class="selo">${esc(MODOS[l.modo] ?? l.modo)}</span>` : '<span class="selo">sem perfil</span>'}</td>
<td class="n">${l.treinos}</td>
<td class="n">${l.treinos7}</td>
<td>${l.ultimoTreino ? `${quando(l.ultimoTreino)}<br><small style="color:var(--suave)">${ha(l.ultimoTreino, agora)}</small>` : '—'}</td>
<td>${quando(l.ultimoAcesso)}<br><small style="color:var(--suave)">${ha(l.ultimoAcesso, agora)}</small></td>
<td>${quando(l.criadaEm)}</td>
</tr>`;
}

export function paginaAdmin(r: ResumoAdmin, agora: number, downloads: number | null) {
  const pessoas = r.linhas.map((l) => linhaPessoa(l, agora)).join('');
  return pagina(`<header>
<img src="icone.png" alt="">
<h1>Admin ReadyTAF</h1>
<form method="post" action="admin/sair"><button type="submit">Sair</button></form>
</header>
<main>
<p class="atualizado">Atualizado em ${quando(agora)} (horário de Brasília). Recarregue a página para ver os números de agora.</p>

<h2>Cadastros</h2>
<div class="cartoes">
${cartao('Pessoas cadastradas', r.contas, `${r.novas7} nos últimos 7 dias · ${r.novas30} em 30`)}
${downloads === null ? '' : cartao('Downloads do APK', downloads, r.contas ? `${pct(r.contas, downloads)} viraram cadastro` : '')}
${cartao('Abriram o app hoje', r.ativos1, 'últimas 24 horas')}
${cartao('Ativos em 7 dias', r.ativos7, `${pct(r.ativos7, r.contas)} dos cadastrados`)}
${cartao('Ativos em 30 dias', r.ativos30, `${pct(r.ativos30, r.contas)} dos cadastrados`)}
</div>

<h2>Treinos</h2>
<div class="cartoes">
${cartao('Treinos lançados', r.treinos, `média de ${r.comTreino ? (r.treinos / r.comTreino).toFixed(1).replace('.', ',') : 0} por quem treina`)}
${cartao('Treinos em 7 dias', r.treinos7, `${r.treinos30} em 30 dias`)}
${cartao('Já lançaram treino', r.comTreino, `${pct(r.comTreino, r.contas)} dos cadastrados`)}
${cartao('Lançaram em 7 dias', r.lancaram7, `${pct(r.lancaram7, r.contas)} dos cadastrados`)}
${cartao('Candidatos', r.modos.candidato, `${r.modos.efetivo} policiais · ${r.modos.semPerfil} sem perfil`)}
</div>

<h2>Últimos 30 dias</h2>
<div class="dois">
${grafico('Treinos lançados por dia', 'Pela hora em que o treino foi salvo no app', r.dias, 'treinos', ['treino', 'treinos'])}
${grafico('Cadastros por dia', 'Primeiro login com Google', r.dias, 'cadastros', ['cadastro', 'cadastros'])}
</div>

<h2>Pessoas (${r.contas})</h2>
<div class="tabela">
<table>
<thead><tr><th>Pessoa</th><th>Modo</th><th class="n">Treinos</th><th class="n">Em 7 dias</th><th>Último treino</th><th>Último acesso</th><th>Cadastro</th></tr></thead>
<tbody>${pessoas || '<tr><td colspan="7">Ninguém cadastrado ainda.</td></tr>'}</tbody>
</table>
</div>
<p class="atualizado" style="margin-top:10px">Os treinos vêm do backup na nuvem: um treino feito sem internet aparece aqui quando o celular sincroniza.</p>
</main>`);
}
