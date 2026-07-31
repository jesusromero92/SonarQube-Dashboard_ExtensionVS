# Changelog

Todos los cambios relevantes de SonarQube Dashboard se documentarán en este archivo.

All notable changes to SonarQube Dashboard will be documented in this file.

## [0.19.0] - 2026-07-30

### Añadido / Added

- Pipeline configurable de etapas antes y después del análisis para ejecutar compilaciones, auditorías y otras herramientas de seguridad.
- Configurable pre- and post-analysis pipeline stages for builds, audits, and other security tools.

- La tabla de **Issues** permite ordenar por severidad, tipo, archivo, estado y regla.
- The **Issues** table can be sorted by severity, type, file, status, and rule.

### Cambiado / Changed

- La evolución de **Issues**, **Cobertura** y **Duplicación** se agrupa por **Día** de forma predeterminada.
- **Issues**, **Coverage**, and **Duplication** evolution is grouped by **Day** by default.

## [0.18.5] - 2026-07-30

### Corregido / Fixed

- Unificado el foco y el desplazamiento nativo de **Top Archivos**, **Top Reglas**, **Cobertura** y **Duplicación** con la tabla de **Issues**.
- Unified focus behavior and native scrolling for **Top Files**, **Top Rules**, **Coverage**, and **Duplications** with the **Issues** table.