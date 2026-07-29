import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectionErrorMessage,
  connectionFingerprint,
  connectionNeedsValidation
} from '../src/dashboard/connectionValidation';

test('un token nuevo exige haber validado la conexión', () => {
  assert.equal(
    connectionNeedsValidation(
      'https://sonarqube.example',
      'token-guardado',
      'https://sonarqube.example/',
      'token-random'
    ),
    true
  );
});

test('la conexión guardada sin cambios no necesita otra validación', () => {
  assert.equal(
    connectionNeedsValidation(
      'https://sonarqube.example/',
      'token-guardado',
      'https://sonarqube.example',
      ''
    ),
    false
  );
});

test('la validación pertenece exactamente al servidor y token consultados', () => {
  assert.notEqual(
    connectionFingerprint('https://sonarqube.example', 'token-correcto'),
    connectionFingerprint('https://sonarqube.example', 'token-random')
  );
  assert.notEqual(
    connectionFingerprint('https://sonarqube.example', 'token-correcto'),
    connectionFingerprint('https://otro.example', 'token-correcto')
  );
});

test('convierte los fallos de red en un mensaje de conexión útil', () => {
  assert.equal(
    connectionErrorMessage(new TypeError('fetch failed')),
    'SonarQube no está disponible. Comprueba que el servidor esté iniciado y que la URL sea accesible.'
  );
});

test('distingue credenciales rechazadas y servidores no compatibles', () => {
  assert.equal(
    connectionErrorMessage(Object.assign(new Error('Unauthorized'), { status: 401 })),
    'El token de SonarQube no es válido.'
  );
  assert.equal(
    connectionErrorMessage(Object.assign(new Error('Not Found'), { status: 404 })),
    'La URL no corresponde a un servidor SonarQube compatible.'
  );
  assert.equal(
    connectionErrorMessage(new SyntaxError('Unexpected token <')),
    'La URL no corresponde a un servidor SonarQube compatible.'
  );
});
