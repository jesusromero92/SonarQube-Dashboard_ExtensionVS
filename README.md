# SonarQube Dashboard 0.5.0

Extensión de Visual Studio Code que conecta una carpeta del workspace con SonarQube, publica los issues en **Problems** y muestra un dashboard integrado.

## Cambios de esta versión

- El dashboard está dividido en dos páginas:
  - **Datos**, que es la página principal y se abre al pulsar el icono de la extensión.
  - **Configuración**, donde se introducen el servidor, token, proyecto, rama y subcarpeta.
- Cuando no hay proyecto vinculado o todavía no se han sincronizado datos, la página principal muestra un estado vacío con acceso directo a configuración.
- Después de guardar y sincronizar, la extensión vuelve automáticamente a la página de datos.
- La tabla principal se llama **Defectos**.
- Se añaden dos tablas nuevas:
  - **Top Archivos**, ordenada por número de defectos.
  - **Top Reglas**, ordenada por número de defectos.
- Las filas de Defectos y Top Archivos abren el archivo afectado. Las filas de Top Reglas abren un defecto representativo de la regla.
- Las tarjetas y tablas solo aparecen después de una sincronización explícita.
- Las severidades mostradas son las devueltas por el modo activo del servidor SonarQube.

## Uso

1. Abre la carpeta local correspondiente al proyecto de SonarQube.
2. Pulsa el icono de bug de **SonarQube Dashboard** en la barra izquierda.
3. En la página **Datos**, pulsa **Configurar proyecto**.
4. Introduce la URL y el token.
5. Pulsa **Conectar y cargar aplicaciones**.
6. Selecciona el proyecto o aplicación.
7. Pulsa **Guardar y sincronizar**.
8. La extensión vuelve a **Datos** y muestra:
   - totales por severidad;
   - Defectos;
   - Top Archivos;
   - Top Reglas.

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
4. Genera `sonarqube-dashboard-0.5.0.vsix` en la raíz.

Cuando las dependencias ya estén instaladas:

```powershell
.\generar-vsix.ps1 -SinInstalarDependencias
```

## Desarrollo

```bash
npm install
npm run compile
```

Pulsa `F5` para ejecutar la extensión en un Extension Development Host.
