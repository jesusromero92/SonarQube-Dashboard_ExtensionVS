# Changelog

All notable changes to SonarQube Dashboard & Pipeline will be documented in this file.

*Todos los cambios relevantes de SonarQube Dashboard & Pipeline se documentarán en este archivo.*

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
