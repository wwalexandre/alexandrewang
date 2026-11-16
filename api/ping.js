// Mantém o banco acordado. O plano gratuito do Supabase pausa o projeto depois de
// 7 dias sem uso; a Vercel chama esta função uma vez por dia (ver "crons" no vercel.json)
// e ela faz uma leitura mínima no banco. Usa só a chave publicável, a mesma do site.
const SB_URL = 'https://apezjjrpvlglaawvhqoo.supabase.co';
const SB_KEY = 'sb_publishable_eHbHUKdtoOVlIg87zQZAew_DgD-GK6J';

module.exports = async (req, res) => {
  try {
    const r = await fetch(SB_URL + '/rest/v1/itens_site?select=slug&limit=1', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.ok ? 200 : 502).json({ banco: r.ok ? 'acordado' : 'sem resposta', quando: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ banco: 'sem resposta' });
  }
};
