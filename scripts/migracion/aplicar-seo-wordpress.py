"""Recupera en los artículos el título y la descripción SEO que tenían en WordPress (ThinkRank SEO).

Fuente: docs/seo/fuentes/wordpress-rastreo-2026-10-23.json. Se ejecutó una vez el 23/10/2026 (#2).
- Se quita el sufijo de marca antiguo (| Praetoria Abogados, | PRAETORIA, - Praetoria División Jurídica…);
  la plantilla añade «| Praetoria División Jurídica».
- Si WordPress usaba la descripción genérica del sitio, se conserva la redactada en la migración.
"""
import json, re, glob

GENERIC = 'Praetoria Abogados: asesoramiento legal en transporte'
FIX_DESC = {  # descripciones que WordPress guardaba cortadas a media palabra
    '/quien-debe-hacer-el-deca-el-cargador-o-el-transportista-que-ocurre-en-una-inspeccion-y-que-pasa-si-cada-parte-utiliza-una-plataforma-diferente/':
        '¿Quién debe generar el DeCA, el cargador o el transportista? Responsabilidades, inspecciones, conservación durante un año y qué ocurre si cada parte usa una plataforma.',
    '/deca-para-empresas-cargadoras-obligaciones-del-departamento-de-logistica-y-como-cumplir-en-2026/':
        '¿Tu empresa contrata transportes? Cuándo actúa como cargador contractual, quién debe generar el DECA y cómo organizar su cumplimiento desde octubre de 2026.',
    '/consulta-los-precios-del-software-deca-elige-el-plan-que-mejor-se-adapta-al-volumen-de-documentos-y-usuarios-de-tu-empresa/':
        'Consulta los precios del software DeCA Profesional y elige el plan que mejor se adapta al volumen de documentos y usuarios de tu empresa.',
}
BRAND = re.compile(r'\s*(\||-|–)\s*(PRAETORIA( ABOGADOS)?|Praetoria( Abogados| División Jurídica)?)\s*$', re.I)

def clean_title(t):
    return BRAND.sub('', t).strip()

rows = {r['ruta']: r for r in json.load(open('docs/seo/fuentes/wordpress-rastreo-2026-10-23.json'))['filas']}
changed = 0
for f in glob.glob('src/content/blog/*.md'):
    slug = f.split('/')[-1][:-3]
    r = rows.get(f'/{slug}/')
    if not r:
        continue
    s = open(f).read()
    fm, body = s.split('---', 2)[1], s.split('---', 2)[2]
    title = re.search(r'^title: (.*)$', fm, re.M).group(1)
    seo = clean_title(r['title'])
    desc = FIX_DESC.get(r['ruta'], r['meta_description'].strip())
    if json.dumps(seo, ensure_ascii=False) != title and seo:
        fm = re.sub(r'^seoTitle: .*\n', '', fm, flags=re.M)
        fm = fm.replace(f'title: {title}\n', f'title: {title}\nseoTitle: {json.dumps(seo, ensure_ascii=False)}\n')
    if desc and not desc.startswith(GENERIC):
        fm = re.sub(r'^description: .*$', 'description: ' + json.dumps(desc, ensure_ascii=False), fm, count=1, flags=re.M)
    new = '---' + fm + '---' + body
    if new != s:
        open(f, 'w').write(new)
        changed += 1
print('artículos actualizados:', changed)
