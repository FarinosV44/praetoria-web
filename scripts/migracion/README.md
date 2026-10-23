# Scripts de migración desde WordPress

Se usaron una sola vez para convertir el export de WordPress (`praetoria-export.json`, no incluido en el repositorio) en los artículos Markdown de `src/content/blog/`.

```bash
python3 extract.py praetoria-export.json out/
python3 posts.py praetoria-export.json ../../src/content/blog
```

No hace falta volver a ejecutarlos: los artículos ya se editan directamente en Markdown.
