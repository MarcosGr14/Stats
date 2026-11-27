# Plan: evaluación semanal y clasificación gradual

## Objetivo
Permitir evaluar a cualquier participante por categoría cada semana y separar esas evaluaciones de su clasificación anual. La clasificación se gana por evidencia y confirmación independiente de P1 y P2; no se borran votos ni tags históricos.

## Estado actual observado
- `js/weekly.js` valida que el participante ya tenga categoría para votar; `categoriesForParticipant` deriva categorías asignadas/históricas.
- `js/season.js` considera elegible el ranking con cinco semanas evaluadas, sin estado de clasificación explícito.
- `js/seasons.js` ya congela la tabla al cerrar la temporada y limpia `participant.categoryIds` al iniciar la siguiente.
- `js/weekly-view.js` separa P1/P2 y registra notas/motivos semanales; el diálogo ya tiene pestañas por categoría.
- `js/data.js` valida y crea el estado local; se debe mantener compatibilidad con respaldos existentes.

## Supuestos de producto
- La evaluación usa la escala existente de 0–3 puntos por votante (máximo conjunto: 6 por semana).
- Criterio inicial editable por categoría: 3 semanas con voto y promedio de 4.2/6; el promedio se calcula con semanas evaluadas y los ceros cuentan.
- P1 y P2 confirman cada clasificación por separado. Sin autenticación, las confirmaciones son controles separados, no una garantía de identidad.
- Solo categorías clasificadas entran en la competencia anual oficial; semanas, notas y etiquetas conservan evaluaciones de observación.

## Pasos
1. Habilitar evaluación abierta en las seis categorías sin asignación previa; mantener la lista semanal compacta y ofrecer una acción de evaluación general. Comprobar dominio y flujo en navegador.
2. Añadir criterios y confirmaciones por categoría/temporada con defaults compatibles, validación y reinicio en temporada nueva. Comprobar estado antiguo y cierre/apertura de temporada.
3. Separar ranking oficial de candidatos en observación; mostrar progreso, desacuerdos entre votantes y controles de clasificación. Probar UI móvil y desktop.
4. Reforzar uso de etiquetas en evaluación y resumen semanal sin añadir puntos automáticos ni duplicar méritos; revisar copia y carga de votación.
5. Actualizar especificación de producto y verificar suites relevantes, sintaxis, accesibilidad básica y flujo real.

## Riesgos y mitigación
- Cambiar el significado de `categoryIds` afectaría filtros/historial: conservarlo como categorías clasificadas de la temporada; cada semana mantiene sus propios votos y snapshot.
- Los estados nuevos podrían invalidar backups: serán campos aditivos opcionales para temporadas previas y tendrán valores por defecto al iniciar la temporada activa.
- La confirmación P1/P2 no es autenticación: mostrarlo como revisión colaborativa local.
- Mostrar seis resúmenes por persona sería abrumador: limitar tarjetas a categorías con actividad y dejar el selector completo dentro de “Evaluar”.

## Progreso
- [x] Inspección de modelo y flujos existentes.
- [x] Evaluación semanal abierta, nominación por categoría y descubrimiento del catálogo completo.
- [x] Criterios editables, confirmaciones separadas P1/P2 y pausas dentro de revisiones trimestrales.
- [x] Resumen de progreso, desacuerdo entre votos, tags recurrentes y evidencia con enlace.
- [x] Verificación automatizada, sintaxis y documentación de producto.

## Resultado y límites
- Los votos de observación no clasifican por sí solos. Al confirmarse una categoría, las semanas completas que sustentaron la clasificación cuentan en esa participación; las semanas nuevas se agregan mientras la categoría permanezca activa.
- La confirmación P1/P2 son acciones locales separadas en el mismo navegador, no cuentas autenticadas.
- La sesión no ofreció un navegador para la inspección visual manual. Se comprobaron contratos de UI, renderizadores y comportamiento de dominio mediante las pruebas automatizadas.
