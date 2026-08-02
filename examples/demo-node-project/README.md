# Demo Node.js project / Proyecto de demostración Node.js

This dependency-free project is a technical sample for validating scanner detection, pipeline templates, execution history, Problems integration, and SonarQube path mapping.

*Este proyecto sin dependencias es una muestra técnica para validar la detección del scanner, las plantillas del pipeline, el historial, la integración con Problems y la asociación de rutas de SonarQube.*

## Procedure / Procedimiento

1. Open this folder directly in Visual Studio Code.  
   *Abre esta carpeta directamente en Visual Studio Code.*
2. Run `npm install` to generate the lock file.  
   *Ejecuta `npm install` para generar el archivo de bloqueo.*
3. Run `npm run compile` and `npm test` to verify the local build and test commands.  
   *Ejecuta `npm run compile` y `npm test` para comprobar los comandos locales.*
4. Create a SonarQube project whose analyzed sources correspond to this folder.  
   *Crea un proyecto de SonarQube cuyos fuentes correspondan con esta carpeta.*
5. Configure the server, token, project, branch, and local subfolder in the extension.  
   *Configura servidor, token, proyecto, rama y subcarpeta local en la extensión.*
6. Import `.sonarqube-dashboard.yml` or select the **Complete** template.  
   *Importa `.sonarqube-dashboard.yml` o selecciona la plantilla **Completo**.*
7. Confirm the commands and run the pipeline.  
   *Confirma los comandos y ejecuta el pipeline.*
8. Inspect the live log, saved execution, Problems entries, and issue navigation.  
   *Revisa el log, la ejecución guardada, las entradas de Problems y la navegación de issues.*

The sample intentionally contains a small nested-template code smell so an analysis can produce a visible finding. Never store a real token in the project files or YAML template.

*La muestra contiene intencionadamente un code smell de template anidado para producir un hallazgo visible. No guardes tokens reales en los archivos del proyecto ni en la plantilla YAML.*
