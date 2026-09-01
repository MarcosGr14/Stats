# Stats V2

Aplicación local-first para organizar y, en fases posteriores, evaluar performers K-pop a lo largo de una temporada. Mantiene HTML, CSS y JavaScript Vanilla, sin backend, framework ni dependencias de ejecución.

## Estado actual

Está implementada **Fase 4 - Weekly Voting** sobre Participant Manager, Tag System y Rankings:

- alta y edición de participantes;
- grupos reutilizables, con creación rápida desde el formulario;
- género `male`/`female` independiente de las categorías;
- categorías múltiples: `vocal`, `rap`, `dance`, `stage`, `visual` y `all-rounder`;
- foto opcional en IndexedDB, con fallback visual;
- catálogo reutilizable de 84 tags predefinidos, organizado por disciplina y tipo;
- tags personalizados globales con reutilización case-insensitive, edición y borrado protegidos;
- asignación many-to-many entre participantes y tags, con remoción no destructiva;
- búsqueda por nombre o grupo, filtros por género/estado/categoría/tag y orden A-Z/recientes;
- vista Rankings para `vocal`, `rap`, `dance`, `stage`, `visual` y `all-rounder`;
- directorios derivados con filtros por género, grupo/solista, tag, búsqueda y archivados opcionales;
- modo `Unranked` explícito: no asigna posiciones ni activa el Top 3 sin un score legítimo;
- arquitectura preparada para un futuro `scoreProvider(participant, category)`;
- acceso desde cada fila del ranking al participante correspondiente;
- creación explícita de la semana ISO actual, lunes-domingo en `America/Panama`;
- una sola semana `OPEN`, cierre confirmado y semanas `CLOSED` de solo lectura;
- votación semanal independiente para los usuarios permanentes `p1` y `p2`;
- ratings Standout (3), Impressed (2), Good (1) y Normal (0), separados de Not evaluated;
- máximo de 5 Standouts por usuario y semana;
- hasta 3 reason tags por voto y nota opcional de hasta 500 caracteres;
- Weekly Points, votes/voters count, standout count, provisional y diferencia de ratings derivados;
- orden semanal por puntos, votos y Standouts con empates de competición `1, 1, 3`;
- filtros semanales por categoría, género, grupo, búsqueda y estado de evaluación;
- `createWeeklyPointsProvider()` preparado, sin conectarlo todavía a Rankings;
- archivado y restauración;
- borrado permanente solo cuando no existe historial relacionado;
- UI responsive y accesible con formularios y diálogos navegables por teclado.

No se han implementado Weekly Spotlight, Overall Score, perfiles completos, analytics ni fórmulas de temporada. Esas funciones pertenecen a fases posteriores.

## Ejecución

No hay build step. Se puede abrir `index.html` directamente o servir la carpeta con un servidor estático:

```bash
python -m http.server 4173
```

## Estructura

```text
Stats/
├── index.html
├── css/
│   ├── global.css
│   ├── components.css
│   ├── app.css
│   └── weekly.css
├── js/
│   ├── constants.js
│   ├── data.js
│   ├── storage.js
│   ├── weekly-migration.js
│   ├── weekly.js
│   ├── weekly-view.js
│   ├── participants.js
│   ├── tags.js
│   ├── rankings.js
│   ├── image-storage.js
│   └── app.js
├── docs/
│   └── screenshots/
├── tests/
│   ├── foundation.test.cjs
│   ├── participants.test.cjs
│   ├── tags.test.cjs
│   ├── rankings.test.cjs
│   ├── weekly.test.cjs
│   ├── weekly-migration.test.cjs
│   ├── weekly-ui-contract.test.cjs
│   └── image-storage.test.cjs
└── README.md
```

Los módulos comparten el namespace global `StatsV2` para conservar compatibilidad con un sitio estático y con la apertura mediante `file://`.

## Modelo de participante

```js
{
  id,
  name,
  groupId,
  gender,
  imageId,
  categoryIds: [],
  archivedAt,
  createdAt,
  updatedAt
}
```

Cada persona existe una sola vez y puede tener varias categorías. Los grupos son entidades separadas; el género funciona como filtro y queda listo para los ganadores masculino/femenino de una fase posterior.

## Modelo de tags

Los tags son entidades globales independientes y las asignaciones son relaciones normalizadas:

```js
// Tag
{ id, name, categoryId, type, predefined, isCustom, createdAt, updatedAt }

// Relación participante-tag
{ id, participantId, tagId, assignedAt, removedAt }
```

Las categorías del catálogo son `vocal`, `rap`, `dance`, `stage` y `general`; los tipos son `strength`, `weakness` y `neutral`. Un tag global se puede reutilizar en varios participantes y removerlo de una persona no borra el catálogo ni las demás asignaciones.

Los reason tags semanales reutilizan el catálogo, pero viven únicamente en `weeklyVote.reasonTagIds`. Nunca crean ni modifican una relación en `participantTagAssignments`. Un tag usado como razón histórica queda protegido frente a edición o borrado global.

## Weekly Voting

```js
// Week
{
  id: "2026-W36",
  label: "W36",
  startDate: "2026-08-31",
  endDate: "2026-09-06",
  status: "OPEN", // OPEN | CLOSED
  openedAt,
  closedAt,
  createdAt,
  updatedAt
}

// Weekly vote
{
  id,
  weekId,
  participantId,
  userId, // p1 | p2
  rating, // standout | impressed | good | normal
  reasonTagIds: [],
  note,
  createdAt,
  updatedAt
}
```

Existe como máximo un voto por `weekId + participantId + userId`. `Not evaluated` es ausencia de registro; `Normal` sí crea un voto con 0 puntos. Mientras la semana está `OPEN`, el voto puede crearse, editarse o removerse. Al cerrar, `closedAt` congela el historial y la UI queda en modo lectura. No hay reapertura en Fase 4.

Los agregados no se persisten. Para cada participante se derivan `weeklyPoints`, `votesCount`, `votersCount`, `standoutCount`, estado provisional y diferencia entre ratings. El orden semanal usa puntos DESC, votos DESC y Standouts DESC; si todo coincide, conserva un empate real y asigna ranking de competición. El orden alfabético solo estabiliza la presentación del empate.

## Rankings y modo Unranked

Weekly Voting ya produce puntos semanales legítimos y expone `createWeeklyPointsProvider(state, weekId)`. Durante Fase 4 ese proveedor no se conecta a Rankings: la fórmula de temporada, la política de semanas y Weekly Spotlight aún no están definidas. Por eso la vista Rankings conserva explícitamente `Unranked` y el Top 3 bloqueado.

`rankings.js` deriva una vista nueva a partir de `participants`, `groups`, `tags` y asignaciones activas. No agrega `rankPosition` al participante ni guarda una colección `rankings`. Sin `scoreProvider`, el resultado queda `ranked: false`, el Top 3 permanece bloqueado y el directorio usa únicamente A-Z o Recently Added. Un proveedor futuro con scores finitos puede activar posiciones sin reescribir la UI.

## Persistencia

| Uso | Nombre exacto |
| --- | --- |
| Estado y metadata en `localStorage` | `stats:v2:state` |
| Backup exacto previo a la migración de tags | `stats:v2:state:pre-tags-backup` |
| Backup exacto previo a Weekly Voting | `stats:v2:state:pre-weekly-voting-backup` |
| Base IndexedDB | `stats-v2` |
| Object store de imágenes | `images` |

Las fotos admiten JPEG, PNG o WebP de hasta 5 MB. El blob se guarda en IndexedDB y `localStorage` conserva únicamente su `imageId`. Si la imagen no existe o IndexedDB falla, la tarjeta muestra las iniciales como fallback.

La migración Fase 3 -> Fase 4 clona el estado, conserva participantes, grupos, tags, asignaciones, IDs e `imageId`, añade solo el modelo semanal faltante y convierte de forma compatible los campos semanales heredados. Valida referencias y unicidad antes de persistir. El primer guardado conserva el JSON anterior exacto en `stats:v2:state:pre-weekly-voting-backup`; no crea backups infinitos. Si la copia, validación o escritura falla, el estado principal original no se reemplaza. La migración no abre ni modifica IndexedDB.

Abrir, filtrar u ordenar Rankings es una operación de solo lectura: no llama al helper de guardado, no modifica participantes y no toca IndexedDB.

## Archivado y borrado

- Archivar conserva identidad, categorías, foto y referencias históricas.
- Restaurar vuelve a mostrar el participante en el roster activo.
- El borrado permanente se permite solo cuando no existen votos ni asignaciones históricas de tags.
- Si hay historial, la UI ofrece archivar en lugar de destruir el registro.

## Seguridad y accesibilidad

- Los datos editables se insertan con `textContent` y creación segura de nodos; no se usa `innerHTML`.
- Hay enlace de salto, landmarks, labels, estados de error, foco visible y diálogos nativos.
- El layout fue revisado en 320, 375, 768 y 1440 px, sin overflow horizontal.
- Los controles no dependen solo de hover o color y se respeta `prefers-reduced-motion`.
- No se cargan fuentes, scripts ni estilos de terceros.

## Pruebas

Requiere Node.js 20 o superior y no instala paquetes:

```bash
node --test tests/*.test.cjs
```

Las pruebas usan `localStorage` e IndexedDB simulados; no tocan el almacenamiento real del navegador. Las 81 pruebas cubren modelo, validación, duplicados, grupos, edición, filtros, archivo/restauración, tags, protección referencial, migración y backup exacto, semanas ISO, cierre, unicidad de voto, P1/P2, Standout limit, reason tags, notas, métricas, desempates, UI contractual, Rankings Unranked y errores de imágenes.

También se realizó un smoke test en un origen local aislado con roster ficticio: apertura explícita de W36, voto/edición/remoción, reason tags, nota, límite 5 y rechazo del sexto Standout, contadores P1/P2 independientes, Weekly Points combinados, Normal vs Not evaluated, filtros, persistencia tras recarga y cierre inmutable. El layout fue revisado en 320, 375, 768 y 1440 px sin overflow horizontal; el modal móvil se verificó a 320 px y no hubo errores de consola.

## Riesgos y decisiones pendientes

- P1/P2 son identidades locales con el mismo peso, no autenticación; un dispositivo compartido depende de que el usuario confirme el selector visible.
- `localStorage` no ofrece transacciones entre pestañas; ediciones simultáneas pueden producir last-write-wins.
- El crecimiento de votos y notas está sujeto a la cuota de `localStorage`; las fotos continúan separadas en IndexedDB.
- Las semanas cerradas no pueden reabrirse en Fase 4. Una futura reapertura administrativa debe ser explícita y auditable.
- El Top 3 y las posiciones quedan deliberadamente bloqueados hasta que una fase posterior defina qué semana/política consume Rankings.
- La limpieza de blobs huérfanos se hace de forma oportunista; una herramienta integral de mantenimiento/backup pertenece a la Fase 9.
- Navegadores sin IndexedDB mantienen el participant manager, pero usan el fallback visual y no pueden guardar fotos.
- La fórmula de `overallScore`, Male Performer of the Year y Female Performer of the Year requiere aprobación explícita antes de implementarse.

## Límite de fase

La Fase 4 termina en Weekly Voting y su proveedor de puntos preparado. No se implementan Weekly Spotlight, Overall Score, standings de temporada, ganadores ni Analytics; el proyecto queda detenido antes de Fase 5.
