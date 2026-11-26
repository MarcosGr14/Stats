# Stats

Stats es una aplicación web local para organizar el catálogo de **Fan Choice**, registrar evaluaciones semanales y consultar clasificaciones individuales y de temporada.

## Propósito

La aplicación reúne en un solo lugar a los participantes, sus nominaciones por categoría y el historial de resultados. Está pensada para que dos votantes permanentes puedan evaluar a los competidores y revisar cómo evolucionan durante una temporada.

## Funciones del producto

- Catálogo Fan Choice con 242 participantes: 235 integrantes de 39 grupos y siete solistas, organizados por género y grupo.
- Fichas de participantes con búsqueda, filtros, grupos, imágenes, tags, archivo y perfil histórico.
- Nominación independiente por temporada: cada participante puede quedar sin categoría hasta que se decida en cuáles competirá.
- Votación semanal por categoría para P1 y P2, con Standout, Impressed, Good y Normal; también admite dejar una categoría sin evaluar.
- Resultados semanales en vivo y oficiales, con puntuación, posiciones, empates y motivos destacados.
- Estadísticas por periodo, categoría, género, grupo y votante, con tendencias y métricas descriptivas.
- Clasificación de temporada con resultados por categoría y género, provisionales, podios y puntuaciones explicables.
- Hall of Fame con ganadores, ranking completo, puntuaciones y métricas congeladas al cerrar cada temporada.
- Copias de seguridad portátiles con validación de integridad, imágenes incluidas y recuperación ante datos dañados.

## Temporadas y participación

Cada temporada agrupa semanas de votación. Las categorías de participación pertenecen a la temporada en curso y se pueden asignar o cambiar conforme se nominan competidores. Al cerrar la temporada, Stats guarda sus resultados y rankings; la siguiente comienza con las categorías vacías para todos. El historial de votos y perfiles permanece disponible.

La clasificación oficial requiere al menos cinco semanas evaluadas por categoría. La puntuación de temporada combina rendimiento promedio (40%), tasa de victorias (25%), apariciones en el Top 3 (20%) y votos Standout (15%). Los resultados provisionales se muestran por separado hasta cumplir ese mínimo. La puntuación general combina el 95% de la mejor categoría elegible con el 5% de la segunda, cuando existe.

Las semanas siguen el calendario ISO de lunes a domingo en la zona horaria de Panamá. Una semana abierta muestra resultados en vivo; al cerrarla, sus resultados pasan a ser oficiales. Solo puede existir una semana abierta a la vez.

## Votación

P1 y P2 evalúan por separado a cada participante en cada categoría. Las valoraciones aportan 3 puntos por Standout, 2 por Impressed, 1 por Good y 0 por Normal. “Sin evaluar” significa que no hay voto guardado. Cada votante tiene un máximo global de cinco Standouts por semana, y puede añadir hasta tres tags de motivo y una nota breve por voto.

Los rankings semanales ordenan por puntos, cantidad de votos y Standouts. Los empates usan posiciones de competición, por ejemplo 1, 1, 3. Los resultados distinguen las categorías y los géneros.

## Datos y privacidad

Stats funciona sin cuenta ni servidor de aplicación. El estado del catálogo, temporadas y votaciones se guarda localmente en el navegador; las imágenes se guardan en el almacenamiento local del navegador. Los datos permanecen en ese dispositivo y no se sincronizan automáticamente entre navegadores o equipos. La sincronización del repositorio de GitHub corresponde al código del producto, no a los datos personales de la aplicación.

La función de backup permite exportar e importar el estado y las imágenes en un archivo JSON. Antes de restaurar, la aplicación valida el contenido y permite revisar el reemplazo.

## Tecnología

La interfaz utiliza HTML semántico, CSS adaptable y JavaScript nativo del navegador. Usa `localStorage` para el estado estructurado, `IndexedDB` para imágenes, Web Crypto para comprobar la integridad de los backups y las APIs de archivos del navegador para exportar e importar datos. No requiere framework, backend ni servicios externos para las funciones principales.

La interfaz está en español, se adapta a móvil y escritorio y contempla navegación por teclado, etiquetas accesibles, estados vacíos y movimiento reducido.
