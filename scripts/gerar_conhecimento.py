"""Monta a base de conhecimento do assistente do site (api/_conhecimento.js).

Rode de novo sempre que mudar texto do site, README ou docs:

    python scripts/gerar_conhecimento.py

Só entra o que já é público: o texto das páginas em português, o README e o
README do repositório conferencia-caixa no GitHub. Nada do segundo cérebro entra aqui,
porque este arquivo fica no repositório público.
"""
import glob
import html
import io
import json
import os
import re
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'api', '_conhecimento.js')

# Linhas com estes termos não entram (regras do projeto: não citar a empresa e não expor e-mails).
PROIBIDO = re.compile(r'microport|[\w.+-]+@[\w-]+\.[\w.]+', re.I)


def ler(caminho):
    return io.open(os.path.join(RAIZ, caminho), encoding='utf-8').read()


def limpar(texto):
    linhas = [l for l in texto.splitlines() if not PROIBIDO.search(l)]
    texto = '\n'.join(linhas)
    texto = texto.replace(chr(0x2014), ',')
    return re.sub(r'\n{3,}', '\n\n', texto).strip()


def texto_da_pagina(caminho):
    s = ler(caminho)
    titulo = re.search(r'<title>(.*?)</title>', s, re.S)
    s = re.sub(r'<(script|style|svg|nav|footer)\b.*?</\1>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<(br|p|li|h[1-6]|div|section|tr)\b[^>]*>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n\s*\n+', '\n', s)
    nome = html.unescape(titulo.group(1)).strip() if titulo else caminho
    url = 'https://alexandrewang.vercel.app/' + ('' if caminho == 'index.html' else caminho)
    return '### Página: ' + nome + '\nEndereço: ' + url + '\n' + s.strip()


def readme_externo(repo):
    url = 'https://raw.githubusercontent.com/wwalexandre/' + repo + '/main/README.md'
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return r.read().decode('utf-8')
    except Exception as e:
        print('aviso: não deu para baixar o README de', repo, '-', e)
        return ''


def main():
    partes = []
    partes.append('## O site e a carreira (texto público das páginas em português)')
    paginas = ['index.html'] + sorted(
        p.replace('\\', '/') for p in glob.glob(os.path.join(RAIZ, 'projetos', '*.html'))
        + glob.glob(os.path.join(RAIZ, 'publicacoes', '*.html')))
    for p in paginas:
        rel = os.path.relpath(p, RAIZ).replace('\\', '/') if os.path.isabs(p) else p
        if rel.endswith('-en.html'):
            continue
        partes.append(texto_da_pagina(rel))

    partes.append('## Como o código do site funciona (README do repositório wwalexandre/alexandrewang)')
    partes.append(ler('README.md'))
    # docs/SUPABASE.md e docs/HISTORICO.md ficam de fora: detalhes internos de segurança não
    # são assunto do assistente, e cada pergunta fica menor (o plano gratuito limita tokens por minuto).

    externo = readme_externo('conferencia-caixa')
    if externo:
        partes.append('## Projeto Conferência do Caixa (repositório wwalexandre/conferencia-caixa)')
        partes.append(externo)

    texto = limpar('\n\n'.join(partes))
    with io.open(SAIDA, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Gerado por scripts/gerar_conhecimento.py. Não edite à mão.\n')
        f.write('// Só conteúdo que já é público (páginas do site, README e docs).\n')
        f.write('module.exports = ' + json.dumps(texto, ensure_ascii=False) + ';\n')
    print('ok:', len(texto), 'caracteres, cerca de', len(texto) // 4, 'tokens')


if __name__ == '__main__':
    main()
