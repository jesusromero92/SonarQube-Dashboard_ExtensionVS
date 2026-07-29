import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
