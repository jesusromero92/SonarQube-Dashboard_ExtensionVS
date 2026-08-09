# Changelog

All notable changes to SonarQube Dashboard & Pipeline will be documented in this file.

*Todos los cambios relevantes de SonarQube Dashboard & Pipeline se documentarán en este archivo.*

## [1.2.0] - 2026-08-09

### Added

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

### Fixed

- Removed the leading horizontal inset from the **SonarQube / Pipeline / Notifications** tab bar so the first tab starts flush with the configuration panel.

  *Se ha eliminado la separación horizontal inicial de la barra de pestañas **SonarQube / Pipeline / Notificaciones**, de modo que la primera pestaña comienza alineada con el panel de configuración.*

- Stabilized the repository-analysis status panel so its height no longer changes between idle and running states, with the status text vertically aligned with the analysis icon and long content truncated instead of resizing the panel.

  *Se ha estabilizado el panel de estado del análisis del repositorio para que su altura no cambie entre reposo y ejecución, manteniendo el texto alineado verticalmente con el icono de análisis y truncando el contenido largo en lugar de redimensionar el panel.*

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
