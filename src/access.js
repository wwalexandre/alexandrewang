// Confere o login do Cloudflare Access.
//
// O Access fica na frente de /admin/* e /api/admin/* e, depois de autenticar a pessoa, manda
// o cabeçalho Cf-Access-Jwt-Assertion. Este módulo confere a assinatura, o público (AUD),
// o emissor e a validade desse token. Assim, mesmo que o Access seja desligado ou mal
// configurado por engano, o Worker continua recusando quem não está autenticado.

const certsEmMemoria = new Map(); // team -> { chaves, ate }

function b64urlParaBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlParaJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlParaBytes(s)));
}

async function buscarCerts(team, buscar, forcar) {
  const agora = Date.now();
  const guardado = certsEmMemoria.get(team);
  if (!forcar && guardado && guardado.ate > agora) return guardado.chaves;
  const r = await buscar('https://' + team + '/cdn-cgi/access/certs');
  if (!r.ok) throw new Error('certs');
  const j = await r.json();
  const chaves = (j && j.keys) || [];
  certsEmMemoria.set(team, { chaves: chaves, ate: agora + 60 * 60 * 1000 });
  return chaves;
}

// Devolve { ok: true, email } ou { ok: false, status, motivo }.
export async function verificarJwt(token, opcoes) {
  const team = String(opcoes.team || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = String(opcoes.aud || '');
  const buscar = opcoes.buscar || fetch;
  const agora = Math.floor((opcoes.agora || Date.now()) / 1000);
  if (!team || !aud) return { ok: false, status: 503, motivo: 'acesso-nao-configurado' };
  if (!token) return { ok: false, status: 401, motivo: 'sem-token' };

  const partes = String(token).split('.');
  if (partes.length !== 3) return { ok: false, status: 401, motivo: 'token-invalido' };

  let cab, dados;
  try {
    cab = b64urlParaJson(partes[0]);
    dados = b64urlParaJson(partes[1]);
  } catch (e) {
    return { ok: false, status: 401, motivo: 'token-invalido' };
  }
  if (cab.alg !== 'RS256' || !cab.kid) return { ok: false, status: 401, motivo: 'token-invalido' };

  let chave;
  try {
    let chaves = await buscarCerts(team, buscar, false);
    chave = chaves.find(k => k.kid === cab.kid);
    // chave nova que ainda não estava no cache: busca de novo uma vez
    if (!chave) {
      chaves = await buscarCerts(team, buscar, true);
      chave = chaves.find(k => k.kid === cab.kid);
    }
  } catch (e) {
    return { ok: false, status: 503, motivo: 'certs-indisponiveis' };
  }
  if (!chave) return { ok: false, status: 401, motivo: 'chave-desconhecida' };

  try {
    const cripto = await crypto.subtle.importKey(
      'jwk', chave, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const assinatura = b64urlParaBytes(partes[2]);
    const assinado = new TextEncoder().encode(partes[0] + '.' + partes[1]);
    const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cripto, assinatura, assinado);
    if (!valido) return { ok: false, status: 401, motivo: 'assinatura' };
  } catch (e) {
    return { ok: false, status: 401, motivo: 'assinatura' };
  }

  const audiencia = Array.isArray(dados.aud) ? dados.aud : [dados.aud];
  if (audiencia.indexOf(aud) === -1) return { ok: false, status: 403, motivo: 'aud' };
  if (dados.iss !== 'https://' + team) return { ok: false, status: 403, motivo: 'iss' };
  if (typeof dados.exp !== 'number' || dados.exp <= agora) return { ok: false, status: 401, motivo: 'expirado' };
  if (typeof dados.nbf === 'number' && dados.nbf > agora + 60) return { ok: false, status: 401, motivo: 'nbf' };

  const email = String(dados.email || '').toLowerCase();
  if (!email) return { ok: false, status: 403, motivo: 'sem-email' };
  return { ok: true, email: email };
}

// Usado pelo Worker. Em desenvolvimento local (localhost), DEV_ADMIN_EMAIL no arquivo
// .dev.vars libera o painel sem Access. Em qualquer outro endereço essa variável é ignorada.
export async function exigirAdmin(request, env) {
  const host = new URL(request.url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (local && env.DEV_ADMIN_EMAIL) return { ok: true, email: String(env.DEV_ADMIN_EMAIL).toLowerCase() };

  const r = await verificarJwt(request.headers.get('Cf-Access-Jwt-Assertion'), {
    team: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD
  });
  if (!r.ok) return r;

  // Opcional: lista extra de e-mails (separados por vírgula), além da política do Access.
  const lista = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (lista.length && lista.indexOf(r.email) === -1) return { ok: false, status: 403, motivo: 'email' };
  return r;
}
