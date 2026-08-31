# Stats V2 — K-Pop Performance Tracker

Stats V2 es una aplicación local-first para organizar, evaluar y seguir el rendimiento de performers de K-pop a lo largo del tiempo.

El proyecto comenzó como un ranking simple con barras y controles manuales, pero evolucionó hacia una herramienta más completa basada en:

- participantes;
- categorías;
- grupos;
- fotos;
- tags;
- evaluaciones semanales;
- historial;
- rankings;
- análisis comparativos;
- ganadores finales masculino y femenino.

La aplicación está construida con HTML, CSS y JavaScript Vanilla, sin frameworks y sin backend.

---

## Objetivo

Stats busca responder preguntas como:

- ¿Quién está destacando más esta semana?
- ¿Quién sobresale en vocal, rap, dance o stage?
- ¿Qué fortalezas tiene cada performer?
- ¿Qué aspectos necesita mejorar?
- ¿Quién ha sido más consistente?
- ¿Qué performers generan mayor consenso o desacuerdo entre los dos usuarios?
- ¿Quién debería terminar la temporada como Male Performer of the Year y Female Performer of the Year?

El proyecto prioriza una experiencia simple, visual y orientada al seguimiento histórico.

---

# Características actuales

## Participant Manager

Permite administrar participantes directamente desde la aplicación.

Cada performer puede tener:

- nombre;
- grupo;
- género;
- múltiples categorías;
- fotografía;
- estado activo o archivado.

Funciones disponibles:

- crear participante;
- editar participante;
- buscar;
- filtrar;
- ordenar;
- archivar;
- restaurar;
- eliminar cuando no existe historial asociado.

Las fotografías se almacenan en IndexedDB y no dentro de localStorage.

---

## Categorías

Actualmente se utilizan seis categorías principales:

- Vocal
- Rap
- Dance
- Stage
- Visual
- All-Rounder

Un mismo participante puede pertenecer a varias categorías.

Ejemplo:

```text
Jurin
├── Rap
├── Dance
└── Stage
````

Esto permite reutilizar una sola entidad de participante en toda la aplicación.

---

## Grupos

Los grupos se manejan como entidades reutilizables.

Ejemplos:

```text
TWICE
aespa
XG
NMIXX
SEVENTEEN
```

También se admiten performers sin grupo mediante `groupId: null`.

---

# Tag System

Stats incluye un sistema reutilizable de tags para describir las capacidades de cada performer.

Los tags se dividen visualmente en:

```text
Strengths
Needs Work
Special
```

Internamente:

```text
strength
weakness
neutral
```

Los tags existen una sola vez en el catálogo y pueden asignarse a múltiples participantes.

Ejemplo:

```text
Stage Presence
├── Ningning
├── Jurin
└── Jihyo
```

---

## Tags predefinidos

El catálogo inicial contiene decenas de tags organizados por área.

### Vocal

Ejemplos:

* High Notes
* Vocal Power
* Stable Live
* Vocal Range
* Vocal Tone
* Falsetto
* Belting
* Breath Control
* Harmonies
* Emotional Delivery

### Rap

Ejemplos:

* Flow
* Fast Rap
* Diction
* Rhythm
* Delivery
* Freestyle
* Wordplay
* Breath Control
* Aggressive Flow
* Melodic Rap

### Dance

Ejemplos:

* Precision
* Isolation
* Footwork
* Body Control
* Musicality
* Power
* Fluidity
* Synchronization
* Popping
* Versatility

### Stage

Ejemplos:

* Stage Presence
* Facial Expressions
* Charisma
* Camera Awareness
* Crowd Control
* Energy
* Confidence
* Center Presence
* Consistency

### General / Special

Ejemplos:

* All-Rounder
* Ace
* Fast Improvement
* Standout Performer
* Reliable Live
* Great Chemistry
* Concept Chameleon

---

## Custom Tags

También se pueden crear tags personalizados.

Ejemplos:

```text
Killer Bridge
Encore Queen
Dance Break Specialist
Ending Fairy
Award Show Monster
```

Los custom tags pueden:

* crearse;
* editarse;
* asignarse a participantes;
* removerse;
* filtrarse;
* eliminarse cuando es seguro.

Los tags predefinidos están protegidos contra eliminación destructiva.

---

# Rankings

Stats incluye una vista de rankings por:

* Vocal
* Rap
* Dance
* Stage
* Visual
* All-Rounder

Actualmente el sistema funciona en modo:

```text
Unranked
```

porque todavía no se utiliza una fórmula artificial para determinar posiciones.

La aplicación prioriza datos reales antes que inventar scores.

---

## Filtros disponibles

Los participantes pueden explorarse mediante:

* categoría;
* género;
* grupo;
* tag;
* estado activo/archivado;
* búsqueda;
* orden A-Z;
* fecha de creación.

Los rankings se derivan en memoria y no modifican los datos persistentes.

---

# Weekly Voting

Stats está diseñado para incorporar un sistema de evaluación semanal entre dos usuarios.

Escala definida:

```text
🔥 Standout   = 3 puntos
✨ Impressed  = 2 puntos
👍 Good       = 1 punto
➖ Normal      = 0 puntos
— Not evaluated = sin voto
```

Una evaluación `Normal` no es lo mismo que no evaluar a un participante.

---

## Standout Limit

Cada usuario puede otorgar como máximo:

```text
5 Standout 🔥 por semana
```

Esto evita que la categoría pierda valor.

Los votos:

* Impressed;
* Good;
* Normal;

no tienen límite.

---

## Dos usuarios

El sistema está pensado para dos evaluadores con el mismo peso.

Conceptualmente:

```text
P1 = 50%
P2 = 50%
```

Cada usuario puede emitir como máximo una evaluación por participante y semana.

---

## Weekly Points

La puntuación semanal se calcula mediante la suma de las evaluaciones existentes.

Ejemplo:

```text
P1 → 🔥 Standout   3
P2 → ✨ Impressed  2

Weekly Points = 5
```

Máximo posible:

```text
6 puntos
```

---

## Reglas de ranking semanal

El futuro Weekly Ranking utiliza:

```text
1. Weekly Points
2. Número de votantes
3. Cantidad de Standout
4. Empate real
```

No se utilizan desempates arbitrarios por nombre, género o fecha de creación.

---

# Weekly Reasons

Las evaluaciones semanales pueden utilizar tags como razones.

Ejemplo:

```text
🔥 Standout

Reasons:
[Stage Presence]
[High Notes]
[Stable Live]
```

Estos tags semanales no modifican automáticamente los tags permanentes del perfil.

Se consideran dos conceptos diferentes:

```text
Profile Tag
→ fortaleza habitual

Weekly Reason
→ razón por la que destacó esta semana
```

---

# Weekly System

Las semanas utilizan formato ISO:

```text
2026-W36
```

y siguen una estructura:

```text
Monday → Sunday
```

Estados:

```text
OPEN
CLOSED
```

Mientras una semana está abierta se pueden editar evaluaciones.

Una semana cerrada conserva sus resultados para historial.

---

# Futuras funciones

El roadmap contempla varias fases adicionales.

## Weekly Spotlight

Permitirá mostrar:

* Weekly Top 3;
* Performer of the Week;
* Vocalist of the Week;
* Rapper of the Week;
* Dancer of the Week;
* Stage Performer of the Week;
* Visual of the Week.

---

## Participant Profiles

Cada perfil podrá mostrar:

```text
Weekly Score
Best Week
Weekly Wins
Voting History
Tag History
Performance Trend
```

---

## Analytics

Funciones previstas:

* Most Improved;
* Most Consistent;
* Most Versatile;
* Most Weekly Wins;
* Most Tagged Skill;
* Biggest P1/P2 Disagreement;
* Most Controversial Performer.

---

# Grand Winners

El objetivo final del sistema es coronar dos ganadores generales:

```text
Male Performer of the Year
Female Performer of the Year
```

También se podrán mostrar durante la temporada:

```text
Male Leader
Female Leader
```

La fórmula final todavía no está definida.

No se implementará una fórmula arbitraria: deberá basarse en información acumulada como:

* weekly performance;
* consistency;
* category performance;
* standout weeks;
* wins.

---

# Arquitectura

El proyecto utiliza:

```text
HTML
CSS
Vanilla JavaScript
localStorage
IndexedDB
```

No utiliza actualmente:

* React;
* Vue;
* backend;
* Supabase;
* autenticación;
* servidores externos.

La aplicación está diseñada como:

```text
local-first
```

---

## Estructura aproximada

```text
Stats/
│
├── index.html
│
├── css/
│   ├── global.css
│   ├── components.css
│   └── app.css
│
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── storage.js
│   ├── participants.js
│   ├── tags.js
│   ├── rankings.js
│   └── ...
│
├── assets/
│
├── tests/
│
└── README.md
```

---

# Persistencia

El estado principal se almacena en:

```text
localStorage:
stats:v2:state
```

Las imágenes se almacenan en:

```text
IndexedDB:
stats-v2

Object Store:
images
```

Esto evita guardar blobs o imágenes codificadas dentro de localStorage.

---

# Seguridad de datos

Desde la incorporación de participantes reales, el proyecto utiliza una filosofía estrictamente no destructiva.

Las nuevas fases deben ser:

```text
estado existente
+
nuevas estructuras
=
nuevo estado
```

Nunca:

```text
borrar
→ reconstruir
```

Las migraciones deben:

1. leer el estado actual;
2. validarlo;
3. clonar;
4. añadir los nuevos campos;
5. validar la migración;
6. persistir únicamente si es segura.

---

## Backups de migración

Algunas migraciones importantes generan copias preventivas.

Ejemplo:

```text
stats:v2:state:pre-tags-backup
```

Esto permite conservar un punto de restauración antes de cambios estructurales.

---

# Seguridad de interfaz

El contenido introducido por el usuario se renderiza mediante APIs seguras del DOM.

Se prioriza:

```javascript
textContent
```

en lugar de insertar directamente datos del usuario mediante `innerHTML`.

---

# Accesibilidad

El proyecto contempla:

* navegación por teclado;
* `focus-visible`;
* labels accesibles;
* botones semánticos;
* alt text;
* contraste;
* modales con manejo de foco;
* touch targets adecuados;
* soporte para `prefers-reduced-motion`.

---

# Responsive

La interfaz se verifica regularmente en:

```text
320px
375px
768px
1440px
```

El objetivo es mantener la aplicación completamente utilizable tanto en móvil como en escritorio.

---

# Design System

Stats utiliza la misma familia visual dark de otros proyectos personales relacionados.

Base:

```text
Background      #0B0B0F
Surface         #141419
Elevated        #1C1C23
Primary Text    #F5F5F7
Muted Text      #8D8D98
```

Accents:

```text
VOCAL         Pink
RAP           Red / Orange
DANCE         Cyan
STAGE         Purple
VISUAL        Gold
ALL-ROUNDER   Green
```

La intención visual es:

```text
K-pop
dark
editorial
fashion
moderna
competitiva
```

evitando una apariencia genérica de dashboard administrativo.

---

# Testing

El proyecto cuenta con pruebas automatizadas para:

* modelo de participantes;
* relaciones;
* persistencia;
* fotografías;
* tags;
* migraciones;
* filtros;
* rankings;
* seguridad de datos.

Las pruebas utilizan entornos aislados y no interactúan con el almacenamiento real del usuario.

---

# Estado actual del desarrollo

Fases completadas:

```text
✅ Fase 0 — Foundation
✅ Fase 1 — Participant Manager
✅ Fase 2 — Tag System
✅ Fase 3 — Rankings / Unranked
🚧 Fase 4 — Weekly Voting
⬜ Fase 5 — Weekly Spotlight
⬜ Fase 6 — Profiles & History
⬜ Fase 7 — Analytics
⬜ Fase 8 — Grand Winners
⬜ Fase 9 — Data Safety
⬜ Fase 10 — Final Polish
```

---

# Principios del proyecto

```text
Datos reales > datos inventados

Integridad > velocidad

Tests > asumir

Cambios incrementales > reescrituras

Historial > información descartable

Local-first > complejidad innecesaria
```

---

# Autor

Desarrollado por **MarcosGr14** como proyecto personal de seguimiento y evaluación de performers K-pop.

---

## Status

Stats V2 se encuentra actualmente en desarrollo activo.
