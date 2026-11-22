// Porteiro do site (Vercel Routing Middleware). Roda antes de cada página.
//
// 1) Regra "só estado de São Paulo": quem vem de fora do estado de SP, Brasil, vê uma página
//    curta de acesso indisponível. A regra liga e desliga no painel (ingestao_config.so_sp),
//    sem precisar publicar o site de novo.
// 2) Bloqueio: redes marcadas como suspeitas no painel não entram, de onde quer que venham.
//
// O que fica sempre liberado: o painel (/admin, para o Alexandre poder desligar a regra se
// estiver viajando), os arquivos de /assets, as funções de /api e os robôs de busca e de
// prévia de link (Google, Bing, LinkedIn, WhatsApp...), senão o site some do Google e o link
// compartilhado fica sem prévia. Robô se identifica pelo navegador, que dá para falsificar;
// é uma troca consciente.
//
// Se o banco demorar ou falhar, a página abre normalmente: melhor deixar passar do que
// derrubar o site. O IP vai só para o banco calcular o código da rede e não é gravado.

const SB_URL = 'https://apezjjrpvlglaawvhqoo.supabase.co';
const SB_KEY = 'sb_publishable_eHbHUKdtoOVlIg87zQZAew_DgD-GK6J';

const ROBO_LIBERADO = /googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|bingbot|bingpreview|duckduckbot|applebot|yandex|linkedinbot|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|pinterestbot|embedly/i;

export const config = {
  matcher: ['/((?!assets/|api/|admin|robots\\.txt|sitemap\\.xml|favicon|og-).*)']
};

// Resposta do banco guardada por alguns minutos para cada endereço, para não consultar a
// cada clique. Fica só na memória desta instância e some quando ela reinicia.
const memoria = new Map();
const VALIDADE_MS = 5 * 60 * 1000;

async function consultar(ip) {
  const agora = Date.now();
  const guardado = memoria.get(ip);
  if (guardado && agora - guardado.em < VALIDADE_MS) return guardado.r;

  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 800);
  try {
    const resp = await fetch(SB_URL + '/rest/v1/rpc/checar_acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
      body: JSON.stringify({ p_ip: ip }),
      signal: parar.signal
    });
    if (!resp.ok) return null;
    const r = await resp.json();
    if (memoria.size > 5000) memoria.clear();
    memoria.set(ip, { em: agora, r: r });
    return r;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

function pagina(motivo) {
  const fora = motivo === 'fora';
  const pt = fora
    ? 'Por enquanto, este site está disponível apenas para acessos do estado de São Paulo.'
    : 'O acesso a este site não está disponível para a sua conexão.';
  const en = fora
    ? 'For now, this website is only available from the state of São Paulo, Brazil.'
    : 'Access to this website is not available for your connection.';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="robots" content="noindex">'
    + '<title>Acesso indisponível | Access unavailable</title>'
    + '<style>'
    + 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F7F5;color:#1D2A26;'
    + 'font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;box-sizing:border-box}'
    + 'main{max-width:30rem}h1{font-size:1.35rem;margin:0 0 .75rem}p{margin:0 0 1rem}'
    + '.en{color:#56635F;border-top:1px solid #D9DEDB;padding-top:1rem}'
    + '@media (prefers-color-scheme:dark){body{background:#121816;color:#E6ECE9}.en{color:#A3B0AB;border-color:#2B3532}}'
    + '</style></head><body><main>'
    + '<h1>Acesso indisponível</h1><p>' + pt + '</p>'
    + '<p class="en" lang="en"><strong>Access unavailable.</strong> ' + en + '</p>'
    + '</main></body></html>';
  return new Response(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    }
  });
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (ROBO_LIBERADO.test(ua)) return;

  const ip = String(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '')
    .split(',')[0].trim();
  if (!ip) return;

  const r = await consultar(ip);
  if (!r) return;

  if (r.bloqueado === true) return pagina('bloqueado');

  if (r.so_sp !== false) {
    const pais = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    const estado = (request.headers.get('x-vercel-ip-country-region') || '').toUpperCase();
    // Sem cabeçalho de país (ambiente local ou de teste), não dá para saber: deixa passar.
    if (!pais) return;
    if (pais !== 'BR' || estado !== 'SP') return pagina('fora');
  }
}
