# SonarQube Dashboard & Pipeline para Visual Studio Code

[English](README.md) | **Español**

Guía técnica de usuario para configurar, sincronizar, analizar y operar proyectos de SonarQube y pipelines locales de calidad desde Visual Studio Code.

**Conecta SonarQube, ejecuta pipelines de calidad configurables y consulta Quality Gates, issues, Security Hotspots, cobertura, duplicación e historial de ejecuciones sin salir de VS Code.**

![Vista general de SonarQube Dashboard & Pipeline](docs/images/marketplace-hero.png)

![Flujo de análisis de SonarQube Dashboard & Pipeline](docs/images/marketplace-demo.gif)

Para realizar una primera configuración guiada, abre la paleta de comandos y ejecuta **SonarQube Dashboard & Pipeline: Primeros pasos**. El walkthrough nativo abre el dashboard, guía la conexión con SonarQube, inicia el primer pipeline y muestra dónde revisar los resultados.

> **Extensión comunitaria:** este proyecto es independiente y no está afiliado, respaldado ni mantenido por SonarSource. SonarQube es una marca registrada de SonarSource SA.

## Alcance funcional

| Área | Funcionamiento técnico |
|---|---|
| Módulos | Pipeline y Live Remediation pueden activarse de forma independiente; los módulos desactivados ocultan sus pestañas/vistas nativas y detienen su trabajo en runtime. |
| Conexión con SonarQube | Valida el servidor y el token configurados, carga los proyectos accesibles y guarda el proyecto seleccionado por carpeta del workspace. |
| Sincronización | Obtiene issues, Security Hotspots, condiciones del Quality Gate, ratings, métricas, histórico, cobertura y duplicación. |
| Asociación con archivos locales | Relaciona las rutas de componentes de SonarQube con archivos de la carpeta activa y de la subcarpeta local opcional. |
| Análisis del repositorio | Detecta Maven, Gradle, .NET, NPM, Docker o un comando de scanner personalizado y lo ejecuta en el workspace. |
| Pipeline de calidad | Ejecuta compilación, tests, auditorías, herramientas de seguridad, SonarQube y comandos personalizados en el orden seleccionado y con políticas de fallo por paso. |
| Integración con el editor | Publica entradas en Problems, decoraciones, hovers, CodeLens, flujos de issues, cobertura e indicadores de duplicación. |
| Remediación en vivo | Sigue cambios netos de issues sincronizados dentro del editor y en operaciones externas/múltiples archivos, ofrece diff Servidor ↔ Local y revert seguro, mantiene una sesión persistente con cambios pendientes y separa los resultados del último análisis real entre Solucionados y Siguen detectándose. |
| Historial de ejecuciones | Conserva las últimas 30 ejecuciones por carpeta de análisis, incluyendo estado, duración, pasos, log limitado y la línea base exacta antes/después de cada ejecución finalizada. |
| Diagnóstico | Informa del entorno, compatibilidad, scanner, comandos detectados, herramientas, latencia del servidor y última petición fallida, ocultando secretos. |

## Arquitectura modular en 2.0.0

La 2.0.0 separa **Core**, **Pipeline** y **Live Remediation** como fronteras reales de código y de runtime. Abre **Configuración → Módulos** para controlar las funciones opcionales de forma independiente:

- **Core** conserva exclusivamente la conexión/sincronización con SonarQube, Dashboard, navegación, decoraciones y el snapshot normal de diagnósticos publicado en **Problems**. No importa clases, servicios, tipos de scanner ni managers internos de los módulos opcionales.
- **Pipeline** vive íntegramente en `src/modules/pipeline/` y es propietario de scanner, alcance del análisis, ejecución, pasos, plantillas, integraciones, historial, comparación de baseline, comandos, vista nativa, configuración y contribución webview. Su configuración propia usa el namespace `sonarQubeDashboard.pipeline.*`.
- **Live Remediation** vive íntegramente en `src/modules/liveRemediation/` y es propietario de tracking local, watchers, baseline, diff/revert, persistencia, sesión, resultados del último análisis, historial, comandos y vista nativa. No importa Pipeline ni conoce sus comandos concretos.
- Los dos módulos implementan un contrato común y se montan mediante un **registro/runtime genérico de módulos**. El core se comunica con ellos únicamente mediante contratos, contribuciones y capacidades; añadir otro módulo no requiere introducir su implementación dentro de `DashboardPanel` o `extension.ts`.
- Las capacidades entre módulos pasan por un broker genérico. Por ejemplo, **Analizar repositorio** desde Live Remediation solicita la capacidad `analyzeRepository`; Pipeline la proporciona solo cuando está activo. No existe una dependencia `Live Remediation → Pipeline`.
- El webview del Dashboard consume una única fachada de contribuciones de módulos. Cada módulo es dueño de su pestaña, markup, scripts, estilos, modales y páginas; los controles reutilizables están en `src/shared/webview/`, evitando dependencias circulares Dashboard ↔ módulo.
- Los módulos pueden activarse y desactivarse en caliente. Al abrir o refrescar el dashboard, las pestañas opcionales de configuración se reconstruyen siempre desde el estado persistido de los módulos, incluso si ya estaban activados antes de abrir la vista. Al desactivar Pipeline se cancelan/liberan sus servicios y comandos. Al desactivar Live Remediation se liberan listeners/watchers y se restaura inmediatamente el snapshot normal de **Problems**, pero **su sesión persistida se conserva** para una reactivación posterior.
- Borrar estado y desactivar un módulo son operaciones distintas: solo las acciones explícitas de papelera/limpieza eliminan el estado de Live Remediation. Desactivar o reiniciar VS Code no revierte archivos locales ni borra la sesión.
- Tanto **activar** como **desactivar** un módulo muestra un modal nativo de confirmación. El checkbox conserva su último valor confirmado mientras la decisión y la transición del ciclo de vida están pendientes, y el nuevo valor solo se persiste después de cargar o descargar correctamente el módulo. Si Pipeline tiene un análisis activo, el aviso de desactivación indica expresamente que será cancelado. Los interruptores se guardan mediante `sonarQubeDashboard.modules.pipeline.enabled` y `sonarQubeDashboard.modules.liveRemediation.enabled`; no existe un segundo interruptor interno de Live Remediation.
- Los cambios de ciclo de vida conservan **Configuración → Módulos** mientras el Dashboard recompone el HTML, CSS y JavaScript propiedad de los módulos. El webview reconstruido nace directamente en la página/pestaña conservada, sin mostrar momentáneamente **Datos** ni **SonarQube**. Si el estado persistido indica que un módulo está activo pero falta su runtime, la sincronización repara la incoherencia y vuelve a cargar su implementación de forma lazy.

## Modelo de funcionamiento

1. La carpeta activa aporta la configuración de servidor, proyecto, rama, ruta local, scanner, pipeline y notificaciones.
2. El token se obtiene desde `SecretStorage` de VS Code y no se guarda en `settings.json`.
3. La sincronización consulta el servidor SonarQube configurado y asocia las rutas recibidas con archivos locales.
4. Solo los hallazgos cuyos archivos pueden resolverse dentro de la carpeta activa se publican en el dashboard local, Problems, decoraciones y explorador de issues. El snapshot de **Problems** lo mantiene el core y no depende de que Live Remediation esté activo.
5. Si Pipeline está activo, el análisis del repositorio ejecuta el pipeline confirmado dentro del workspace de confianza y transmite la salida a la vista de ejecución.
6. Los metadatos de las ejecuciones finalizadas se guardan en el estado del workspace, con un máximo de 30 entradas por carpeta de análisis.
7. Al cambiar de carpeta activa, la extensión carga su configuración independiente y cancela las solicitudes obsoletas.

## Instalación

### Visual Studio Marketplace

Abre **Extensiones** en Visual Studio Code, busca **SonarQube Dashboard & Pipeline**, selecciona la extensión y pulsa **Instalar**.

### Paquete VSIX

1. Abre la paleta de comandos con `Ctrl + Shift + P` o `Cmd + Shift + P`.
2. Ejecuta **Extensions: Install from VSIX...**.
3. Selecciona `vscode-sonarqube-dashboard-pipeline-<versión>.vsix`.
4. Recarga la ventana cuando se solicite.

## Requisito para utilizar la extensión

Para que SonarQube Dashboard & Pipeline funcione correctamente:

1. La aplicación debe haber sido analizada previamente en SonarQube.
2. En Visual Studio Code debe abrirse la carpeta local de esa misma aplicación.
3. La carpeta abierta debe vincularse con el proyecto correspondiente de SonarQube desde la pestaña **Configuración**.

La extensión compara las rutas de los componentes devueltos por SonarQube con los archivos existentes en la carpeta abierta. En el dashboard y en **Problems** se mostrarán únicamente los defectos que puedan asociarse con un archivo local coincidente.

Si el código analizado se encuentra dentro de una subcarpeta del workspace, debe indicarse en **Configuración avanzada → Subcarpeta local**. Una asociación incorrecta entre proyecto, carpeta o subcarpeta puede provocar que SonarQube tenga issues, pero que estos no aparezcan en la extensión.

## Características principales

- Análisis del repositorio desde VS Code con detección automática del scanner y un asistente de dos pasos para plantilla/confirmación que muestra la carpeta efectiva y el alcance de análisis de SonarQube.
- Pipeline de análisis configurable con compilación, tests, integraciones predefinidas y pasos personalizados ordenables mediante drag & drop.
- Plantillas reutilizables de pipeline: **Rápido**, **Completo**, **Seguridad**, **Release** y plantillas propias importables/exportables en YAML versionado.
- Vista nativa **Ejecuciones del pipeline** con las últimas ejecuciones, su estado, duración, pasos, registro en tiempo real o histórico y variaciones antes/después de SonarQube.
- **Línea base local antes/después** automática para cada análisis del repositorio, con Issues, Security Hotspots, Cobertura, Duplicación y Quality Gate.
- Pantalla de diagnóstico interno con entorno, servidor, compatibilidad, scanner, herramientas, comandos, última petición fallida y tiempo de respuesta.
- Compatibilidad con Maven/Gradle para Java y Kotlin, SonarScanner for .NET para C#/VB.NET/F#, SonarScanner for NPM para proyectos con `package.json` y SonarScanner CLI en Docker para proyectos genéricos.
- Selección manual de Maven, Gradle, .NET, NPM, Docker o un comando personalizado.
- Sincronización automática al abrir un proyecto ya vinculado.
- Configuración independiente por carpeta del workspace.
- Selector de idioma con cambio inmediato entre español e inglés.
- Token protegido mediante `SecretStorage`.
- Selector global **Overall / New Code**.
- Resumen por severidad y tipo de defecto.
- Ratings de Maintainability, Reliability, Security y Security Review.
- Estado y detalle completo del Quality Gate.
- Tabla de defectos con filtro, ordenación por cabeceras y navegación al código.
- Gestión del ciclo de vida del defecto sin salir de VS Code: aceptar, falso positivo, reapertura, asignación, comentarios, historial y responsable actual.
- Información dentro del editor mediante decoraciones, hovers, acciones rápidas y CodeLens para defectos y Security Hotspots.
- **Live Remediation 2.0** con seguimiento neto dentro/fuera del editor, operaciones de múltiples archivos, diff Servidor ↔ Local, revert seguro por issue, sesión persistente, cambios pendientes restaurables tras reiniciar, acordeón **Tras último análisis** con **Solucionados** / **Siguen detectándose**, navegación a la ubicación nueva del servidor, historial de solucionados y acciones de limpieza independientes. Solo un análisis real del repositorio puede confirmar una remediación.
- Navegación de flujos de seguridad con source, pasos intermedios, sink, ubicaciones secundarias y CodeLens.
- Vista de cobertura y duplicación con métricas actuales de Overall/New Code, decoraciones en el gutter, bloques duplicados, archivos con menor cobertura e histórico de Overall agrupable por día, semana o mes.
- Navegación mediante atajos, contador en la barra de estado y explorador agrupado por archivo, regla o severidad.
- Notificaciones automáticas de regresiones, fallos del Quality Gate, nuevos hotspots y análisis completados.
- Tabla específica de Security Hotspots.
- Rankings de archivos y reglas con ordenación por columnas.
- Evolución histórica de Overall por tipo de issue y criticidad, con agrupación independiente por día, semana o mes y **Día** como valor predeterminado. New Code conserva sus métricas actuales, pero oculta las gráficas históricas no comparables.
- Publicación de diagnósticos en **Problems**.
- Compatibilidad con ramas y subcarpetas locales.

## Inicio rápido

1. Comprueba que la aplicación ya tenga al menos un análisis disponible en SonarQube.
2. Abre en VS Code la carpeta local de esa misma aplicación.
3. Pulsa el icono de **SonarQube Dashboard & Pipeline** en la barra de actividad.
4. Abre la pestaña **Configuración**.
5. Selecciona **Español** o **English** en el desplegable de idioma. El dashboard, el panel lateral, las notificaciones, los modales y los mensajes del scanner cambian inmediatamente.
6. Introduce la URL del servidor y un token de acceso.
7. Pulsa **Conectar** para validar el servidor y el token y cargar los proyectos visibles.
8. Selecciona expresamente el proyecto o aplicación de SonarQube que analiza la carpeta abierta. Conectar nunca vincula un proyecto automáticamente.
9. Configura opcionalmente la rama y, si las rutas no parten de la raíz del workspace, la subcarpeta local.
10. Pulsa **Sincronizar** para guardar la vinculación y cargar sus datos.
11. En la página **Datos**, pulsa **Analizar repositorio**, añade los pasos opcionales de esta ejecución y confirma el pipeline.

Después de la primera vinculación, la extensión sincroniza los datos automáticamente al abrir el workspace. El icono de recarga del panel lateral permite solicitar una actualización manual.

## Panel lateral

![Panel lateral con resumen de SonarQube](docs/images/sidebar-summary.png)

El panel lateral ofrece una lectura rápida sin abandonar el explorador de VS Code:

- **Datos / Configuración / Diagnóstico:** abre el resumen, la configuración dividida por áreas o el informe técnico de la extensión.
- **Ejecuciones del pipeline:** vista nativa de VS Code situada bajo el resumen lateral; muestra ejecuciones activas y finalizadas y abre su página de detalle.
- **Recargar:** vuelve a consultar SonarQube y actualiza el dashboard y Problems.
- **Issues encontrados:** total de issues que coinciden con archivos existentes en la carpeta vinculada.
- **Severidades:** distribución de Blocker, Critical, Major, Minor e Info entre esos issues locales.
- **Tipos:** Bugs, Code Smells, Vulnerabilidades y Security Hotspots cuya ruta coincide con un archivo local.
- **Quality Gate:** estado del último análisis. Al pulsarlo se abre su detalle.
- **Ratings:** comparación directa entre Overall y New Code mediante badges A–E.

Mientras se realiza una sincronización, el panel muestra un spinner y oculta temporalmente los datos anteriores para evitar estados parciales.

## Vista de datos y selector Overall / New Code

![Vista general del dashboard y tabla de defectos](docs/images/dashboard-overview.png)

El selector global **Overall / New Code** actualiza de forma coordinada:

- el resumen superior;
- la tabla de defectos;
- los Security Hotspots;
- Top Archivos;
- Top Reglas.

**Overall** representa el estado completo del proyecto. **New Code** limita los resúmenes actuales, issues, hotspots, cobertura y duplicación al periodo de código nuevo configurado en SonarQube.

La evolución histórica se muestra únicamente en **Overall**. La definición de New Code puede cambiar entre análisis, por lo que sus valores no siempre son comparables como serie temporal. En New Code, la extensión oculta las gráficas de evolución de issues, criticidad, cobertura y duplicación y muestra un aviso explicativo en lugar de valores cero artificiales.

### Resumen superior

Cada columna muestra:

- valor actual;
- severidad correspondiente;
- aumento o disminución frente al análisis anterior;
- color oficial utilizado en el resto del dashboard.

Los indicadores `▲` y `▼` permiten detectar rápidamente regresiones y mejoras. Cuando no existe variación se muestra **Sin cambios**.

La comparación histórica solo se muestra cuando el total del último análisis de SonarQube coincide con los issues asociados a archivos locales. Si hay rutas omitidas, la extensión evita comparar el subconjunto local con el total global del proyecto.

Esta comparación superior siempre utiliza el **análisis inmediatamente anterior** al último análisis disponible. No depende de la agrupación por día, semana o mes seleccionada en las gráficas de evolución.

### Tabla de defectos

La tabla contiene:

- **Severidad:** criticidad del issue.
- **Tipo:** icono de Bug, Code Smell o Vulnerabilidad.
- **Archivo:** nombre final y línea afectada; el tooltip conserva la ruta completa.
- **Regla:** nombre descriptivo de la regla de SonarQube.

El campo de búsqueda filtra por archivo, regla o descripción. Las cabeceras **Severidad**, **Tipo**, **Archivo**, **Estado** y **Regla** permiten ordenar la tabla; un segundo clic invierte la dirección. Al pulsar una fila se abre el archivo local en la línea afectada. Al pulsar la regla se muestra su detalle en un modal.

Solo se incluyen los issues cuyo componente de SonarQube coincide con un archivo de la carpeta abierta, teniendo en cuenta la subcarpeta local configurada.

El encabezado permanece fijo y únicamente el cuerpo de la tabla tiene desplazamiento vertical.

### Indicadores, CodeLens y detalle dentro del editor

![Iconos y detalle de los hallazgos dentro del editor](docs/images/details.png)

Al abrir un archivo con hallazgos, la extensión marca directamente las líneas afectadas:

- muestra en el gutter, a la izquierda del número de línea, el mismo icono y color utilizados en el resumen para **Bug**, **Code Smell**, **Vulnerability** y **Security Hotspot**;
- resalta la línea con el color correspondiente al tipo de hallazgo y añade una marca en la regla de visión general del editor;
- muestra un CodeLens sobre la línea afectada con severidad, regla y acceso directo al detalle;
- al situar el puntero sobre el icono muestra la descripción, regla, tipo, severidad o prioridad, estado, resolución, archivo, línea, proyecto, componente, identificador e impactos disponibles;
- el enlace del tooltip abre el detalle completo del defecto o Security Hotspot en **SonarQube Dashboard & Pipeline**;
- para los issues de SonarQube, la bombilla nativa de VS Code ofrece acciones Quick Fix para **Ver regla**, **Marcar como aceptado**, **Asignarme issue**, **Abrir en SonarQube** y **Gestionar defecto en Dashboard**;

Las acciones Quick Fix que modifican SonarQube respetan los permisos del token configurado. Si el usuario actual no puede aceptar o asignar un issue, la extensión no lo modifica e informa de que la operación no está disponible.

### Estado de remediación en vivo

Live Remediation funciona cuando el módulo `sonarQubeDashboard.modules.liveRemediation.enabled` está activo. Su principio es deliberadamente conservador: **modificar código no significa solucionar un issue**. SonarQube Server sigue siendo la única fuente de verdad y una remediación solo se confirma a partir del snapshot producido por un análisis real del repositorio.

La identidad del archivo se normaliza antes de relacionar eventos del editor, guardado y sistema de archivos, incluidas las diferencias de mayúsculas en URI de Windows. Por ello, una edición directa sobre un rango de issue sincronizado o junto a él se registra inmediatamente como **Modificado localmente**, aunque exista una línea de código idéntica en otra parte del archivo.

#### Seguimiento de cambios locales

- Al editar dentro de VS Code el rango seguido de un issue, el CodeLens/hover pasa a **Modificado localmente · pendiente de validación** y la entrada de Problems se vuelve informativa. El rango seguido se transforma con inserciones, eliminaciones, reemplazos, undo y redo.
- Live Remediation compara el **cambio neto** con la baseline capturada desde el servidor. Si el código vuelve exactamente al contenido original —también mediante `Ctrl+Z`— el issue deja de estar pendiente inmediatamente, sin exigir una edición adicional.
- El módulo observa también operaciones de archivos fuera del editor: cambios, guardados, creación, eliminación, rename, copia y sustitución desde Explorer, terminal u otras herramientas. Los eventos rápidos de múltiples archivos se agrupan y se realiza una reconciliación adicional del conjunto de archivos seguidos para no perder cambios por ordenación/coalescencia de eventos del sistema.
- Cuando un reemplazo externo desplaza líneas pero el bloque original del issue sigue intacto, la baseline se relocaliza en lugar de marcar un falso cambio. Cuando no existe información suficiente para demostrar equivalencia, el comportamiento es conservador y el issue afectado se mantiene como modificado.
- Si la extensión oficial **SonarQube for IDE** había informado previamente del mismo hallazgo, sus diagnósticos pueden utilizarse únicamente como señal adicional para pasar de **Modificado localmente · pendiente de validación** a **Modificado localmente · pendiente de confirmación de SonarQube**. Esa señal local nunca confirma una solución.

#### Diff y revert seguro

Cada entrada de **Cambios pendientes** utiliza la baseline del último snapshot de SonarQube:

- seleccionar el issue abre un **diff Servidor ↔ Local** con el bloque original y el bloque local actual;
- las acciones inline/contextuales permiten **Ver cambio**, **Ir al código** y **Revertir este cambio**;
- el revert restaura únicamente el bloque asociado al issue y pide confirmación mediante un modal nativo de VS Code;
- antes de aplicar el revert se comprueban el rango seguido, el rango original y las anclas de contexto. Si no puede demostrarse que el bloque es el correcto, el revert automático se rechaza sin modificar el archivo;
- revertir un issue no guarda automáticamente el archivo, por lo que sigue siendo una edición normal de VS Code y puede deshacerse con Undo.

#### Sesión de remediación

La vista nativa **Issues modificados localmente** contiene una **Sesión de remediación** con:

- **Iniciada**, con la hora de inicio de la sesión;
- **Analizar repositorio**, que ejecuta el Pipeline para obtener un nuevo snapshot real de SonarQube;
- **Modificados ahora**, **Pendientes de validación** y **Pendientes de servidor**, que representan el estado pendiente actual;
- **Cambios pendientes (N)**, con los issues que todavía tienen estado local diferente del snapshot del servidor.

Una sincronización normal, el auto-refresh o el refresh de arranque **no consumen ni validan Cambios pendientes**. Solo un refresh cuyo origen sea un análisis real del repositorio puede producir resultados de validación.

#### Tras último análisis

Después de un análisis real aparece el acordeón **Tras último análisis**, que agrupa exclusivamente los resultados de esa última validación:

- **Validado** muestra la hora del snapshot que produjo el resultado;
- **Solucionados (N)** contiene los issues modificados que SonarQube dejó de devolver;
- **Siguen detectándose (N)** contiene los issues modificados que SonarQube volvió a devolver. Cada entrada conserva los datos y la **ubicación nueva del último análisis**, por lo que al seleccionarla se abre el archivo en la línea actual devuelta por el servidor;
- **Historial de solucionados** conserva hasta 20 confirmaciones anteriores. El historial solo contiene remediaciones realmente confirmadas por SonarQube Server.

Los resultados del último análisis son independientes del historial acumulado: cada análisis real sustituye las listas **Solucionados** y **Siguen detectándose**; si no hay nada pendiente que validar, ambas quedan vacías. El **Historial de solucionados** continúa conservando las confirmaciones anteriores.

#### Persistencia y limpieza

La sesión completa se guarda por workspace mediante `ExtensionContext.workspaceState` (esquema v4, con migración automática del estado pendiente v3). Al recargar la ventana o reiniciar VS Code se restauran:

- los **Cambios pendientes**, estados `modified` / `awaitingConfirmation`, rangos y baselines;
- la hora de inicio de la sesión;
- el bloque **Tras último análisis**, incluidos Solucionados y Siguen detectándose;
- el Historial de solucionados.

Los pendientes persistidos se muestran incluso mientras todavía se está ejecutando el primer refresh del servidor, evitando que la vista parezca vacía durante el arranque.

La vista incorpora acciones de papelera independientes, todas con confirmación nativa:

- la papelera de **Sesión de remediación** borra pendientes, resultados del último análisis, historial y persistencia local de la sesión y crea una sesión nueva limpia; **no revierte ni modifica archivos locales y no modifica SonarQube Server**;
- la papelera de **Solucionados** elimina únicamente esa lista del último análisis y mantiene el Historial de solucionados;
- la papelera de **Siguen detectándose** elimina únicamente esa lista del último análisis y no toca Cambios pendientes ni los archivos.

El indicador de la barra de estado aparece únicamente mientras exista estado local pendiente. Seleccionarlo solicita un refresh del Dashboard, pero la confirmación definitiva de remediaciones continúa reservada al resultado de un análisis real del repositorio.

Al desactivar el módulo se liberan watcher, listeners, timers, barra de estado y vista nativa. Los diagnósticos normales de **Problems** continúan perteneciendo al core y se restauran inmediatamente al desmontar Live Remediation.

![Estado de remediación en vivo](docs/images/liveremedation.png)


## Top Archivos y Top Reglas

![Rankings de archivos y reglas](docs/images/rankings.png)

### Top Archivos

Agrupa los issues por archivo y muestra:

- nombre final del archivo;
- ruta completa en el tooltip;
- severidad más alta encontrada;
- número total de defectos.

### Top Reglas

Agrupa los issues por regla y muestra:

- nombre descriptivo de la regla;
- severidad más alta;
- cantidad de apariciones.

En ambas tablas se puede ordenar pulsando **Archivo/Regla**, **Severidad** o **Defectos**. Un segundo clic invierte el orden y el indicador `▲` o `▼` muestra la dirección activa.

Los headers permanecen fuera del área desplazable y las dos tablas conservan la misma altura.

## Evolución histórica

![Gráficas de evolución histórica](docs/images/evolution.png)

La sección inferior incluye dos gráficas:

- **Issues por tipo:** Bugs, Code Smells, Vulnerabilidades y Security Hotspots.
- **Issues por criticidad:** Blocker, Critical, Major, Minor e Info.

Cada gráfica dispone de su propio selector **Día / Semana / Mes** en la esquina superior derecha y comienza agrupada por **Día**. Los selectores son independientes: cambiar la agrupación de una gráfica no modifica ninguna otra.

Cada punto representa el último análisis del intervalo seleccionado: el último análisis de cada día, de cada semana o de cada mes. Al mover el ratón sobre la gráfica aparece un tooltip que sigue el cursor e indica la fecha real de ese análisis y los valores de todas las series visibles.

Las leyendas están centradas y son interactivas: al pulsar una serie se puede ocultar o volver a mostrar.

## Quality Gate

![Modal con detalle del Quality Gate](docs/images/quality-gate.png)

El botón del Quality Gate abre un modal con:

- estado global del último análisis;
- número de condiciones fallidas y configuradas;
- métrica evaluada;
- valor actual;
- límite permitido;
- ámbito Overall o New Code;
- resultado individual de cada condición;
- ratings Overall y New Code;
- número de Security Hotspots.

Las condiciones fallidas aparecen primero. El modal diferencia entre el total de condiciones configuradas y las condiciones fallidas que muestra SonarQube en su interfaz.

El modal está dividido en **header**, **body** y **footer**. Solo el body tiene scroll, por lo que el título y los botones permanecen siempre visibles.


## Gestión del ciclo de vida del defecto

![Ciclo de vida, acciones, comentarios, historial y flujo del defecto](docs/images/view-info-issue.png)

Selecciona **Gestionar defecto** desde la tabla de Defectos, el tooltip del editor o el explorador para abrir el modal de gestión. Según las operaciones que SonarQube devuelva para el token actual, permite:

- aceptar un defecto;
- marcarlo como falso positivo o como no se corregirá;
- reabrirlo, confirmarlo o resolverlo;
- asignar o quitar el responsable;
- añadir comentarios;
- consultar comentarios, historial de cambios, autor, fechas, estado, resolución y responsable.

Antes de cualquier operación de escritura se muestra una confirmación nativa. Los botones de estado se crean únicamente a partir de las transiciones incluidas por `/api/issues/search`; los controles de asignación siguen las acciones devueltas para el defecto y la lista de usuarios se pagina. La autorización del servidor sigue siendo la fuente final de verdad y los errores de la API se muestran sin descartar el estado actual del dashboard.

![Confirmación nativa antes de modificar un defecto en SonarQube](docs/images/view-info-issue2.png)

El estado actual aparece tanto en la tabla de Defectos como en el modal, y su acción correspondiente queda deshabilitada. Los comentarios y el historial utilizan secciones plegables mutuamente excluyentes.

## Flujos de seguridad y ubicaciones secundarias

Los defectos que incluyen execution flows muestran todas las ubicaciones locales implicadas:

- source;
- pasos intermedios;
- sink;
- otras ubicaciones relacionadas.

El modal incluye los botones **Anterior** y **Siguiente**, además de la lista completa de ubicaciones. Al seleccionar una ubicación se abre su archivo y línea. Mientras el flujo está activo, VS Code muestra decoraciones de línea y CodeLens para recorrer el camino directamente desde el editor.

Las ubicaciones que forman parte del flujo de SonarQube pero no existen en el workspace abierto siguen visibles como no disponibles y nunca se redirigen a otro archivo con el mismo nombre.

## Cobertura y duplicaciones

![Cobertura, duplicación, rankings de archivos y evolución histórica](docs/images/coverage-duplication.png)

La pestaña **Cobertura y duplicación** incluye vistas actuales independientes para Overall y New Code de:

- cobertura, cobertura de líneas y cobertura de condiciones;
- líneas a cubrir y líneas sin cubrir;
- densidad de líneas duplicadas, bloques duplicados y líneas duplicadas;
- archivos con menor cobertura;
- archivos con mayor duplicación.

Las gráficas históricas de cobertura y duplicación están disponibles únicamente en **Overall**. Incluyen selectores **Día / Semana / Mes** independientes, comienzan agrupadas por **Día** y conservan el último análisis de cada intervalo. En **New Code** se mantienen las métricas actuales y los rankings de archivos, mientras que las gráficas se sustituyen por un aviso que explica por qué no existe una serie comparable.

Al seleccionar un archivo se cargan los datos por línea bajo demanda. Las líneas cubiertas, parcialmente cubiertas y no cubiertas se marcan en el gutter y el overview ruler. Las líneas duplicadas utilizan una decoración propia, y el modal de detalle enumera cada bloque duplicado junto con todos los archivos y rangos locales coincidentes.

![Resumen de líneas y bloques duplicados del archivo seleccionado](docs/images/modal-coverage-duplication.png)

Las líneas duplicadas que contienen código muestran la palabra `duplicated` en morado al final. Las líneas vacías o formadas únicamente por espacios no reciben esta etiqueta visual.

![Indicador de línea duplicada dentro del editor](docs/images/duplicated-overview.png)

Cada grupo de duplicación puede abrirse en una pestaña de comparación con un diseño similar al diff de Git. Muestra en paralelo todas las apariciones locales, conserva sus números de línea originales y permite navegar directamente al rango seleccionado.

![Comparación en paralelo del código duplicado con diseño similar a Git](docs/images/duplicated-overview2.png)

La cobertura depende de que los informes de pruebas correspondientes se hayan importado durante el análisis. Cuando SonarQube no contiene cobertura para un archivo, la extensión no añade decoraciones.
Las métricas históricas ausentes también se muestran como no disponibles, en lugar de inventar un 0 %.

## Navegación rápida entre defectos

![Explorador de defectos agrupado por archivo local](docs/images/issue-explorer.png)

La extensión añade un **Explorador de defectos** bajo el resumen lateral. Puede agrupar los defectos locales por archivo, regla o severidad y limitarse al archivo activo.

Atajos predeterminados:

| Acción | Windows/Linux | macOS |
|---|---|---|
| Siguiente defecto | `Ctrl+Alt+Down` | `Cmd+Alt+Down` |
| Defecto anterior | `Ctrl+Alt+Up` | `Cmd+Alt+Up` |
| Siguiente defecto del mismo tipo | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| Siguiente Blocker/Critical | `Ctrl+Alt+C` | `Cmd+Alt+C` |

La barra de estado muestra la posición actual, por ejemplo `3/12`, y abre el siguiente defecto al seleccionarla.
Al abrir o cambiar a un archivo que ya contiene diagnósticos de SonarQube en **Problems**, el editor muestra automáticamente el primer defecto de SonarQube de ese archivo y sitúa el cursor sobre su rango de diagnóstico.
El explorador y los comandos de navegación siguen el ámbito Overall/New Code activo.
Haz clic derecho sobre un grupo de archivo y selecciona **Copiar todos los defectos del archivo** para copiar su ruta y todos los defectos visibles, incluyendo línea, severidad, tipo, estado, resolución, regla, descripción, clave de regla y clave del defecto.

## Notificaciones automáticas

Las notificaciones pueden activarse o desactivarse desde la configuración del dashboard o desde los ajustes de VS Code. La extensión avisa cuando una sincronización detecta:

- nuevos defectos Blocker, Critical o High;
- un Quality Gate que pasa de OK a WARN/ERROR;
- un aumento significativo configurable de defectos locales;
- nuevos Security Hotspots;
- finalización de un análisis iniciado por la extensión.

El umbral predeterminado es un aumento del 20% y al menos cinco defectos adicionales. Puede modificarse mediante `sonarQubeDashboard.notifications.significantIncreasePercent` y `sonarQubeDashboard.notifications.significantIncreaseMinimum`.
Las referencias de notificación se guardan de forma independiente por carpeta del workspace, servidor, proyecto, rama y workspace de VS Code.

## Security Hotspots

![Tabla y detalle de Security Hotspots](docs/images/security-hotspots2.png)

La pestaña **Security Hotspots** ofrece una vista independiente con:

- prioridad High, Medium o Low;
- estado To Review, Acknowledged, Fixed o Safe;
- archivo y línea;
- regla o descripción;
- filtro de texto;
- opción **Solo pendientes**.

Al pulsar un hotspot se consulta su detalle y se abre un modal con:

- descripción;
- riesgo;
- contexto de vulnerabilidad;
- recomendaciones de corrección;
- acceso directo al archivo.

La extensión obtiene el detalle bajo demanda para no retrasar la carga inicial del dashboard.

## Integraciones detectadas

Cuando el módulo **Pipeline** está habilitado, la configuración incluye una pestaña independiente **Configuración → Integraciones**. La vista se divide en dos acordeones: **Disponibles**, abierto por defecto con las herramientas detectadas en el workspace, y **No disponibles**, cerrado por defecto con el resto de integraciones compatibles. Para las herramientas no detectadas se muestra, cuando es posible, un comando sugerido o una indicación de configuración para habilitar la integración. La extensión no ejecuta esas instrucciones ni instala herramientas automáticamente.

La detección se basa en archivos de configuración, scripts y dependencias presentes en el proyecto. Para proyectos Node, la extensión detecta automáticamente el gestor de paquetes usando primero el campo `packageManager` de `package.json` y, si no existe, los lockfiles habituales (`package-lock.json`/`npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` o `bun.lockb`). Los comandos sugeridos del catálogo se adaptan al gestor detectado: por ejemplo `npm install -D eslint`, `pnpm add -D eslint`, `yarn add -D eslint` o `bun add -d eslint`. Cuando una herramienta Node ya está disponible, los comandos detectados también usan el ejecutor correspondiente al gestor del proyecto. Ninguno de estos comandos se ejecuta automáticamente.

Actualmente reconoce, entre otras:

- SonarQube del proyecto configurado;
- auditoría de dependencias con `npm audit`, `pnpm audit`, `yarn audit` o `bun audit`;
- ESLint, Biome, Stylelint y Prettier;
- React Doctor;
- Semgrep, Trivy y Snyk;
- OWASP Dependency-Check para Maven o Gradle;
- Ruff y Bandit para Python;
- Checkov para infraestructura como código;
- golangci-lint para Go.

Una integración se considera **disponible** únicamente cuando se detecta su configuración, dependencia, script o evidencia específica (o, en el caso de SonarQube, cuando existe un proyecto configurado). El acordeón **No disponibles** sirve como catálogo de las integraciones que el plugin sabe reconocer y explica cómo hacer que pasen a estar disponibles. La configuración y ejecución del pipeline continúan realizándose desde la pestaña **Pipeline**.

## Pipeline de análisis configurable

![Configuración de compilación, tests y pasos personalizados](docs/images/analysis-pipeline-configuration.png)

La pestaña **Configuración → Pipeline** detecta automáticamente los comandos habituales de compilación y tests según el proyecto. Ambos pueden reemplazarse manualmente. También permite crear pasos personalizados para auditorías de dependencias, linters, SAST, generación de informes u otras herramientas disponibles en el workspace.

Cada paso personalizado incluye:

- nombre y comando editables;
- ordenación mediante drag & drop desde el icono `⋮⋮`;
- condición **Detener si falla** o **Continuar si falla**;
- variables `${workspaceFolder}`, `${projectKey}`, `${projectName}`, `${serverUrl}` y `${branch}`;
- guardado independiente mediante **Guardar pipeline**.

![Selección y orden de los pasos antes de analizar](docs/images/analysis-pipeline-confirmation.png)

Al abrir **Analizar repositorio**, la ejecución contiene inicialmente solo el paso obligatorio de SonarQube. **Añadir paso** permite incorporar la compilación detectada, los tests o cualquiera de los pasos personalizados guardados. El comando puede ajustarse para esa ejecución y el orden respecto a SonarQube se controla arrastrando cada fila desde su icono.

El botón **Analizar** permanece deshabilitado mientras exista un paso incompleto. Los pasos opcionales pueden eliminarse antes de comenzar y no modifican la configuración guardada.

![Stepper y registro de un pipeline en ejecución](docs/images/analysis-pipeline-execution.png)

Durante la ejecución, el modal muestra un stepper cuando hay más de un paso. Cada etapa indica si está ejecutándose, ha finalizado correctamente, ha fallado deteniendo el pipeline o ha fallado con permiso para continuar. El registro separa claramente el inicio y el final de cada paso, muestra el comando ejecutado y conserva la salida completa de las herramientas.

## Plantillas de pipeline

![Editor de plantillas de pipeline](docs/images/analysis-pipeline-configuration.png)

La extensión incorpora un acordeón de plantillas reutilizables en **Configuración → Pipeline**:

- **Rápido:** compilación y SonarQube.
- **Completo:** compilación, tests, auditoría de dependencias y SonarQube.
- **Seguridad:** herramientas de seguridad detectadas y SonarQube.
- **Release:** todos los pasos disponibles con política estricta de parada ante fallos.

Los pasos reutilizables se crean primero en **Pasos del pipeline**. Después, el editor de plantillas permite seleccionar una plantilla, revisar sus pasos, añadir otros disponibles, eliminarlos y reordenarlos mediante drag & drop sin modificar la lista general de pasos del proyecto.

Las plantillas integradas se adaptan a los comandos y herramientas detectados en la carpeta. **Guardar cambios** actualiza la plantilla seleccionada para ese workspace, incluidas las plantillas predeterminadas, sin crear duplicados. Las plantillas personalizadas pueden eliminarse con confirmación; al eliminar una personalización de una plantilla integrada se recupera su definición predeterminada. También se pueden importar y exportar plantillas como `.sonarqube-dashboard.yml` o YAML equivalente.

Al iniciar un análisis del repositorio se abre ahora un asistente de dos pasos. **Paso 1 — Seleccionar plantilla** permite elegir una plantilla y ajustar el orden de los pasos de la ejecución; seleccionar una plantilla aplica sus pasos inmediatamente y no existe una acción independiente **Aplicar plantilla**. Seleccionar **Sin plantilla** devuelve la ejecución al paso obligatorio de análisis de SonarQube para personalizarla manualmente. **Paso 2 — Confirmación** resume el proyecto, la carpeta efectiva que se analizará (incluida la subcarpeta local configurada), el método del scanner, la plantilla elegida, los `sonar.inclusions` / `sonar.exclusions` guardados y los pasos exactos en orden antes de que **Analizar** sea la acción final.

El archivo exportado utiliza `version: 1` y conserva el orden de los pasos, incluido cualquier paso situado después de SonarQube:

```yaml
version: 1
name: "Release local"
description: "Pipeline versionado del workspace"
steps:
  - id: "build"
    name: "Compilar"
    kind: build
    command: "npm run compile"
    failurePolicy: stop
    enabled: true
  - id: "sonarqube-analysis"
    name: "Análisis SonarQube"
    kind: sonar
    command: ""
    failurePolicy: stop
    enabled: true
  - id: "report"
    name: "Publicar informe"
    kind: custom
    command: "npm run security-report"
    failurePolicy: continue
    enabled: true
```

## Línea base antes/después del análisis

Cada análisis del repositorio captura las métricas actuales del proyecto de SonarQube **justo antes de iniciar el pipeline**. La captura permanece interna mientras el pipeline está en ejecución. Cuando SonarQube termina de procesar el informe y la sincronización del dashboard finaliza correctamente, la extensión consulta de nuevo ese mismo proyecto, guarda la comparación completa junto a la ejecución y la muestra al abrir esa ejecución desde **Ejecuciones del pipeline**, por ejemplo:

- **Issues:** `71 → 64 (-7)`
- **Cobertura:** `73,2% → 75,8% (+2,6 pp)`
- **Duplicación:** `4,1% → 3,7% (-0,4 pp)`
- **Security Hotspots:** recuento antes/después y variación
- **Quality Gate:** estado anterior → estado nuevo, indicando mejora o regresión

Cuando una métrica **no tiene variación**, el historial conserva el valor antes/después (por ejemplo `0 → 0`) pero oculta el badge azul neutro de variación. Los badges quedan así reservados para cambios reales y para el estado de primera medición.

La captura es específica del proyecto y utiliza métricas ligeras a nivel de proyecto en lugar de volver a cargar todo el conjunto de issues/archivos, por lo que un workspace con varias carpetas configuradas no mezcla métricas de componentes diferentes ni necesita una recarga completa adicional del dashboard. Si el proyecto nunca se había analizado, la extensión muestra el resultado como **primera medición** y utiliza los valores publicados como línea base de la siguiente ejecución, sin compararlos contra ceros artificiales.

La comparación se muestra intencionadamente solo en el detalle del historial de **Ejecuciones del pipeline**, manteniendo el modal de análisis en vivo y el dashboard principal centrados en el progreso de ejecución y en los datos actuales de SonarQube. Se guarda junto a cada entrada del historial, de modo que una ejecución antigua conserva sus valores aunque se publiquen análisis posteriores. La captura de la línea base es opcional y tolerante a fallos: si la consulta previa no puede completarse, el pipeline se ejecuta igualmente y solo se omite la comparación histórica.

## Historial de ejecuciones


![Vista nativa Ejecuciones del pipeline](docs/images/pipeline-executions-native.png)

La vista nativa **Ejecuciones del pipeline**, situada en la barra lateral junto al **Explorador de defectos**, conserva localmente las últimas 30 ejecuciones de cada carpeta de análisis. Las ejecuciones activas muestran estado de carga y las finalizadas indican su resultado y duración.

Al seleccionar cualquier ejecución, activa o finalizada, se abre una página dedicada que muestra únicamente esa ejecución:

![Detalle de una ejecución del pipeline](docs/images/pipeline-run-detail.png)


- proyecto, rama, fecha, resultado y duración total;
- scanner utilizado;
- resultado y duración de cada paso;
- advertencias permitidas, fallos y cancelaciones;
- acordeones animados para los pasos y la consola;
- registro en tiempo real mientras la ejecución continúa;
- registro histórico limitado para evitar un crecimiento indefinido del almacenamiento.

La página mantiene visible la ejecución actual mientras se cambia a otra para evitar parpadeos de carga. El historial se guarda en el estado del workspace, no contiene el token y puede limpiarse desde la propia pantalla.

## Diagnóstico interno

![Diagnóstico interno de la extensión](docs/images/diagnostics.png)

La pestaña **Diagnóstico** recopila información útil para investigar problemas de conexión, compatibilidad o detección del proyecto:

- versión de la extensión, VS Code y Node.js;
- sistema operativo, arquitectura y estado de confianza del workspace;
- SonarQube detectado, estado, perfil de compatibilidad y latencia del servidor;
- scanner seleccionado y evidencia usada para detectarlo;
- únicamente los comandos de compilación y tests detectados automáticamente;
- integraciones disponibles y la evidencia utilizada para detectarlas;
- última petición fallida y errores producidos durante la recopilación.

La página utiliza tarjetas monocromas y compactas, sin colores por categoría. **Copiar informe** genera un texto listo para adjuntar a una incidencia. Las credenciales, cabeceras de autorización y valores reconocibles como token, contraseña, secreto o API key se ocultan antes de copiarse.

## Análisis del repositorio

![Análisis del repositorio y registro de SonarScanner](docs/images/analisis.png)

El botón **Analizar repositorio** detecta el tipo de proyecto y selecciona la estrategia adecuada:

- **Maven:** ejecuta el wrapper `mvnw` o Maven con SonarScanner for Maven.
- **Gradle:** utiliza `gradlew` o Gradle. Si el plugin de SonarQube no está configurado, compila el proyecto y utiliza el scanner genérico con los binarios Java encontrados.
- **.NET:** detecta `.sln`, `.csproj`, `.vbproj` y `.fsproj`; instala SonarScanner for .NET dentro del almacenamiento de la extensión y ejecuta `begin`, compilación y `end`.
- **NPM:** cuando encuentra `package.json`, ejecuta `npx @sonar/scan`. Es la estrategia destinada a proyectos JavaScript, TypeScript, React y otros proyectos Node.js.
- **Docker:** cuando no encuentra un descriptor de Maven, Gradle, .NET ni `package.json`, utiliza automáticamente la imagen `sonarsource/sonar-scanner-cli`. Esta es la estrategia genérica para Python y otros lenguajes sin proyecto NPM.
- **Personalizado:** ejecuta el comando configurado con las variables de entorno `SONAR_HOST_URL` y `SONAR_TOKEN`.

En modo **Automático**, la prioridad de detección es **.NET → Maven → Gradle → NPM → Docker**. La búsqueda examina la carpeta de análisis y sus subcarpetas hasta tres niveles. En repositorios mixtos puede seleccionarse manualmente otro método o configurarse **Subcarpeta local** para limitar la detección al componente correcto.

SonarScanner for NPM lee el `package.json` del proyecto. La extensión no crea uno artificialmente: si el workspace no lo contiene, selecciona directamente Docker y evita iniciar NPX con una configuración incompatible.

La extensión ejecuta el pipeline seleccionado, muestra el progreso y el registro completo, permite cancelar el proceso, espera a que SonarQube termine la tarea en segundo plano y después actualiza automáticamente el dashboard y **Problems**. El modal puede cerrarse durante la ejecución sin detener el análisis; **Ver registro** permite abrirlo de nuevo. Únicamente **Cancelar análisis** finaliza el scanner. El token se oculta en el registro.

Antes de habilitar esta sección, la extensión consulta el endpoint de caché de análisis que utiliza SonarScanner y que requiere el permiso **Execute Analysis / Ejecutar análisis**. Si SonarQube rechaza la petición, se ocultan los controles de análisis y se indica el motivo en Configuración. Una respuesta que simplemente indique que todavía no existe caché se considera válida. La comprobación se repite en el backend antes de iniciar cualquier scanner.

### Requisitos de las herramientas

La extensión incluye la orquestación y descarga automáticamente SonarScanner for .NET, pero no incluye compiladores ni SDK completos:

- Java/Kotlin necesita un JDK y Maven/Gradle o su wrapper.
- C#, VB.NET y F# necesitan el SDK de .NET.
- SonarScanner for NPM necesita Node.js con `npx` y un `package.json`; si NPX no está disponible, el modo automático intenta Docker.
- El modo Docker necesita Docker Desktop o Docker Engine.

Docker conserva la caché de SonarScanner entre análisis y utiliza el Java incluido en la imagen para reducir el tiempo de las siguientes ejecuciones.

El análisis solo puede ejecutarse en un workspace de confianza. Los lenguajes disponibles finalmente dependen también de la edición, plugins y configuración del servidor SonarQube.

## Integración con Problems

![Issues de SonarQube publicados en Problems](docs/images/problems-integration.png)

Los issues Overall se publican como diagnósticos nativos de VS Code mediante un gestor perteneciente al core. Esta publicación no depende de Pipeline ni de Live Remediation. Con Live Remediation activado, el módulo puede superponer temporalmente el estado local conservador: los hallazgos tocados pasan a entradas informativas **Modificado localmente**. SonarQube for IDE puede moverlos de pendiente de validación a pendiente de confirmación, pero las sincronizaciones normales y los refresh de arranque conservan ese estado pendiente. Solo el snapshot del servidor producido por un análisis real del repositorio puede clasificar una remediación pendiente como **Solucionada** o **Sigue detectándose**.

- se agrupan por archivo;
- muestran regla y descripción;
- incluyen severidad, línea y columna;
- muestran en el editor el icono del tipo de hallazgo y permiten consultar todos sus datos desde la propia línea;
- identifican a **SonarQube Dashboard & Pipeline** como origen;
- permiten navegar al código con un clic.
- muestran automáticamente el primer diagnóstico de SonarQube cuando su archivo pasa a ser el editor activo.

Para evitar diagnósticos asociados a archivos incorrectos, no se publica un issue cuando su ruta de SonarQube no puede resolverse dentro de la carpeta vinculada.

El comando **Limpiar Problems** elimina únicamente los diagnósticos publicados por la extensión.

## Configuración

![Configuración de la conexión con SonarQube](docs/images/configuration.png)

El flujo de conexión es explícito: **Conectar** valida la URL y el token y carga los componentes visibles sin seleccionar ninguno. Si la validación falla, el desplegable de proyectos permanece vacío y deshabilitado. El proyecto solo queda vinculado cuando el usuario lo selecciona y pulsa **Sincronizar**. Los borradores no guardados del servidor y del token se conservan al cambiar entre Datos y Configuración.

La página de configuración se organiza en **SonarQube**, **Módulos** y **Notificaciones**, junto con las pestañas opcionales **Pipeline**, **Integraciones** y **Live Remediation**. **SonarQube** contiene únicamente conexión, proyecto, rama y mapeo local; **Módulos** controla qué runtimes opcionales están cargados; **Pipeline** es propietario del scanner, alcance, comandos, pasos, plantillas y detección de herramientas; **Integraciones** muestra de forma informativa las herramientas detectadas cuando Pipeline está habilitado; **Live Remediation** muestra su integración/estado propio; y **Notificaciones** agrupa los avisos automáticos.

La página permite gestionar:

- **Servidor SonarQube:** URL base del servidor.
- **Token:** credencial utilizada para consultar la API.
- **Proyecto o aplicación:** componentes visibles para el token.
- **Rama:** rama opcional que debe consultarse.
- **Subcarpeta local:** correspondencia entre la raíz de SonarQube y una carpeta del workspace.
- **Método de análisis:** automático, Maven, Gradle, .NET, NPM, Docker o personalizado.
- **Inclusiones del análisis:** patrones comodín opcionales de `sonar.inclusions`. Puede escribirse un patrón por línea o separarlos por comas.
- **Exclusiones del análisis:** patrones comodín opcionales de `sonar.exclusions`. Puede escribirse un patrón por línea o separarlos por comas.
- **Módulo Pipeline:** `sonarQubeDashboard.modules.pipeline.enabled` controla si se cargan el runtime, comandos, vistas y configuración de Pipeline. Está activado de forma predeterminada.
- **Módulo Live Remediation:** `sonarQubeDashboard.modules.liveRemediation.enabled` controla si se cargan su seguimiento, watcher, vista y recursos de runtime. Está activado de forma predeterminada.
- **Comando de compilación:** comando opcional previo al scanner genérico o sustituto de `dotnet build`.
- **Comando personalizado:** permite integrar herramientas o procesos propios sin guardar el token en el comando.
- **Comandos previos al análisis:** `sonarQubeDashboard.pipeline.preAnalysisCommands` ejecuta comandos del pipeline antes del paso SonarQube; admite uno por línea y el prefijo opcional `Nombre ::`.
- **Comandos posteriores al análisis:** `sonarQubeDashboard.pipeline.postAnalysisCommands` ejecuta comandos después de que SonarQube procese correctamente el análisis; admite uno por línea y el prefijo opcional `Nombre ::`.
- **Pipeline de análisis:** comandos de compilación y tests detectados, pasos personalizados, orden y política de fallo.

El acordeón **Inclusiones y exclusiones del análisis** envía el alcance configurado a los flujos integrados de Maven, Gradle, .NET, NPM y Docker. Si ambos campos están vacíos y se utiliza el scanner genérico sin `sonar-project.properties`, la extensión conserva sus exclusiones automáticas para carpetas de dependencias y contenido generado. Los comandos de scanner personalizados pueden utilizar las variables normalizadas `${analysisInclusions}` y `${analysisExclusions}`.

Usa **Guardar inclusiones y exclusiones** para persistir estos dos campos dentro de la configuración propia del módulo Pipeline. El estado mostrado junto al botón confirma el resultado del guardado. Como este alcance es específico de cada proyecto, la extensión vacía ambos campos al volver a cargar la conexión de SonarQube y al sincronizar un proyecto o aplicación diferente; configura y guarda de nuevo el alcance para el nuevo componente vinculado.

### Seguridad del token

El token se almacena mediante:

```typescript
ExtensionContext.secrets
```

Por tanto:

- no se escribe en `settings.json`;
- no se incluye en el repositorio;
- no se empaqueta dentro del VSIX;
- se almacena de forma independiente para cada entorno de VS Code.

No incluyas tokens reales en capturas, incidencias o archivos del proyecto.

## Sincronización

Una sincronización realiza las siguientes acciones:

1. Lee la configuración de la carpeta activa.
2. Consulta issues Overall y New Code.
3. Consulta Security Hotspots y sus métricas.
4. Obtiene Quality Gate, ratings e histórico.
5. Asocia los componentes de SonarQube con archivos locales.
6. Publica los diagnósticos Overall en Problems.
7. Actualiza el panel lateral y el dashboard.

Si cambia la carpeta activa, la extensión selecciona su configuración correspondiente. Las solicitudes anteriores se cancelan para evitar que una respuesta obsoleta sobrescriba los datos actuales.

## Configuración disponible

```json
{
  "sonarQubeDashboard.language": "es",
  "sonarQubeDashboard.sonar.serverUrl": "",
  "sonarQubeDashboard.sonar.projectKey": "",
  "sonarQubeDashboard.sonar.projectName": "",
  "sonarQubeDashboard.sonar.branch": "",
  "sonarQubeDashboard.sonar.baseDir": "",
  "sonarQubeDashboard.pipeline.scannerMode": "auto",
  "sonarQubeDashboard.pipeline.analysisInclusions": "",
  "sonarQubeDashboard.pipeline.analysisExclusions": "",
  "sonarQubeDashboard.pipeline.buildCommand": "",
  "sonarQubeDashboard.pipeline.customScannerCommand": "",
  "sonarQubeDashboard.pipeline.preAnalysisCommands": "",
  "sonarQubeDashboard.pipeline.postAnalysisCommands": "",
  "sonarQubeDashboard.autoRefresh": true,
  "sonarQubeDashboard.refreshIntervalMinutes": 0,
  "sonarQubeDashboard.modules.pipeline.enabled": true,
  "sonarQubeDashboard.modules.liveRemediation.enabled": true,
  "sonarQubeDashboard.notifications.enabled": true,
  "sonarQubeDashboard.notifications.significantIncreasePercent": 20,
  "sonarQubeDashboard.notifications.significantIncreaseMinimum": 5
}
```

`sonarQubeDashboard.language` acepta `en` o `es` y se guarda globalmente para el entorno de VS Code. `autoRefresh` activa la sincronización al abrir o cambiar el workspace y un valor mayor que `0` en `refreshIntervalMinutes` habilita la actualización periódica. `modules.pipeline.enabled` y `modules.liveRemediation.enabled` activan o desactivan los runtimes opcionales completos; ambos valen `true` de forma predeterminada. Los ajustes `pipeline.*` pertenecen exclusivamente al módulo Pipeline. Activar y desactivar un módulo desde **Configuración → Módulos** requiere confirmación mediante un modal nativo de VS Code; el checkbox solo cambia tras confirmar y completar correctamente la transición, la pestaña Módulos permanece seleccionada durante la recomposición y desactivar Live Remediation conserva su sesión persistida.

## Limitaciones operativas

- La extensión no sustituye al servidor ni al scanner de SonarQube; necesita una instancia accesible y las herramientas requeridas por el modo de scanner seleccionado.
- Los issues, hotspots, datos de cobertura y duplicaciones solo se muestran cuando sus rutas pueden asociarse con archivos de la carpeta activa.
- Las gráficas históricas de New Code no se generan porque el periodo de New Code puede cambiar entre análisis y no siempre es comparable.
- Las operaciones de escritura dependen de los permisos del token y de las acciones que SonarQube devuelva para cada issue.
- Los comandos externos del pipeline pueden modificar archivos, acceder a la red o ejecutar código del proyecto. Revisa cada comando y utiliza únicamente workspaces de confianza.
- La cobertura solo está disponible cuando el scanner ha importado informes compatibles en SonarQube.
- Cuando un archivo seguido cambia fuera del editor, VS Code puede no proporcionar el diff exacto; en ese caso Live Remediation marca de forma conservadora todos los issues seguidos de ese archivo como modificados localmente.

## Documentación técnica

- [Modelo de seguridad y uso seguro](SECURITY.md)
- [Tratamiento de datos y persistencia local](PRIVACY.md)
- [Diagnóstico y resolución de problemas](SUPPORT.md)
- [Historial de versiones](CHANGELOG.md)
- [Términos de licencia](LICENSE)

## Licencia

Consulta [LICENSE](LICENSE) para conocer los términos de uso y distribución. La licencia no está aprobada como Open Source por la Open Source Initiative porque limita la modificación y distribución de trabajos derivados.
