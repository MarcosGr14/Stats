# Stats V2

Aplicación local-first para organizar y, en fases posteriores, evaluar performers K-pop a lo largo de una temporada. Mantiene HTML, CSS y JavaScript Vanilla, sin backend, framework ni dependencias de ejecución.

## Estado actual

Está implementada **Fase 3 - Rankings** sobre el Participant Manager y el Tag System:

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
- archivado y restauración;
- borrado permanente solo cuando no existe historial relacionado;
- UI responsive y accesible con formularios y diálogos navegables por teclado.

No se han implementado Weekly Voting, perfiles completos, analytics ni fórmulas de ganadores. Esas funciones pertenecen a fases posteriores.

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
│   └── app.css
├── js/
│   ├── constants.js
│   ├── data.js
│   ├── storage.js
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

## Rankings y modo Unranked

Actualmente no existe un score de performance válido por categoría. `RATING_OPTIONS` describe opciones futuras, pero no hay Weekly Voting cerrado ni resultados que permitan calcular posiciones. Por eso la Fase 3 no usa tags, fortalezas, género, cantidad de categorías o fechas como puntuación.

`rankings.js` deriva una vista nueva a partir de `participants`, `groups`, `tags` y asignaciones activas. No agrega `rankPosition` al participante ni guarda una colección `rankings`. Sin `scoreProvider`, el resultado queda `ranked: false`, el Top 3 permanece bloqueado y el directorio usa únicamente A-Z o Recently Added. Un proveedor futuro con scores finitos puede activar posiciones sin reescribir la UI.

## Persistencia

| Uso | Nombre exacto |
| --- | --- |
| Estado y metadata en `localStorage` | `stats:v2:state` |
| Backup exacto previo a la migración de tags | `stats:v2:state:pre-tags-backup` |
| Base IndexedDB | `stats-v2` |
| Object store de imágenes | `images` |

Las fotos admiten JPEG, PNG o WebP de hasta 5 MB. El blob se guarda en IndexedDB y `localStorage` conserva únicamente su `imageId`. Si la imagen no existe o IndexedDB falla, la tarjeta muestra las iniciales como fallback.

Al primer arranque de la Fase 2, la app valida el estado existente, crea una copia en memoria, agrega el catálogo de tags y valida el resultado antes de persistirlo. Antes de guardar la migración conserva el JSON original exacto en `stats:v2:state:pre-tags-backup`. Si una validación o escritura falla, el valor principal original no se sobrescribe. La inicialización de Fase 2 no repite limpiezas legacy ni enumera o elimina otras claves.

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

Las pruebas usan `localStorage` e IndexedDB simulados; no tocan el almacenamiento real del navegador. Cubren modelo, validación, duplicados, grupos, edición, filtros, orden, archivo/restauración, catálogo, tags personalizados, asignación/remoción, protección referencial, migración aditiva, backup exacto, persistencia, rankings derivados y errores de imágenes.

También se realizó un smoke test en un origen local aislado para recorrer las seis categorías, combinar filtros, buscar, incluir archivados, abrir un participante y comprobar persistencia visible tras recarga. El layout fue revisado en 320, 375, 768 y 1440 px.

## Riesgos y decisiones pendientes

- Las relaciones conservan `assignedAt` y `removedAt` para no impedir un historial futuro, pero la auditoría completa pertenece a una fase posterior.
- El Top 3 y las posiciones quedan deliberadamente bloqueados hasta que Weekly Voting aporte un score válido por categoría.
- La limpieza de blobs huérfanos se hace de forma oportunista; una herramienta integral de mantenimiento/backup pertenece a la Fase 9.
- Navegadores sin IndexedDB mantienen el participant manager, pero usan el fallback visual y no pueden guardar fotos.
- La fórmula de `overallScore`, Male Performer of the Year y Female Performer of the Year requiere aprobación explícita antes de implementarse.

## Límite de fase

La Fase 4 (Weekly Voting) no debe comenzar automáticamente. Este repositorio queda detenido al terminar y verificar la Fase 3.
