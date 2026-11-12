// Resumo do painel de visitantes. Portado das funções resumo_visitas e resumo_extra do
// Postgres: devolve exatamente as mesmas chaves, para o painel não precisar mudar de formato.
// Horário de Brasília = UTC-3 (sem horário de verão desde 2019), por isso o modificador '-3 hours'.

const SP = "'-3 hours'";

function limiteDias(d) {
  const n = Math.round(Number(d));
  return Math.max(1, Math.min(Number.isFinite(n) ? n : 30, 365));
}

async function todas(db, sql, ...params) {
  const r = await db.prepare(sql).bind(...params).all();
  return r.results || [];
}

const lista = linhas => linhas.map(l => {
  const o = { chave: l.chave, n: l.n };
  if (l.extra !== undefined && l.extra !== null) o.extra = l.extra;
  return o;
});

export async function resumoVisitas(db, diasPedidos) {
  const dias = limiteDias(diasPedidos);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const [totais, porDia, paises, cidades, locais, origens, campanhas, paginas, publicacoes,
    projetos, dispositivos, navegadores, idiomas, secoes, imagens, acoes, engaj, tempoPag, sessoes] =
    await Promise.all([
      todas(db, `SELECT count(*) visitas, count(DISTINCT sessao) sessoes, count(DISTINCT pais) paises,
                        count(DISTINCT cidade) cidades FROM visitas WHERE criado_em > ?`, desde),
      todas(db, `SELECT strftime('%Y-%m-%d', criado_em, ${SP}) chave, count(*) n, count(DISTINCT sessao) s
                 FROM visitas WHERE criado_em > ? GROUP BY 1 ORDER BY 1`, desde),
      todas(db, `SELECT coalesce(pais, '??') chave, count(*) n FROM visitas WHERE criado_em > ?
                 GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
      todas(db, `SELECT coalesce(cidade, 'desconhecida') || coalesce(', ' || pais, '') chave, count(*) n
                 FROM visitas WHERE criado_em > ? GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
      todas(db, `SELECT coalesce(cidade, 'cidade desconhecida') || ' · ' || coalesce(cep, 'sem CEP') chave,
                        count(*) n FROM visitas WHERE criado_em > ? AND (cep IS NOT NULL OR cidade IS NOT NULL)
                 GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
      todas(db, `SELECT coalesce(origem, 'direto') chave, count(*) n FROM visitas WHERE criado_em > ?
                 GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
      todas(db, `SELECT campanha chave, count(*) n, count(DISTINCT sessao) extra FROM visitas
                 WHERE criado_em > ? AND campanha IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 25`, desde),
      todas(db, `SELECT caminho chave, count(*) n FROM visitas WHERE criado_em > ?
                 GROUP BY 1 ORDER BY n DESC LIMIT 25`, desde),
      todas(db, `SELECT caminho chave, count(*) n FROM visitas WHERE criado_em > ? AND caminho LIKE '/publicacoes/%'
                 GROUP BY 1 ORDER BY n DESC LIMIT 15`, desde),
      todas(db, `SELECT caminho chave, count(*) n FROM visitas WHERE criado_em > ? AND caminho LIKE '/projetos/%'
                 GROUP BY 1 ORDER BY n DESC LIMIT 15`, desde),
      todas(db, `SELECT coalesce(dispositivo, 'desconhecido') chave, count(*) n FROM visitas WHERE criado_em > ?
                 GROUP BY 1 ORDER BY n DESC`, desde),
      todas(db, `SELECT coalesce(navegador, 'desconhecido') || ' / ' || coalesce(sistema, 'desconhecido') chave,
                        count(*) n FROM visitas WHERE criado_em > ? GROUP BY 1 ORDER BY n DESC LIMIT 12`, desde),
      todas(db, `SELECT coalesce(idioma, 'pt') chave, count(*) n FROM visitas WHERE criado_em > ?
                 GROUP BY 1 ORDER BY n DESC`, desde),
      todas(db, `SELECT valor chave, CAST(round(sum(numero)) AS INTEGER) n, count(*) extra FROM eventos_visita
                 WHERE criado_em > ? AND tipo = 'secao' AND valor IS NOT NULL AND numero IS NOT NULL
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, desde),
      todas(db, `SELECT valor chave, count(*) n FROM eventos_visita
                 WHERE criado_em > ? AND tipo = 'imagem' AND valor IS NOT NULL
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, desde),
      todas(db, `SELECT tipo || coalesce(': ' || valor, '') chave, count(*) n FROM eventos_visita
                 WHERE criado_em > ? AND tipo IN ('projeto', 'curriculo', 'demo', 'contato', 'publicacao', 'video', 'link')
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 25`, desde),
      todas(db, `SELECT
                   CAST(round(coalesce(avg(CASE WHEN tipo = 'tempo' THEN numero END), 0)) AS INTEGER) tempo_medio,
                   coalesce(max(CASE WHEN tipo = 'tempo' THEN numero END), 0) tempo_maximo,
                   CAST(round(coalesce(avg(CASE WHEN tipo = 'rolagem' THEN numero END), 0)) AS INTEGER) rolagem_media,
                   coalesce(sum(CASE WHEN tipo = 'rolagem' AND numero >= 90 THEN 1 ELSE 0 END), 0) leram_ate_o_fim
                 FROM eventos_visita WHERE criado_em > ?`, desde),
      todas(db, `SELECT coalesce(valor, 'desconhecida') chave, CAST(round(avg(numero)) AS INTEGER) n
                 FROM eventos_visita WHERE criado_em > ? AND tipo = 'tempo' AND valor IS NOT NULL
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, desde),
      todas(db, `SELECT sessao, min(criado_em) ini, count(*) paginas, max(cidade) cidade, max(pais) pais,
                        max(cep) cep, max(dispositivo) dispositivo, max(campanha) campanha, max(origem) origem
                 FROM visitas WHERE criado_em > ? GROUP BY sessao ORDER BY ini DESC LIMIT 30`, desde)
    ]);

  // Rota de cada jornada, na ordem em que as páginas foram abertas
  let jornadas = [];
  if (sessoes.length) {
    const marcas = sessoes.map(() => '?').join(',');
    const passos = await todas(db,
      `SELECT sessao, caminho FROM visitas WHERE criado_em > ? AND sessao IN (${marcas}) ORDER BY criado_em, id`,
      desde, ...sessoes.map(s => s.sessao));
    const rotas = {};
    passos.forEach(p => { (rotas[p.sessao] = rotas[p.sessao] || []).push(p.caminho); });
    jornadas = await Promise.all(sessoes.map(async s => {
      const [f] = await todas(db,
        `SELECT strftime('%Y%m%d%H%M%S', ?1) ordem, strftime('%d/%m %H:%M', ?1, ${SP}) inicio`, s.ini);
      return {
        ordem: f.ordem,
        inicio: f.inicio,
        paginas: s.paginas,
        lugar: (s.cidade || 'desconhecida') + (s.pais ? ', ' + s.pais : '') + (s.cep ? ' · ' + s.cep : ''),
        dispositivo: s.dispositivo || '',
        origem: s.campanha || s.origem || 'direto',
        rota: (rotas[s.sessao] || []).join(' > ')
      };
    }));
    jornadas.sort((a, b) => (a.ordem < b.ordem ? 1 : -1));
  }

  const t = totais[0] || {};
  const e = engaj[0] || {};
  return {
    dias: dias,
    totais: { visitas: t.visitas || 0, sessoes: t.sessoes || 0, paises: t.paises || 0, cidades: t.cidades || 0 },
    por_dia: porDia.map(l => ({ chave: l.chave, n: l.n, s: l.s })),
    paises: lista(paises),
    cidades: lista(cidades),
    locais: lista(locais),
    origens: lista(origens),
    campanhas: lista(campanhas),
    paginas: lista(paginas),
    publicacoes: lista(publicacoes),
    projetos: lista(projetos),
    dispositivos: lista(dispositivos),
    navegadores: lista(navegadores),
    idiomas: lista(idiomas),
    secoes: lista(secoes),
    imagens: lista(imagens),
    acoes: lista(acoes),
    engajamento: {
      tempo_medio: e.tempo_medio || 0,
      tempo_maximo: e.tempo_maximo || 0,
      rolagem_media: e.rolagem_media || 0,
      leram_ate_o_fim: e.leram_ate_o_fim || 0
    },
    tempo_por_pagina: lista(tempoPag),
    jornadas: jornadas
  };
}

export async function resumoExtra(db, diasPedidos) {
  const dias = limiteDias(diasPedidos);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const [estados, redes, tipos, acessos] = await Promise.all([
    todas(db, `SELECT coalesce(regiao, 'sem regiao') || coalesce(' (' || pais || ')', '') chave, count(*) n
               FROM visitas WHERE criado_em > ? GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
    todas(db, `SELECT operadora chave, count(*) n, max(rede_tipo) extra FROM visitas
               WHERE criado_em > ? AND operadora IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 20`, desde),
    todas(db, `SELECT coalesce(rede_tipo, 'desconhecido') chave, count(*) n FROM visitas WHERE criado_em > ?
               GROUP BY 1 ORDER BY n DESC`, desde),
    todas(db, `SELECT substr(sessao, 1, 6) codigo, count(*) n,
                      coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), '') lugar,
                      coalesce(max(operadora), '') rede,
                      coalesce(max(rede_tipo) = 'datacenter', 0) robo,
                      coalesce(max(dispositivo), '') || coalesce(' · ' || max(navegador), '') aparelho,
                      strftime('%d/%m', min(criado_em), ${SP}) dia,
                      strftime('%H:%M', min(criado_em), ${SP}) || ' às ' || strftime('%H:%M', max(criado_em), ${SP}) janela,
                      max(1, CAST(round((julianday(max(criado_em)) - julianday(min(criado_em))) * 1440) AS INTEGER)) minutos
               FROM visitas WHERE criado_em > ? GROUP BY sessao HAVING count(*) >= 5
               ORDER BY n DESC LIMIT 15`, desde)
  ]);

  return {
    estados: lista(estados),
    redes: lista(redes),
    tipos_rede: lista(tipos),
    mais_acessos: acessos.map(a => ({
      codigo: a.codigo, n: a.n, lugar: a.lugar, rede: a.rede, robo: Boolean(a.robo),
      aparelho: a.aparelho, dia: a.dia, janela: a.janela, minutos: a.minutos
    }))
  };
}
