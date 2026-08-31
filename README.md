# Stats V2

Aplicación local-first para evaluar y seguir performers K-pop a lo largo de una temporada. La Fase 0 reemplaza el ranking monolítico original con una base versionada, segura y preparada para participantes, categorías, tags, votos semanales e historial.

## Estado actual

Solo está implementada **Fase 0 — Reset & Foundation**:

- shell visual dark, responsive y accesible;
- HTML, CSS y JavaScript separados;
- modelo de datos V2 y validación antes de persistir;
- metadata en `localStorage` e interfaz base para imágenes en IndexedDB;
- eliminación limitada y explícita del estado legacy;
- pruebas aisladas que no usan el almacenamiento real del navegador.

No están implementados todavía el participant manager, el catálogo de tags, las votaciones, los rankings, los perfiles, los analytics ni la fórmula de ganadores.

## Ejecución

No hay dependencias, build step ni framework. Se puede abrir `index.html` directamente o servir la carpeta con cualquier servidor estático.

Ejemplo con Python:

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
│   ├── image-storage.js
│   └── app.js
├── docs/
│   └── screenshots/
│       ├── foundation-desktop.png
│       └── foundation-mobile.png
├── tests/
│   └── foundation.test.cjs
└── README.md
```

Los módulos comparten únicamente el namespace global `StatsV2` para conservar compatibilidad con sitios estáticos y con la apertura mediante `file://`.

## Modelo de datos

El estado raíz tiene esta forma:

```js
{
  schemaVersion: 2,
  meta: {
    createdAt,
    updatedAt
  },
  participants: [],
  groups: [],
  tags: [],
  participantTagAssignments: [],
  weeks: [],
  weeklyVotes: [],
  settings: {
    activeWeekId: null,
    voters: [
      { id: "p1", name: "P1" },
      { id: "p2", name: "P2" }
    ]
  }
}
```

### Participante

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

Las categorías son constantes neutras: `vocal`, `rap`, `dance`, `stage`, `visual` y `all-rounder`. El género (`male` o `female`) es un filtro independiente.

Los tags no se duplican dentro del participante. `participantTagAssignments` registra la relación y sus fechas `assignedAt`/`removedAt`, lo que permite construir historial sin perder información.

`weeklyVotes` admite las evaluaciones `standout`, `impressed`, `good` y `normal`. Sus puntajes base están declarados, pero no existe ni se presume una fórmula de ganador general.

## Persistencia

| Uso | Nombre exacto |
| --- | --- |
| Estado V2 en `localStorage` | `stats:v2:state` |
| Clave legacy eliminada | `rankingsApp_data` |
| Base IndexedDB | `stats-v2` |
| Object store de imágenes | `images` |

Al iniciar:

1. se elimina únicamente `rankingsApp_data` si existe;
2. nunca se enumeran ni eliminan otras claves;
3. se crea un estado V2 vacío si no existe;
4. si el estado V2 está corrupto o no pasa validación, se muestra un estado temporal vacío **sin sobrescribir el valor original**.

Las imágenes no se guardan en `localStorage`. `image-storage.js` prepara operaciones `putImage`, `getImage` y `deleteImage` para IndexedDB, pero la UI de fotos pertenece a la Fase 1.

## Seguridad y accesibilidad

- La UI no utiliza `innerHTML` para insertar datos.
- Las actualizaciones de contenido usan `textContent`.
- Hay enlace de salto, landmarks, labels accesibles y `focus-visible`.
- El layout contempla 320, 375, 768, laptop y desktop.
- No depende de hover y respeta `prefers-reduced-motion`.
- No se cargan fuentes, scripts ni estilos de terceros.

## Pruebas

Requiere Node.js 20 o superior y no instala paquetes:

```bash
node --test tests/foundation.test.cjs
```

La suite usa almacenamiento en memoria; no toca `localStorage` ni IndexedDB reales.

## Revisión visual

La shell fue revisada en 320, 375, 768 y 1440 px. No presenta overflow horizontal del documento ni errores de consola. Las capturas de referencia están en `docs/screenshots/`.

## Riesgos y decisiones pendientes

- El catálogo de tags predefinidos se creará en la Fase 2.
- Las reglas de unicidad de votos por semana/participante/usuario se cerrarán antes de la Fase 4.
- El formato de exportación de imágenes se definirá en la Fase 9.
- La fórmula de `overallScore`, Male Performer of the Year y Female Performer of the Year requiere aprobación explícita antes de implementarse.
- La compatibilidad con navegadores sin IndexedDB se limitará a mostrar el fallback visual de imagen.

## Próxima fase

La Fase 1 añadirá el participant manager solo después de revisar y aprobar esta fundación.
