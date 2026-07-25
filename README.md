# SonarQube Dashboard 0.10.0

Extensión para Visual Studio Code que conecta una carpeta del workspace con un proyecto de SonarQube, publica sus issues en el panel **Problems** y muestra un dashboard integrado con métricas, defectos, archivos, reglas y evolución histórica.

## Características

- Dashboard integrado en Visual Studio Code.
- Acceso desde el icono de bug situado en la barra lateral.
- Dos páginas principales:
  - **Datos**, abierta por defecto.
  - **Configuración**, para gestionar la conexión con SonarQube.
- Selección de proyectos y aplicaciones visibles para el token configurado.
- Publicación de los issues de SonarQube en el panel **Problems**.
- Asociación de los issues con los archivos y líneas del workspace.
- Resumen por severidad o criticidad.
- Tabla completa de **Defectos**.
- Tabla de **Top Archivos**.
- Tabla de **Top Reglas**.
- Métricas de Quality Gate.
- Visualización de Security Hotspots.
- Evolución histórica de los análisis.
- Filtros y navegación directa desde las tablas hasta el código afectado.
- Compatibilidad con los distintos modos de severidad de SonarQube.
- Almacenamiento seguro del token mediante `SecretStorage`.

## Páginas del dashboard

### Datos

Es la página principal y se abre al pulsar el icono de la extensión.

Cuando existe un proyecto configurado y se han sincronizado los datos, muestra:

- resumen de defectos por severidad;
- estado del Quality Gate;
- Defectos;
- Top Archivos;
- Top Reglas;
- Security Hotspots;
- evolución histórica por tipo;
- evolución histórica por criticidad.

Las tablas permiten navegar directamente al archivo y línea relacionados con el defecto.

Cuando todavía no hay un proyecto vinculado, se muestra un estado vacío con un botón para abrir la página de configuración.

### Configuración

Permite introducir y guardar:

- URL del servidor SonarQube;
- token de acceso;
- proyecto o aplicación;
- rama opcional;
- subcarpeta local opcional.

Después de introducir la URL y el token, el botón **Conectar** carga los proyectos y aplicaciones visibles para ese usuario.

Al pulsar **Sincronizar**, la extensión:

1. Guarda la configuración.
2. Consulta los datos de SonarQube.
3. Publica los issues correspondientes en **Problems**.
4. Actualiza las métricas y tablas.
5. Vuelve a la página de Datos.

## Uso

1. Abre en VS Code la carpeta local correspondiente al proyecto de SonarQube.
2. Pulsa el icono de bug de **SonarQube Dashboard** en la barra lateral.
3. En la página Datos, pulsa **Configurar proyecto**.
4. Introduce la URL del servidor SonarQube.
5. Introduce un token con permisos para consultar el proyecto.
6. Pulsa **Conectar**.
7. Selecciona un proyecto o aplicación.
8. Configura opcionalmente la rama y la subcarpeta local.
9. Pulsa **Sincronizar**.
10. Consulta los resultados en el dashboard y en el panel **Problems**.

## Seguridad del token

El token se guarda mediante la API de almacenamiento seguro de Visual Studio Code:

```typescript
ExtensionContext.secrets
```

Visual Studio Code utiliza `SecretStorage` para proteger este valor.

El token:

- no se escribe en `settings.json`;
- no se incluye en el repositorio;
- no se guarda dentro del VSIX;
- se almacena de forma independiente para cada entorno de Visual Studio Code.

No incluyas tokens reales en capturas, incidencias ni archivos del proyecto.

## Configuración disponible

La extensión utiliza las siguientes propiedades:

```json
{
  "sonarQubeDashboard.sonar.serverUrl": "",
  "sonarQubeDashboard.sonar.projectKey": "",
  "sonarQubeDashboard.sonar.branch": "",
  "sonarQubeDashboard.sonar.baseDir": "",
  "sonarQubeDashboard.autoRefresh": true,
  "sonarQubeDashboard.refreshIntervalMinutes": 0
}
```

La URL, el proyecto, la rama y la subcarpeta también pueden gestionarse directamente desde el dashboard.

## Desarrollo

Instala las dependencias:

```bash
npm install
```

Compila el proyecto:

```bash
npm run compile
```

Para mantener el compilador activo durante el desarrollo:

```bash
npm run watch
```

Pulsa `F5` desde Visual Studio Code para ejecutar la extensión en un **Extension Development Host**.

## Estructura del código

El dashboard está dividido en módulos para facilitar su mantenimiento y crecimiento.

```text
src/
├── constants.ts
├── dashboardPanel.ts
├── diagnostics.ts
├── extension.ts
├── sonarClient.ts
├── types.ts
└── dashboard/
    ├── contracts.ts
    ├── summary.ts
    ├── pages/
    ├── components/
    ├── modals/
    ├── scripts/
    └── styles/
```

Las constantes relacionadas con severidades, criticidades, tipos, colores, iconos, estados y métricas están centralizadas para evitar duplicación.

Las páginas, tablas, gráficas, modales, scripts y estilos del dashboard se encuentran separadas en módulos independientes.

## Generar el VSIX en Windows

Desde PowerShell, dentro de la carpeta raíz del proyecto:

```powershell
.\generar-vsix.ps1
```

También puedes ejecutar:

```bat
generar-vsix.cmd
```

El proceso realiza:

1. Instalación de dependencias mediante `npm ci` o `npm install`.
2. Compilación mediante `npm run compile`.
3. Empaquetado mediante `@vscode/vsce`.
4. Generación del archivo VSIX.

Cuando las dependencias ya estén instaladas:

```powershell
.\generar-vsix.ps1 -SinInstalarDependencias
```

También se puede generar directamente mediante:

```bash
npm run package
```

El archivo generado tendrá la versión indicada en `package.json`, por ejemplo:

```text
vscode-sonarqube-dashboard-0.10.0.vsix
```

Si el script utiliza un nombre de salida personalizado, puede generarse como:

```text
sonarqube-dashboard-0.10.0.vsix
```

## Instalar el VSIX

1. Abre Visual Studio Code.
2. Pulsa `Ctrl + Shift + P`.
3. Ejecuta:

```text
Extensions: Install from VSIX...
```

4. Selecciona el archivo `.vsix`.
5. Recarga la ventana cuando Visual Studio Code lo solicite.

## Repositorio

El código fuente está disponible en:

https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS

Las incidencias y propuestas pueden registrarse en:

https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS/issues

## Licencia

Este proyecto es de código fuente público y puede utilizarse gratuitamente en su forma original y sin modificaciones.

No está permitido:

- modificar el código fuente;
- crear versiones derivadas;
- distribuir versiones modificadas;
- eliminar los avisos de autoría o licencia;
- vender copias o versiones derivadas de la extensión.

Consulta el archivo [LICENSE](LICENSE) para conocer los términos completos.

> Esta licencia no corresponde a una licencia Open Source aprobada por la Open Source Initiative, ya que no permite modificar ni distribuir trabajos derivados.
