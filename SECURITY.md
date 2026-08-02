# Security model and secure operation / Modelo de seguridad y uso seguro

## English

### Trust boundaries

The extension connects Visual Studio Code, the local workspace, the configured SonarQube server, and any command-line tools selected for a pipeline. Treat all four as separate trust boundaries.

- SonarQube responses are remote data and are rendered as text by the extension.
- Workspace files and scripts can contain executable project code.
- Pipeline commands run with the permissions of the Visual Studio Code process or remote extension host.
- External scanners, package managers, linters, and security tools are outside the extension's security boundary.

### Token protection

- Access tokens are stored with VS Code `SecretStorage`, not in `settings.json`.
- Tokens are supplied only when authenticating requests or scanner processes that require them.
- Recognizable tokens, passwords, secrets, API keys, and Bearer headers are redacted from diagnostic reports and scanner logs.
- Use a dedicated token with the minimum SonarQube permissions required by the intended workflow.
- Revoke and replace a token immediately when exposure is suspected.

### Command execution

Repository analysis can execute build, test, audit, scanner, integration, and custom commands. These commands can read or modify files, launch child processes, access environment variables, or connect to external services.

Before each run:

1. Use a trusted workspace.
2. Review every selected command and its order.
3. Verify commands imported from YAML templates before saving or running them.
4. Confirm that external tools come from trusted publishers and expected paths.
5. Avoid embedding credentials directly in command text.

### SonarQube permissions

Read operations require access to the selected project. Issue transitions, assignments, comments, and other write actions are displayed only when the server reports them as available, but SonarQube remains the final authorization authority.

### Network security

- Prefer HTTPS for the SonarQube server.
- Do not place credentials in the server URL.
- Ensure corporate proxies and custom certificate authorities are configured in the environment where VS Code and the scanner run.
- In Remote, WSL, SSH, or Dev Container sessions, the extension and scanner may execute in the remote environment; validate network reachability from that environment.

### Diagnostic reports

The copied technical report is designed to omit recognizable secrets, but it can include server hostnames, project identifiers, local paths, tool versions, commands, and error messages. Review the report before sharing it outside the organization.

### Secure deployment checklist

- Use least-privilege SonarQube tokens.
- Require trusted workspaces for repository analysis.
- Review custom and imported pipeline commands.
- Use HTTPS and supported SonarQube/scanner versions.
- Keep Visual Studio Code, the extension, scanners, and external tools updated.
- Restrict write permissions when only dashboard and synchronization functions are required.
- Clear history and revoke tokens before transferring or disposing of a development environment.

## Español

### Límites de confianza

La extensión conecta Visual Studio Code, el workspace local, el servidor SonarQube configurado y las herramientas de línea de comandos seleccionadas. Considera los cuatro elementos como límites de confianza independientes.

- Las respuestas de SonarQube son datos remotos y la extensión las representa como texto.
- Los archivos y scripts del workspace pueden contener código ejecutable.
- Los comandos del pipeline se ejecutan con los permisos del proceso de Visual Studio Code o del extension host remoto.
- Los scanners, gestores de paquetes, linters y herramientas de seguridad externas quedan fuera del límite de seguridad de la extensión.

### Protección del token

- Los tokens se guardan mediante `SecretStorage`, no en `settings.json`.
- Solo se proporcionan al autenticar solicitudes o procesos de scanner que los necesiten.
- Los informes y logs ocultan tokens, contraseñas, secretos, API keys y cabeceras Bearer reconocibles.
- Utiliza un token específico con los permisos mínimos necesarios.
- Revoca y sustituye inmediatamente cualquier token cuya exposición sea posible.

### Ejecución de comandos

El análisis puede ejecutar compilación, tests, auditorías, scanner, integraciones y comandos personalizados. Estos comandos pueden leer o modificar archivos, iniciar procesos, acceder a variables de entorno o conectarse a servicios externos.

Antes de cada ejecución:

1. Utiliza un workspace de confianza.
2. Revisa todos los comandos seleccionados y su orden.
3. Verifica los comandos importados desde plantillas YAML antes de guardarlos o ejecutarlos.
4. Comprueba que las herramientas externas proceden de proveedores y rutas esperados.
5. No incluyas credenciales directamente en el texto de los comandos.

### Permisos de SonarQube

Las lecturas requieren acceso al proyecto seleccionado. Las transiciones, asignaciones, comentarios y otras escrituras solo se muestran cuando el servidor las ofrece, pero SonarQube sigue siendo la autoridad final de autorización.

### Seguridad de red

- Utiliza HTTPS para SonarQube.
- No incluyas credenciales en la URL del servidor.
- Configura proxies corporativos y autoridades certificadoras en el entorno donde se ejecutan VS Code y el scanner.
- En sesiones Remote, WSL, SSH o Dev Container, la extensión y el scanner pueden ejecutarse en el entorno remoto; valida la conectividad desde ese entorno.

### Informes de diagnóstico

El informe técnico oculta secretos reconocibles, pero puede incluir nombres de host, identificadores de proyecto, rutas locales, versiones, comandos y errores. Revísalo antes de compartirlo fuera de la organización.

### Lista de comprobación para un uso seguro

- Usa tokens con privilegios mínimos.
- Exige workspaces de confianza para ejecutar análisis.
- Revisa comandos personalizados e importados.
- Utiliza HTTPS y versiones compatibles de SonarQube y scanners.
- Mantén actualizados Visual Studio Code, la extensión y las herramientas externas.
- Limita los permisos de escritura cuando solo se necesiten consultas y dashboard.
- Limpia el historial y revoca tokens antes de transferir o retirar un entorno.
