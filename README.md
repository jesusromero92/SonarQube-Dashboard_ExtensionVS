# Issue Dashboard 0.4.0

Extensión de Visual Studio Code que conecta una carpeta del workspace con SonarQube, publica los issues en **Problems** y muestra un dashboard con los defectos ordenados por severidad.

## Cambios de esta versión

- El icono del panel y de la pestaña es un bug.
- Servidor, token y botón de conexión están en la misma fila.
- El selector de proyecto y el botón **Sincronizar** están en la misma fila.
- La selección del proyecto se conserva al guardar y ya no vuelve al proyecto anterior.
- Las tarjetas se generan con las severidades activas del servidor:
  - MQR: `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, `INFO`.
  - Standard Experience: `BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR`, `INFO`.
- Las tarjetas y la tabla permanecen ocultas hasta realizar una sincronización.
- Se incluye un script de PowerShell para compilar y generar el VSIX.

## Uso

1. Abre la carpeta local correspondiente al proyecto de SonarQube.
2. Pulsa el icono de bug de **Issue Dashboard** en la barra izquierda.
3. Introduce la URL y el token.
4. Pulsa **Conectar**.
5. Selecciona el proyecto o aplicación.
6. Pulsa **Sincronizar**.
7. Los issues aparecerán en **Problems** y en la tabla del dashboard.

El token se guarda mediante `ExtensionContext.secrets` (`SecretStorage`) y no se escribe en `settings.json`.

## Generar el VSIX en Windows

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
.\generar-vsix.ps1
```

También puedes ejecutar:

```bat
generar-vsix.cmd
```

El script realiza:

1. `npm ci` o `npm install`.
2. `npm run compile`.
3. `npx @vscode/vsce package`.
4. Genera `issue-dashboard-0.4.0.vsix` en la raíz.

Cuando las dependencias ya estén instaladas y no quieras reinstalarlas:

```powershell
.\generar-vsix.ps1 -SinInstalarDependencias
```

## Desarrollo

```bash
npm install
npm run compile
```

Pulsa `F5` para ejecutar la extensión en un Extension Development Host.

## Configuración guardada por carpeta

```json
{
  "issueDashboard.sonar.serverUrl": "https://sonarqube.example.com",
  "issueDashboard.sonar.projectKey": "mi-proyecto",
  "issueDashboard.sonar.branch": "main",
  "issueDashboard.sonar.baseDir": ""
}
```

## Comandos

- `Issue Dashboard: Abrir dashboard`
- `Issue Dashboard: Actualizar issues`
- `Issue Dashboard: Limpiar Problems`
