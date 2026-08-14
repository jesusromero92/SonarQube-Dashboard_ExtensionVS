# Data processing and local persistence / Tratamiento de datos y persistencia local

## English

### Data processed by the extension

The extension processes the following information to provide its functionality:

- SonarQube server URL, project key, project name, branch, and local subfolder;
- access token used to authenticate requests to the configured SonarQube server;
- issues, Security Hotspots, Quality Gate conditions, ratings, measures, histories, comments, users, coverage, and duplication information returned by SonarQube;
- workspace file paths required to associate SonarQube components with local files;
- local file-change events for files that currently contain tracked SonarQube issues while Live Remediation is enabled; the watcher is local and does not upload file contents by itself;
- pipeline configuration, selected steps, commands, execution status, duration, and output;
- diagnostic information such as VS Code, Node.js, extension, operating-system, scanner, and SonarQube versions;
- notification baselines used to detect regressions between synchronizations.

### Network communication

The extension sends requests only to the SonarQube server configured for the active workspace folder. Repository scanners and external tools selected in the pipeline can make their own network requests according to their configuration and privacy policies.

The extension does not include product analytics, advertising identifiers, or usage telemetry of its own.

### Local storage

| Data | Storage mechanism | Scope and retention |
|---|---|---|
| Access token | VS Code `SecretStorage` | Stored per configured workspace folder until replaced or removed. |
| Server, project, branch, base directory, scanner, module enablement, Live Remediation, and notification settings | VS Code configuration | Stored according to the setting scope shown by VS Code. |
| Pipeline steps, detected commands, templates, execution history, pending Live Remediation state/ranges, diagnostic state, and notification baselines | VS Code workspace state | Stored locally for the workspace. Execution history is limited to the latest 30 runs per analysis folder; pending Live Remediation state is removed when it is cleared or confirmed by a later SonarQube synchronization. |
| Current dashboard and editor state | Extension memory and webview state | Temporary; rebuilt when the extension reloads or synchronizes. |

Execution logs can contain paths, source-tool output, dependency names, test names, server messages, or other project information. The history implementation limits stored log size and can omit the beginning of very long logs.

### Secret handling

Tokens are not written to `settings.json`. Diagnostic reports and scanner output are filtered to hide recognizable tokens, passwords, secrets, API keys, and Bearer authorization headers. Redaction is a protective measure, not a guarantee that arbitrary third-party command output contains no confidential information. Review copied reports before sharing them.

### Removing stored information

- Replace or remove the token from the extension configuration to update `SecretStorage`.
- Clear pipeline history from the execution interface to remove saved runs.
- Remove the workspace configuration or uninstall the extension and clear its stored data through Visual Studio Code when a complete reset is required.
- Delete scanner-generated files, tool caches, or reports separately; they are created and controlled by the corresponding external tools.

## Español

### Datos tratados por la extensión

La extensión procesa la siguiente información para proporcionar sus funciones:

- URL del servidor SonarQube, clave y nombre del proyecto, rama y subcarpeta local;
- token utilizado para autenticar las solicitudes al servidor configurado;
- issues, Security Hotspots, condiciones del Quality Gate, ratings, métricas, históricos, comentarios, usuarios, cobertura y duplicaciones devueltos por SonarQube;
- rutas de archivos del workspace necesarias para asociar componentes de SonarQube con archivos locales;
- eventos locales de cambio de archivos que contienen issues de SonarQube seguidos mientras Live Remediation está activo; el watcher es local y no sube por sí mismo el contenido de los archivos;
- configuración del pipeline, pasos seleccionados, comandos, estado, duración y salida de las ejecuciones;
- datos de diagnóstico como versiones de VS Code, Node.js, extensión, sistema operativo, scanner y SonarQube;
- referencias de notificación utilizadas para detectar regresiones entre sincronizaciones.

### Comunicaciones de red

La extensión envía solicitudes únicamente al servidor SonarQube configurado para la carpeta activa. Los scanners y herramientas externas seleccionados en el pipeline pueden realizar sus propias conexiones de acuerdo con su configuración y sus políticas de privacidad.

La extensión no incluye analítica de producto, identificadores publicitarios ni telemetría de uso propia.

### Almacenamiento local

| Dato | Mecanismo | Alcance y conservación |
|---|---|---|
| Token de acceso | `SecretStorage` de VS Code | Se guarda por carpeta configurada hasta que se sustituye o elimina. |
| Servidor, proyecto, rama, subcarpeta, scanner, activación de módulos, Live Remediation y notificaciones | Configuración de VS Code | Se guardan según el alcance que muestra VS Code. |
| Pasos, comandos detectados, plantillas, historial, estados/rangos pendientes de Live Remediation, diagnóstico y referencias de notificación | Estado del workspace de VS Code | Se guardan localmente para el workspace. El historial se limita a 30 ejecuciones por carpeta de análisis; el estado pendiente de Live Remediation se elimina al limpiarlo o al confirmarlo una sincronización posterior con SonarQube. |
| Estado actual del dashboard y del editor | Memoria de la extensión y estado del webview | Temporal; se reconstruye al recargar o sincronizar. |

Los logs pueden contener rutas, salida de herramientas, dependencias, nombres de tests, mensajes del servidor u otros datos del proyecto. El historial limita el tamaño almacenado y puede omitir el comienzo de logs muy extensos.

### Tratamiento de secretos

Los tokens no se escriben en `settings.json`. Los informes de diagnóstico y la salida del scanner se filtran para ocultar tokens, contraseñas, secretos, API keys y cabeceras Bearer reconocibles. El filtrado es una medida de protección, no una garantía de que la salida arbitraria de comandos externos no contenga información confidencial. Revisa los informes antes de compartirlos.

### Eliminación de información almacenada

- Sustituye o elimina el token desde la configuración para actualizar `SecretStorage`.
- Limpia el historial desde la interfaz de ejecuciones para eliminar las ejecuciones guardadas.
- Elimina la configuración del workspace o desinstala la extensión y borra sus datos desde Visual Studio Code cuando necesites un reinicio completo.
- Elimina por separado los archivos, cachés o informes creados por scanners y herramientas externas.
