# Changelog

All notable changes to SonarQube Dashboard & Pipeline will be documented in this file.

*Todos los cambios relevantes de SonarQube Dashboard & Pipeline se documentarán en este archivo.*

## [2.0.0] - 2026-08-15

### Added

- Added the **modular 2.0 architecture** with a dedicated **Configuration → Modules** area. **Pipeline** and **Live Remediation** can be enabled or disabled independently at runtime, their native views/configuration tabs follow module state immediately, and disabling a module requires confirmation through a native VS Code modal. If Pipeline is running, the modal explicitly warns that the analysis will be cancelled.

  *Se ha añadido la **arquitectura modular de la 2.0** con una sección dedicada **Configuración → Módulos**. **Pipeline** y **Live Remediation** pueden activarse o desactivarse de forma independiente en runtime, sus vistas nativas/pestañas de configuración reaccionan inmediatamente al estado del módulo y la desactivación requiere confirmación mediante un modal nativo de VS Code. Si Pipeline está ejecutándose, el modal avisa expresamente de que el análisis será cancelado.*

- Added **fully isolated source boundaries** for the optional modules. Pipeline now lives under `src/modules/pipeline/` with its scanner, execution, templates, history, configuration, commands, views, and webview contribution; Live Remediation lives under `src/modules/liveRemediation/` with its tracking, baseline, diff/revert, persistence, session, commands, views, and webview contribution. Legacy top-level `src/pipeline`, `src/liveRemediation`, and `src/scanner` module folders are no longer part of the 2.0 architecture.

  *Se han añadido **fronteras de código completamente aisladas** para los módulos opcionales. Pipeline vive ahora en `src/modules/pipeline/` con su scanner, ejecución, plantillas, historial, configuración, comandos, vistas y contribución webview; Live Remediation vive en `src/modules/liveRemediation/` con su tracking, baseline, diff/revert, persistencia, sesión, comandos, vistas y contribución webview. Las antiguas carpetas de módulo `src/pipeline`, `src/liveRemediation` y `src/scanner` dejan de formar parte de la arquitectura 2.0.*

- Added a **generic module contract, registry/runtime, and capability broker**. `extension.ts` and `DashboardPanel` consume module contracts instead of concrete Pipeline/Live Remediation implementations. Cross-module actions such as repository analysis are requested through the generic `analyzeRepository` capability, so Live Remediation has no direct dependency on Pipeline.

  *Se ha añadido un **contrato, registro/runtime y broker de capacidades genérico para módulos**. `extension.ts` y `DashboardPanel` consumen contratos de módulo en lugar de implementaciones concretas de Pipeline/Live Remediation. Las acciones entre módulos, como el análisis del repositorio, se solicitan mediante la capacidad genérica `analyzeRepository`, por lo que Live Remediation no depende directamente de Pipeline.*

- Added **module-owned Dashboard webview contributions**. Each optional module owns its configuration markup, scripts, styles, pages, dialogs, and event integration, while reusable webview controls live under `src/shared/webview/`. The Dashboard webview consumes a single generic module facade and no longer contains Pipeline or Live Remediation implementation logic.

  *Se han añadido **contribuciones webview propiedad de cada módulo**. Cada módulo opcional es dueño de su markup de configuración, scripts, estilos, páginas, diálogos e integración de eventos, mientras que los controles webview reutilizables viven en `src/shared/webview/`. El webview del Dashboard consume una única fachada genérica de módulos y ya no contiene lógica de implementación de Pipeline o Live Remediation.*

- Added a dedicated **Pipeline configuration namespace** (`sonarQubeDashboard.pipeline.*`) so scanner, scope, build/custom commands, and pre/post-analysis settings are no longer part of the core SonarQube connection namespace. The 2.0 runtime reads and writes only the module-owned namespace.

  *Se ha añadido un **namespace de configuración propio de Pipeline** (`sonarQubeDashboard.pipeline.*`) para que scanner, alcance, comandos de build/personalizados y comandos pre/post análisis dejen de pertenecer al namespace de conexión SonarQube del core. El runtime 2.0 lee y escribe únicamente el namespace propiedad del módulo.*

- Added isolated module lifecycles. Pipeline services are created only while Pipeline is enabled, and the core owns the normal SonarQube diagnostic snapshot used by **Problems**, so Live Remediation can be mounted or removed without disabling server diagnostics or the rest of the Dashboard. Disabling Live Remediation unloads its runtime but preserves its persisted session; only explicit cleanup actions erase that state.

  *Se han añadido ciclos de vida aislados por módulo. Los servicios de Pipeline solo se crean mientras Pipeline está activo y el core mantiene el snapshot normal de diagnósticos de SonarQube utilizado por **Problems**, por lo que Live Remediation puede montarse o desmontarse sin desactivar los diagnósticos del servidor ni el resto del Dashboard. Desactivar Live Remediation descarga su runtime pero conserva la sesión persistida; solo las acciones explícitas de limpieza eliminan ese estado.*

- Added the native **Issues modified locally** workflow. Live Remediation tracks net changes to synchronized issues inside the editor and in files changed, copied, replaced, created, deleted, renamed, or saved externally. Multi-file operations are reconciled in batches, tracked ranges follow precise edits, and an issue returns to the server state automatically when its code is restored exactly to the captured baseline.

  *Se ha añadido el flujo nativo **Issues modificados localmente**. Live Remediation sigue los cambios netos de issues sincronizados dentro del editor y en archivos modificados, copiados, sustituidos, creados, eliminados, renombrados o guardados externamente. Las operaciones de múltiples archivos se reconcilian por lotes, los rangos seguidos acompañan las ediciones precisas y un issue vuelve automáticamente al estado del servidor cuando su código se restaura exactamente a la baseline capturada.*

- Added deterministic **Server ↔ Local diff** support for pending issues and guarded per-issue actions to **View change**, **Go to code**, and **Revert this change**. Automatic revert restores only the associated baseline block and is refused when the original location/context cannot be proven safe.

  *Se ha añadido soporte de **diff Servidor ↔ Local** determinista para los issues pendientes y acciones protegidas por issue para **Ver cambio**, **Ir al código** y **Revertir este cambio**. El revert automático restaura únicamente el bloque asociado de la baseline y se rechaza cuando no puede demostrarse con seguridad la ubicación/contexto original.*

- Added a persistent **Remediation Session** to the native view, with start time, current modified/pending counters, and an **Analyze repository** action. Ordinary synchronization/startup refreshes preserve pending remediation state; only the real SonarQube snapshot produced by a repository analysis can validate pending modifications.

  *Se ha añadido una **Sesión de remediación** persistente a la vista nativa, con hora de inicio, contadores actuales de modificados/pendientes y la acción **Analizar repositorio**. Las sincronizaciones normales y los refresh de arranque conservan el estado de remediación pendiente; solo el snapshot real de SonarQube producido por un análisis del repositorio puede validar las modificaciones pendientes.*

- Added the **After latest analysis / Tras último análisis** accordion. It records the validation time and separates **Solved** issues from issues **Still detected** by the latest real server analysis. Still-detected entries use the new location returned by SonarQube and navigate directly to that current file/line.

  *Se ha añadido el acordeón **Tras último análisis / After latest analysis**. Registra la hora de validación y separa los issues **Solucionados** de los que **Siguen detectándose** en el último análisis real del servidor. Las entradas que siguen detectándose utilizan la ubicación nueva devuelta por SonarQube y navegan directamente a ese archivo/línea actual.*

- Added a **Solved history** capped at 20 confirmed remediations. Only a real SonarQube server analysis can add a confirmation; local edits or SonarQube for IDE diagnostics never mark an issue as solved on their own.

  *Se ha añadido un **Historial de solucionados** limitado a 20 remediaciones confirmadas. Solo un análisis real de SonarQube Server puede añadir una confirmación; las ediciones locales o los diagnósticos de SonarQube for IDE nunca marcan por sí solos un issue como solucionado.*

- Added full **per-workspace remediation-session persistence** using VS Code `workspaceState` (schema v4 with automatic migration from v3). Pending changes, baselines/ranges, session start, latest-analysis results, still-detected results, and solved history survive window reloads and VS Code restarts and are surfaced immediately while the first server refresh is still loading.

  *Se ha añadido persistencia completa de la **sesión de remediación por workspace** mediante `workspaceState` de VS Code (esquema v4 con migración automática desde v3). Los cambios pendientes, baselines/rangos, inicio de sesión, resultados del último análisis, issues que siguen detectándose e historial de solucionados sobreviven a recargas y reinicios de VS Code y se muestran inmediatamente mientras todavía se carga el primer refresh del servidor.*

- Added independent cleanup actions with native confirmation modals: a trash action on **Remediation Session** resets all session-local pending/results/history without modifying source files or SonarQube Server; separate trash actions clear only **Solved** or only **Still detected** results from the latest analysis. Clearing the latest solved results does not erase the accumulated solved history.

  *Se han añadido acciones de limpieza independientes con modales nativos de confirmación: una papelera en **Sesión de remediación** reinicia todos los pendientes/resultados/historial locales de la sesión sin modificar archivos fuente ni SonarQube Server; papeleras separadas eliminan únicamente **Solucionados** o únicamente **Siguen detectándose** del último análisis. Limpiar los solucionados del último análisis no borra el historial acumulado de solucionados.*

### Fixed

- Module activation and deactivation are now transactional and both require confirmation. Module checkboxes keep the last confirmed value while the modal/lifecycle transition is pending, enabled state is persisted only after lazy activation succeeds, failed activation is rolled back, and synchronization reloads an implementation when persisted state and the active runtime become inconsistent. This fixes Pipeline remaining absent after it was disabled and enabled again.

  *La activación y desactivación de módulos son ahora transaccionales y ambas requieren confirmación. Los checkbox conservan el último valor confirmado mientras están pendientes el modal y la transición del ciclo de vida, el estado activo solo se persiste después de completar correctamente la activación lazy, una activación fallida se revierte y la sincronización vuelve a cargar una implementación cuando el estado persistido y el runtime activo quedan incoherentes. Esto corrige que Pipeline siguiera ausente después de desactivarlo y volverlo a activar.*

- Dashboard recomposition now preserves **Configuration → Modules** from the first rendered frame. Enabling or disabling a module no longer switches to **SonarQube** or briefly flashes the **Data** page while module-owned HTML, CSS, and JavaScript are rebuilt.

  *La recomposición del Dashboard conserva ahora **Configuración → Módulos** desde el primer frame renderizado. Activar o desactivar un módulo ya no cambia a **SonarQube** ni muestra brevemente la página **Datos** mientras se reconstruyen el HTML, CSS y JavaScript propiedad del módulo.*

- Fixed Live Remediation event matching on Windows by normalizing file URI identity across server snapshots, editor changes, saves, watchers, open documents, and persisted sessions. Direct edits to an issue range now take precedence over global block relocation, preventing an identical line elsewhere in the file from hiding a real **Modified locally** change.

  *Se ha corregido la asociación de eventos de Live Remediation en Windows normalizando la identidad de las URI entre snapshots del servidor, cambios del editor, guardados, watchers, documentos abiertos y sesiones persistidas. Las ediciones directas sobre un rango de issue tienen ahora prioridad sobre la relocalización global de bloques, evitando que una línea idéntica en otra parte del archivo oculte un cambio real **Modificado localmente**.*

## [1.4.0] - 2026-08-13

### Added

- Added **Live remediation state** for synchronized SonarQube issues. Editing the range of a published issue immediately changes its local state to **Modified locally · pending validation** instead of presenting the stale server severity as if the file had not changed.

  *Se ha añadido el **estado de remediación en vivo** para los issues sincronizados de SonarQube. Al editar el rango de un defecto publicado, su estado local cambia inmediatamente a **Modificado localmente · pendiente de validación**, evitando mostrar la severidad antigua del servidor como si el archivo no hubiese cambiado.*

- When the official **SonarQube for IDE** extension has independently reported the same rule and location, SonarQube Dashboard observes its real-time diagnostics. If that local diagnostic disappears after the edit, the server issue becomes **Fixed locally · awaiting SonarQube confirmation**, remains in **Problems** as an informational pending-confirmation entry, is excluded from normal issue navigation, and keeps an explicit green marker in the editor until the next repository analysis confirms the server state.

  *Cuando la extensión oficial **SonarQube for IDE** ha informado de forma independiente de la misma regla y ubicación, SonarQube Dashboard observa sus diagnósticos en tiempo real. Si ese diagnóstico local desaparece después de editar, el issue del servidor pasa a **Corregido localmente · pendiente de confirmación de SonarQube**, permanece en **Problems** como una entrada informativa pendiente de confirmación, se excluye de la navegación normal de defectos y mantiene un marcador verde explícito en el editor hasta que el siguiente análisis del repositorio confirme el estado del servidor.*

- A dedicated status-bar indicator summarizes locally modified and locally fixed findings. Selecting it opens the repository-analysis flow so the pending local state can be confirmed by SonarQube Server.

  *Un indicador específico de la barra de estado resume los defectos modificados y corregidos localmente. Al seleccionarlo se abre el flujo de análisis del repositorio para poder confirmar en SonarQube Server el estado local pendiente.*

- Added the `sonarQubeDashboard.liveRemediation.enabled` setting, enabled by default, plus an **Editor integration** toggle in the SonarQube configuration page. The behavior can be enabled or disabled immediately without affecting normal SonarQube synchronization.

  *Se ha añadido el ajuste `sonarQubeDashboard.liveRemediation.enabled`, activado de forma predeterminada, junto con un interruptor de **Integración con el editor** en la configuración de SonarQube. El comportamiento puede activarse o desactivarse inmediatamente sin afectar a la sincronización normal con SonarQube.*

- The Activity Bar container now exposes **Issues fixed locally** as its own native collapsible view, alongside **Pipeline executions** and **Issue explorer**, instead of embedding that list inside the summary webview. Each pending finding shows its rule, file and tracked line with a green fixed icon, and selecting it opens the exact location in the editor.

  *El contenedor de la barra de actividad expone ahora **Issues corregidos localmente** como una vista nativa desplegable independiente, al mismo nivel que **Ejecuciones del pipeline** y **Explorador de issues**, en lugar de incrustar la lista dentro del webview de Resumen. Cada hallazgo pendiente muestra su regla, archivo y línea seguida con un icono verde de corrección, y al seleccionarlo se abre la ubicación exacta en el editor.*

- Repository-analysis completion notifications now report how many **Fixed locally** findings were confirmed by SonarQube Server and therefore removed from the pending-remediation view. The confirmation is included in the same bottom-right notification used for a completed analysis, avoiding an additional popup.

  *Las notificaciones de finalización del análisis del repositorio indican ahora cuántos defectos **Corregidos localmente** han sido confirmados por SonarQube Server y, por tanto, eliminados de la vista de remediación pendiente. La confirmación se incluye en la misma notificación inferior derecha utilizada al finalizar el análisis, evitando mostrar un aviso adicional.*

### Changed

- Live remediation is now fully migrated to `src/liveRemediation/` and split into focused modules for state management, persistence, range tracking, SonarQube for IDE diagnostic correlation, diagnostics, shared models/constants, and the native locally-fixed tree view. The previous root-level compatibility facades have been removed; all internal consumers now import the dedicated module directly.

  *La remediación en vivo queda migrada por completo a `src/liveRemediation/` y se divide en módulos específicos para gestión de estado, persistencia, seguimiento de rangos, correlación de diagnósticos con SonarQube for IDE, diagnósticos, modelos/constantes compartidos y la vista nativa de issues corregidos localmente. Se eliminan las antiguas fachadas de compatibilidad de la raíz y todos los consumidores internos importan directamente el módulo dedicado.*

- Pipeline functionality is now centralized under `src/pipeline/`. Execution orchestration, history, templates, project-action detection, baseline comparison, pipeline models/constants, the native execution tree, and pipeline-specific webview scripts/pages/modals now live behind the pipeline module instead of being scattered across the root, `scanner/`, and dashboard webview folders.

  *La funcionalidad de pipeline queda ahora centralizada bajo `src/pipeline/`. La orquestación de ejecuciones, historial, plantillas, detección de acciones del proyecto, comparación de línea base, modelos/constantes del pipeline, la vista nativa de ejecuciones y los scripts/páginas/modales específicos del pipeline pasan a vivir detrás del módulo de pipeline en lugar de estar repartidos entre la raíz, `scanner/` y las carpetas del webview del dashboard.*

- Pending-remediation persistence is now debounced instead of writing `workspaceState` on every keystroke, and external Sonar diagnostic snapshots are deduplicated so dashboard-owned marker updates do not schedule unnecessary SonarQube for IDE reevaluations.

  *La persistencia de la remediación pendiente se agrupa ahora mediante debounce en lugar de escribir `workspaceState` en cada pulsación, y los snapshots de diagnósticos Sonar externos se deduplican para que las actualizaciones de marcadores del propio dashboard no programen reevaluaciones innecesarias de SonarQube for IDE.*

- Live remediation now explicitly detects the official **SonarQube for IDE** VS Code extension and shows its installed/active state in **Configuration → SonarQube → Editor integration**. SonarQube for IDE remains optional: without an active local analyzer, edited findings stay pending validation until the next server analysis.

  *La remediación en vivo detecta ahora explícitamente la extensión oficial **SonarQube for IDE** para VS Code y muestra su estado instalado/activo en **Configuración → SonarQube → Integración con el editor**. SonarQube for IDE sigue siendo opcional: sin un analizador local activo, los defectos editados permanecen pendientes de validación hasta el siguiente análisis del servidor.*

- Local edits now keep issue ranges aligned as text is inserted, removed, or replaced. A modified issue is temporarily published as an informational diagnostic while it awaits local/server validation, rather than keeping the original Error/Warning severity unchanged.

  *Las ediciones locales mantienen ahora alineados los rangos de los issues cuando se inserta, elimina o reemplaza texto. Un defecto modificado se publica temporalmente como diagnóstico informativo mientras espera validación local/del servidor, en lugar de conservar sin cambios la severidad Error/Warning original.*

- Server analysis remains authoritative, while ordinary dashboard refreshes preserve pending local-remediation states. **Locally fixed** findings therefore keep their green **awaiting SonarQube confirmation** marker until a repository analysis confirms the new server state; issues still returned after that analysis become open again, while issues no longer returned disappear permanently.

  *El análisis del servidor sigue siendo autoritativo, mientras que las actualizaciones normales del dashboard conservan los estados locales pendientes. Por ello, los defectos **corregidos localmente** mantienen su marcador verde de **pendiente de confirmación de SonarQube** hasta que un análisis del repositorio confirma el nuevo estado del servidor; los issues que sigan apareciendo después de ese análisis vuelven a estado abierto y los que ya no se devuelvan desaparecen definitivamente.*

- The integration with SonarQube for IDE is intentionally conservative: an issue is only classified as locally fixed when the same rule/location had previously been observed from an external Sonar diagnostic. If no independent local analyzer confirmation exists, the extension keeps the safer **Modified locally · pending validation** state.

  *La integración con SonarQube for IDE es deliberadamente conservadora: un issue solo se clasifica como corregido localmente cuando la misma regla/ubicación se había observado previamente mediante un diagnóstico Sonar externo. Si no existe confirmación independiente del analizador local, la extensión mantiene el estado más seguro **Modificado localmente · pendiente de validación**.*

### Fixed

- Fixed a modularization regression where `src/constants.ts` had been accidentally replaced with Live Remediation constants, breaking imports across configuration, diagnostics, dashboard, issue navigation, notifications, and SonarQube API code. Pipeline history previews now also accept the token-free form configuration they actually consume instead of requiring a full `FolderSonarConfig` containing the secret token.

  *Corregida una regresión de la modularización por la que `src/constants.ts` había sido sustituido accidentalmente por constantes de Live Remediation, rompiendo imports de configuración, diagnósticos, dashboard, navegación de issues, notificaciones y API de SonarQube. Las previsualizaciones del historial del pipeline aceptan además la configuración de formulario sin token que realmente consumen, en lugar de exigir un `FolderSonarConfig` completo que contenga el token secreto.*

- SonarQube for IDE correlation now performs one-to-one nearest-position matching for findings that share the same rule, preventing a single local IDE diagnostic from being associated with multiple nearby server issues. Persisted `Modified locally` findings also require fresh SonarQube for IDE evidence after a VS Code restart before they can become `Fixed locally`, avoiding false local fixes caused by stale pre-restart evidence. Persisted `Fixed locally` findings are also downgraded immediately to `Modified locally` if the official IDE analyzer already reports the same finding again when the workspace is restored.

  *La correlación con SonarQube for IDE realiza ahora una asignación uno-a-uno por posición más cercana para defectos que comparten la misma regla, evitando que un único diagnóstico local se asocie a varios issues de servidor próximos. Además, los defectos `Modificado localmente` persistidos requieren evidencia nueva de SonarQube for IDE después de reiniciar VS Code antes de poder pasar a `Corregido localmente`, evitando falsos positivos provocados por evidencia obsoleta de la sesión anterior. Los defectos `Corregido localmente` persistidos también vuelven inmediatamente a `Modificado localmente` si el analizador oficial del IDE ya vuelve a informar del mismo defecto al restaurar el workspace.*

- Pending **Modified locally** and **Fixed locally · awaiting SonarQube confirmation** states are now persisted in workspace state. Reloading or restarting VS Code restores the pending state, tracked range, and local-analyzer evidence instead of publishing the stale server issue as open again. A completed repository analysis remains authoritative and clears or restores the persisted state according to the new SonarQube result.

  *Los estados pendientes **Modificado localmente** y **Corregido localmente · pendiente de confirmación de SonarQube** se guardan ahora en el estado del workspace. Al recargar o reiniciar VS Code se restauran el estado pendiente, el rango seguido y la evidencia del analizador local, en lugar de volver a publicar como abierto el issue antiguo del servidor. Un análisis completo del repositorio sigue siendo autoritativo y limpia o restaura el estado persistido según el nuevo resultado de SonarQube.*

- When VS Code restores a window with a source file already active, SonarQube Dashboard now republishes that file in a separate delayed diagnostic update and keeps locally-fixed pending entries in **Problems**. This gives the native `problems.autoReveal` behavior a distinct active-resource marker change after startup synchronization, so the restored active file is revealed instead of an earlier file whenever auto-reveal is enabled.

  *Cuando VS Code restaura una ventana con un archivo de código ya activo, SonarQube Dashboard vuelve a publicar ese archivo mediante una actualización de diagnósticos separada y retrasada y mantiene en **Problems** las entradas pendientes corregidas localmente. Así, el comportamiento nativo `problems.autoReveal` recibe un cambio de marcadores específico del recurso activo tras la sincronización inicial y revela el archivo restaurado en lugar de uno anterior siempre que el auto-reveal esté activado.*

- Fixed Live Remediation losing **Modified locally** when an edit is made immediately next to a narrow Sonar diagnostic range (for example while changing an escaped token). Adjacent token edits, Quick Fix replacements, Undo and Redo now keep the finding in the local-modified state, and SonarQube for IDE continuing to report the issue no longer resets it to the stale server state; only a new repository analysis can do that authoritatively.

  *Corregida la pérdida del estado **Modificado localmente** cuando una edición se realiza justo al lado de un rango estrecho de diagnóstico de Sonar (por ejemplo al cambiar un token escapado). Las ediciones adyacentes, los Quick Fix, Undo y Redo mantienen ahora el defecto como modificado localmente, y que SonarQube for IDE siga detectándolo ya no lo devuelve al estado antiguo del servidor; solo un nuevo análisis del repositorio puede hacerlo de forma autoritativa.*

- Disabling or removing SonarQube for IDE can no longer be mistaken for a locally fixed issue: promotion to **Fixed locally** is evaluated only while the official extension is active.

  *Desactivar o eliminar SonarQube for IDE ya no puede confundirse con un defecto corregido localmente: la promoción a **Corregido localmente** solo se evalúa mientras la extensión oficial está activa.*

- Fixed the **Locally fixed** editor state being cleared by ordinary synchronization before a new SonarQube analysis had actually confirmed the result. The pending-confirmation message now remains visible and is rendered with an explicit green success color until server confirmation.

  *Corregido el estado **Corregido localmente** del editor para que una sincronización normal no lo elimine antes de que un nuevo análisis de SonarQube confirme realmente el resultado. El mensaje pendiente de confirmación permanece ahora visible y se representa con un color verde de éxito explícito hasta la confirmación del servidor.*

## [1.3.0] - 2026-08-13

### Added

- Opening or switching to a local file that contains SonarQube diagnostics now automatically reveals the first SonarQube problem in that file. The cursor is placed on the first published diagnostic and the editor scrolls to it, while explicit navigation to a specific issue keeps its requested target.

  *Al abrir o cambiar a un archivo local que contiene diagnósticos de SonarQube, la extensión muestra automáticamente el primer defecto de SonarQube de ese archivo. El cursor se sitúa en el primer diagnóstico publicado y el editor se desplaza hasta él, mientras que la navegación explícita a un defecto concreto mantiene el destino solicitado.*

- Repository analysis now captures a local SonarQube baseline immediately before the pipeline starts and compares it with the metrics published after SonarQube finishes processing the new analysis. The **Pipeline executions** history detail shows before/after values and deltas for **Issues**, **Security Hotspots**, **Coverage**, **Duplication**, and the **Quality Gate**.

  *El análisis del repositorio captura ahora una línea base local de SonarQube justo antes de iniciar el pipeline y la compara con las métricas publicadas después de que SonarQube termine de procesar el nuevo análisis. El detalle del historial de **Ejecuciones del pipeline** muestra los valores antes/después y sus variaciones para **Issues**, **Security Hotspots**, **Cobertura**, **Duplicación** y el **Quality Gate**.*

- The comparison is also stored with the pipeline execution history, so completed runs keep their exact baseline even after newer analyses are published. The native **Pipeline executions** tree surfaces the issue delta and the execution detail page renders the complete comparison.

  *La comparación se guarda también junto al historial de ejecuciones del pipeline, por lo que cada ejecución finalizada conserva su línea base exacta aunque posteriormente se publiquen nuevos análisis. La vista nativa **Ejecuciones del pipeline** muestra la variación de issues y la página de detalle representa la comparación completa.*

- The baseline comparison is kept out of the live analysis modal and main dashboard and is presented only in pipeline history, avoiding layout noise while the scanner is running.

  *La comparación de línea base se mantiene fuera del modal de análisis en vivo y del dashboard principal y se presenta únicamente en el historial del pipeline, evitando ruido visual mientras se ejecuta el scanner.*

- Informational historical badges such as the first-measurement state use the VS Code badge foreground color, keeping their text readable on badge backgrounds in dark themes.

  *Los badges informativos del historial, como el estado de primera medición, utilizan el color de primer plano de los badges de VS Code, manteniendo el texto legible sobre sus fondos en temas oscuros.*

### Changed

- Starting a repository analysis now uses a two-step wizard. **Step 1 — Select template** lets the user choose a pipeline template and adjust the execution steps. **Step 2 — Confirmation** shows the effective project, analysis folder (including the configured local subfolder), scanner method, selected template, SonarQube inclusions/exclusions, and the ordered steps before the pipeline starts.

  *El inicio de un análisis del repositorio utiliza ahora un asistente de dos pasos. **Paso 1 — Seleccionar plantilla** permite elegir una plantilla de pipeline y ajustar los pasos de la ejecución. **Paso 2 — Confirmación** muestra el proyecto efectivo, la carpeta que se analizará (incluida la subcarpeta local configurada), el método del scanner, la plantilla seleccionada, las inclusiones/exclusiones de SonarQube y los pasos ordenados antes de iniciar el pipeline.*

- Historical before/after cards no longer render a neutral blue delta badge when a metric did not change. The before/after value remains visible, while badges are reserved for real changes or the first-measurement state.

  *Las tarjetas históricas de comparación antes/después ya no muestran un badge azul neutro cuando una métrica no ha variado. El valor antes/después sigue visible y los badges se reservan para cambios reales o para el estado de primera medición.*

- Baseline capture is project-specific and uses lightweight project-level SonarQube measures instead of reloading the complete issue/file dataset, so it remains accurate in multi-folder workspaces without adding a second full dashboard refresh before and after every pipeline. A failure to capture the optional baseline does not block repository analysis.

  *La captura de la línea base es específica del proyecto y utiliza métricas ligeras de proyecto de SonarQube en lugar de volver a cargar todo el conjunto de issues/archivos, por lo que sigue siendo precisa en workspaces con varias carpetas sin añadir una segunda recarga completa del dashboard antes y después de cada pipeline. Un fallo al capturar esta línea base opcional no bloquea el análisis del repositorio.*

- When a project has no previous SonarQube analysis, the result is treated as the first measurement instead of comparing artificial zero values. The published metrics become the new baseline for the next run.

  *Cuando un proyecto todavía no tiene un análisis previo de SonarQube, el resultado se trata como primera medición en lugar de compararlo contra ceros artificiales. Las métricas publicadas pasan a ser la nueva línea base para la siguiente ejecución.*

## [1.2.2] - 2026-08-13

### Added

- SonarQube issues published in the editor now expose native VS Code **Quick Fix** actions from the light bulb: **View rule**, **Mark as accepted**, **Assign issue to me**, **Open in SonarQube**, and **Manage issue in Dashboard**. The actions use the current SonarQube token and refresh the workspace data after remote issue mutations.

  *Los issues de SonarQube publicados en el editor incorporan ahora acciones nativas **Quick Fix** desde la bombilla de VS Code: **Ver regla**, **Marcar como aceptado**, **Asignarme issue**, **Abrir en SonarQube** y **Gestionar defecto en Dashboard**. Las acciones utilizan el token actual de SonarQube y actualizan los datos del workspace después de modificar un issue remoto.*

## [1.2.1] - 2026-08-13

### Changed

- Selecting a pipeline template in **Template for this run** now applies its steps immediately. The separate **Apply template** button has been removed, and selecting **No template** restores the run to the required SonarQube analysis step for manual customization.

  *Al seleccionar una plantilla de pipeline en **Plantilla para esta ejecución**, sus pasos se aplican ahora de forma inmediata. Se ha eliminado el botón independiente **Aplicar plantilla** y seleccionar **Sin plantilla** devuelve la ejecución al paso obligatorio de análisis de SonarQube para poder personalizarla manualmente.*

## [1.2.0] - 2026-08-09

### Added

- The extension now opens `CHANGELOG.md` automatically on the first activation of each installed version. The last displayed version is stored globally, so release notes are shown once after installation or update and are not reopened on subsequent starts of the same version.

  *La extensión abre ahora `CHANGELOG.md` automáticamente en la primera activación de cada versión instalada. La última versión mostrada se guarda globalmente, por lo que las notas de la versión se muestran una sola vez tras instalar o actualizar y no vuelven a abrirse en los siguientes inicios de esa misma versión.*

- The **SonarQube** configuration tab now includes a dedicated **Analysis inclusions and exclusions** accordion for `sonar.inclusions` and `sonar.exclusions`. Patterns can be entered one per line or separated with commas and are applied to the built-in Maven, Gradle, .NET, NPM, and Docker analysis flows.

  *La pestaña de configuración **SonarQube** incorpora un nuevo acordeón de **Inclusiones y exclusiones del análisis** para `sonar.inclusions` y `sonar.exclusions`. Los patrones pueden introducirse uno por línea o separados por comas y se aplican a los flujos integrados de Maven, Gradle, .NET, NPM y Docker.*

- Custom scanner commands can use `${analysisInclusions}` and `${analysisExclusions}` with the normalized pattern lists.

  *Los comandos de scanner personalizados pueden utilizar `${analysisInclusions}` y `${analysisExclusions}` con las listas de patrones normalizadas.*

### Changed

- Analysis-scope settings are stored per workspace folder and exposed through the extension settings as `sonarQubeDashboard.sonar.analysisInclusions` and `sonarQubeDashboard.sonar.analysisExclusions`. The accordion now has its own **Save inclusions and exclusions** action and inline save status, so the scope can be persisted independently from the rest of the SonarQube configuration.

  *La configuración del alcance del análisis se guarda por carpeta del workspace y se expone en los ajustes de la extensión como `sonarQubeDashboard.sonar.analysisInclusions` y `sonarQubeDashboard.sonar.analysisExclusions`. El acordeón dispone ahora de su propia acción **Guardar inclusiones y exclusiones** y estado de guardado junto al botón, por lo que el alcance puede persistirse de forma independiente al resto de la configuración de SonarQube.*

- Analysis inclusions and exclusions are cleared when the SonarQube connection is reloaded or when a different project/application is synchronized, preventing a project-specific scope from being reused accidentally with another component.

  *Las inclusiones y exclusiones del análisis se restablecen al volver a cargar la conexión de SonarQube o al sincronizar un proyecto/aplicación diferente, evitando reutilizar por error un alcance específico de otro componente.*

- English and Spanish translations and both README files now document the analysis-scope configuration and its independent save/reset behavior.

  *Se han actualizado las traducciones en inglés y español y ambos README para documentar la configuración del alcance del análisis y su comportamiento independiente de guardado/restablecimiento.*

- The **SonarQube Dashboard** editor tab now uses the same SonarQube icon as the VS Code activity bar, with a dedicated white variant for dark themes to keep the icon clearly visible.

  *La pestaña del editor **SonarQube Dashboard** utiliza ahora el mismo icono de SonarQube que la barra de actividad de VS Code, con una variante blanca específica para temas oscuros que mantiene el icono claramente visible.*

### Fixed

- Removed the leading horizontal inset from the **SonarQube / Pipeline / Notifications** tab bar so the first tab starts flush with the configuration panel.

  *Se ha eliminado la separación horizontal inicial de la barra de pestañas **SonarQube / Pipeline / Notificaciones**, de modo que la primera pestaña comienza alineada con el panel de configuración.*

- Stabilized the repository-analysis status panel so its height no longer changes between idle and running states, with the status text vertically aligned with the analysis icon and long content truncated instead of resizing the panel.

  *Se ha estabilizado el panel de estado del análisis del repositorio para que su altura no cambie entre reposo y ejecución, manteniendo el texto alineado verticalmente con el icono de análisis y truncando el contenido largo en lugar de redimensionar el panel.*

- Pipeline console output and execution history now use a generic terminal renderer for any tool, preserving ANSI colors, Unicode symbols, carriage-return progress updates, cursor/line control sequences, tabs, spacing, and streamed stdout/stderr chunks instead of printing terminal escape codes literally.

  *La consola del pipeline y el historial de ejecuciones utilizan ahora un renderizador de terminal genérico para cualquier herramienta, conservando colores ANSI, símbolos Unicode, actualizaciones de progreso mediante retorno de carro, secuencias de control de cursor/línea, tabulaciones, espacios y chunks de stdout/stderr en streaming, en lugar de imprimir literalmente los códigos de escape del terminal.*

## [1.1.0] - 2026-08-08

### Added

- The **Issues** table now includes a dedicated **Filters** action that opens the existing dashboard modal component.

  *La tabla de **Issues** incorpora una acción específica de **Filtros** que abre el componente de modal existente del dashboard.*

- Issue filters are available for **severity**, **type**, **status**, **file**, and **rule**, with an active-filter counter displayed on the Filters button.

  *Los filtros de issues permiten filtrar por **severidad**, **tipo**, **estado**, **archivo** y **regla**, mostrando además en el botón de Filtros el número de filtros activos.*

- A new copy action is available next to the Issues search field. It exports every issue in the current scope using a compact structure containing, in this exact order: **rule name, file, line, severity, and issue type**.

  *Se ha añadido una nueva acción de copia junto al buscador de Issues. Exporta todos los issues del ámbito actual con una estructura compacta que contiene, exactamente en este orden: **nombre de la regla, archivo, línea, severidad y tipo de defecto**.*

- The copied issue text is intentionally prepared as concise context for **AI-assisted remediation**: it can be pasted into an AI assistant so the model receives the relevant SonarQube findings and can work through the listed defects without unnecessary issue metadata.

  *El texto copiado está preparado expresamente como contexto conciso para la **corrección asistida por IA**: puede pegarse en un asistente de IA para que el modelo reciba los hallazgos relevantes de SonarQube y pueda trabajar en la corrección de todos los defectos indicados sin incluir metadatos innecesarios.*

### Changed

- Issue filters now use a draft-and-apply workflow. Changing a field inside the modal does not affect the table until **Apply** is pressed.

  *Los filtros de Issues utilizan ahora un flujo de edición y aplicación. Cambiar un campo dentro del modal no modifica la tabla hasta pulsar **Aplicar**.*

- The dashboard now distinguishes between **a project with no SonarQube analysis yet** and **an analyzed project with zero issues** instead of inferring analysis state from the issue count.

  *El dashboard distingue ahora entre **un proyecto que todavía no tiene ningún análisis de SonarQube** y **un proyecto analizado con cero issues**, en lugar de deducir el estado del análisis a partir del número de issues.*

- When no analysis exists, the **Overall** and **New Code** scope controls are disabled until SonarQube has published the first analysis.

  *Cuando no existe ningún análisis, los controles de ámbito **Overall** y **New Code** permanecen deshabilitados hasta que SonarQube publique el primer análisis.*

- Historical evolution sections for **issues**, **coverage**, and **duplication** are hidden until at least two SonarQube analyses are available for comparison.

  *Las secciones de evolución histórica de **issues**, **cobertura** y **duplicación** permanecen ocultas hasta que existan al menos dos análisis de SonarQube que puedan compararse.*

- In **Coverage and duplication**, metric cards and the **Lowest coverage files** / **Most duplicated files** tables are hidden when no analysis exists. The view now shows the same empty-state container used by the Issues view.

  *En **Cobertura y duplicación**, las tarjetas de métricas y las tablas **Archivos con menor cobertura** / **Archivos con mayor duplicación** se ocultan cuando todavía no existe ningún análisis. La vista muestra ahora el mismo contenedor de estado vacío utilizado en Issues.*

- The **Security Hotspots** view uses the same no-analysis empty state and now differentiates it from a completed analysis containing zero hotspots.

  *La vista de **Security Hotspots** utiliza el mismo estado vacío cuando no existe ningún análisis y lo diferencia de un análisis completado que contiene cero hotspots.*

- The side **Summary** panel follows the same analysis-state logic. Before the first analysis, issue totals, severity/type breakdowns, Quality Gate, and ratings are hidden and replaced with the no-analysis state; after an analysis with zero issues, the normal zero-value summary is shown.

  *El panel lateral de **Resumen** sigue la misma lógica de estado del análisis. Antes del primer análisis se ocultan los totales de issues, desgloses por severidad/tipo, Quality Gate y ratings, mostrando en su lugar el estado sin análisis; después de un análisis con cero issues se muestra normalmente el resumen con valores a cero.*

### Fixed

- Empty states are now consistent across **Issues**, **Security Hotspots**, **Coverage and duplication**, and the side Summary panel, avoiding misleading zero-result screens before the first analysis.

  *Los estados vacíos son ahora coherentes entre **Issues**, **Security Hotspots**, **Cobertura y duplicación** y el panel lateral de Resumen, evitando mostrar resultados a cero que puedan interpretarse erróneamente antes del primer análisis.*

- Projects with a valid first analysis but no issues are no longer treated as projects that have never been analyzed.

  *Los proyectos con un primer análisis válido pero sin issues ya no se tratan como proyectos que nunca han sido analizados.*
## [1.0.2] - 2026-08-07

### Added

- Native **Get Started** walkthrough for the first SonarQube connection, synchronization, pipeline execution, and result review.

  *Walkthrough nativo de **Primeros pasos** para la primera conexión con SonarQube, sincronización, ejecución del pipeline y revisión de resultados.*

- Contextual welcome actions in empty **Issue explorer** and **Pipeline executions** views.

  *Acciones contextuales de bienvenida en las vistas vacías **Explorador de issues** y **Ejecuciones del pipeline**.*

### Changed

- Marketplace documentation now exposes the real analysis workflow and technical value proposition before the full reference guide.

  *La documentación de Marketplace muestra ahora el flujo real de análisis y la propuesta técnica antes de la guía de referencia completa.*

## [1.0.0] - 2026-08-02

### Changed

- Marketplace launch under the **SonarQube Dashboard & Pipeline** name with optimized description, categories, keywords, gallery banner, screenshots, trust documentation, support links, and bilingual positioning.

  *Lanzamiento en Marketplace con el nombre **SonarQube Dashboard & Pipeline**, descripción, categorías, palabras clave, banner, capturas, documentación de confianza, soporte y posicionamiento bilingüe optimizados.*

### Added

- GitHub issue templates, CI packaging workflow, manual Marketplace publishing workflow, reproducible demo project, and a launch and content kit.

  *Plantillas de incidencias, workflow de CI y empaquetado, publicación manual en Marketplace, proyecto de demostración y kit de lanzamiento y contenidos.*

- Security, privacy, support, and contribution documentation.

  *Documentación de seguridad, privacidad, soporte y contribución.*

## [0.21.0] - 2026-08-01

### Added

*Añadido*

- **Diagnostics** page with VS Code, Node.js, and extension versions, SonarQube status and latency, compatibility profile, detected scanner, automatic commands, available tools, and the last failed request.

  *Pantalla **Diagnóstico** con versiones de VS Code, Node.js y la extensión, estado y latencia de SonarQube, perfil de compatibilidad, scanner detectado, comandos automáticos, herramientas disponibles y última petición fallida.*

- Copyable technical report with tokens, credentials, secrets, API keys, and Bearer headers redacted.

  *Botón para copiar un informe técnico con ocultación de tokens, credenciales, secretos, API keys y cabeceras Bearer.*

- Native **Pipeline executions** side-bar view with the latest 30 runs per folder.

  *Vista nativa **Ejecuciones del pipeline** en la barra lateral, con las últimas 30 ejecuciones por carpeta.*

- Dedicated run detail page with status, duration, scanner, steps, historical console output, and live updates for active runs.

  *Página de detalle para cada ejecución, con estado, duración, scanner, pasos, consola histórica y actualización en tiempo real para ejecuciones activas.*

- Built-in **Quick**, **Complete**, **Security**, and **Release** templates, plus custom templates.

  *Plantillas integradas **Rápido**, **Completo**, **Seguridad** y **Release**, además de plantillas personalizadas.*

- Versioned YAML (`version: 1`) template import and export preserving order, failure policy, and position relative to SonarQube.

  *Importación y exportación de plantillas mediante YAML versionado (`version: 1`) conservando el orden, la política de fallo y la posición respecto a SonarQube.*

- Configuration split into **SonarQube**, **Pipeline**, and **Notifications** tabs with separate accordions.

  *Configuración dividida en las pestañas **SonarQube**, **Pipeline** y **Notificaciones**, con acordeones independientes.*


### Changed

*Cambiado*

- The template editor can inspect, add, remove, and reorder template steps without changing the project's main step list.

  *El editor de plantillas permite ver, añadir, eliminar y reordenar sus pasos sin modificar la lista general de pasos del proyecto.*

- Built-in templates can be customized per workspace without duplicates; deleting the override restores the original definition.

  *Las plantillas predeterminadas pueden personalizarse por workspace sin crear duplicados; al eliminar la personalización se restaura la definición original.*

- Predefined integrations disappear from the available list when added to the pipeline and return when removed.

  *Las integraciones predefinidas desaparecen de la lista de disponibles al añadirse al pipeline y vuelven a mostrarse cuando se eliminan.*

- Diagnostics displays only automatically detected commands and uses more compact monochrome cards.

  *Diagnóstico muestra únicamente comandos detectados automáticamente y utiliza tarjetas monocromas más compactas.*

- **Diagnostics** in the side panel is shown as a compact information icon, with separators between navigation options.

  *El acceso a **Diagnóstico** en el panel lateral se muestra como un icono de información compacto, con separadores entre las opciones de navegación.*

- Active and completed runs open the same detail page; active runs update their console without rebuilding the whole view.

  *Las ejecuciones activas y finalizadas abren la misma página de detalle; las activas actualizan su consola sin reconstruir toda la vista.*


### Fixed

*Corregido*

- Prevented the loading-container flash when switching between runs.

  *Evitado el parpadeo del contenedor de carga al cambiar entre ejecuciones.*

- Prevented spinner and scroll resets when new console lines arrive.

  *Evitado el reinicio del spinner y del scroll al recibir nuevas líneas de consola.*

- Removed duplicated active runs from the side-bar view.

  *Eliminadas las ejecuciones activas duplicadas en la vista lateral.*

- Fixed template deletion with a confirmation prompt.

  *Corregida la eliminación de plantillas con confirmación previa.*

- Fixed duplicated integrations between custom steps and detected tools.

  *Corregida la duplicación de integraciones entre pasos personalizados y herramientas detectadas.*


### Security

*Seguridad*

- Diagnostics reports redact recognizable token, password, secret, API-key, and Bearer-header values.

  *Los informes de diagnóstico eliminan valores reconocibles como token, contraseña, secreto, API key y cabeceras Bearer.*


## [0.20.1] - 2026-08-01

### Added

*Añadido*

- SonarQube information inside the editor through CodeLens for issues and Security Hotspots, alongside the existing hovers and quick actions.

  *Información de SonarQube dentro del editor mediante CodeLens para issues y Security Hotspots, manteniendo los hovers y acciones rápidas existentes.*

- Detected predefined integrations for **npm/pnpm/yarn audit**, **ESLint**, **Semgrep**, **Trivy**, **Snyk**, and **OWASP Dependency-Check**, available as pipeline steps.

  *Integraciones predefinidas detectadas para **npm/pnpm/yarn audit**, **ESLint**, **Semgrep**, **Trivy**, **Snyk** y **OWASP Dependency-Check**, disponibles como pasos del pipeline.*


## [0.20.0] - 2026-07-31

### Added

*Añadido*

- Configurable pipeline with drag-and-drop steps, editable commands, and **Stop on failure** or **Continue on failure** policies.

  *Pipeline configurable con pasos ordenables mediante drag & drop, comandos editables y políticas **Detener si falla** o **Continuar si falla**.*

- Manual step selection for each run while keeping SonarQube as the required step.

  *Selección manual de los pasos para cada ejecución, manteniendo SonarQube como paso obligatorio.*

- Execution stepper with loading, success, failure, and warning states, plus visual step separators in the console.

  *Stepper de ejecución con estados de carga, éxito, fallo y advertencia, además de separación visual de pasos en la consola.*


## [0.19.0] - 2026-07-30

### Added

*Añadido*

- The **Issues** table can be sorted by severity, type, file, status, and rule.

  *La tabla de **Issues** permite ordenar por severidad, tipo, archivo, estado y regla.*


### Changed

*Cambiado*

- **Issues**, **Coverage**, and **Duplication** evolution is grouped by **Day** by default.

  *La evolución de **Issues**, **Cobertura** y **Duplicación** se agrupa por **Día** de forma predeterminada.*


## [0.18.5] - 2026-07-30

### Fixed

*Corregido*

- Unified focus behavior and native scrolling for **Top Files**, **Top Rules**, **Coverage**, and **Duplications** with the **Issues** table.

  *Unificado el foco y el desplazamiento nativo de **Top Archivos**, **Top Reglas**, **Cobertura** y **Duplicación** con la tabla de **Issues**.*
