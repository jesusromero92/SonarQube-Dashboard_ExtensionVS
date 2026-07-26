# SonarQube Dashboard para Visual Studio Code

SonarQube Dashboard conecta cada carpeta del workspace con un proyecto de SonarQube y acerca sus resultados al flujo de trabajo de Visual Studio Code.

La extensión permite ejecutar un nuevo análisis del repositorio, consultar el estado del proyecto, comparar **Overall** y **New Code**, revisar defectos y Security Hotspots, analizar la evolución entre análisis y publicar los hallazgos directamente en el panel **Problems**.


## Requisito para utilizar la extensión

Para que SonarQube Dashboard funcione correctamente:

1. La aplicación debe haber sido analizada previamente en SonarQube.
2. En Visual Studio Code debe abrirse la carpeta local de esa misma aplicación.
3. La carpeta abierta debe vincularse con el proyecto correspondiente de SonarQube desde la pestaña **Configuración**.

La extensión compara las rutas de los componentes devueltos por SonarQube con los archivos existentes en la carpeta abierta. En el dashboard y en **Problems** se mostrarán únicamente los defectos que puedan asociarse con un archivo local coincidente.

Si el código analizado se encuentra dentro de una subcarpeta del workspace, debe indicarse en **Configuración avanzada → Subcarpeta local**. Una asociación incorrecta entre proyecto, carpeta o subcarpeta puede provocar que SonarQube tenga issues, pero que estos no aparezcan en la extensión.

## Características principales

- Análisis del repositorio desde VS Code con detección automática del scanner.
- Compatibilidad con Maven/Gradle para Java y Kotlin, SonarScanner for .NET para C#/VB.NET/F#, SonarScanner for NPM para proyectos con `package.json` y SonarScanner CLI en Docker para proyectos genéricos.
- Selección manual de Maven, Gradle, .NET, NPM, Docker o un comando personalizado.
- Sincronización automática al abrir un proyecto ya vinculado.
- Configuración independiente por carpeta del workspace.
- Token protegido mediante `SecretStorage`.
- Selector global **Overall / New Code**.
- Resumen por severidad y tipo de defecto.
- Ratings de Maintainability, Reliability, Security y Security Review.
- Estado y detalle completo del Quality Gate.
- Tabla de defectos con filtro y navegación al código.
- Tabla específica de Security Hotspots.
- Rankings de archivos y reglas con ordenación por columnas.
- Evolución histórica por tipo de issue y criticidad.
- Publicación de diagnósticos en **Problems**.
- Compatibilidad con ramas y subcarpetas locales.

## Inicio rápido

1. Comprueba que la aplicación ya tenga al menos un análisis disponible en SonarQube.
2. Abre en VS Code la carpeta local de esa misma aplicación.
3. Pulsa el icono de **SonarQube Dashboard** en la barra de actividad.
4. Abre la pestaña **Configuración**.
5. Introduce la URL del servidor y un token de acceso.
6. Pulsa **Conectar y cargar proyectos**.
7. Vincula la carpeta con el proyecto o aplicación de SonarQube que analiza ese código.
8. Configura opcionalmente la rama y, si las rutas no parten de la raíz del workspace, la subcarpeta local.
9. Pulsa **Guardar y sincronizar**.
10. En la página **Datos**, pulsa **Analizar repositorio** para generar y enviar un nuevo análisis.

Después de la primera vinculación, la extensión sincroniza los datos automáticamente al abrir el workspace. El icono de recarga del panel lateral permite solicitar una actualización manual.

## Panel lateral

![Panel lateral con resumen de SonarQube](docs/images/sidebar-summary.png)

El panel lateral ofrece una lectura rápida sin abandonar el explorador de VS Code:

- **Datos / Configuración:** cambia entre el resumen y la conexión del proyecto.
- **Recargar:** vuelve a consultar SonarQube y actualiza el dashboard y Problems.
- **Issues encontrados:** total de issues recuperados para el proyecto.
- **Severidades:** distribución de Blocker, Critical, Major, Minor e Info.
- **Tipos:** Bugs, Code Smells, Vulnerabilidades y Security Hotspots.
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
- Top Reglas;
- las gráficas de evolución.

**Overall** representa el estado completo del proyecto. **New Code** limita la vista al periodo de código nuevo configurado en SonarQube.

### Resumen superior

Cada columna muestra:

- valor actual;
- severidad correspondiente;
- aumento o disminución frente al análisis anterior;
- color oficial utilizado en el resto del dashboard.

Los indicadores `▲` y `▼` permiten detectar rápidamente regresiones y mejoras. Cuando no existe variación se muestra **Sin cambios**.

### Tabla de defectos

La tabla contiene:

- **Severidad:** criticidad del issue.
- **Tipo:** icono de Bug, Code Smell o Vulnerabilidad.
- **Archivo:** nombre final y línea afectada; el tooltip conserva la ruta completa.
- **Regla:** nombre descriptivo de la regla de SonarQube.

El campo de búsqueda filtra por archivo, regla o descripción. Al pulsar una fila se abre el archivo local en la línea afectada. Al pulsar la regla se muestra su descripción en un modal.

Solo se incluyen los issues cuyo componente de SonarQube coincide con un archivo de la carpeta abierta, teniendo en cuenta la subcarpeta local configurada.

El encabezado permanece fijo y únicamente el cuerpo de la tabla tiene desplazamiento vertical.

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

Cada punto representa un análisis anterior. Al mover el ratón sobre la gráfica aparece un tooltip que sigue el cursor e indica la fecha y los valores de todas las series visibles.

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

La extensión muestra el progreso y el registro completo, permite cancelar el proceso, espera a que SonarQube termine la tarea en segundo plano y después actualiza automáticamente el dashboard y **Problems**. El modal puede cerrarse durante la ejecución sin detener el análisis; **Ver registro** permite abrirlo de nuevo. Únicamente **Cancelar análisis** finaliza el scanner. El token se oculta en el registro.

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

Los issues Overall se publican como diagnósticos nativos de VS Code:

- se agrupan por archivo;
- muestran regla y descripción;
- incluyen severidad, línea y columna;
- identifican a **SonarQube Dashboard** como origen;
- permiten navegar al código con un clic.

Para evitar diagnósticos asociados a archivos incorrectos, no se publica un issue cuando su ruta de SonarQube no puede resolverse dentro de la carpeta vinculada.

El comando **Limpiar Problems** elimina únicamente los diagnósticos publicados por la extensión.

## Configuración

![Configuración de la conexión con SonarQube](docs/images/configuration.png)

La página de configuración permite gestionar:

- **Servidor SonarQube:** URL base del servidor.
- **Token:** credencial utilizada para consultar la API.
- **Proyecto o aplicación:** componentes visibles para el token.
- **Rama:** rama opcional que debe consultarse.
- **Subcarpeta local:** correspondencia entre la raíz de SonarQube y una carpeta del workspace.
- **Método de análisis:** automático, Maven, Gradle, .NET, NPM, Docker o personalizado.
- **Comando de compilación:** comando opcional previo al scanner genérico o sustituto de `dotnet build`.
- **Comando personalizado:** permite integrar herramientas o procesos propios sin guardar el token en el comando.

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
  "sonarQubeDashboard.sonar.serverUrl": "",
  "sonarQubeDashboard.sonar.projectKey": "",
  "sonarQubeDashboard.sonar.branch": "",
  "sonarQubeDashboard.sonar.baseDir": "",
  "sonarQubeDashboard.sonar.scannerMode": "auto",
  "sonarQubeDashboard.sonar.buildCommand": "",
  "sonarQubeDashboard.sonar.customScannerCommand": "",
  "sonarQubeDashboard.autoRefresh": true,
  "sonarQubeDashboard.refreshIntervalMinutes": 0
}
```

`autoRefresh` activa la sincronización al abrir o cambiar el workspace. Un valor mayor que `0` en `refreshIntervalMinutes` habilita la actualización periódica.

## Desarrollo

Instala las dependencias y compila:

```bash
npm install
npm run compile
```

Para mantener el compilador activo:

```bash
npm run watch
```

Pulsa `F5` desde Visual Studio Code para ejecutar la extensión en un **Extension Development Host**.

### Estructura

```text
src/
├── constants.ts
├── dashboardPanel.ts
├── diagnostics.ts
├── extension.ts
├── sonarClient.ts
├── types.ts
├── scanner/
│   ├── analysisService.ts
│   ├── detector.ts
│   ├── processRunner.ts
│   └── types.ts
└── dashboard/
    ├── contracts.ts
    ├── summary.ts
    ├── components/
    ├── modals/
    ├── pages/
    ├── scripts/
    └── styles/
```

Colores, iconos, severidades, tipos, estados y métricas están centralizados. Las páginas, componentes, scripts, modales y estilos del webview se mantienen en módulos separados.

## Generar el VSIX

Desde PowerShell:

```powershell
.\generar-vsix.ps1
```

Sin reinstalar dependencias:

```powershell
.\generar-vsix.ps1 -SinInstalarDependencias
```

También se puede ejecutar:

```bat
generar-vsix.cmd
```

El VSIX utiliza la versión indicada en `package.json`.

## Instalar el VSIX

1. Abre la paleta con `Ctrl + Shift + P`.
2. Ejecuta **Extensions: Install from VSIX...**.
3. Selecciona `sonarqube-dashboard-<versión>.vsix`.
4. Recarga la ventana cuando VS Code lo solicite.

## Repositorio

- Código fuente: <https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS>
- Incidencias: <https://github.com/jesusromero92/SonarQube-Dashboard_ExtensionVS/issues>

## Licencia

Consulta [LICENSE](LICENSE) para conocer los términos de uso y distribución.

Esta licencia no es una licencia Open Source aprobada por la Open Source Initiative, ya que limita la modificación y distribución de trabajos derivados.
