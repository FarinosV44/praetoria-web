"""Extrae los <style> de los componentes Astro (tag astro-final) y los reescribe con ámbito
bajo una clase raíz, para portar el CSS a la capa de componentes de Tailwind sin colisiones."""
import re, subprocess, sys

SOURCES = [
    # (archivo en astro-final, clase raíz, ¿la regla raíz ya empieza por esta clase?)
    ('src/components/Header.astro', '.site-header'),
    ('src/components/Footer.astro', '.site-footer'),
    ('src/components/CookieConsent.astro', '.consent-root'),
    ('src/components/PostList.astro', '.posts-root'),
    ('src/components/DecaBand.astro', '.deca-root'),
    ('src/components/CtaBand.astro', '.cta'),
    ('src/components/AreaPage.astro', '.area-page'),
    ('src/layouts/Base.astro', '.site-root'),
    ('src/pages/index.astro', '.page-home'),
    ('src/pages/[slug].astro', '.page-post'),
    ('src/pages/abogado-hacienda-y-seguridad-social-en-valencia.astro', '.page-hacienda'),
    ('src/pages/abogado-divorcio-horta-nord-valencia.astro', '.page-divorcio'),
    ('src/pages/abogado-el-puig.astro', '.page-elpuig'),
    ('src/pages/el-despacho.astro', '.page-despacho'),
    ('src/pages/contacto.astro', '.page-contacto'),
    ('src/pages/areas/index.astro', '.page-areas'),
    ('src/components/BlogIndex.astro', '.page-blog'),
]


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def scope_selector(sel, root):
    sel = sel.strip()
    sel = re.sub(r':global\(([^)]*)\)', r'\1', sel)
    if not sel:
        return sel
    if sel.startswith(root) or sel in ('body', 'html'):
        return sel
    # La regla del componente raíz (p. ej. .posts, .deca, .consent) ya identifica el componente
    return f'{root} {sel}'


def scope_block(css, root, indent='  '):
    out, i = [], 0
    while i < len(css):
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            depth, k = 1, j + 1
            while depth:
                if css[k] == '{':
                    depth += 1
                elif css[k] == '}':
                    depth -= 1
                k += 1
            inner = css[j + 1:k - 1]
            out.append(f'{indent}{head} {{\n' + scope_block(inner, root, indent + '  ') + f'{indent}}}\n')
            i = k
            continue
        k = css.find('}', j)
        body = ' '.join(l.strip() for l in css[j + 1:k].strip().splitlines())
        sels = ', '.join(scope_selector(s, root) for s in head.split(','))
        out.append(f'{indent}{sels} {{ {body} }}\n')
        i = k + 1
    return ''.join(out)


chunks = []
for path, root in SOURCES:
    src = subprocess.run(['git', 'show', f'astro-final:{path}'], capture_output=True, text=True, check=True).stdout
    styles = re.findall(r'<style>(.*?)</style>', src, flags=re.S)
    if not styles:
        continue
    css = strip_comments('\n'.join(styles))
    chunks.append(f'\n  /* {path} -> {root} */\n' + scope_block(css, root))

sys.stdout.write('\n/* Estilos de componentes portados de Astro (ámbito por clase raíz) */\n@layer components {' + ''.join(chunks) + '}\n')
