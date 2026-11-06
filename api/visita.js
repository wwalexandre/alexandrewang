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

async function chamar(funcao, corpo) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + funcao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
    body: JSON.stringify(corpo)
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // A resposta é sempre vazia e sempre 204: o site nunca quebra nem espera por isto.
  const fim = () => res.status(204).end();

  if (req.method !== 'POST') { res.status(405).end(); return; }

  const token = process.env.VISITAS_TOKEN;
  const sal = process.env.VISITAS_SALT;
  if (!token || !sal) { fim(); return; }

  const h = req.headers || {};
  const ua = String(h['user-agent'] || '');
  if (!ua || ua.length > 500 || ROBO.test(ua)) { fim(); return; }
  // Quem pediu para não ser rastreado não é rastreado.
  if (h['dnt'] === '1' || h['sec-gpc'] === '1') { fim(); return; }

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; } }
  if (!corpo || typeof corpo !== 'object') { fim(); return; }

  const ip = String(h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0].trim();
  const dia = new Date().toISOString().slice(0, 10);
  const sessao = createHash('sha256').update(ip + '|' + ua + '|' + sal + '|' + dia).digest('hex').slice(0, 32);

  try {
    // Lote: vários eventos num envio só, para gastar menos invocação da Vercel
    if (Array.isArray(corpo.lote)) {
      const itens = corpo.lote.slice(0, 12).filter(function (it) {
        return it && TIPOS.indexOf(it.evento) !== -1;
      });
      await Promise.all(itens.map(function (it) {
        return chamar('registrar_evento_visita', {
          p_token: token, p_sessao: sessao, p_tipo: it.evento,
          p_valor: texto(it.valor, 160),
          p_numero: Number.isFinite(it.numero) ? Math.round(it.numero) : null
        });
      }));
      fim();
      return;
    }

    const evento = texto(corpo.evento, 24);
    if (evento) {
      if (TIPOS.indexOf(evento) === -1) { fim(); return; }
      const numero = Number.isFinite(corpo.numero) ? Math.round(corpo.numero) : null;
      await chamar('registrar_evento_visita', {
        p_token: token, p_sessao: sessao, p_tipo: evento,
        p_valor: texto(corpo.valor, 160), p_numero: numero
      });
      fim();
      return;
    }

    const caminho = texto(corpo.caminho, 200);
    if (!caminho || caminho[0] !== '/') { fim(); return; }

    let cidade = null;
    try { cidade = decodeURIComponent(String(h['x-vercel-ip-city'] || '')) || null; } catch (e) { cidade = null; }

    await chamar('registrar_visita', {
      p_token: token,
      p_sessao: sessao,
      p_caminho: caminho,
      p_idioma: corpo.idioma === 'en' ? 'en' : 'pt',
      p_pais: texto(String(h['x-vercel-ip-country'] || ''), 2),
      p_regiao: texto(String(h['x-vercel-ip-country-region'] || ''), 80),
      p_cidade: texto(cidade, 120),
      p_fuso: texto(String(h['x-vercel-ip-timezone'] || ''), 60),
      p_dispositivo: aparelho(ua),
      p_sistema: sistema(ua),
      p_navegador: navegador(ua),
      p_origem: origemDe(texto(corpo.veio_de, 300), String(h['host'] || '').replace(/^www\./, '').toLowerCase()),
      p_campanha: texto(corpo.campanha, 120)
    });
  } catch (e) {
    // Falha de rede ou do banco não pode virar erro para o visitante.
  }

  fim();
};
