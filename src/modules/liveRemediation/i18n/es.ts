export const ES_MESSAGES: Readonly<Record<string, string>> = {
  "remediation": "Remediación",
  'editorIntegration': 'Integración con el editor',
  'liveRemediation': 'Remediación en vivo',
  'liveRemediationIntro': 'Mantén el estado local de los defectos sincronizado mientras editas el código, sin marcar como corregido en SonarQube nada que el servidor todavía no haya confirmado.',
  'sonarIdeDetectedActive': 'SonarQube for IDE detectado y activo',
  'sonarIdeDetectedActiveHint': 'Sus diagnósticos locales pueden confirmar de forma independiente que un defecto modificado ya no se reproduce antes del siguiente análisis del servidor.',
  'sonarIdeInstalledInactive': 'SonarQube for IDE instalado, todavía no activo',
  'sonarIdeInstalledInactiveHint': 'Abre o guarda un archivo compatible para activar su análisis local. Hasta entonces, los cambios permanecerán pendientes de validación.',
  'sonarIdeNotDetected': 'SonarQube for IDE no detectado',
  'sonarIdeNotDetectedHint': 'No es obligatorio. Los defectos modificados permanecerán pendientes de validación hasta el siguiente análisis del repositorio.',
  "locallyModifiedIssues": "Issues modificados localmente",
  "noLocallyModifiedIssues": "No hay issues modificados localmente pendientes de validación o confirmación.",
  "locallyModifiedAwaitingConfirmation": "Modificado localmente · pendiente de confirmación de SonarQube",
  'disableLiveRemediationModuleConfirm': '¿Seguro que quieres desactivar el módulo Live Remediation? Se detendrá el seguimiento local y se ocultará su vista. Los diagnósticos normales de SonarQube seguirán funcionando.',
  'liveRemediationHint': 'Los defectos tocados pasan a modificado localmente y pendiente de validación. Si SonarQube for IDE deja de detectar el mismo defecto, sigue siendo modificado localmente y pasa a pendiente de confirmación de SonarQube; solo el análisis del servidor puede confirmar que está resuelto.'
};
