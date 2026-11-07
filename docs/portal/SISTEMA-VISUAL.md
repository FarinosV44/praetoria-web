# Sistema visual del panel del despacho

El panel `/admin` sigue la pauta del superadmin de DeCA Profesional, con la marca de Praetoria. Estilos en
`src/app/(portal)/despacho.css` (todo bajo `.despacho`: el área de clientes no cambia). Piezas en
`src/portal/components/despacho.tsx` y `despacho-cliente.tsx`. Seguros adapta sus clases al final de
`src/seguros/seguros.css`.

## Medidas

| Elemento | Valor |
|---|---|
| Barra lateral | 240 px, plegable a 48 px; en móvil, cajón bajo una barra fija |
| Contenido | 24 px de margen en escritorio, 16 px en móvil; sin ancho máximo en listas |
| Texto base | Archivo, 14 px. Título de página 20/700. Sección 12 en mayúsculas |
| Colores | Neutros y estados de DeCA. Rojo `#b3242a` para acción y marca; azul `#1f4a78` para enlaces |
| Radios | 3 px en tarjetas y botones, 11 px en campos, 12 px en la tarjeta de filtros |
| Controles | Botón 38 px (44 en móvil), campo de filtro 44 px, filtrar en píldora |

## Reglas

1. **Una lista filtrable se lee siempre igual:** `Cabecera` · `Vistas` · `Filtros` · `Resultados` · tabla · `Paginacion`.
   El estado vive en la URL, de modo que atrás y recargar conservan la vista.
2. **Indicadores:** solo `Kpi` dentro de `RejillaKpi`. Todos miden lo mismo; nunca hay una tarjeta «principal» más grande.
3. **Paneles de trabajo:** solo `Panel` dentro de `.rejilla-paneles`. Altura fija y lista desplazable por dentro.
4. **Filtros:** `FiltroTexto` y `FiltroSelector`, nunca un `<select>` suelto. Lo poco frecuente va en «Filtros avanzados».
5. **Tablas:** `.tabla-marco` y `.tabla`. Añade `.tabla-apilada` y `data-e="Columna"` en cada celda para que en móvil se apile.
6. **Estados:** siempre con texto (`.chip-*`), nunca solo con color. El rojo avisa de lo que requiere atención.
7. **Controles de formulario sueltos:** clase `.control`, sin utilidades de borde o relleno.
8. **Vacío, carga y error:** `Vacio`, `BarraCarga` y `admin/error.tsx`. Un vacío dice qué hacer a continuación.
   No añadas `loading.tsx` bajo `/admin`: activa el streaming y una ficha sin permiso respondería 200 en lugar de 404.
