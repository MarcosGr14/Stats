# Stats

Stats es una aplicación web local para organizar el catálogo de **Fan Choice**, registrar evaluaciones semanales y consultar clasificaciones individuales y de temporada.

## Propósito

La aplicación reúne en un solo lugar a los participantes, sus nominaciones por categoría y el historial de resultados. Está pensada para que dos votantes permanentes puedan evaluar a los competidores y revisar cómo evolucionan durante una temporada.

## Funciones del producto

- Catálogo Fan Choice con 242 participantes: 235 integrantes de 39 grupos y siete solistas, organizados por género y grupo.
- Retratos WebP para los 242 perfiles del catálogo, con sus fuentes registradas por imagen.
- Temas claro y oscuro, con opción automática según el dispositivo.
- Fichas de participantes con búsqueda, filtros, grupos, imágenes, tags, archivo y perfil histórico.
- Nominación independiente por temporada: cada participante puede quedar sin categoría hasta que se decida en cuáles competirá.
- Lista semanal breve de nominados compartida por categoría, más acceso opcional al catálogo completo para descubrir nuevos talentos.
- Evaluación semanal abierta en cualquiera de las seis categorías, aunque el participante todavía no compita oficialmente en ella.
- Dos votos independientes (P1 y P2), evidencia enlazada por tipo, tags descriptivos, nota breve y hasta cinco Standouts por votante en cada semana.
- Resultados semanales en vivo y oficiales, con puntuación, posiciones, empates y motivos destacados.
- Estadísticas por periodo, categoría, género, grupo y votante, con tendencias y métricas descriptivas.
- Clasificación gradual por categoría: estado en observación, requisitos configurables, revisión trimestral con confirmación de P1 y P2, y pausa de participación que conserva el historial.
- Clasificación de temporada con resultados por categoría y género, provisionales, podios y puntuaciones explicables. Solo las categorías confirmadas participan en el ranking anual.
- Hall of Fame con ganadores, ranking completo, puntuaciones y métricas congeladas al cerrar cada temporada.
- Copias de seguridad portátiles con validación de integridad, imágenes incluidas y recuperación ante datos dañados.

## Temporadas y participación

Cada temporada agrupa semanas de votación. La evaluación semanal está abierta para descubrir talento en cualquier categoría; una evaluación o nominación no clasifica automáticamente al participante. Por defecto, una categoría queda lista para revisión al reunir tres semanas completas con votos de ambos evaluadores y promedio mínimo de 4,2 sobre 6. Cada categoría permite ajustar esos criterios. En los cierres trimestrales, P1 y P2 confirman la entrada de forma independiente. Las semanas completas de observación que respaldan la clasificación cuentan en la temporada y las nuevas se agregan mientras siga activa. También puede pausarse y retomarse en una revisión posterior. Al cerrar la temporada, Stats guarda resultados, rankings, criterios y estados; la siguiente empieza sin clasificaciones activas. El historial semanal y las etiquetas se conservan.

La clasificación oficial requiere al menos cinco semanas evaluadas por categoría. La puntuación de temporada combina rendimiento promedio (40%), tasa de victorias (25%), apariciones en el Top 3 (20%) y votos Standout (15%). Los resultados provisionales se muestran por separado hasta cumplir ese mínimo. La puntuación general combina el 95% de la mejor categoría elegible con el 5% de la segunda, cuando existe.

Las semanas siguen el calendario ISO de lunes a domingo en la zona horaria de Panamá. Una semana abierta muestra resultados en vivo; al cerrarla, sus resultados pasan a ser oficiales. Solo puede existir una semana abierta a la vez.

## Votación

P1 y P2 evalúan por separado a cada participante en cada categoría. Las valoraciones aportan 3 puntos por Standout, 2 por Impressed, 1 por Good y 0 por Normal. “Sin evaluar” significa que no hay voto guardado. Cada votante tiene un máximo global de cinco Standouts por semana, y puede adjuntar tipo de evidencia, enlace, hasta tres tags de motivo y una nota breve por voto. Los tags recurrentes resumen observaciones, pero no agregan puntos automáticamente.

Los rankings semanales ordenan por puntos, cantidad de votos y Standouts. Los empates usan posiciones de competición, por ejemplo 1, 1, 3. Los resultados distinguen las categorías y los géneros.

## Datos y privacidad

Stats funciona sin cuenta ni servidor de aplicación. P1 y P2 son confirmaciones separadas en la misma instancia local, no identidades autenticadas. El estado del catálogo, temporadas y votaciones se guarda localmente en el navegador; las fotos personalizadas se guardan en su almacenamiento local. Los retratos predeterminados del catálogo forman parte de los recursos del producto y tienen sus páginas de origen registradas junto a los archivos. Los datos personales no se sincronizan automáticamente entre navegadores o equipos. La sincronización del repositorio de GitHub corresponde al código y sus recursos, no a los datos personales de la aplicación.

La función de backup permite exportar e importar el estado y las imágenes en un archivo JSON. Antes de restaurar, la aplicación valida el contenido y permite revisar el reemplazo.

## Tecnología

La interfaz utiliza HTML semántico, CSS adaptable y JavaScript nativo del navegador. Usa `localStorage` para el estado estructurado y las preferencias visuales, `IndexedDB` para fotos personalizadas, Web Crypto para comprobar la integridad de los backups y las APIs de archivos del navegador para exportar e importar datos. Las tipografías de marca son Unbounded y Onest; la aplicación no requiere framework ni backend.

La interfaz está en español, se adapta a móvil y escritorio y contempla navegación por teclado, etiquetas accesibles, estados vacíos y movimiento reducido.
