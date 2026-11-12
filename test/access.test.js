import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verificarJwt } from '../src/access.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function token(payload, header = { alg: 'RS256', kid: 'k1' }, key = privateKey) {
  const corpo = b64(header) + '.' + b64(payload);
  const sig = createSign('RSA-SHA256').update(corpo).sign(key).toString('base64url');
  return corpo + '.' + sig;
}
const TEAM = 'time.cloudflareaccess.com', AUD = 'aud123', agora = 1_800_000_000;
const buscar = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
const base = { iss: 'https://' + TEAM, aud: [AUD], email: 'eu@exemplo.com', exp: agora + 600, nbf: agora - 10 };
const run = t => verificarJwt(t, { team: TEAM, aud: AUD, buscar, agora: agora * 1000 });

test('aceita token válido', async () => { const r = await run(token(base)); assert.equal(r.ok, true); assert.equal(r.email, 'eu@exemplo.com'); });
test('recusa expirado', async () => assert.equal((await run(token({ ...base, exp: agora - 1 }))).ok, false));
test('recusa aud errado', async () => assert.equal((await run(token({ ...base, aud: ['x'] }))).ok, false));
test('recusa iss errado', async () => assert.equal((await run(token({ ...base, iss: 'https://outro' }))).ok, false));
test('recusa assinatura de outra chave', async () => {
  const outra = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal((await run(token(base, undefined, outra))).ok, false);
});
test('recusa alg none', async () => assert.equal((await run(b64({ alg: 'none', kid: 'k1' }) + '.' + b64(base) + '.')).ok, false));
test('recusa lixo', async () => assert.equal((await run('abc')).ok, false));
test('sem configuração responde 503', async () => {
  const r = await verificarJwt(token(base), { team: '', aud: '', buscar, agora: agora * 1000 });
  assert.equal(r.status, 503);
});
