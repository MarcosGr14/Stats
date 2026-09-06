# Stats V2

Aplicación local-first para organizar y, en fases posteriores, evaluar performers K-pop a lo largo de una temporada. Mantiene HTML, CSS y JavaScript Vanilla, sin backend, framework ni dependencias de ejecución.

## Estado actual

Está implementada **Fase 8.5 - Product Cleanup** sobre Participant Manager, Tag System, Category-specific Voting, Weekly Spotlight, Profiles & History, Analytics y Season Standings:

- alta y edición de participantes;
- grupos reutilizables, con creación rápida desde el formulario;
- género `male`/`female` independiente de las categorías;
- categorías múltiples: `vocal`, `rap`, `dance`, `stage`, `visual` y `all-rounder`;
- foto opcional en IndexedDB, con fallback visual;
- catálogo reutilizable de 84 tags predefinidos, organizado por disciplina y tipo;
- tags personalizados globales con reutilización case-insensitive, edición y borrado protegidos;
- asignación many-to-many entre participantes y tags, con remoción no destructiva;
- búsqueda por nombre o grupo, filtros por género/estado/categoría/tag y orden A-Z/recientes;
- Rankings concentra la clasificación acumulada por categoría y género, con Top 3, tabla completa y provisionales;
- Temporada concentra exclusivamente premios generales y ganadores por categoría;
- Participantes conserva toda la gestión, búsqueda, filtros y archivados, sin duplicar esas funciones en Rankings;
- perfiles y tags continúan como flujos contextuales, fuera de la navegación principal;
- seis destinos principales estables: Participantes, Votación, Destacados, Rankings, Estadísticas y Temporada;
- creación explícita de la semana ISO actual, lunes-domingo en `America/Panama`;
- una sola semana `OPEN`, cierre confirmado y reapertura administrativa explícita de semanas `CLOSED`;
- votación semanal independiente por categoría para los usuarios permanentes `p1` y `p2`;
- ratings Standout (3), Impressed (2), Good (1) y Normal (0), separados de Not evaluated;
- máximo global de 5 Standouts por usuario y semana, sin reiniciarlo por categoría;
- hasta 3 reason tags por voto y nota opcional de hasta 500 caracteres;
- Weekly Points, votes/voters count, standout count, provisional y diferencia de ratings derivados por categoría;
- orden semanal por puntos, votos y Standouts con empates de competición `1, 1, 3`;
- filtros semanales por categoría, género, grupo, búsqueda y estado de evaluación;
- `createWeeklyPointsProvider()` se conserva como API de compatibilidad para resultados semanales;
- Weekly Spotlight derivado por `weekId + categoryId + gender`, con resultados Female/Male separados;
- Top 3 real, ganadores simples o conjuntos y ranking completo de competición `1, 1, 3`;
- estados `LIVE PREVIEW` para semanas abiertas y `OFFICIAL RESULTS` para semanas cerradas;
- recap de seis categorías y ambos géneros, badges editoriales y motivos semanales destacados;
- perfiles completos derivados desde la identidad y el historial existentes, sin crear una entidad `profile`;
- resumen por participante con semanas evaluadas únicas, victorias, Top 3, mejores semanas y motivo más citado;
- récords y tendencias independientes por categoría, incluyendo huecos explícitos para `Not evaluated`;
- historial semanal filtrable y ordenable con posición, puntos, votantes, Standouts, badges y motivos;
- navegación al perfil desde Manager, Rankings, Weekly, Spotlight y Recap, con estado por URL;
- participantes archivados con perfil, foto e historial íntegros y en modo de solo lectura histórica;
- capa `analytics.js` pura, explicable y de solo lectura, sin colecciones derivadas persistidas;
- métricas de victorias, Top 3, Standouts, Duo Standouts, Solo Picks y Split Decisions por categoría y género;
- consistencia, mejora, promedios de score/posición, acuerdo y controversia con muestras mínimas explícitas;
- Weekly Praise, profile tags, P1/P2, distribución de ratings, actividad semanal y agregados descriptivos;
- alcance oficial `CLOSED` por defecto, con `includeOpen` explícito para análisis live y filtros temporales;
- vista Estadísticas con filtros globales por periodo, categoría, género y grupo;
- secciones Resumen, Rendimiento, P1 vs P2, Habilidades y Actividad;
- tabla ordenable por métricas individuales, sin score compuesto ni desempate alfabético competitivo;
- gráficos CSS de actividad con equivalente textual accesible y estados explícitos de datos insuficientes;
- reason tags semanales y tags permanentes del perfil presentados en bloques independientes;
- 12 clasificaciones de temporada independientes: seis categorías por dos géneros;
- Season Score explicable `40/25/20/15`, con cinco semanas evaluadas como mínimo y provisionales separados;
- ganadores por categoría, incluyendo empates conjuntos exactos, sin desempates ocultos;
- Grand Winners Female y Male mediante el 95% de la mejor categoría y el 5% de la segunda elegible;
- vista oficial basada en semanas `CLOSED` y preview `LIVE / PROVISIONAL` opcional para incluir `OPEN`;
- resumen de ganadores, podios, tablas completas y desglose accesible de cada puntuación;
- archivado y restauración;
- borrado permanente solo cuando no existe historial relacionado;
- UI responsive y accesible con formularios y diálogos navegables por teclado.

No se han implementado `overallScore`, Best Group, Most Competitive Week, administración de múltiples temporadas ni ninguna función de Fase 9. La vista inicial sigue siendo Participantes.

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
│   ├── weekly.css
│   ├── spotlight.css
│   ├── profile.css
│   ├── analytics.css
│   └── season.css
├── js/
│   ├── constants.js
│   ├── ui.js
│   ├── data.js
│   ├── storage.js
│   ├── weekly-migration.js
│   ├── weekly.js
│   ├── weekly-view.js
│   ├── spotlight.js
│   ├── spotlight-view.js
│   ├── profile-history.js
│   ├── profile-view.js
│   ├── analytics.js
│   ├── analytics-view.js
│   ├── season.js
│   ├── season-view.js
│   ├── participants.js
│   ├── tags.js
│   ├── image-storage.js
│   └── app.js
├── docs/
│   └── screenshots/
├── tests/
│   ├── foundation.test.cjs
│   ├── participants.test.cjs
│   ├── tags.test.cjs
│   ├── ui.test.cjs
│   ├── product-cleanup.test.cjs
│   ├── weekly.test.cjs
│   ├── weekly-migration.test.cjs
│   ├── category-voting-migration.test.cjs
│   ├── weekly-ui-contract.test.cjs
│   ├── spotlight.test.cjs
│   ├── spotlight-ui-contract.test.cjs
│   ├── profile-history.test.cjs
│   ├── profile-ui-contract.test.cjs
│   ├── analytics.test.cjs
│   ├── analytics-view.test.cjs
│   ├── analytics-ui-contract.test.cjs
│   ├── season.test.cjs
│   ├── season-ui-contract.test.cjs
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
  reopenedAt,
  reopenCount,
  createdAt,
  updatedAt
}

// Weekly vote
{
  id,
  weekId,
  participantId,
  categoryId,
  userId, // p1 | p2
  rating, // standout | impressed | good | normal
  reasonTagIds: [],
  note,
  createdAt,
  updatedAt
}
```

Existe como máximo un voto por `weekId + participantId + categoryId + userId`. `categoryId` debe existir y estar asignada al participante. `Not evaluated` es ausencia de registro en esa categoría; `Normal` sí crea un voto con 0 puntos. Rating, reason tags y nota pertenecen únicamente a ese voto categorizado.

Mientras la semana está `OPEN`, cada voto categorizado puede crearse, editarse o removerse. Al cerrar, `closedAt` congela el historial y la UI queda en modo lectura. `Reopen Week` requiere confirmación explícita, se rechaza si otra semana está abierta y registra `reopenedAt` y `reopenCount` sin borrar el `closedAt` anterior. La semana puede cerrarse de nuevo y actualiza `closedAt`.

Los agregados no se persisten. Para cada `weekId + participantId + categoryId` se derivan `weeklyPoints`, `votesCount`, `votersCount`, `standoutCount`, estado provisional y diferencia entre ratings. El orden semanal usa puntos DESC, voters count DESC y Standouts DESC; si todo coincide, conserva un empate real y asigna ranking de competición. El orden alfabético solo estabiliza la presentación del empate. No existe una suma Overall entre categorías.

## Rankings acumulados

Rankings muestra las clasificaciones de temporada ya definidas por `season.js`: seis categorías independientes, cada una separada entre mujeres y hombres. Incluye Top 3, clasificación completa, provisionales y desglose auditable. Por defecto utiliza solo semanas `CLOSED`; incluir la semana abierta es una vista previa explícita y provisional.

La gestión de participantes permanece en Participantes. Se eliminó el antiguo directorio duplicado `Unranked`, su módulo específico y sus filtros redundantes. Rankings sigue siendo de solo lectura: no agrega posiciones a participantes, no crea una colección persistente y no reimplementa las fórmulas de temporada.

## Weekly Spotlight

`spotlight.js` deriva cada resultado de una selección exacta `weekId + categoryId + gender`. Solo entran participantes con al menos un voto categorizado: `Normal` aparece con 0 puntos y `Not evaluated` queda fuera. El orden usa `weeklyPoints DESC`, `votersCount DESC` y `standoutCount DESC`; si las tres métricas coinciden, conserva el empate real. El nombre se usa únicamente para estabilidad visual.

El resultado incluye Top 3, ranking completo, todos los ganadores de la posición 1, motivos semanales principales, `Most Praised Skill` y los badges `Duo Standout`, `Duo Approved`, `Solo Pick` y `Split Decision`. Una semana `OPEN` se presenta como `LIVE PREVIEW`; una `CLOSED`, como `OFFICIAL RESULTS`; una reapertura vuelve inmediatamente a LIVE. El recap muestra Female y Male en las seis categorías, sin sumar disciplinas ni crear un ganador overall.

Todo es de solo lectura. No existen colecciones `weeklyRankings` o `weeklyWinners`, ni campos persistidos de posición o ganador. `deriveParticipantHistory()` prepara consultas futuras de victorias, Top 3, posiciones y mejor semana a partir del historial existente, pero no implementa standings de temporada.

## Profiles & History

`profile-history.js` deriva el dossier completo de un participante desde `participants`, `groups`, asignaciones activas de tags, `weeks` y `weeklyVotes`. No persiste una colección de perfiles, estadísticas, tendencias ni historial. Para cada semana y categoría reutiliza el mismo ranking de competición de Weekly Spotlight, con el mismo orden por puntos, votantes y Standouts y los mismos empates reales.

El resumen general cuenta semanas evaluadas únicas, aunque una persona tenga votos en varias categorías durante la misma semana. Las victorias conjuntas cuentan como una victoria completa y las apariciones Top 3 conservan la posición de competición. Los récords permanecen separados por categoría: victorias, Top 3, mejor puntuación, mejores semanas empatadas por las tres métricas, semanas evaluadas y motivo más citado. No existe un score combinado ni una “Best Category”.

El historial distingue `Normal` de `Not evaluated`: un voto Normal aparece con 0 puntos; la ausencia de voto queda fuera del historial y como hueco accesible en la tendencia. Los tags permanentes provienen únicamente de `participantTagAssignments`; los motivos semanales se leen de `weeklyVote.reasonTagIds` y nunca modifican el perfil. Los participantes archivados conservan identidad, imagen, tags e historial, pero siguen excluidos de votos nuevos.

`profile-view.js` presenta Summary, Profile Tags, Category Records, Performance Trend, Weekly Praise, Wins y Weekly History. El historial se filtra por categoría y se ordena de más reciente a más antiguo o al revés. Participantes, Rankings, Weekly, Spotlight y Recap enlazan al mismo perfil mediante `participant` en el hash; Back restaura la vista interna cuando existe y vuelve a Participantes al entrar por URL directa. Edit Participant y Manage Tags reutilizan los diálogos existentes.

## Core Analytics

`analytics.js` es una capa de funciones puras sobre el estado existente. Reutiliza `weekly.js` para scores y desempates y `spotlight.js` para posiciones, ganadores y badges; no copia esas fórmulas ni persiste resultados. Las métricas de performance siempre se agrupan independientemente por `categoryId + gender`, de modo que competir en más categorías no produce una ventaja global. El nombre solo estabiliza la presentación después de asignar empates reales.

Métricas disponibles y fórmulas:

- **Most Weekly Wins:** cuenta resultados con rank 1; cada joint winner recibe una victoria completa.
- **Most Top 3 Appearances:** cuenta ranks de competición 1, 2 o 3; en `1, 1, 3` las tres apariciones cuentan.
- **Most Standouts:** cuenta votos individuales `rating === standout`; `weeksWithStandout` se conserva como metadata separada.
- **Duo Standouts / Solo Picks / Split Decisions:** cuentan eventos semanales usando los badges oficiales de Spotlight. Duo es P1+P2 Standout; Solo requiere un único voto mayor que Normal; Split conserva la definición existente de diferencia 3.
- **Most Controversial:** promedio de `abs(P1 score - P2 score)` usando únicamente semanas con ambos votos. **Biggest Disagreement** devuelve todos los eventos empatados con la mayor diferencia.
- **Highest Agreement:** el menor promedio de diferencia con al menos 3 semanas de doble voto.
- **Most Consistent:** desviación estándar poblacional de `weeklyPoints` en semanas evaluadas. Requiere 3 semanas; empata primero por menor desviación, después por más semanas y luego por mayor promedio. Si todo coincide, conserva empate real.
- **Most Improved:** pendiente de regresión lineal ordinaria de `weeklyPoints` frente a la posición cronológica de la semana. Requiere 3 evaluaciones y slope positivo; los gaps conservan distancia temporal, `Normal` aporta 0 y `Not evaluated` no aporta score.
- **Best Average Weekly Score:** media aritmética de Weekly Points con al menos 3 semanas evaluadas.
- **Best Average Placement:** media de ranks de competición con al menos 3 apariciones.
- **Most Praised Skill:** menciones en `weeklyVotes.reasonTagIds`, globales o filtradas. No existe una segunda métrica duplicada llamada Most Used Reason Tag.
- **Profile Tag Analytics:** conteo independiente de asignaciones activas `strength`, `weakness` y `neutral` (Special); excluye relaciones removidas y Weekly Praise.
- **P1/P2 Analytics:** total de votos, rating promedio, Standouts dados, razones más usadas, participantes más evaluados y distribución Standout/Impressed/Good/Normal por usuario.
- **Weekly Activity / Most Active Week:** votos, participantes, categorías, Standouts y reason tags por semana; mide actividad, no calidad, y conserva empates.
- **Category Analytics:** votos, participantes evaluados, score semanal promedio, Standouts, skill más elogiada y participantes con más victorias por categoría/género.
- **Group Analytics:** participantes evaluados, victorias, Top 3 y Standouts descriptivos por grupo/categoría/género; no asigna Best Group.

Todas las respuestas incluyen scope, valor, tamaño de muestra y metadata explicativa cuando corresponde. Las métricas estadísticas devuelven `insufficientData: true` si no alcanzan su umbral. Se soportan filtros lógicos `categoryId`, `gender`, `groupId`, `participantId`, `userId` donde aplica, `fromWeekId`, `toWeekId` y `lastNWeeks`. Por defecto solo entran semanas `CLOSED`; `includeOpen: true` incorpora explícitamente `OPEN + CLOSED` para análisis live.

Quedan deliberadamente fuera de Analytics `Most Competitive Week`, `overallScore` y Best Group. Season Score, standings y Grand Winners pertenecen a `season.js`; `analytics-view.js` no duplica ni altera sus fórmulas.

## Analytics UI

La vista `#analytics` aplica un único alcance global por periodo, categoría, género y grupo. Mantiene resultados oficiales `CLOSED` por defecto; el control “Incluir resultados en vivo” incorpora `OPEN` de forma explícita y visible. Las opciones temporales son todo el historial o las últimas 4, 8 y 12 semanas del alcance oficial/live elegido.

Resumen muestra victorias, Top 3, Standouts, mejora, consistencia y habilidad más elogiada. Rendimiento conserva una fila independiente por participante, categoría y género, y permite ordenar por una métrica a la vez. P1 vs P2 muestra acuerdos, desacuerdos, Duo Standouts, Solo Picks, Split Decisions y distribuciones de rating. Habilidades separa estrictamente `reasonTagIds` de las asignaciones activas del perfil. Actividad presenta votos, participantes, Standouts y motivos por semana, la semana más activa y agregados descriptivos por categoría; nunca asigna Best Group.

Los gráficos se construyen con CSS, conservan valores visibles y exponen un resumen textual mediante `aria-label` y texto en pantalla. Las pestañas admiten flechas, Home y End. Cuando el filtro no define una comparación válida o una muestra no alcanza el mínimo estadístico, la UI explica “Elige categoría y género” o “Datos insuficientes” en vez de inventar un ganador.

La vista no persiste resultados ni crea una caché. Cada cambio de alcance vuelve a derivar los datos desde el estado autoritativo y muestra el costo medido de esa derivación. Cambiar únicamente la métrica del gráfico recalcula solo la actividad semanal.

## Season Standings y Grand Winners

`season.js` deriva las 12 clasificaciones posibles (`categoryId + gender`) desde el historial actual. Por defecto usa únicamente semanas `CLOSED`; el control explícito de preview incorpora `OPEN` y marca todo el resultado como `LIVE / PROVISIONAL`. Esta fase considera todo el historial cerrado como la temporada vigente y no crea todavía entidades ni controles para múltiples temporadas.

El Season Score se calcula con precisión completa y se muestra con un decimal:

- 40% rendimiento promedio: `(averageWeeklyPoints / 6) * 100`;
- 25% tasa de victorias: `wins / weeksEvaluated * 100`;
- 20% tasa de Top 3: `topThreeAppearances / weeksEvaluated * 100`;
- 15% tasa de Standouts: `standoutVotes / (weeksEvaluated * 2) * 100`.

`Normal` cuenta como semana evaluada con cero puntos y `Not evaluated` es ausencia de registro. Se requieren cinco semanas evaluadas dentro de la misma categoría; con cuatro o menos el resultado queda en Provisionales y no puede ganar. Las posiciones oficiales ordenan solo por Season Score exacto y usan ranking de competición (`1, 1, 3`). El nombre se usa después únicamente para estabilidad visual.

El Grand Score se calcula por género con categorías ya elegibles: 95% de la mejor categoría y 5% de la segunda. Cuando solo existe una categoría elegible se usa su puntuación completa, sin penalización. Categorías adicionales no aportan ventaja y los empates exactos producen ganadores conjuntos. `season-view.js` comparte un único controlador: Rankings presenta podios, standings elegibles y provisionales; Temporada presenta los ganadores de las 12 clasificaciones y Grand Winners Female/Male. Ambos reutilizan el mismo desglose y las fórmulas no viven en `app.js`.

## Auditoría y rendimiento de Fase 8.5

La auditoría clasificó Participantes, Votación, Destacados, Perfiles y Analytics como capacidades a mantener; Rankings y las clasificaciones internas de Temporada como vistas a fusionar/reubicar; el directorio `Unranked`, sus handlers y CSS como elementos a eliminar; y los helpers DOM, labels, iniciales y formato numérico como utilidades a reutilizar. Perfiles y Tags permanecen contextuales. No se detectaron defectos P0 ni fue necesario cambiar reglas de negocio.

Se eliminó el principal cuello de botella comprobado: cada pantalla recorría repetidamente todos los votos para reconstruir el mismo ranking. Ahora una derivación crea índices efímeros por selección y reutiliza métricas dentro de la misma operación. No existe caché persistente ni una segunda fuente de verdad.

Benchmark sintético, mediana de cinco ejecuciones con 100 participantes, 52 semanas y 20,800 votos:

| Derivación | Antes | Después |
| --- | ---: | ---: |
| Spotlight | 142.0 ms | 15.9 ms |
| Perfil | 8276.9 ms | 191.6 ms |
| Dashboard de Analytics | 21061.0 ms | 104.5 ms |
| Clasificaciones de temporada | 8738.0 ms | 413.3 ms |
| Ganadores generales | 8716.2 ms | 406.8 ms |

El benchmark usa estado enteramente sintético en memoria y no accede al almacenamiento real del navegador.

## Persistencia

| Uso | Nombre exacto |
| --- | --- |
| Estado y metadata en `localStorage` | `stats:v2:state` |
| Backup exacto previo a la migración de tags | `stats:v2:state:pre-tags-backup` |
| Backup exacto previo a Weekly Voting | `stats:v2:state:pre-weekly-voting-backup` |
| Backup exacto previo a votos por categoría | `stats:v2:state:pre-category-voting-backup` |
| Base IndexedDB | `stats-v2` |
| Object store de imágenes | `images` |

Las fotos admiten JPEG, PNG o WebP de hasta 5 MB. El blob se guarda en IndexedDB y `localStorage` conserva únicamente su `imageId`. Si la imagen no existe o IndexedDB falla, la tarjeta muestra las iniciales como fallback.

La migración Fase 3 -> Fase 4 clona el estado, conserva participantes, grupos, tags, asignaciones, IDs e `imageId`, añade solo el modelo semanal faltante y convierte de forma compatible los campos semanales heredados. Valida referencias y unicidad antes de persistir. El primer guardado conserva el JSON anterior exacto en `stats:v2:state:pre-weekly-voting-backup`; no crea backups infinitos. Si la copia, validación o escritura falla, el estado principal original no se reemplaza. La migración no abre ni modifica IndexedDB.

La migración Fase 4 -> Fase 4.1 conserva el JSON exacto previo en `stats:v2:state:pre-category-voting-backup`, una sola vez. Un voto antiguo de un participante con exactamente una categoría recibe esa categoría de forma segura. Si el participante tiene varias, el voto mantiene ID, rating, razones, nota y timestamps, queda marcado `legacyUncategorized` y se muestra para conversión manual. Nunca se duplica ni se asigna arbitrariamente. IndexedDB no se abre ni se modifica.

Abrir, filtrar o cambiar categoría/género en Rankings es una operación de solo lectura: no llama al helper de guardado, no modifica participantes y solo consulta IndexedDB cuando necesita mostrar una foto ya referenciada.

Abrir o navegar Weekly Spotlight tampoco guarda estado. Fase 5 no requiere migración, backup adicional ni cambios de esquema porque consume exclusivamente `weeks`, `weeklyVotes`, participantes, grupos, tags e IDs ya existentes.

Abrir, filtrar u ordenar un perfil también es de solo lectura. Fase 6 no requiere migración, backup adicional ni cambios de esquema: la identidad, la foto y todo el historial se consultan desde las colecciones e IDs existentes. IndexedDB solo se lee para mostrar la imagen y nunca se usa para pruebas con datos reales.

Ejecutar Core Analytics tampoco escribe estado. Fase 7A no requiere migración, backup ni cambio de esquema porque deriva exclusivamente desde participantes, grupos, tags, asignaciones, semanas y votos existentes; no abre IndexedDB.

Abrir, filtrar u ordenar Analytics también es de solo lectura. Fase 7B no requiere migración, backup ni cambio de esquema: consume las derivaciones de Fase 7A, no guarda métricas y no abre IndexedDB ni carga imágenes.

Abrir Rankings o Temporada también es de solo lectura. Fase 8.5 no introduce esquema, migración ni backup porque reorganiza vistas y optimiza derivaciones desde las colecciones existentes; no persiste resultados ni índices. IndexedDB se consulta solo para mostrar fotos ya referenciadas; ninguna prueba usa los datos reales ni modifica imágenes.

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

Las pruebas usan `localStorage` e IndexedDB simulados; no tocan el almacenamiento real del navegador. Cubren modelo, validación, duplicados, grupos, edición, filtros, archivo/restauración, tags, protección referencial, ambas migraciones y backups exactos, semanas ISO, cierre/reapertura, unicidad categorizada, conversión legacy, P1/P2, límite global de Standouts, reason tags, notas, métricas por categoría, desempates, UI contractual, Rankings acumulados, Weekly Spotlight, perfiles, historial categorizado, tendencias, Analytics, las fórmulas y umbrales de Season Score, los 12 standings, empates conjuntos, Grand Score, Grand Winners, helpers compartidos, limpieza de producto y errores de imágenes.

También se realizó un smoke test en un origen local aislado con roster ficticio: Female Vocal A=6, B=5, C=4, D=0 y E sin voto. El Top 3 mostró A/B/C, el ranking completo incluyó D y excluyó E. El cierre cambió Spotlight a OFFICIAL; la reapertura volvió a LIVE y una edición de C a 5 produjo `1, 2, 2, 4`. También se comprobaron Male, otra categoría, recap, motivos, badges y acceso al participante. El layout fue revisado en 320, 375, 768 y 1440 px sin overflow horizontal ni errores de consola.

Para Fase 6 se ejecutó además un smoke aislado con un participante archivado y cinco resultados en Vocal/Stage. Se verificaron tres semanas únicas, tres victorias, cinco Top 3, mejores semanas empatadas, motivos y tags independientes, el hueco `Not evaluated`, orden histórico, navegación/Back, URL directa y los diálogos existentes. El perfil se revisó en 320, 375, 768 y 1440 px sin overflow horizontal ni errores de consola.

El smoke aislado de Fase 7A usa seis participantes ficticios, ambos géneros, Vocal/Stage, cinco semanas cerradas y una abierta. Verifica joint winners, gaps, Normals, Duo Standouts, Solo Picks, Split Decisions, razones, consistencia, mejora, promedios, acuerdo/controversia, P1/P2, filtros temporales, archivado y `CLOSED` frente a `includeOpen`, sin acceder al almacenamiento real.

Para Fase 7B se ejecutó además un smoke en un origen local desechable con seis participantes ficticios, seis semanas cerradas y una abierta. Se recorrieron las cinco secciones, filtros combinados, últimas 4 semanas, grupo, modo live, orden de la tabla, cambio de métrica del gráfico, estado sin mezcla y acceso al perfil. La UI se inspeccionó en 320, 375, 768 y 1440 px sin overflow de página; las pestañas usan scroll interno en móvil. No hubo errores ni warnings en consola.

Para Fase 8 se ejecutó un smoke en otro origen local desechable con nueve participantes ficticios, ambos géneros, seis semanas cerradas y una abierta, resultados `Normal`, provisionales, empates conjuntos y participantes elegibles en varias categorías. Se verificaron overview, los 12 ganadores potenciales, Grand Winners, podios, standings, provisionales, desgloses, navegación a perfil, teclado y preview live. La UI se inspeccionó en 320, 375, 768 y 1440 px sin overflow de página; tablas y diálogos se adaptaron a móvil y no hubo errores ni warnings de consola. El almacenamiento real permaneció fuera del origen de prueba.

Para Fase 8.5 se repitió una regresión en un origen aislado con datos sintéticos. Se recorrieron los seis destinos, Rankings acumulados, premios de Temporada, perfiles y los controles accesibles principales. Se comparó el JSON del estado antes y después de la navegación de solo lectura. La cobertura contractual valida las reglas responsive específicas para 320, 375, 768 y 1440 px. El origen y el servidor de prueba son desechables; no comparten `localStorage` ni IndexedDB con la app real.

## Riesgos y decisiones pendientes

- P1/P2 son identidades locales con el mismo peso, no autenticación; un dispositivo compartido depende de que el usuario confirme el selector visible.
- `localStorage` no ofrece transacciones entre pestañas; ediciones simultáneas pueden producir last-write-wins.
- El crecimiento de votos y notas está sujeto a la cuota de `localStorage`; las fotos continúan separadas en IndexedDB.
- La reapertura es una acción administrativa local sin autenticación; queda auditada con contador y último timestamp, no con identidad ni motivo.
- Rankings y Temporada recalculan desde la fuente autoritativa; los índices de cada derivación viven solo durante esa operación y un volumen muy superior al benchmark podría exigir nueva medición.
- En Fase 8 todo el historial `CLOSED` representa una única temporada vigente; separar temporadas históricas requiere una futura decisión explícita de modelo y migración.
- Una muestra mínima de 3 reduce resultados estadísticos engañosos, pero seguirá siendo una muestra pequeña y debe mostrarse junto a cada resultado.
- La limpieza de blobs huérfanos se hace de forma oportunista; una herramienta integral de mantenimiento/backup pertenece a la Fase 9.
- Navegadores sin IndexedDB mantienen el participant manager, pero usan el fallback visual y no pueden guardar fotos.
- La fórmula de `overallScore` sigue sin definición y requiere aprobación explícita antes de implementarse.

## Límite de fase

La Fase 8.5 termina con seis destinos principales, Rankings dedicado a standings acumulados, Temporada dedicada a premios, helpers de UI compartidos y derivaciones optimizadas. No se implementan `overallScore`, Best Group, Most Competitive Week, temporadas múltiples ni ninguna parte de Fase 9; el proyecto queda detenido al cierre de Fase 8.5.
