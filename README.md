# WORLD CUP 2030 — THE ROAD TO GLORY

Simulador de torneo de 64 selecciones con identidad visual propia para el Mundial 2030 (España · Portugal · Marruecos).
Aplicación web completa: sorteo animado, fase de grupos, cuadro eliminatorio interactivo, editor de acontecimientos,
recorridos, estadísticas, pósters en alta resolución y **vídeo MP4 real** generado en el navegador.

> **Aviso:** el formato de 64 selecciones y la lista de participantes son una configuración personalizada del usuario, no
> información oficial. Proyecto de aficionados sin afiliación con la FIFA. Ningún resultado viene precargado: todos los
> resultados los carga el usuario o los genera el simulador cuando el usuario lo pide.

## Usarla en el teléfono (iPhone / Android)

La app se publica sola en GitHub Pages con `.github/workflows/deploy.yml` en cada push a `main`
(requiere *Settings → Pages → Source: GitHub Actions*). Abrí la dirección en Safari y tocá
**Compartir → Agregar a pantalla de inicio**: queda instalada como app, a pantalla completa y con soporte sin conexión.
En iPhone, «Guardar en Fotos» abre el menú de compartir para guardar pósters y vídeos.

## Puesta en marcha

Requisitos: Node.js 20+ (probado con Node 22).

```bash
npm install
npm run dev        # desarrollo → http://localhost:5173
npm test           # 26 pruebas del motor del torneo (Vitest)
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve el build
```

No hace falta servidor ni base de datos: todo se guarda en IndexedDB (con respaldo en localStorage).

## Secciones

| Sección | Qué hace |
|---|---|
| **Home** | Hero cinematográfico, cuenta regresiva configurable, progreso del torneo por fases, campeón. |
| **Draw Ceremony** | 4 modos: libre (Fisher–Yates + RNG criptográfico), restricciones por confederación (máximos configurables, solver con backtracking que garantiza una distribución válida), bombos por ranking personalizado y manual (tocar/arrastrar). Bombos con bolillas, extracción animada, sonido, velocidad 1×/2×/4×, validación antes de confirmar, repetir animación. |
| **Group Stage** | 16 grupos, 96 partidos generados automáticamente (round-robin), tabla PJ/PG/PE/PP/GF/GC/DG/PTS en vivo, desempates configurables (incl. enfrentamiento directo y juego limpio), clasificación matemática asegurada/eliminada, vista por jornada. |
| **Knockout** | Cuadro simétrico con conectores, zoom y vista por rondas para móvil. Marcador, prórroga, penales y elección manual del clasificado sin límites. |
| **Momentum** | Editor de acontecimientos (gol, penal convertido/errado, autogol, amarilla, roja, cambio, gol en prórroga, tanda) con minuto + añadido, jugador y descripción; línea temporal visual; aviso de incoherencias marcador/acontecimientos y botón para sincronizar. |
| **The Road to Glory** | Recorrido automático de cualquier selección: grupo, posición, rivales, marcadores, goles y minutos, estado final; camino del campeón. |
| **Statistics** | Goleadores, récords (más goleadora, menos goleada, mayor goleada, partido con más goles, más victorias/empates, mejor DG), goles por fase y por tramo, distribución de resultados, confederaciones, acontecimientos y tabla de las 64. |
| **Cinematic Recap** | Vídeo real exportable: 16:9 (1920×1080) o 9:16 (1080×1920), 30 fps, 30–120 s, 4 estilos de música original, público opcional, todo el torneo o el recorrido de una selección, textos personalizados. Vista previa con scrub. |
| **Legendary Poster** | 5 plantillas (campeón, subcampeón, semifinales, cualquier selección, resumen), 6 estilos, 3 formatos (2160×2700, 2160×3840, 2400×2400). Descarga PNG/JPG y compartir. |
| **Settings** | Múltiples simulaciones (nueva, abrir, duplicar, renombrar, eliminar), exportar/importar JSON validado, borrar resultados, reiniciar torneo, desempates, ranking, nombres de selecciones, sonido y animaciones. |

Además: guardado automático, deshacer/rehacer (botones y Ctrl+Z / Ctrl+Shift+Z), confirmación antes de acciones destructivas,
celebraciones (victoria, clasificación, transición de fase, campeón) y navegación adaptada a móvil (barra inferior + hoja "Más").

## Arquitectura

```
src/
  engine/        Motor del torneo, TypeScript puro (sin React): equipos, sorteo, fixture, tablas y desempates,
                 bracket, propagación, invalidación en cascada, estadísticas, recorridos, simulador, validación de importación.
  store/         Zustand: estado del torneo, historial deshacer/rehacer, persistencia IndexedDB, diálogos y celebraciones.
  components/    UI reutilizable (botones, modal/hoja, steppers), banderas, escudos, emblema, trofeo, editor de partido.
  sections/      Las 9 secciones (cargadas bajo demanda).
  media/         canvasKit (dibujo compartido), poster.ts, video/{scenes,music,encode}.ts, synth.ts (audio procedural).
  assets/flags/  64 banderas SVG (flag-icons, licencia MIT).
```

**Propagación e invalidación.** El estado guarda solo resultados "crudos" con una instantánea de los participantes.
`deriveTournament()` recalcula tablas y cruces. Si un cambio (un resultado, un desempate, un sorteo) modifica quién juega un
partido posterior, `invalidatedBy()` detecta en cascada qué resultados quedan obsoletos y la app pide confirmación antes de
borrarlos (se puede deshacer).

**Cruces de dieciseisavos.** 1A–2B, 1C–2D … 1O–2P en la mitad superior y 1B–2A, 1D–2C … 1P–2O en la inferior: los dos
clasificados de un mismo grupo solo pueden reencontrarse en la final.

**Desempates.** Orden configurable; los criterios de enfrentamiento directo se calculan dentro del subconjunto empatado. El
último recurso es un "sorteo" determinista por semilla del torneo.

## Vídeo: cómo se genera

En lugar de Remotion + FFmpeg (que requieren un servidor con Chrome headless), el vídeo se renderiza **en el navegador**:

1. Cada fotograma se dibuja en un `<canvas>` (escenas: presentación, 64 selecciones, sorteo, grupos, resultados destacados,
   clasificados, 16avos, octavos, cuartos, semis, tercer puesto, final, campeón, camino del campeón, imagen final).
2. La banda sonora se compone de forma procedural con `OfflineAudioContext` (sintetizadores, percusión, público), sincronizada
   con los cortes de escena. Es música original, sin muestras ni canciones comerciales.
3. **WebCodecs** codifica vídeo H.264 (o VP9/AV1 si no hay H.264) y audio AAC (u Opus si la plataforma no ofrece AAC), y
   **mp4-muxer** empaqueta un `.mp4` real, más rápido que el tiempo real.
4. Si el navegador no soporta WebCodecs, se usa `MediaRecorder` y se graba un `.webm` en tiempo real.

Compatibilidad: MP4 en Chrome/Edge 94+ y Safari 16.4+. Firefox usa la grabación WebM. En Chrome de Linux no hay codificador
AAC, así que el audio sale en Opus dentro del MP4 (se reproduce en navegadores, VLC y la mayoría de editores; algunos reproductores
antiguos de Apple pueden necesitar AAC). Probado: 30 s a 1080p generados en ~50 s en Chromium headless (H.264 1920×1080 30 fps + Opus 48 kHz estéreo).

## Pruebas

`npm test` verifica: 64 selecciones únicas; 16 grupos de 4 en los tres modos automáticos; límites por confederación y bombos;
reglas imposibles rechazadas; aleatoriedad; 6 partidos por grupo y 3 por selección; actualización de tablas y desempates
(incluido enfrentamiento directo); clasificación matemática; bracket de 32 partidos con los cruces correctos; 32 clasificados;
propagación de ganadores y perdedores hasta la final y el tercer puesto; prórroga/penales/elección manual; invalidación en cascada;
coherencia entre goles, estadísticas y acontecimientos; recorrido completo del campeón.

## Licencias de recursos

- Banderas: [flag-icons](https://github.com/lipis/flag-icons) — MIT (`src/assets/flags/LICENSE-flag-icons.txt`).
- Tipografías: Anton, Barlow Condensed, Inter — SIL Open Font License (paquetes @fontsource).
- Emblema, trofeo, escudos, música y efectos: creaciones originales de esta app.
