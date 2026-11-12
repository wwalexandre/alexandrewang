// Worker do portfólio: serve o site estático e a API (contato, leads, visitas e painel admin).
// Banco: Cloudflare D1 (binding DB). Painel: protegido pelo Cloudflare Access (src/access.js).
// Este arquivo substitui api/visita.js da Vercel e as funções SQL do Supabase.

import { exigirAdmin } from './access.js';
import { resumoVisitas, resumoExtra } from './resumo.js';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const CABECALHOS_JSON = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (corpo, status) => new Response(JSON.stringify(corpo), { status: status || 200, headers: CABECALHOS_JSON });
const vazio = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

function texto(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const agoraISO = () => new Date().toISOString();
const haUmaHora = () => new Date(Date.now() - 3600 * 1000).toISOString();
const haUmDia = () => new Date(Date.now() - 86400 * 1000).toISOString();

// Chamada feita de outro site é descartada. Não substitui autenticação (fora do navegador dá
// para forjar o cabeçalho), mas corta o abuso mais comum de graça.
function deOutroSite(request, url) {
  const origem = request.headers.get('Origin');
  if (!origem) return false;
  try {
    const host = new URL(origem).hostname.replace(/^www\./, '').toLowerCase();
    return host !== url.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return true;
  }
}

async function corpoJson(request) {
  try {
    const t = await request.text();
    if (t.length > 20000) return null;
    const j = JSON.parse(t);
    return j && typeof j === 'object' ? j : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contato e leads
// ---------------------------------------------------------------------------

// Até 3 mensagens por e-mail por hora e 30 no total por hora. Acima disso: 429 com "limite".
async function rotaContato(request, env, url) {
  if (request.method !== 'POST') return json({ message: 'metodo' }, 405);
  if (deOutroSite(request, url)) return json({ message: 'origem' }, 403);
  const c = await corpoJson(request);
  if (!c) return json({ message: 'invalido' }, 400);

  const nome = String(c.nome || '').trim();
  const email = String(c.email || '').trim().toLowerCase();
  const assunto = String(c.assunto || '').trim();
  const mensagem = String(c.mensagem || '').trim();
  if (nome.length < 2 || nome.length > 100 || !EMAIL_OK.test(email) || email.length > 160
      || assunto.length > 120 || mensagem.length < 10 || mensagem.length > 2000) {
    return json({ message: 'invalido' }, 400);
  }

  const desde = haUmaHora();
  const [porEmail, total] = await Promise.all([
    env.DB.prepare('SELECT count(*) n FROM mensagens_contato WHERE email = ? AND criado_em > ?').bind(email, desde).first(),
    env.DB.prepare('SELECT count(*) n FROM mensagens_contato WHERE criado_em > ?').bind(desde).first()
  ]);
  if ((porEmail && porEmail.n >= 3) || (total && total.n >= 30)) return json({ message: 'limite' }, 429);

  await env.DB.prepare(
    'INSERT INTO mensagens_contato (nome, email, assunto, mensagem, idioma, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(nome, email, assunto || null, mensagem, c.idioma === 'en' ? 'en' : 'pt', agoraISO()).run();
  return json({ ok: true }, 201);
}

// Ignora repetição (mesmo e-mail, origem e detalhe em 24 h) e para de gravar acima de 500 por
// dia. Nunca devolve erro ao visitante: a resposta é sempre 204.
async function rotaLead(request, env, url) {
  if (request.method !== 'POST') return json({ message: 'metodo' }, 405);
  if (deOutroSite(request, url)) return vazio();
  const c = await corpoJson(request);
  if (!c) return vazio();

  const email = String(c.email || '').trim().toLowerCase();
  const origem = String(c.origem || '');
  const detalhe = String(c.detalhe || '').trim().slice(0, 120) || null;
  if (!EMAIL_OK.test(email) || email.length > 160 || ['curriculo', 'arquivo', 'demo'].indexOf(origem) === -1) return vazio();

  const desde = haUmDia();
  const [repetido, total] = await Promise.all([
    env.DB.prepare(
      'SELECT 1 x FROM leads WHERE email = ? AND origem = ? AND detalhe IS ? AND criado_em > ? LIMIT 1'
    ).bind(email, origem, detalhe, desde).first(),
    env.DB.prepare('SELECT count(*) n FROM leads WHERE criado_em > ?').bind(desde).first()
  ]);
  if (repetido || (total && total.n >= 500)) return vazio();

  await env.DB.prepare('INSERT INTO leads (email, origem, idioma, detalhe, criado_em) VALUES (?, ?, ?, ?, ?)')
    .bind(email, origem, c.idioma === 'en' ? 'en' : 'pt', detalhe, agoraISO()).run();
  return vazio();
}

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------
// Privacidade: o IP é usado só para montar um hash junto com um sal secreto e a data do dia.
// O IP não é gravado em lugar nenhum, e o hash muda à meia-noite, então não dá para seguir a
// mesma pessoa de um dia para o outro nem descobrir quem ela é.

const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|lighthouse|headless|phantom|curl|wget|python|axios|scrapy|node-fetch|go-http|java\/|monitor|pingdom|uptime|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|ccbot/i;

const TIPOS = ['rolagem', 'tempo', 'projeto', 'curriculo', 'demo', 'contato',
  'publicacao', 'video', 'imagem', 'secao', 'link'];

function aparelho(ua) {
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) return 'celular';
  return 'computador';
}

function sistema(ua) {
  if (/windows nt 10|windows nt 11/i.test(ua)) return 'Windows';
  if (/windows/i.test(ua)) return 'Windows antigo';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return null;
}

function navegador(ua) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return null;
}

// Host de onde a pessoa veio. Link interno do próprio site não conta como origem.
function origemDe(referencia, meuHost) {
  if (!referencia) return null;
  try {
    const host = new URL(referencia).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || host === meuHost || host.endsWith('.workers.dev') || host.endsWith('.vercel.app')) return null;
    if (host.includes('lnkd.in') || host.includes('linkedin')) return 'linkedin.com';
    return host.slice(0, 120);
  } catch (e) {
    return null;
  }
}

// `/` e `/index.html` são a mesma página: normaliza na gravação.
function caminhoCanonico(c) {
  if (c === '/index.html' || c === '/index.htm') return '/';
  if (c.length > 1 && c.endsWith('/')) return c.replace(/\/+$/, '');
  return c;
}

// Dono da rede do visitante, por consulta de servidor para servidor ao ipwho.is. O endereço
// é enviado na consulta e descartado: não é gravado aqui nem no banco. Declarado nas páginas
// privacidade.html e privacy.html. Se falhar ou demorar, a visita é gravada sem o nome da rede.
const DATACENTER = /amazon|aws|google|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|cloudflare|oracle|vultr|contabo|scaleway|leaseweb|m247|choopa|hostinger|godaddy|locaweb|hostgator|hosting|data ?cent|servi[cç]os de dados|data services|colocation|vpn|proxy/i;
const PROVEDOR = /vivo|claro|telefonica|telefônica|net servi|algar|sercomtel|universo online|terra net|embratel|telecom|telecomunica|banda larga|internet|provedor|fibra|virtua|gvt|copel|ligga|unifique|sumicity|brisanet|sigmanet/i;

async function redeDoIp(ip) {
  if (!ip) return null;
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 1200);
  try {
    const r = await fetch(
      'https://ipwho.is/' + encodeURIComponent(ip) + '?fields=success,postal,latitude,longitude,connection',
      { signal: parar.signal }
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.success === false) return null;
    const c = j.connection || {};
    const nome = String(c.org || c.isp || '').trim();
    if (!nome) return null;
    const paraClassificar = (String(c.org || '') + ' ' + String(c.isp || '') + ' ' + String(c.domain || '')).trim();
    return {
      operadora: nome.slice(0, 80),
      tipo: DATACENTER.test(paraClassificar) ? 'datacenter' : (PROVEDOR.test(paraClassificar) ? 'provedor' : 'empresa'),
      cep: j.postal == null ? null : String(j.postal),
      lat: j.latitude == null ? null : String(j.latitude),
      lon: j.longitude == null ? null : String(j.longitude)
    };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

// Sal secreto do identificador do dia. Gerado uma vez, na primeira visita, e guardado na
// tabela config: não existe passo manual de configuração.
let salEmMemoria = null;
async function salDoBanco(db) {
  if (salEmMemoria) return salEmMemoria;
  let linha = await db.prepare('SELECT sal FROM config WHERE id = 1').first();
  if (!linha) {
    const novo = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await db.prepare('INSERT OR IGNORE INTO config (id, sal) VALUES (1, ?)').bind(novo).run();
    linha = await db.prepare('SELECT sal FROM config WHERE id = 1').first();
  }
  salEmMemoria = linha.sal;
  return salEmMemoria;
}

// Impressão (sha256 de IP + navegador) + sal + data de Brasília, cortado em 32 caracteres.
// Muda à meia-noite de Brasília, não é reversível e o IP nunca chega ao banco.
async function sessaoDoDia(db, impressao) {
  if (!impressao) return null;
  const sal = await salDoBanco(db);
  const dia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  return (await sha256Hex(impressao + sal + dia)).slice(0, 32);
}

async function gravarVisita(db, sessao, v) {
  if (!sessao) return;
  const c = v.caminho;
  if (typeof c !== 'string' || !/^\/[A-Za-z0-9/._-]{0,199}$/.test(c) || c.includes('..')) return;
  const hoje = await db.prepare('SELECT count(*) n FROM visitas WHERE criado_em > ?').bind(haUmDia()).first();
  if (hoje && hoje.n >= 20000) return;

  let lat = v.lat === null || v.lat === '' ? NaN : Number(v.lat);
  let lon = v.lon === null || v.lon === '' ? NaN : Number(v.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    lat = null; lon = null;
  }

  await db.prepare(
    `INSERT INTO visitas (sessao, caminho, idioma, pais, regiao, cidade, fuso, dispositivo, sistema, navegador,
                          origem, campanha, cep, latitude, longitude, operadora, rede_tipo, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    sessao, caminhoCanonico(c).slice(0, 200), v.idioma === 'en' ? 'en' : 'pt',
    v.pais ? String(v.pais).slice(0, 2).toUpperCase() : null,
    v.regiao ? String(v.regiao).slice(0, 80) : null,
    v.cidade ? String(v.cidade).slice(0, 120) : null,
    v.fuso ? String(v.fuso).slice(0, 60) : null,
    v.dispositivo || null, v.sistema || null, v.navegador || null,
    v.origem || null, v.campanha || null,
    v.cep ? String(v.cep).slice(0, 12) : null, lat, lon,
    v.operadora ? String(v.operadora).slice(0, 80) : null,
    ['empresa', 'provedor', 'datacenter'].indexOf(v.rede_tipo) !== -1 ? v.rede_tipo : null,
    agoraISO()
  ).run();
}

async function gravarEvento(db, sessao, tipo, valorBruto, numero) {
  if (!sessao || TIPOS.indexOf(tipo) === -1) return;
  const hoje = await db.prepare('SELECT count(*) n FROM eventos_visita WHERE criado_em > ?').bind(haUmDia()).first();
  if (hoje && hoje.n >= 60000) return;

  let valor = texto(valorBruto, 160);
  if (valor && ['rolagem', 'tempo', 'projeto', 'publicacao'].indexOf(tipo) !== -1 && valor.startsWith('/')) {
    valor = caminhoCanonico(valor);
  }
  const n = Number.isFinite(numero) && numero >= 0 && numero <= 100000 ? Math.round(numero) : null;
  await db.prepare('INSERT INTO eventos_visita (sessao, tipo, valor, numero, criado_em) VALUES (?, ?, ?, ?, ?)')
    .bind(sessao, tipo, valor, n, agoraISO()).run();
}

// Aviso na hora: quando alguém de REDE DE EMPRESA faz algo que mostra interesse, sai um e-mail.
// Provedor doméstico e datacenter não geram aviso. A tabela avisos tem a sessão como chave
// primária: dois eventos ao mesmo tempo disputam a mesma linha e só um ganha.
const AVISO_PARA = 'https://formsubmit.co/ajax/alexandre01.w@gmail.com';
const GATILHOS = ['curriculo', 'demo', 'contato', 'projeto'];

async function prepararAviso(db, sessao, motivo) {
  if (!sessao) return null;
  const rede = await db.prepare('SELECT max(rede_tipo) tipo FROM visitas WHERE sessao = ?').bind(sessao).first();
  if (!rede || rede.tipo !== 'empresa') return null;

  const hoje = await db.prepare('SELECT count(*) n FROM avisos WHERE criado_em > ?').bind(haUmDia()).first();
  if (hoje && hoje.n >= 10) return null;

  const r = await db.prepare('INSERT OR IGNORE INTO avisos (sessao, motivo, criado_em) VALUES (?, ?, ?)')
    .bind(sessao, texto(motivo, 24), agoraISO()).run();
  if (!r.meta || r.meta.changes === 0) return null;

  const base = await db.prepare(
    `SELECT max(operadora) rede, max(cidade) cidade, max(pais) pais, max(dispositivo) disp, max(navegador) nav,
            max(campanha) camp, max(origem) orig, min(criado_em) ini, count(*) paginas
     FROM visitas WHERE sessao = ?`).bind(sessao).first();
  const [pags, tempo, acoes] = await Promise.all([
    db.prepare('SELECT DISTINCT caminho FROM visitas WHERE sessao = ?').bind(sessao).all(),
    db.prepare("SELECT coalesce(sum(numero), 0) s FROM eventos_visita WHERE sessao = ? AND tipo = 'tempo'").bind(sessao).first(),
    db.prepare(
      `SELECT DISTINCT tipo || coalesce(': ' || valor, '') a FROM eventos_visita
       WHERE sessao = ? AND tipo IN ('curriculo', 'demo', 'contato', 'projeto', 'publicacao')`).bind(sessao).all()
  ]);
  const inicio = new Date(new Date(base.ini).getTime() - 3 * 3600 * 1000).toISOString();
  return {
    rede: base.rede,
    lugar: (base.cidade || 'desconhecida') + (base.pais ? ', ' + base.pais : ''),
    aparelho: (base.disp || '') + (base.nav ? ' e ' + base.nav : ''),
    veio_de: base.camp || base.orig || 'direto',
    inicio: inicio.slice(8, 10) + '/' + inicio.slice(5, 7) + ' ' + inicio.slice(11, 16),
    quantas_paginas: base.paginas,
    paginas: (pags.results || []).map(p => p.caminho).join(', '),
    segundos: Math.round(tempo ? tempo.s : 0),
    acoes: (acoes.results || []).map(a => a.a).join(' | ') || 'nenhuma'
  };
}

async function mandarAviso(ctx, motivo) {
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 2500);
  try {
    await fetch(AVISO_PARA, {
      method: 'POST', signal: parar.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Visita de empresa no site: ' + (ctx.rede || 'rede não identificada'),
        _template: 'table',
        _captcha: 'false',
        rede: ctx.rede || 'não identificada',
        de_onde: ctx.lugar || '',
        comecou_em: ctx.inicio || '',
        paginas_abertas: String(ctx.quantas_paginas || 0),
        caminhos: ctx.paginas || '',
        tempo_somado: Math.round((ctx.segundos || 0) / 60) + ' min',
        o_que_fez: ctx.acoes || 'nenhuma ação',
        veio_de: ctx.veio_de || '',
        aparelho: ctx.aparelho || '',
        disparado_por: motivo
      })
    });
  } catch (e) {
    // aviso que falha não pode derrubar o registro da visita
  } finally {
    clearTimeout(relogio);
  }
}

async function talvezAvisar(db, sessao, tipos, numeros) {
  for (let i = 0; i < tipos.length; i++) {
    const forte = GATILHOS.indexOf(tipos[i]) !== -1 || (tipos[i] === 'tempo' && Number(numeros[i]) >= 90);
    if (!forte) continue;
    const ctx = await prepararAviso(db, sessao, tipos[i]);
    if (ctx) await mandarAviso(ctx, tipos[i]);
    return;
  }
}

async function processarVisita(request, env, url, corpo, ip) {
  const ua = String(request.headers.get('User-Agent') || '');
  const meuHost = url.hostname.replace(/^www\./, '').toLowerCase();
  // A impressão sai daqui já embaralhada; o IP não passa do Worker.
  const impressao = await sha256Hex(ip + '|' + ua);
  const sessao = await sessaoDoDia(env.DB, impressao);
  if (!sessao) return;

  if (Array.isArray(corpo.lote)) {
    const itens = corpo.lote.slice(0, 12).filter(it => it && TIPOS.indexOf(it.evento) !== -1);
    for (const it of itens) await gravarEvento(env.DB, sessao, it.evento, it.valor, it.numero);
    await talvezAvisar(env.DB, sessao, itens.map(it => it.evento), itens.map(it => it.numero));
    return;
  }

  const evento = texto(corpo.evento, 24);
  if (evento) {
    if (TIPOS.indexOf(evento) === -1) return;
    const numero = Number.isFinite(corpo.numero) ? Math.round(corpo.numero) : null;
    await gravarEvento(env.DB, sessao, evento, corpo.valor, numero);
    await talvezAvisar(env.DB, sessao, [evento], [numero]);
    return;
  }

  const caminho = texto(corpo.caminho, 200);
  if (!caminho || caminho[0] !== '/') return;

  const rede = await redeDoIp(ip);
  const cf = request.cf || {};
  await gravarVisita(env.DB, sessao, {
    caminho: caminho,
    idioma: corpo.idioma,
    pais: cf.country,
    regiao: cf.regionCode || cf.region,
    cidade: cf.city,
    fuso: cf.timezone,
    dispositivo: aparelho(ua),
    sistema: sistema(ua),
    navegador: navegador(ua),
    origem: origemDe(texto(corpo.veio_de, 300), meuHost),
    campanha: texto(corpo.campanha, 120),
    // Localização aproximada: palpite do provedor pelo endereço de rede, costuma cair no centro
    // da cidade. Não serve para dizer o bairro de ninguém.
    cep: cf.postalCode || (rede && rede.cep) || null,
    lat: cf.latitude || (rede && rede.lat) || null,
    lon: cf.longitude || (rede && rede.lon) || null,
    operadora: (rede && rede.operadora) || null,
    rede_tipo: (rede && rede.tipo) || null
  });
}

async function rotaVisita(request, env, ctx, url) {
  // GET é o teste de saúde do painel: prova que o Worker consegue falar com o banco.
  if (request.method === 'GET') {
    let ok = false;
    try { ok = Boolean(await env.DB.prepare('SELECT 1 x').first()); } catch (e) { ok = false; }
    return json({ configurado: ok });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  // A resposta é sempre 204: o site nunca quebra nem espera por isto.
  if (deOutroSite(request, url)) return vazio();
  const ua = String(request.headers.get('User-Agent') || '');
  if (!ua || ua.length > 500 || ROBO.test(ua)) return vazio();
  // Quem pediu para não ser rastreado não é rastreado.
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return vazio();

  const corpo = await corpoJson(request);
  if (!corpo) return vazio();

  const ip = String(request.headers.get('CF-Connecting-IP') || '').trim();
  ctx.waitUntil(processarVisita(request, env, url, corpo, ip).catch(() => {}));
  return vazio();
}

// ---------------------------------------------------------------------------
// Painel admin (atrás do Cloudflare Access)
// ---------------------------------------------------------------------------

function paraMensagem(l) { return Object.assign({}, l, { lida: Boolean(l.lida) }); }

async function rotaAdmin(request, env, url) {
  const acesso = await exigirAdmin(request, env);
  if (!acesso.ok) return json({ erro: acesso.motivo }, acesso.status);

  // Quem altera dados precisa vir do próprio painel, não de outro site.
  if (request.method !== 'GET' && deOutroSite(request, url)) return json({ erro: 'origem' }, 403);

  const caminho = url.pathname.replace(/^\/api\/admin\/?/, '');
  const partes = caminho.split('/').filter(Boolean);
  const id = partes[1] && /^\d+$/.test(partes[1]) ? Number(partes[1]) : null;

  if (partes[0] === 'eu' && request.method === 'GET') return json({ email: acesso.email });

  if (partes[0] === 'mensagens') {
    if (!partes[1] && request.method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM mensagens_contato ORDER BY criado_em DESC LIMIT 200').all();
      return json((r.results || []).map(paraMensagem));
    }
    if (id && request.method === 'PATCH') {
      const c = await corpoJson(request);
      if (!c || typeof c.lida !== 'boolean') return json({ erro: 'invalido' }, 400);
      await env.DB.prepare('UPDATE mensagens_contato SET lida = ? WHERE id = ?').bind(c.lida ? 1 : 0, id).run();
      return json({ ok: true });
    }
    if (id && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM mensagens_contato WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  if (partes[0] === 'leads') {
    if (!partes[1] && request.method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM leads ORDER BY criado_em DESC LIMIT 1000').all();
      return json(r.results || []);
    }
    if (id && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  if (partes[0] === 'visitas' && request.method === 'GET') {
    const dias = url.searchParams.get('dias');
    const [resumo, extra] = await Promise.all([resumoVisitas(env.DB, dias), resumoExtra(env.DB, dias)]);
    return json({ resumo: resumo, extra: extra });
  }

  return json({ erro: 'nao-encontrado' }, 404);
}

// ---------------------------------------------------------------------------
// Site estático: idioma automático por país
// ---------------------------------------------------------------------------
// Quem acessa de fora do Brasil vai para a versão em inglês, enquanto não existir o cookie
// "lang" e se não for robô (Google, LinkedIn e WhatsApp continuam vendo o português).

const PAGINAS_COM_EN = /^\/(?:projetos\/(boletim-ruptura|validador-documentos|automacoes|sop-mensal|cacador-vencimentos)|publicacoes\/(importacao-jogo|forecast-erro|incoterms))\.html$/;
const BOT_NA_ORIGEM = /([Bb]ot|[Cc]rawl|[Ss]pider|[Ss]lurp|facebookexternalhit|WhatsApp|Lighthouse|Inspection|Preview)/;

function destinoEmIngles(p) {
  if (p === '/' || p === '/index.html') return '/en.html';
  const m = PAGINAS_COM_EN.exec(p);
  return m ? p.replace(/\.html$/, '-en.html') : null;
}

function redirecionaParaIngles(request, p) {
  const destino = destinoEmIngles(p);
  if (!destino) return null;
  const pais = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || '';
  if (!pais || pais === 'BR' || pais === 'XX' || pais === 'T1') return null;
  if (/(?:^|;\s*)lang=/.test(request.headers.get('Cookie') || '')) return null;
  if (BOT_NA_ORIGEM.test(request.headers.get('User-Agent') || '')) return null;
  return destino;
}

// Com html_handling "none", o Worker precisa mapear pastas para index.html.
function arquivoDoCaminho(p) {
  return p.endsWith('/') ? p + 'index.html' : p;
}

async function rotaSite(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  const destino = redirecionaParaIngles(request, url.pathname);
  if (destino) {
    return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store', Vary: 'Cookie' } });
  }
  if (url.pathname === '/admin') return new Response(null, { status: 301, headers: { Location: '/admin/' } });
  const alvo = new URL(request.url);
  alvo.pathname = arquivoDoCaminho(url.pathname);
  return env.ASSETS.fetch(new Request(alvo, request));
}

// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/api/contato') return await rotaContato(request, env, url);
      if (p === '/api/lead') return await rotaLead(request, env, url);
      if (p === '/api/visita') return await rotaVisita(request, env, ctx, url);
      if (p === '/api/admin' || p.startsWith('/api/admin/')) return await rotaAdmin(request, env, url);
      if (p.startsWith('/api/')) return json({ erro: 'nao-encontrado' }, 404);
      return await rotaSite(request, env, url);
    } catch (e) {
      if (p === '/api/contato') return json({ message: 'erro' }, 500);
      if (p === '/api/lead' || p === '/api/visita') return vazio();
      return json({ erro: 'interno' }, 500);
    }
  }
};
