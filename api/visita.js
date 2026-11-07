// Função da Vercel que registra as visitas do site.
//
// Por que existe (e por que não dá para fazer isso só com GitHub Pages):
// - a Vercel entrega país, região, cidade e fuso nos cabeçalhos da requisição, sem pedir nada ao visitante;
// - este código roda no servidor, então guarda o segredo que libera a gravação no banco;
// - o navegador não consegue mentir sobre de onde veio nem forjar visita, porque nada disso vem dele.
//
// Privacidade: o IP é usado só para montar um hash junto com um sal secreto e a data do dia.
// O IP não é gravado em lugar nenhum, e o hash muda à meia-noite, então não dá para seguir
// a mesma pessoa de um dia para o outro nem descobrir quem ela é.

const { createHash } = require('crypto');

const SB_URL = 'https://apezjjrpvlglaawvhqoo.supabase.co';
const SB_KEY = 'sb_publishable_eHbHUKdtoOVlIg87zQZAew_DgD-GK6J';

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
    if (!host || host === meuHost || host.endsWith('.vercel.app')) return null;
    if (host.includes('lnkd.in') || host.includes('linkedin')) return 'linkedin.com';
    return host.slice(0, 120);
  } catch (e) {
    return null;
  }
}

function texto(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

// Dono da rede do visitante. A Vercel não entrega esse dado, então vem de uma consulta ao
// serviço ipwho.is. O endereço de rede é enviado na consulta e descartado: não é gravado
// aqui nem no banco, e o envio é de servidor para servidor, nunca do navegador.
// Isso está declarado nas páginas privacidade.html e privacy.html, e foi autorizado pelo
// Alexandre em 06/11/2026. Se a consulta falhar ou demorar, a visita é gravada do mesmo
// jeito, só sem o nome da rede.
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
    // Classifica olhando os dois campos: a Amazon, por exemplo, aparece como
    // "A100 ROW SERVICOS DE DADOS BRASIL" na organização e só como "Amazon" no provedor.
    const paraClassificar = (String(c.org || '') + ' ' + String(c.isp || '') + ' ' + String(c.domain || '')).trim();
    return {
      operadora: nome.slice(0, 80),
      tipo: DATACENTER.test(paraClassificar) ? 'datacenter'
        : (PROVEDOR.test(paraClassificar) ? 'provedor' : 'empresa'),
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

async function chamar(funcao, corpo) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + funcao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
    body: JSON.stringify(corpo)
  });
  return r.ok;
}

// Aviso na hora. Dispara só quando a visita vem de REDE DE EMPRESA e a pessoa faz algo que
// mostra interesse de verdade. Provedor doméstico e datacenter não geram aviso, senão viraria
// ruído. Quem decide e evita e-mail repetido é a função preparar_aviso no banco: ela reserva
// a vaga da sessão, então dois eventos ao mesmo tempo mandam um e-mail só.
const AVISO_PARA = 'https://formsubmit.co/ajax/alexandre01.w@gmail.com';
const GATILHOS = ['curriculo', 'demo', 'contato', 'projeto'];

async function pedirContexto(token, impressao, motivo) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/preparar_aviso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
      body: JSON.stringify({ p_token: token, p_impressao: impressao, p_motivo: motivo })
    });
    if (!r.ok) return null;
    const ctx = await r.json();
    return ctx && typeof ctx === 'object' ? ctx : null;
  } catch (e) {
    return null;
  }
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

// Avisa, no máximo uma vez por chamada, se algum dos eventos recebidos for sinal de interesse
async function talvezAvisar(token, impressao, tipos, numeros) {
  for (let i = 0; i < tipos.length; i++) {
    const t = tipos[i];
    const forte = GATILHOS.indexOf(t) !== -1 || (t === 'tempo' && Number(numeros[i]) >= 90);
    if (!forte) continue;
    const ctx = await pedirContexto(token, impressao, t);
    if (ctx) await mandarAviso(ctx, t);
    return;
  }
}

// Cópia do site detectada. O código copiado continua chamando esta função, e o navegador
// manda o cabeçalho Origin com o domínio de quem copiou. Registra, e avisa por e-mail só
// na primeira vez que aquele domínio aparece.
async function registrarCopia(token, dominio, caminho) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/registrar_clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
      body: JSON.stringify({ p_token: token, p_dominio: dominio, p_caminho: caminho })
    });
    if (!r.ok) return;
    if ((await r.json()) !== true) return;
  } catch (e) {
    return;
  }
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 2500);
  try {
    await fetch(AVISO_PARA, {
      method: 'POST', signal: parar.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Copia do seu site detectada: ' + dominio,
        _template: 'table',
        _captcha: 'false',
        dominio_que_copiou: dominio,
        pagina: caminho || 'não informada',
        o_que_fazer: 'Abra o domínio para confirmar. Se for cópia mesmo, o painel tem a data da primeira vez e quantas vezes aconteceu.'
      })
    });
  } catch (e) {
    // aviso que falha não pode derrubar nada
  } finally {
    clearTimeout(relogio);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // A resposta é sempre vazia e sempre 204: o site nunca quebra nem espera por isto.
  const fim = () => res.status(204).end();

  // O token é opcional: o banco só o exige se a coluna `token` de ingestao_config estiver
  // preenchida. Assim o registro funciona sem nenhuma variável de ambiente, e dá para
  // fechar depois preenchendo o token no banco e criando VISITAS_TOKEN aqui.
  const token = process.env.VISITAS_TOKEN || null;

  // GET é o teste de saúde do painel. Chama a própria função de gravação com a impressão
  // vazia, que o banco descarta sem inserir nada: prova que a rede, a função e o token
  // estão de pé, sem criar linha nem devolver segredo.
  if (req.method === 'GET') {
    let ok = false;
    try {
      // Todos os argumentos precisam ir, senão o PostgREST não acha a função.
      // A impressão vazia faz o banco sair sem inserir nada.
      ok = await chamar('registrar_visita', {
        p_token: token, p_impressao: '', p_caminho: '/', p_idioma: 'pt',
        p_pais: null, p_regiao: null, p_cidade: null, p_fuso: null,
        p_dispositivo: null, p_sistema: null, p_navegador: null,
        p_origem: null, p_campanha: null
      });
    } catch (e) {
      ok = false;
    }
    // `token` diz apenas SE a variável existe aqui, nunca o valor. Serve para conferir a
    // ordem certa ao ligar a validação: primeiro a Vercel, depois o banco.
    res.status(200).json({ configurado: ok, token: Boolean(token) });
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const h = req.headers || {};

  const meuHost = String(h['host'] || '').replace(/^www\./, '').toLowerCase();

  let corpo = req.body;
  // O aviso de cópia chega como text/plain, para o navegador não exigir preflight de CORS.
  if (Buffer.isBuffer(corpo)) { corpo = corpo.toString('utf8'); }
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; } }
  if (!corpo || typeof corpo !== 'object') { fim(); return; }

  // Chamada vinda de outro domínio não entra como visita. Antes era descartada em silêncio;
  // agora ela é o sinal de que alguém copiou o site, porque o código copiado continua
  // apontando para cá. Registra a cópia e para por aqui.
  const deOutroSite = String(h['origin'] || '');
  if (deOutroSite) {
    let hostDaOrigem = '';
    try { hostDaOrigem = new URL(deOutroSite).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) {}
    if (hostDaOrigem && hostDaOrigem !== meuHost) {
      await registrarCopia(process.env.VISITAS_TOKEN || null, hostDaOrigem, texto(corpo.caminho, 200));
      fim();
      return;
    }
  }

  const ua = String(h['user-agent'] || '');
  if (!ua || ua.length > 500 || ROBO.test(ua)) { fim(); return; }
  // Quem pediu para não ser rastreado não é rastreado.
  if (h['dnt'] === '1' || h['sec-gpc'] === '1') { fim(); return; }

  // Impressão do visitante: só IP e navegador, embaralhados aqui mesmo. O IP não sai deste
  // ponto, nem vai para o banco. Quem junta o sal secreto e a data do dia, e transforma isso
  // no identificador de sessão que muda à meia-noite, é a função sessao_do_dia no Postgres.
  const ip = String(h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0].trim();
  const impressao = createHash('sha256').update(ip + '|' + ua).digest('hex');

  try {
    // Lote: vários eventos num envio só, para gastar menos invocação da Vercel
    if (Array.isArray(corpo.lote)) {
      const itens = corpo.lote.slice(0, 12).filter(function (it) {
        return it && TIPOS.indexOf(it.evento) !== -1;
      });
      await Promise.all(itens.map(function (it) {
        return chamar('registrar_evento_visita', {
          p_token: token, p_impressao: impressao, p_tipo: it.evento,
          p_valor: texto(it.valor, 160),
          p_numero: Number.isFinite(it.numero) ? Math.round(it.numero) : null
        });
      }));
      await talvezAvisar(token, impressao,
        itens.map(it => it.evento), itens.map(it => it.numero));
      fim();
      return;
    }

    const evento = texto(corpo.evento, 24);
    if (evento) {
      if (TIPOS.indexOf(evento) === -1) { fim(); return; }
      const numero = Number.isFinite(corpo.numero) ? Math.round(corpo.numero) : null;
      await chamar('registrar_evento_visita', {
        p_token: token, p_impressao: impressao, p_tipo: evento,
        p_valor: texto(corpo.valor, 160), p_numero: numero
      });
      await talvezAvisar(token, impressao, [evento], [numero]);
      fim();
      return;
    }

    const caminho = texto(corpo.caminho, 200);
    if (!caminho || caminho[0] !== '/') { fim(); return; }

    const rede = await redeDoIp(ip);

    let cidade = null;
    try { cidade = decodeURIComponent(String(h['x-vercel-ip-city'] || '')) || null; } catch (e) { cidade = null; }

    await chamar('registrar_visita', {
      p_token: token,
      p_impressao: impressao,
      p_caminho: caminho,
      p_idioma: corpo.idioma === 'en' ? 'en' : 'pt',
      p_pais: texto(String(h['x-vercel-ip-country'] || ''), 2),
      p_regiao: texto(String(h['x-vercel-ip-country-region'] || ''), 80),
      p_cidade: texto(cidade, 120),
      p_fuso: texto(String(h['x-vercel-ip-timezone'] || ''), 60),
      p_dispositivo: aparelho(ua),
      p_sistema: sistema(ua),
      p_navegador: navegador(ua),
      p_origem: origemDe(texto(corpo.veio_de, 300), meuHost),
      p_campanha: texto(corpo.campanha, 120),
      // Localização aproximada: é o palpite do provedor pelo endereço de rede, costuma cair
      // no centro da cidade ou na operadora. Não serve para dizer o bairro de ninguém.
      p_cep: texto(String(h['x-vercel-ip-postal-code'] || ''), 12) || (rede && texto(rede.cep, 12)) || null,
      p_latitude: texto(String(h['x-vercel-ip-latitude'] || ''), 16) || (rede && texto(rede.lat, 16)) || null,
      p_longitude: texto(String(h['x-vercel-ip-longitude'] || ''), 16) || (rede && texto(rede.lon, 16)) || null,
      p_operadora: (rede && rede.operadora) || null,
      p_rede_tipo: (rede && rede.tipo) || null
    });
  } catch (e) {
    // Falha de rede ou do banco não pode virar erro para o visitante.
  }

  fim();
};
