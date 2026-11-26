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
import subprocess
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


def data_da_pagina(caminho):
    """Data de publicação: datePublished da página, se houver; senão, o dia em que ela entrou no git."""
    m = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', ler(caminho))
    if m:
        return m.group(1)
    try:
        saida = subprocess.run(['git', 'log', '--diff-filter=A', '--follow', '--format=%as', '--', caminho],
                               cwd=RAIZ, capture_output=True, text=True, timeout=30).stdout.split()
        return saida[-1] if saida else ''
    except Exception:
        return ''


def data_repo(repo):
    try:
        with urllib.request.urlopen('https://api.github.com/repos/wwalexandre/' + repo, timeout=15) as r:
            return json.loads(r.read().decode('utf-8')).get('created_at', '')[:10]
    except Exception:
        return ''


def dia(iso):
    return iso[8:10] + '/' + iso[5:7] + '/' + iso[0:4] if len(iso) == 10 else 'sem data'


def main():
    partes = []
    paginas = sorted(
        p.replace('\\', '/') for p in glob.glob(os.path.join(RAIZ, 'projetos', '*.html'))
        + glob.glob(os.path.join(RAIZ, 'publicacoes', '*.html')))
    paginas = [os.path.relpath(p, RAIZ).replace('\\', '/') for p in paginas]
    paginas = [p for p in paginas if not p.endswith('-en.html')]

    # Índice com datas, para o assistente saber o que é mais recente.
    itens = []
    for p in paginas:
        t = re.search(r'<title>(.*?)</title>', ler(p), re.S)
        nome = html.unescape(t.group(1)).split(' | ')[0].strip() if t else p
        tipo = 'Projeto' if p.startswith('projetos/') else 'Publicação'
        itens.append((data_da_pagina(p), tipo, nome, 'https://alexandrewang.vercel.app/' + p))
    criado = data_repo('conferencia-caixa')
    itens.append((criado, 'Projeto', 'Conferência do Caixa (ferramenta no GitHub)',
                  'https://wwalexandre.github.io/conferencia-caixa/'))
    itens.sort(key=lambda i: i[0], reverse=True)
    partes.append('## Índice de projetos e publicações do Alexandre, do mais recente para o mais antigo\n'
                  'Data = dia em que entrou no site ou no GitHub.\n'
                  + '\n'.join('- ' + dia(d) + ' | ' + tipo + ' | ' + nome + ' | ' + url for d, tipo, nome, url in itens))

    partes.append('## O site e a carreira (texto público das páginas em português)')
    for rel in ['index.html'] + paginas:
        partes.append(texto_da_pagina(rel))

    # O README do site fica de fora: como o site foi construído é assunto reservado do Alexandre.
    # docs/SUPABASE.md e docs/HISTORICO.md também ficam de fora pelo mesmo motivo.

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
