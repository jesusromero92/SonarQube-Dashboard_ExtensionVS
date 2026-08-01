# Changelog

Todos los cambios relevantes de SonarQube Dashboard se documentarán en este archivo.

All notable changes to SonarQube Dashboard will be documented in this file.

## [0.20.1] - 2026-08-01

### Añadido / Added

- Información de SonarQube dentro del editor mediante CodeLens por defecto y Security Hotspot, manteniendo los hovers y acciones rápidas existentes.
- SonarQube information inside the editor through CodeLens for issues and Security Hotspots, alongside the existing hovers and quick actions.
- Integraciones predefinidas detectadas para **npm/pnpm/yarn audit**, **ESLint**, **Semgrep**, **Trivy**, **Snyk** y **OWASP Dependency-Check**, disponibles como pasos del pipeline.
- Detected predefined integrations for **npm/pnpm/yarn audit**, **ESLint**, **Semgrep**, **Trivy**, **Snyk**, and **OWASP Dependency-Check**, available as pipeline steps.

## [0.20.0] - 2026-07-31

- Pipeline configurable de etapas antes y después del análisis para ejecutar compilaciones, auditorías y otras herramientas de seguridad.
- Configurable pre- and post-analysis pipeline stages for builds, audits, and other security tools.

## [0.19.0] - 2026-07-30

### Añadido / Added


- La tabla de **Issues** permite ordenar por severidad, tipo, archivo, estado y regla.
- The **Issues** table can be sorted by severity, type, file, status, and rule.

### Cambiado / Changed

- La evolución de **Issues**, **Cobertura** y **Duplicación** se agrupa por **Día** de forma predeterminada.
- **Issues**, **Coverage**, and **Duplication** evolution is grouped by **Day** by default.

## [0.18.5] - 2026-07-30

### Corregido / Fixed

- Unificado el foco y el desplazamiento nativo de **Top Archivos**, **Top Reglas**, **Cobertura** y **Duplicación** con la tabla de **Issues**.
- Unified focus behavior and native scrolling for **Top Files**, **Top Rules**, **Coverage**, and **Duplications** with the **Issues** table.