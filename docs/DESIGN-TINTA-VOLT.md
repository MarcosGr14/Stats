# Sistema de diseño · Tinta + Volt

**Versión 1.0 · noviembre 2026**
Documento de referencia para construir cualquier sitio web con esta identidad visual. Está escrito para que lo use una persona o una IA/agente sin tener contexto previo.

---

## 0. Instrucciones para agentes (leer primero)

Si eres una IA o un agente construyendo una web con este sistema:

**Obligatorio (MUST)**
1. Define los tokens de la sección 3 como variables CSS **antes** de escribir cualquier componente. Nunca escribas colores, radios o tamaños "a mano" dentro de los componentes: usa siempre variables.
2. Entrega **siempre dos temas**: oscuro y claro, diseñados por separado (no es una simple inversión). Por defecto sigue `prefers-color-scheme`; permite al usuario elegir Automático / Claro / Oscuro.
3. Usa **solo dos familias tipográficas**: Unbounded (display y cifras grandes) y Onest (todo lo demás).
4. Usa **un único color de acción**: Volt (lima eléctrica) en oscuro, Tinta en claro (ver sección 3.3).
5. Las fotos y avatares van en **squircle** (cuadrado muy redondeado), nunca en círculo ni en rectángulo de esquinas filosas.
6. Las cifras importantes son **grandes, en Unbounded y con números tabulares**.
7. Respeta la accesibilidad de la sección 12 (contraste, objetivos táctiles, foco visible, `prefers-reduced-motion`).
8. Todo debe funcionar de **320 px a 1440 px** de ancho. Diseña primero para móvil.
9. Todo el texto de interfaz va en **español**, tuteando (ver sección 14).

**Prohibido (MUST NOT)**
- Negro puro con rosa neón, dorado, glow o resplandores permanentes, glassmorphism pesado.
- Etiquetas pequeñas en mayúsculas sobre cada sección, píldoras decorativas repetidas, tarjetas idénticas con borde y sombra de neón.
- Usar Volt como color de **texto sobre fondo claro** (no tiene contraste).
- Más de una tipografía display, o Unbounded en párrafos.
- Emojis como iconos de interfaz.
- Indicar información solo con color (siempre añade forma, trama, icono o texto).

**Antes de entregar**, pasa el checklist de la sección 16. Si el tipo de sitio no encaja en la sección 15, elige el "nivel de expresividad" más cercano y explica la decisión en una línea.

---

## 1. Esencia de la identidad

**Concepto:** cultura fan moderna. Gráfico, directo, con energía, como un cartel de festival y no como un casino de neón.

**Cuatro rasgos que definen la marca (no se negocian):**
1. **Tinta + Volt:** base de tinta (casi negro cálido) o papel (blanco cálido), y una lima eléctrica como único protagonista de color.
2. **Cifras enormes** como recurso visual (marcador deportivo).
3. **Squircle** en toda imagen de personas, portadas y avatares.
4. **Capas tonales** (superficies con distinto tono) en lugar de bordes gruesos y glow.

**Lo que sí es flexible** según el tipo de sitio: la composición de las pantallas, qué datos se destacan, los colores de acento de datos (sección 3.4), la cantidad de movimiento y el tipo de imágenes.

---

## 2. Cómo se relacionan el modo oscuro y el claro

La marca es la misma en espejo:

| | Oscuro ("Noche") | Claro ("Día") |
|---|---|---|
| Fondo | Tinta `#0E0E12` | Papel cálido `#F4F2EC` |
| Botón principal | **Volt** con texto tinta | **Tinta** con texto blanco/Volt |
| Elevación | Por tono de superficie | Por sombras suaves |
| Volt se usa como | Relleno **y** texto/iconos | Solo **relleno** (con texto tinta encima) |

Regla de oro: **Volt nunca es texto sobre claro.** En claro aparece como fondo de resaltado (chips, bloques, marcadores) siempre con texto tinta encima.

---

## 3. Color

### 3.1 Paleta base

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0E0E12` | `#F4F2EC` | Fondo de página |
| `--surface-1` | `#16161C` | `#FFFFFF` | Tarjetas, paneles, cabecera |
| `--surface-2` | `#1F1F27` | `#EDEAE2` | Hover, campos, zonas anidadas |
| `--surface-3` | `#272731` | `#E4E0D6` | Pulsado, pistas de barras |
| `--line` | `#2A2A34` | `#DEDAD0` | Divisores y bordes finos |
| `--text` | `#F3F2F7` | `#16151C` | Texto principal |
| `--text-muted` | `#A3A2B3` | `#5F5C6B` | Texto secundario |
| `--volt` | `#C8FF2E` | `#C8FF2E` | Marca (ver reglas) |
| `--ink` | `#0E0E12` | `#16151C` | Texto sobre Volt |
| `--action` | `#C8FF2E` | `#16151C` | Fondo del botón principal |
| `--action-text` | `#0E0E12` | `#FFFFFF` | Texto del botón principal |
| `--action-hover` | `#D8FF66` | `#2A2933` | Hover del botón principal |
| `--action-press` | `#B3E81F` | `#000000` | Pulsado del botón principal |
| `--focus` | `#C8FF2E` | `#16151C` | Anillo de foco |
| `--scrim` | `rgba(6,6,10,.62)` | `rgba(22,21,28,.45)` | Fondo detrás de modales |

### 3.2 Estados (semánticos)

| Token | Oscuro | Claro |
|---|---|---|
| `--success` | `#3DDC97` | `#12A36B` |
| `--warning` | `#FFB020` | `#C98300` |
| `--danger` | `#FF5C7A` | `#D6264A` |
| `--info` | `#8A97FF` | `#5B6CFF` |

Úsalos para iconos, bordes y rellenos tintados al 12–16 %. **El texto del mensaje sigue siendo `--text`**, así se garantiza el contraste en ambos temas.

### 3.3 Reglas de uso de Volt
- Máximo **un elemento Volt protagonista por pantalla visible** (el botón principal, un bloque destacado o un marcador). Si todo es Volt, nada lo es.
- Dos usos permitidos de Volt como relleno grande: el **Bloque Volt** (sección de énfasis con fondo `#C8FF2E` y texto `#0E0E12`, máximo uno por página) y el **marcador de selección** (chips/filas seleccionadas).
- En oscuro, Volt también puede ser texto o icono sobre fondo oscuro (enlaces, números destacados). En claro, esos mismos elementos usan `--text` con subrayado o un marcador Volt detrás.

### 3.4 Colores de acento de datos (flexibles)
Se usan para distinguir **dos o más series o categorías** (por ejemplo dos tipos de contenido, dos usuarios, dos estados). En el proyecto original son "Hombres" y "Mujeres".

| Token | Oscuro | Claro |
|---|---|---|
| `--accent-a` | `#8A97FF` (periwinkle) | `#5B6CFF` |
| `--accent-b` | `#FF8F73` (coral) | `#F2552C` |

- Si el sitio tiene más categorías, añade tonos del mismo carácter (saturados, ni pastel ni neón) y documenta la elección. Máximo 4 acentos de datos.
- **En claro, los acentos no pasan contraste como texto pequeño**: úsalos solo para rellenos, anillos, barras e iconos grandes.
- Si el sitio no tiene categorías, **no los uses**: la interfaz queda solo en Tinta/Papel + Volt.

### 3.5 Detalle holográfico (reservado a lo mejor)
Un único recurso decorativo para "lo más destacado" (campeón, ítem premium, logro). Es un borde con degradado cónico:

```css
--holo: conic-gradient(from var(--angle, 0deg), var(--accent-a), var(--volt), var(--accent-b), var(--accent-a));
```
Se aplica como borde de 2 px. Máximo **1 por pantalla**. Sin `--accent-a/b`, usa Volt y `--text`.

---

## 4. Tipografía

### 4.1 Familias
- **Display: Unbounded** (pesos 500, 700, 800). Ancha y con presencia. Solo títulos, nombres de sección, y cifras grandes.
- **Texto e interfaz: Onest** (pesos 400, 500, 600, 700). Párrafos, botones, formularios, tablas.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700;800&display=swap" rel="stylesheet">
```
```css
--font-display: "Unbounded", "Arial Black", system-ui, sans-serif;
--font-body: "Onest", system-ui, -apple-system, "Segoe UI", sans-serif;
```

### 4.2 Escala

| Estilo | Familia / peso | Tamaño | Interlínea | Tracking |
|---|---|---|---|---|
| Display XL (hero) | Unbounded 800 | `clamp(40px, 8vw, 88px)` | 1.0 | -0.03em |
| Número XL (marcador) | Unbounded 800 | `clamp(48px, 10vw, 96px)` | 1.0 | -0.02em |
| H1 | Unbounded 800 | `clamp(32px, 5vw, 56px)` | 1.05 | -0.025em |
| H2 | Unbounded 700 | `clamp(24px, 3.5vw, 36px)` | 1.1 | -0.02em |
| H3 | Unbounded 700 | `clamp(18px, 2.2vw, 24px)` | 1.2 | -0.01em |
| Cifra L (stats) | Unbounded 800 | 28–40 px | 1.1 | -0.01em |
| Cuerpo L | Onest 400 | 18 px | 1.55 | 0 |
| **Cuerpo** | Onest 400 | **16 px** | 1.55 | 0 |
| Cuerpo S | Onest 400 | 14 px | 1.5 | 0 |
| Etiqueta / botón | Onest 600 | 14–15 px | 1.2 | 0 |
| Caption | Onest 500 | 12 px | 1.4 | 0.01em |

### 4.3 Reglas
- **Mínimos:** cuerpo 14 px, etiquetas 12 px. Nada por debajo de 12 px.
- Todos los números en tablas, listas, marcadores y contadores llevan `font-variant-numeric: tabular-nums`.
- Unbounded es ancha: **máximo ~28 caracteres por línea de título**, y no la uses en mayúsculas sostenidas.
- Ancho máximo de párrafos: `60ch`. Alineación a la izquierda (no justificar).
- Mayúsculas sostenidas solo en etiquetas muy cortas (≤ 12 caracteres) y **con moderación**.
- Jerarquía por **tamaño y peso**, no por color. El color secundario es `--text-muted`.

---

## 5. Espaciado, forma y elevación

### 5.1 Espaciado (escala de 4 px)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72 · 96`
Tokens: `--space-1` (4) … `--space-11` (96). Espacio entre secciones: 56–96 px. Padding de tarjeta: 16 px en móvil, 24 px en escritorio.

### 5.2 Radios
| Token | Valor | Uso |
|---|---|---|
| `--r-sm` | 8 px | Badges, tooltips |
| `--r-md` | 12 px | Botones, campos, filas |
| `--r-lg` | 20 px | Tarjetas, paneles |
| `--r-xl` | 28 px | Hero, modales, hojas inferiores |
| `--r-full` | 999 px | Chips, interruptores, píldoras |
| `--r-squircle` | 30 % | Fotos y avatares |

> Mejora progresiva: si el navegador lo soporta, usa `corner-shape: squircle` junto al `border-radius`.

### 5.3 Elevación
- **Oscuro:** sin sombras. La profundidad se logra con `--surface-1/2/3` y una línea `--line` de 1 px.
- **Claro:** `--shadow-1: 0 1px 2px rgba(22,21,28,.06)`; `--shadow-2: 0 8px 24px rgba(22,21,28,.08)`; `--shadow-3: 0 20px 48px rgba(22,21,28,.14)` (modales).
- Z-index: contenido 0 · sticky 20 · desplegables 40 · modal 60 · toast 80.

### 5.4 Cuadrícula y contenedores
- Contenedor máximo: **1200 px**. Padding lateral: 16 px (móvil), 24 px (tablet), 32 px (escritorio).
- Columnas: 4 (móvil), 8 (tablet), 12 (escritorio). Separación: 16 / 20 / 24 px.
- Breakpoints (mobile-first): `480 · 640 · 900 · 1100 · 1280`.

---

## 6. Iconografía
- Familia recomendada: **Lucide** (o equivalente con trazo redondeado). Trazo **1.75 px**, extremos y uniones redondeados.
- Tamaños: 16, 20, 24 px. Color: `currentColor`.
- Un icono solo nunca es la única señal: acompáñalo de texto o `aria-label`.

---

## 7. Imágenes

**Formas y proporciones**
- Personas, portadas y avatares: squircle (`--r-squircle`), proporción 1:1. Tamaños de avatar: 32 · 40 · 48 · 72 · 96 px.
- Tarjetas con foto: 4:5 (vertical) o 3:2 (horizontal). Hero: 16:9 o 21:9. Siempre `object-fit: cover`.

**Tratamiento**
- Sin filtros agresivos, sin marcos decorativos, sin sombras de neón.
- Texto sobre imagen: degradado de legibilidad `linear-gradient(to top, rgba(14,14,18,.85), transparent 60%)`.
- En modo oscuro, atenúa un poco las imágenes muy claras: `filter: brightness(.92)`.
- Evita fotos de stock genéricas (luces de concierto, siluetas). Prefiere fotos reales del contenido o formas geométricas planas (círculos, bloques, bandas Volt).

**Carga y respaldo**
- Siempre `width` y `height` (evita saltos de diseño), `loading="lazy"`, `decoding="async"` y `alt` descriptivo (vacío solo si es decorativa).
- Mientras carga: esqueleto (sección 10.12) y entrada con fundido de 300 ms.
- **Placeholder cuando no hay foto:** degradado generado a partir del nombre + iniciales.

```js
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
const initials = n => { const w = n.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase(); };
// CSS: background: linear-gradient(135deg, hsl(var(--h) 70% 52%), hsl(calc(var(--h) + 45) 65% 32%)); color:#fff;
```

---

## 8. Movimiento

### 8.1 Tokens
```css
--dur-1: 120ms;  /* microinteracciones: hover de color, foco */
--dur-2: 200ms;  /* hover, toggles, popovers */
--dur-3: 320ms;  /* modales, hojas, cambios de tema */
--dur-4: 600ms;  /* entradas de contenido */
--dur-5: 900ms;  /* contadores y barras que crecen (una sola vez) */
--ease-out: cubic-bezier(.2, .8, .2, 1);       /* por defecto */
--ease-in-out: cubic-bezier(.65, 0, .35, 1);   /* movimientos largos */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1);/* confirmaciones, "pop" */
```

### 8.2 Catálogo de animaciones (usar solo estas)
1. **Entrada escalonada:** `opacity 0→1` + `translateY(14px→0)`, 500–600 ms, retraso de 55–70 ms por elemento (**máximo 10 elementos** escalonados; el resto entra junto).
2. **Contador:** los números suben de 0 al valor en `--dur-5` con ease-out cúbico. Solo al primer render.
3. **Barra que crece:** `scaleX(0→1)` desde la izquierda, `--dur-5`.
4. **Hover de tarjeta/fila:** `translateY(-2px)` (o `translateX(3px)` en filas) + cambio de superficie, `--dur-2`.
5. **Hover de imagen/avatar:** `scale(1.04–1.08)`, `--dur-2`.
6. **Pulsado:** `scale(.97)`, `--dur-1`.
7. **Confirmación:** check con `--ease-spring` y una onda Volt que se expande y se desvanece (400 ms). Sin confeti.
8. **Reordenar lista:** animación FLIP (cada elemento se desliza a su nueva posición, 300 ms).
9. **Cambio de tema:** transición suave de `background-color`, `color` y `border-color` en 300 ms (aplicar la clase solo durante el cambio).
10. **Transición entre páginas:** View Transitions API (fundido de 200 ms) cuando esté disponible.
11. **Borde holográfico:** el ángulo del degradado rota lento (12 s). Es la única animación infinita decorativa permitida, y solo en el elemento destacado.
12. **Esqueleto de carga:** destello suave de 1.4 s en bucle mientras hay carga real.

### 8.3 Reglas
- **No más de 3 elementos animándose a la vez** a la vista del usuario.
- Nada decorativo dura más de 900 ms, salvo los bucles 11 y 12.
- Anima `transform` y `opacity`. Evita animar `width`, `height`, `top`, `left`.
- `prefers-reduced-motion: reduce` desactiva **todo** lo anterior: los números aparecen ya finales, las barras llenas y no hay desplazamientos.

---

## 9. Estados de interacción

| Estado | Regla |
|---|---|
| **Hover** (solo punteros con hover) | Cambio sutil de superficie, `--dur-2`. Nunca esconde información ni es la única forma de acceder a algo. |
| **Foco (teclado)** | Anillo de 2 px `--focus` con separación de 2 px. Siempre visible, nunca `outline: none` sin reemplazo. |
| **Pulsado** | `scale(.97)` y superficie un tono más oscura. |
| **Seleccionado** | Relleno `--action` (o marcador Volt en claro) + icono de check. No solo color. |
| **Deshabilitado** | Opacidad .45, cursor `not-allowed`, sin hover. Explica el motivo si no es obvio. |
| **Cargando** | Esqueleto o indicador en el propio botón (el botón conserva su ancho). |
| **Error** | Borde `--danger` + icono + texto de ayuda. Nunca solo rojo. |

> En pantallas táctiles todo lo que ocurre al hover debe ser alcanzable con un toque.

---

## 10. Componentes

### 10.1 Botones
| Variante | Estilo |
|---|---|
| **Primario** | Fondo `--action`, texto `--action-text`, peso 600. Uno por vista. |
| **Secundario** | Fondo `--surface-2`, texto `--text`, borde `--line`. |
| **Fantasma** | Sin fondo, texto `--text`; hover `--surface-2`. |
| **Peligro** | Fondo `--danger` al 14 % con borde `--danger`; texto `--text`. Primario peligroso solo en confirmaciones destructivas. |

Alturas: **sm 32 · md 40 · lg 48 px** (usa lg o md con área táctil ≥ 44 px en móvil). Radio `--r-md`. Padding horizontal: 16 px (md). Icono + texto con separación de 8 px. Hover del primario: sube 1 px y usa `--action-hover`.

### 10.2 Chips, etiquetas y badges
- **Chip de filtro:** píldora de 32 px, `--surface-2`; seleccionado: `--action` + check.
- **Badge de estado:** `--r-sm`, fondo del color semántico al 14 %, icono + texto en `--text`.
- **Etiqueta de dato** (p. ej. "Grupo", "Solista"): texto `--text-muted` de 12 px, sin fondo. No uses píldoras decorativas.

### 10.3 Tarjetas
Fondo `--surface-1`, radio `--r-lg`, borde 1 px `--line` (oscuro) o sombra `--shadow-1` + borde `--line` (claro). Interactiva: hover sube 2 px (en claro pasa a `--shadow-2`, en oscuro a `--surface-2`). **Evita rejillas de tarjetas idénticas**: varía el tamaño, destaca una y usa listas cuando los datos sean tabulares.

### 10.4 Campos de formulario
Altura 48 px, radio `--r-md`, fondo `--surface-2`, borde 1 px `--line`. Etiqueta **encima** (14 px, peso 500), ayuda de 12 px debajo. Foco: borde `--text` + anillo `--focus`. Error: borde `--danger` + icono + mensaje. Nunca uses el placeholder como etiqueta. **Select personalizado:** lista emergente en escritorio, hoja inferior en móvil.

### 10.5 Control segmentado y pestañas
- **Segmentado** (2–4 opciones excluyentes): pista `--surface-1` en píldora, indicador deslizante (`--action`) con transición de 200 ms. Opciones de ≥ 44 px de alto en móvil.
- **Pestañas** (secciones de contenido): texto con indicador inferior de 3 px `--action`; en móvil, desplazables horizontalmente con borde difuminado.

### 10.6 Listas y filas
Fila: altura mínima 56 px, radio `--r-md`, hover `--surface-2`. Estructura: posición/índice · imagen squircle · título + subtítulo · dato principal a la derecha (cifra tabular). Separación por espacio, no por líneas.

### 10.7 Tablas
Encabezado fijo (sticky), sin cebreado, hover de fila `--surface-2`, números alineados a la derecha y tabulares. En móvil, convertir en lista de tarjetas o permitir scroll horizontal dentro de su contenedor (el `body` nunca se desplaza de lado).

### 10.8 Barras de progreso y de datos
Altura 6 px, pista `--surface-3`, radio completo.
- **Medida principal:** relleno sólido (`--action` o `--accent-*`).
- **Medida secundaria:** misma barra con **trama rayada**, así no depende solo del color:
```css
.bar-secondary { background: repeating-linear-gradient(135deg, var(--c) 0 4px, transparent 4px 8px), color-mix(in srgb, var(--c) 22%, transparent); }
```

### 10.9 Tarjeta de estadística
Cifra L (Unbounded 800) + etiqueta de 14 px `--text-muted` + cambio opcional (icono flecha + texto). Sin gráficos decorativos innecesarios.

### 10.10 Bloque Volt
Sección o tarjeta con fondo `#C8FF2E` y texto `#0E0E12`, radio `--r-xl`, cifra o título en Unbounded. Máximo uno por página. En él, el botón principal pasa a ser **Tinta** (`#0E0E12` con texto Volt).

### 10.11 Navegación
- **Cabecera:** sticky, 64 px, fondo `--bg` al 82 % con desenfoque ligero, línea inferior `--line`. Logo a la izquierda, enlaces como píldoras, un botón principal a la derecha, menú de usuario (incluye tema y cerrar sesión).
- **Móvil:** barra de pestañas inferior de 64 px + `env(safe-area-inset-bottom)`, **máximo 5 elementos**, indicador activo de 16×3 px. El elemento de acción principal puede resaltar con `--action`.
- **Pie:** sobrio, una fila de enlaces y créditos, sin decoración.
- **Selector de tema:** tres opciones (Automático / Claro / Oscuro) en el menú de usuario, con vista previa del cambio.

### 10.12 Esqueletos, vacíos y errores
- **Esqueleto:** formas con `--surface-2` y destello suave; respeta el tamaño real del contenido.
- **Estado vacío:** ilustración simple geométrica (bloques y Volt), título H3, una frase y una acción.
- **Error de carga:** banner con icono, qué pasó, y botón "Reintentar".

### 10.13 Banners y avisos
Barra con fondo del color semántico al 12 %, icono, texto en `--text`, y **botón de acción** cuando haya algo que hacer (no solo texto de color).

### 10.14 Toasts
Mensajes cortos de confirmación. Posición: abajo al centro en móvil (por encima de la barra inferior), abajo a la derecha en escritorio. Se cierran solos a los 4 s (6 s si llevan acción), pausan al hover, `role="status"`. Entrada: deslizamiento 12 px + fundido, `--dur-2`. Máximo 3 apilados.

### 10.15 Tooltips y popovers
Tooltip: `--surface-3`, texto 12–13 px, radio `--r-sm`, aparece a los 300 ms de hover o al enfocar. Nunca contiene información imprescindible. Popover: `--surface-1`, radio `--r-lg`, sombra en claro / línea en oscuro.

---

## 11. Modales y hojas

### 11.1 Cuándo usar cada uno
| Tipo | Uso |
|---|---|
| **Diálogo de confirmación** | Acciones irreversibles o de un solo intento. Resume lo que se va a hacer. |
| **Diálogo destructivo** | Eliminar o descartar. Botón principal en estilo Peligro, y el botón por defecto enfocado es **Cancelar**. |
| **Formulario corto** | 1–4 campos. Si necesita más, usa una página. |
| **Hoja de detalle** | Ver más información de un elemento de una lista (desglose, historial). |
| **Visor de imagen** | Imagen a pantalla completa con cierre claro. |

### 11.2 Especificación
- **Escritorio (≥ 640 px):** diálogo centrado, ancho 480 px (hasta 640 px para formularios), radio `--r-xl`, fondo `--surface-1`, padding 24–32 px, sombra `--shadow-3` en claro.
- **Móvil (< 640 px):** **hoja inferior**: radio `28px 28px 0 0`, asa de arrastre de 36×4 px, altura máxima `90dvh`, `padding-bottom: env(safe-area-inset-bottom)`, contenido con scroll interno.
- **Fondo (scrim):** `--scrim`, con desenfoque leve opcional. Bloquea el scroll del `body` mientras está abierto.
- **Entrada:** diálogo `scale(.96→1)` + fundido, `--dur-3` `--ease-out`; hoja: `translateY(100%→0)`, `--dur-3`. Salida más rápida (200 ms).
- **Estructura:** título (H3) · descripción (cuerpo S, `--text-muted`) · contenido · acciones.
- **Acciones:** escritorio, alineadas a la derecha (secundaria a la izquierda, primaria a la derecha). Móvil, apiladas a ancho completo con la **primaria arriba**.

### 11.3 Comportamiento y accesibilidad
- `role="dialog"` (o `alertdialog` en destructivos), `aria-modal="true"`, `aria-labelledby` y `aria-describedby`.
- Foco atrapado dentro; al abrir enfoca el primer elemento útil; al cerrar **devuelve el foco** al disparador.
- Se cierra con **Esc**, clic en el fondo y deslizar hacia abajo (hoja). Si hay cambios sin guardar, pide confirmación antes de cerrar.
- Si una acción es irreversible, el diálogo lo dice con claridad (por ejemplo: "Solo puedes votar una vez por temporada").
- Tras confirmar: cierra, muestra toast de éxito y aplica la animación de confirmación (8.2, n.º 7).

---

## 12. Accesibilidad (requisitos mínimos)
- **Contraste:** texto normal ≥ 4.5:1, texto grande y componentes gráficos ≥ 3:1. Referencias: `--text-muted` sobre `--surface-1` cumple en ambos temas; Volt sobre `--ink` ≈ 17:1; los acentos de datos en claro **no** cumplen como texto pequeño.
- **Objetivos táctiles:** ≥ 44×44 px con 8 px de separación.
- **Teclado:** todo operable con teclado, orden lógico, foco visible (sección 9).
- **No depender del color:** usa trama, icono, forma o texto además del color.
- **Movimiento:** respeta `prefers-reduced-motion`. Nada parpadea más de 3 veces por segundo.
- **Semántica:** usa `<button>`, `<nav>`, `<main>`, encabezados en orden, `aria-label` en iconos, `aria-pressed`/`aria-selected` en controles de selección, `aria-live` en toasts.
- **Idioma:** `<html lang="es">`.
- **Zoom y texto:** funciona con zoom al 200 % y con texto agrandado, sin pérdida de contenido.

---

## 13. Responsive

| Ancho | Patrón |
|---|---|
| **< 640 (móvil)** | Una columna. Barra inferior. Hojas inferiores. Control segmentado fijo arriba para alternar vistas en lugar de apilarlas. Cuando haya dos listas hermanas (A y B), muestra **una a la vez** y permite deslizar entre ellas. |
| **640–1099 (tablet)** | Una columna ancha, cabecera completa, diálogos centrados. Dos columnas solo en horizontal y si el contenido lo aguanta. |
| **≥ 1100 (escritorio)** | Cuadrícula de 12 columnas, listas hermanas lado a lado, cabecera con navegación completa. |

Reglas: sin scroll horizontal del `body`; tablas y códigos con scroll dentro de su contenedor; `dvh` en lugar de `vh`; respeta `env(safe-area-inset-*)`; imágenes `max-width: 100%`. **Evita listas largas en móvil:** limita lo visible, agrupa por pestañas o usa hojas de detalle.

---

## 14. Voz y microcopy
- **Español neutro, tuteando.** Cercano pero claro, sin jerga ni exceso de entusiasmo.
- **Mayúscula solo inicial** (sentence case) en títulos, botones y etiquetas.
- **Botones con verbo:** "Votar ahora", "Guardar favoritos", "Reintentar". Evita "Aceptar" y "OK" sin contexto.
- **Errores:** qué pasó + qué hacer. "No pudimos guardar tu voto. Revisa tu conexión e inténtalo de nuevo."
- **Vacíos:** explican qué verá el usuario cuando haya contenido y ofrecen una acción.
- **Números y fechas:** formato local (`Intl`), por ejemplo "23 de noviembre de 2026". Unidades abreviadas con espacio ("5 pts").
- Emojis: casi nunca en la interfaz. Si se usan, como acento puntual en contenido, no como iconos.

---

## 15. Cómo adaptarlo a distintos tipos de sitio

Piensa en un **dial de expresividad** del 1 (sereno) al 5 (muy expresivo). La identidad (secciones 1–4) es igual en todos; cambia cuánto Volt, cuánto movimiento y cuánta cifra grande se usan.

| Tipo de sitio | Dial | Qué enfatizar | Qué moderar |
|---|---|---|---|
| **Landing / portafolio** | 4–5 | Display XL, Bloque Volt, imágenes grandes squircle, entrada escalonada | Número de CTA (uno principal) |
| **Panel / estadísticas** | 2–3 | Tarjetas de estadística, cifras tabulares, tablas limpias, barras | Volt solo en el botón principal y la selección |
| **Juego / interactivo** | 4–5 | Confirmación con onda Volt, cifras grandes de marcador, feedback inmediato | Mantener legibilidad: Volt solo para lo que importa |
| **Herramienta / utilidad** | 1–2 | Campos claros, resultados con Cifra L, estados de carga | Animaciones: mínimas |
| **Contenido / blog / documentación** | 1–2 | Cuerpo L, anchos de 60ch, mucho espacio, imágenes con proporción 3:2 | Tarjetas y decoración |
| **Catálogo / tienda** | 3 | Fotos 4:5 squircle, precio en Cifra L, chips de filtro | Mantener consistencia entre tarjetas |
| **Formularios / registros** | 1–2 | Campos de 48 px, validación clara, un solo primario | Todo lo decorativo |

**Qué es intocable en cualquier sitio:** tokens de color de la sección 3.1–3.3, tipografías, squircle, dos temas, accesibilidad.
**Qué se adapta:** composición, acentos de datos (3.4), tipo de imágenes, cantidad de movimiento, estructura de navegación.

---

## 16. Checklist de entrega
- [ ] Tokens definidos como variables CSS para **oscuro y claro**; sin valores sueltos en los componentes.
- [ ] Sigue `prefers-color-scheme` y permite elegir Automático / Claro / Oscuro; `<meta name="theme-color">` para ambos.
- [ ] Solo Unbounded + Onest; cifras con `tabular-nums`.
- [ ] Un único elemento Volt protagonista por pantalla; Volt nunca como texto sobre fondo claro.
- [ ] Imágenes y avatares en squircle, con `width/height`, `alt`, carga diferida y placeholder.
- [ ] Hover, foco, pulsado, seleccionado, deshabilitado, cargando y error resueltos en cada componente.
- [ ] Modales con foco atrapado, Esc, cierre por fondo, hoja inferior en móvil.
- [ ] Animaciones solo del catálogo; `prefers-reduced-motion` desactiva todo.
- [ ] Probado a 320, 390, 768, 1024 y 1440 px, sin scroll horizontal.
- [ ] Contraste verificado en ambos temas; objetivos táctiles ≥ 44 px.
- [ ] Textos en español, tuteando, botones con verbo.
- [ ] Ninguna información transmitida solo por color.

---

## 17. Código de arranque (copiar y pegar)

### 17.1 Tokens y tema
```css
:root {
  /* Tema oscuro por defecto */
  --bg:#0E0E12; --surface-1:#16161C; --surface-2:#1F1F27; --surface-3:#272731; --line:#2A2A34;
  --text:#F3F2F7; --text-muted:#A3A2B3;
  --volt:#C8FF2E; --ink:#0E0E12;
  --action:#C8FF2E; --action-text:#0E0E12; --action-hover:#D8FF66; --action-press:#B3E81F; --focus:#C8FF2E;
  --accent-a:#8A97FF; --accent-b:#FF8F73;
  --success:#3DDC97; --warning:#FFB020; --danger:#FF5C7A; --info:#8A97FF;
  --scrim:rgba(6,6,10,.62);
  --shadow-1:none; --shadow-2:none; --shadow-3:none;

  --font-display:"Unbounded","Arial Black",system-ui,sans-serif;
  --font-body:"Onest",system-ui,-apple-system,"Segoe UI",sans-serif;

  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px;
  --space-7:32px; --space-8:40px; --space-9:56px; --space-10:72px; --space-11:96px;
  --r-sm:8px; --r-md:12px; --r-lg:20px; --r-xl:28px; --r-full:999px; --r-squircle:30%;

  --dur-1:120ms; --dur-2:200ms; --dur-3:320ms; --dur-4:600ms; --dur-5:900ms;
  --ease-out:cubic-bezier(.2,.8,.2,1); --ease-in-out:cubic-bezier(.65,0,.35,1); --ease-spring:cubic-bezier(.34,1.56,.64,1);

  color-scheme: dark;
}

/* Tema claro: automático (sistema) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg:#F4F2EC; --surface-1:#FFFFFF; --surface-2:#EDEAE2; --surface-3:#E4E0D6; --line:#DEDAD0;
    --text:#16151C; --text-muted:#5F5C6B; --ink:#16151C;
    --action:#16151C; --action-text:#FFFFFF; --action-hover:#2A2933; --action-press:#000000; --focus:#16151C;
    --accent-a:#5B6CFF; --accent-b:#F2552C;
    --success:#12A36B; --warning:#C98300; --danger:#D6264A; --info:#5B6CFF;
    --scrim:rgba(22,21,28,.45);
    --shadow-1:0 1px 2px rgba(22,21,28,.06); --shadow-2:0 8px 24px rgba(22,21,28,.08); --shadow-3:0 20px 48px rgba(22,21,28,.14);
    color-scheme: light;
  }
}
/* Tema claro: elegido por el usuario */
:root[data-theme="light"] {
  --bg:#F4F2EC; --surface-1:#FFFFFF; --surface-2:#EDEAE2; --surface-3:#E4E0D6; --line:#DEDAD0;
  --text:#16151C; --text-muted:#5F5C6B; --ink:#16151C;
  --action:#16151C; --action-text:#FFFFFF; --action-hover:#2A2933; --action-press:#000000; --focus:#16151C;
  --accent-a:#5B6CFF; --accent-b:#F2552C;
  --success:#12A36B; --warning:#C98300; --danger:#D6264A; --info:#5B6CFF;
  --scrim:rgba(22,21,28,.45);
  --shadow-1:0 1px 2px rgba(22,21,28,.06); --shadow-2:0 8px 24px rgba(22,21,28,.08); --shadow-3:0 20px 48px rgba(22,21,28,.14);
  color-scheme: light;
}
/* Tema oscuro: elegido por el usuario (ya es el valor por defecto de :root) */
:root[data-theme="dark"] { color-scheme: dark; }
```
> Si usas un preprocesador o un script de build, genera los dos bloques claros a partir de una sola definición para no duplicar mantenimiento.

### 17.2 Base y tipografía
```css
*,*::before,*::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin:0; background:var(--bg); color:var(--text); font:400 16px/1.55 var(--font-body); -webkit-font-smoothing:antialiased; }
h1,h2,h3 { font-family:var(--font-display); margin:0; }
h1 { font-weight:800; font-size:clamp(32px,5vw,56px); line-height:1.05; letter-spacing:-.025em; }
h2 { font-weight:700; font-size:clamp(24px,3.5vw,36px); line-height:1.1; letter-spacing:-.02em; }
h3 { font-weight:700; font-size:clamp(18px,2.2vw,24px); line-height:1.2; letter-spacing:-.01em; }
.display-xl { font:800 clamp(40px,8vw,88px)/1 var(--font-display); letter-spacing:-.03em; }
.num-xl { font:800 clamp(48px,10vw,96px)/1 var(--font-display); letter-spacing:-.02em; }
.num, table td, .tabular { font-variant-numeric: tabular-nums; }
.muted { color: var(--text-muted); }
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; border-radius:var(--r-sm); }
```

### 17.3 Componentes clave
```css
/* Botones */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:40px; padding:0 16px; border:0; border-radius:var(--r-md);
  font:600 15px/1 var(--font-body); cursor:pointer; background:var(--surface-2); color:var(--text);
  transition:background var(--dur-2) var(--ease-out), transform var(--dur-1) var(--ease-out); }
.btn:active { transform:scale(.97); }
.btn-primary { background:var(--action); color:var(--action-text); }
.btn-primary:hover { background:var(--action-hover); transform:translateY(-1px); }
.btn-primary:active { background:var(--action-press); }
.btn-lg { height:48px; padding:0 22px; }
.btn[disabled] { opacity:.45; cursor:not-allowed; transform:none; }
@media (hover:none) { .btn-primary:hover { transform:none; } }

/* Tarjeta */
.card { background:var(--surface-1); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--space-4); box-shadow:var(--shadow-1);
  transition:transform var(--dur-2) var(--ease-out), background var(--dur-2), box-shadow var(--dur-2); }
.card.interactive:hover { transform:translateY(-2px); background:var(--surface-2); box-shadow:var(--shadow-2); }
@media (min-width:900px) { .card { padding:var(--space-6); } }

/* Chip */
.chip { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px; border-radius:var(--r-full); border:1px solid var(--line);
  background:var(--surface-2); color:var(--text); font:500 14px var(--font-body); cursor:pointer; }
.chip[aria-pressed="true"] { background:var(--action); color:var(--action-text); border-color:transparent; }

/* Campo */
.field { display:grid; gap:6px; }
.field label { font:500 14px var(--font-body); }
.input { height:48px; padding:0 14px; border-radius:var(--r-md); border:1px solid var(--line); background:var(--surface-2); color:var(--text); font:400 16px var(--font-body); }
.input:focus { border-color:var(--text); }
.input[aria-invalid="true"] { border-color:var(--danger); }

/* Imagen squircle */
.squircle { border-radius:var(--r-squircle); object-fit:cover; aspect-ratio:1/1; }

/* Barras (principal sólida / secundaria rayada) */
.bar { height:6px; border-radius:var(--r-full); background:var(--surface-3); overflow:hidden; }
.bar > i { display:block; height:100%; width:var(--w,0%); background:var(--c,var(--action)); border-radius:inherit; transform-origin:left;
  animation:grow var(--dur-5) var(--ease-out) both; }
.bar > i.striped { background:repeating-linear-gradient(135deg,var(--c) 0 4px,transparent 4px 8px),color-mix(in srgb,var(--c) 22%,transparent); }

/* Bloque Volt */
.volt-block { background:#C8FF2E; color:#0E0E12; border-radius:var(--r-xl); padding:var(--space-7); }
.volt-block .btn-primary { background:#0E0E12; color:#C8FF2E; }

/* Borde holográfico (elemento destacado) */
@property --angle { syntax:"<angle>"; initial-value:0deg; inherits:false; }
.holo { position:relative; border-radius:var(--r-lg); background:var(--surface-1); }
.holo::before { content:""; position:absolute; inset:-2px; z-index:-1; border-radius:calc(var(--r-lg) + 2px);
  background:conic-gradient(from var(--angle),var(--accent-a),var(--volt),var(--accent-b),var(--accent-a)); animation:spin 12s linear infinite; }

/* Modal / hoja inferior */
.scrim { position:fixed; inset:0; background:var(--scrim); z-index:60; animation:fade var(--dur-3) var(--ease-out); }
.dialog { position:fixed; z-index:61; left:50%; top:50%; width:min(480px,calc(100% - 32px)); max-height:90dvh; overflow:auto; transform:translate(-50%,-50%);
  background:var(--surface-1); border:1px solid var(--line); border-radius:var(--r-xl); padding:var(--space-7); box-shadow:var(--shadow-3);
  animation:pop var(--dur-3) var(--ease-out); }
.dialog .actions { display:flex; gap:12px; justify-content:flex-end; margin-top:var(--space-6); }
@media (max-width:639px) {
  .dialog { left:0; right:0; bottom:0; top:auto; width:100%; transform:none; border-radius:28px 28px 0 0;
    padding:var(--space-6) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom,0px)); animation:sheet var(--dur-3) var(--ease-out); }
  .dialog::before { content:""; display:block; width:36px; height:4px; border-radius:4px; background:var(--surface-3); margin:0 auto var(--space-5); }
  .dialog .actions { flex-direction:column-reverse; }
  .dialog .actions .btn { width:100%; height:48px; }
}

/* Toast */
.toast { position:fixed; z-index:80; left:50%; bottom:calc(88px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); max-width:calc(100% - 32px);
  background:var(--surface-3); color:var(--text); border-radius:var(--r-md); padding:12px 16px; animation:toast var(--dur-2) var(--ease-out); }
@media (min-width:900px) { .toast { left:auto; right:24px; bottom:24px; transform:none; } }

/* Esqueleto */
.skeleton { background:linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%); background-size:200% 100%;
  border-radius:var(--r-md); animation:shimmer 1.4s linear infinite; }

/* Entrada escalonada: style="--i:0..9" */
.reveal { animation:up var(--dur-4) var(--ease-out) both; animation-delay:calc(var(--i,0) * 60ms); }

@keyframes up { from { opacity:0; transform:translateY(14px); } }
@keyframes grow { from { transform:scaleX(0); } }
@keyframes fade { from { opacity:0; } }
@keyframes pop { from { opacity:0; transform:translate(-50%,-50%) scale(.96); } }
@keyframes sheet { from { transform:translateY(100%); } }
@keyframes toast { from { opacity:0; transform:translate(-50%,12px); } }
@keyframes spin { to { --angle:360deg; } }
@keyframes shimmer { to { background-position:-200% 0; } }

@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after { animation:none !important; transition:none !important; }
}
```

### 17.4 Selector de tema (Automático / Claro / Oscuro)
```js
const root = document.documentElement;
function setTheme(mode) {              // 'auto' | 'light' | 'dark'
  root.classList.add('theme-anim');    // transición suave solo durante el cambio
  if (mode === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = mode;
  try { localStorage.setItem('theme', mode); } catch {}
  setTimeout(() => root.classList.remove('theme-anim'), 350);
}
try { const m = localStorage.getItem('theme'); if (m && m !== 'auto') root.dataset.theme = m; } catch {}
// CSS: .theme-anim, .theme-anim * { transition: background-color .3s, color .3s, border-color .3s !important; }
```
> Ejecuta la lectura inicial en un `<script>` dentro del `<head>` para evitar el parpadeo de tema al cargar.

### 17.5 Si usas Tailwind
Mapea los tokens a la configuración para no repetir valores:
```js
// tailwind.config.js (v3) · en v4 usa @theme con las mismas variables
theme: { extend: {
  colors: { bg:'var(--bg)', s1:'var(--surface-1)', s2:'var(--surface-2)', s3:'var(--surface-3)', line:'var(--line)',
            tx:'var(--text)', mut:'var(--text-muted)', action:'var(--action)', 'action-tx':'var(--action-text)',
            volt:'var(--volt)', a:'var(--accent-a)', b:'var(--accent-b)' },
  fontFamily: { display:['Unbounded','Arial Black','sans-serif'], body:['Onest','system-ui','sans-serif'] },
  borderRadius: { md:'12px', lg:'20px', xl:'28px', squircle:'30%' }
}}
```

---

## 18. Mantenimiento de este documento
- Los cambios en tokens se hacen **aquí primero** y luego en el código.
- Si un sitio necesita algo que no existe (un componente nuevo, un acento extra), documéntalo como extensión con su justificación, y verifica que cumple las secciones 1, 3.3 y 12.
- Versionado: cambia la cifra de versión al modificar tokens (mayor) o añadir componentes (menor).

---

## Adaptación del sistema a Stats

Esta sección registra cómo se aplica la identidad a Stats, una herramienta local de seguimiento y análisis de participantes, temporadas y votaciones. El brief original define la marca; este apéndice traduce sus decisiones a las pantallas y tareas existentes.

### Dirección del producto

- **Tipo de superficie:** herramienta/panel estadístico de uso frecuente, con catálogo, evaluación, resultados, temporadas, perfiles, archivo y gestión de datos.
- **Concepto visual:** archivo deportivo de cultura fan. Los retratos sirven de índice; las puntuaciones y las temporadas se leen como un marcador. La composición prioriza encontrar un participante y continuar el trabajo, no presentar una landing promocional.
- **Jerarquía:** navegación persistente; título directo de la tarea; acción principal disponible; filtros y contenido agrupados por uso; métricas y estados oficiales/provisionales legibles sin depender del color.
- **Contenido y comportamiento:** conservar los datos locales y las funciones ya existentes. No se reemplazan flujos por maquetas ni se altera el cálculo o la persistencia para obtener un efecto visual.
- **Fotos:** conservar los retratos WebP del catálogo y las fotos personalizadas. Presentarlos en squircle, con carga diferida, dimensiones estables, texto alternativo y fallback de iniciales.
- **Temas:** Automático (sigue el sistema), Claro y Oscuro. La elección visual es una preferencia local independiente de los datos de temporadas y backups.
- **Categorías y datos:** ampliar los acentos semánticos hasta cubrir las seis categorías funcionales. Los acentos identifican categorías o series; texto, etiquetas y forma también nombran el estado. Volt queda para la acción principal y selección.
- **Movimiento:** intensidad baja. Respuestas cortas al foco, hover, selección y apertura/cierre, sin efectos decorativos continuos ni animaciones que retrasen la evaluación.
- **Responsive:** móvil primero; navegación horizontal alcanzable, acciones con objetivos táctiles suficientes, filtros reacomodados y tablas que conservan sus columnas en contenedores propios.

### Controles de dirección

- `DESIGN_VARIANCE: 4` — retícula estable con cambios de proporción moderados entre encabezados, filtros y contenido; no se altera el orden para teclado o lector de pantalla.
- `MOTION_INTENSITY: 2` — transiciones discretas y feedback inmediato; la información se muestra completa sin necesitar movimiento.
- `VISUAL_DENSITY: 5` — densidad media para uso frecuente, agrupación clara y controles legibles.

Estos valores reflejan la recomendación de diseño para una herramienta existente. La persona usuaria delegó las decisiones de composición y adaptación en la solicitud del rediseño.

### Contrato observable

| Requisito | Resultado visible | Comprobación |
|---|---|---|
| Mantener funciones e información | Navegación, formularios, votación, rankings, estadísticas, historial, backups y recuperación siguen disponibles. | Suite existente y recorrido de flujos afectados. |
| Adoptar Tinta + Volt | Fondos cálidos de tinta/papel, superficies tonales y un solo tratamiento primario por tema. | Inspección en claro y oscuro. |
| Hacer más legible el catálogo | Cada perfil mantiene su retrato, identidad, grupo, categorías, tags, género y acciones. | Inspección del catálogo con datos reales y responsive. |
| Mejorar pantallas de análisis | Puntuaciones tabulares, jerarquía de títulos y distinción de estados con etiquetas explícitas. | Recorrido por resultados, temporada y Hall of Fame. |
| Adaptar a móvil | Ninguna pantalla pierde controles; las zonas tabulares desplazan internamente si es necesario. | Viewports de 320, 390, 768, 1024 y 1440 px y límites de breakpoints. |

### Decisiones de adaptación

El sistema de diseño de referencia describe sitios de varios tipos. Para Stats se aplica el perfil de panel estadístico, no el de landing: no se añade un hero promocional ni se oculta información bajo interacciones exploratorias. Se conserva la navegación por pestañas que ya existe. Las categorías de género y evaluación mantienen sus nombres; su tratamiento cromático se reduce a marcadores semánticos y Volt se reserva para acción y selección. Los retratos muestran cultura fan real del catálogo en vez de recursos decorativos.
