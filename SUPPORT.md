# Diagnostics and troubleshooting / Diagnóstico y resolución de problemas

## English

### Collecting a technical report

1. Open the **SonarQube Dashboard & Pipeline** side panel.
2. Open **Diagnostics** using the information icon.
3. Refresh the diagnostic snapshot.
4. Select **Copy report**.
5. Review the copied text and remove any organization-specific information that should not be shared.

The report includes the extension, VS Code, Node.js, operating-system, SonarQube, compatibility, scanner, tool, command, latency, workspace-trust, and latest-failed-request information available to the extension. Recognizable credentials are redacted.

### Connection fails

Check the following in order:

1. The server URL includes the correct protocol and base path.
2. The server is reachable from the environment where the extension runs.
3. The token is valid and has access to the selected project.
4. A proxy, VPN, firewall, or custom certificate is not blocking the request.
5. The SonarQube version is compatible with the API profile reported in Diagnostics.

### Project connects but no local issues appear

- Confirm that the open folder contains the same sources analyzed by SonarQube.
- Confirm that the selected project and branch are correct.
- Configure **Advanced configuration → Local subfolder** when SonarQube paths start below the workspace root.
- Synchronize again after changing the mapping.
- Open Diagnostics and inspect mapping, project, branch, and request information.

The extension intentionally omits issues whose files cannot be resolved locally.

### Analysis does not start

- Trust the workspace.
- Verify the selected scanner mode and detected command.
- Install the required scanner, build system, runtime, Docker engine, or package-manager dependency.
- Review every selected pipeline step; the Analyze action remains disabled while a required command is incomplete.
- Check that the working folder and local subfolder are correct.

### Analysis starts but fails

- Open the active execution and identify the first failed step.
- Review the exact command, exit code, and tool output.
- Run the same command manually from the same workspace folder.
- Check environment variables, PATH, runtime versions, certificates, and network access.
- For SonarQube processing failures, inspect the scanner output and the server-side background task.

### Dashboard data looks outdated

- Use the refresh action in the side panel.
- Verify that **Automatic refresh** is enabled when automatic synchronization is expected.
- Check `sonarQubeDashboard.refreshIntervalMinutes`; `0` disables periodic refresh.
- Confirm that the active workspace folder is the one linked to the intended SonarQube project.

### Coverage or duplication is unavailable

- Confirm that the scanner imported a supported coverage report.
- Confirm that the latest SonarQube analysis contains the expected measures.
- Verify local path mapping for the selected file.
- Missing measures are displayed as unavailable and are not converted into artificial zero values.

### Issue actions are missing or rejected

Available transitions and actions depend on the current issue state, SonarQube version, project permissions, and token permissions. Refresh the issue details and verify permissions directly in SonarQube.

### Resetting local extension data

1. Clear pipeline history from the execution view when only execution records must be removed.
2. Remove or replace the stored token from the extension configuration.
3. Remove workspace-level SonarQube and pipeline settings when the project link must be recreated.
4. Reload Visual Studio Code and configure the project again.

When requesting support, include the redacted technical report, extension version, VS Code version, operating system, SonarQube version, scanner mode, reproducible steps, expected result, actual result, and relevant log section.

Support and issue tracking: <https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS/issues>

## Español

### Obtener un informe técnico

1. Abre el panel lateral de **SonarQube Dashboard & Pipeline**.
2. Abre **Diagnóstico** mediante el icono de información.
3. Actualiza la captura de diagnóstico.
4. Pulsa **Copiar informe**.
5. Revisa el texto y elimina cualquier información específica de la organización que no deba compartirse.

El informe incluye la información disponible sobre extensión, VS Code, Node.js, sistema operativo, SonarQube, compatibilidad, scanner, herramientas, comandos, latencia, confianza del workspace y última petición fallida. Las credenciales reconocibles se ocultan.

### Falla la conexión

Comprueba en este orden:

1. La URL incluye protocolo y ruta base correctos.
2. El servidor es accesible desde el entorno donde se ejecuta la extensión.
3. El token es válido y tiene acceso al proyecto.
4. Ningún proxy, VPN, firewall o certificado personalizado bloquea la solicitud.
5. La versión de SonarQube es compatible con el perfil indicado en Diagnóstico.

### Conecta, pero no aparecen issues locales

- Comprueba que la carpeta abierta contiene los mismos fuentes analizados por SonarQube.
- Comprueba el proyecto y la rama seleccionados.
- Configura **Configuración avanzada → Subcarpeta local** cuando las rutas comiencen por debajo de la raíz.
- Vuelve a sincronizar después de cambiar la asociación.
- Revisa en Diagnóstico la carpeta, proyecto, rama y última petición.

La extensión omite intencionadamente los issues cuyos archivos no pueden resolverse localmente.

### El análisis no comienza

- Confía en el workspace.
- Revisa el modo de scanner y el comando detectado.
- Instala el scanner, sistema de build, runtime, Docker o dependencia del gestor de paquetes requerida.
- Revisa cada paso seleccionado; el botón Analizar permanece deshabilitado si falta un comando obligatorio.
- Comprueba la carpeta de trabajo y la subcarpeta local.

### El análisis comienza, pero falla

- Abre la ejecución activa e identifica el primer paso fallido.
- Revisa el comando, código de salida y salida de la herramienta.
- Ejecuta manualmente el mismo comando desde la misma carpeta.
- Comprueba variables de entorno, PATH, versiones, certificados y red.
- Para fallos de procesamiento de SonarQube, revisa la salida del scanner y la tarea en segundo plano del servidor.

### Los datos parecen desactualizados

- Usa la acción de recarga del panel lateral.
- Comprueba que **Actualización automática** esté activada.
- Revisa `sonarQubeDashboard.refreshIntervalMinutes`; `0` desactiva la actualización periódica.
- Comprueba que la carpeta activa sea la vinculada al proyecto esperado.

### No hay cobertura o duplicación

- Confirma que el scanner importó un informe de cobertura compatible.
- Confirma que el último análisis contiene las métricas esperadas.
- Revisa la asociación de rutas del archivo.
- Las métricas ausentes se muestran como no disponibles y no se convierten en ceros artificiales.

### Faltan acciones de un issue o el servidor las rechaza

Las transiciones dependen del estado, versión de SonarQube, permisos del proyecto y permisos del token. Actualiza el detalle y verifica los permisos directamente en SonarQube.

### Restablecer los datos locales

1. Limpia el historial desde la vista de ejecuciones si solo quieres eliminar los registros.
2. Elimina o sustituye el token guardado.
3. Elimina la configuración de SonarQube y pipeline del workspace si necesitas recrear la vinculación.
4. Recarga Visual Studio Code y configura de nuevo el proyecto.

Para solicitar soporte, incluye el informe sin secretos, versión de la extensión, VS Code, sistema operativo, versión de SonarQube, scanner, pasos reproducibles, resultado esperado, resultado real y sección relevante del log.

Soporte y seguimiento de incidencias: <https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS/issues>
