import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toUserFriendlyError } from './app-toast';

describe('toUserFriendlyError', () => {
  it('deja pasar mensajes ya legibles en español', () => {
    assert.equal(
      toUserFriendlyError('Nombre, cédula y cargo son obligatorios.'),
      'Nombre, cédula y cargo son obligatorios.',
    );
    assert.equal(
      toUserFriendlyError('Ya existe un trabajador con esa cédula.'),
      'Ya existe un trabajador con esa cédula.',
    );
  });

  it('traduce error NOT NULL de Postgres', () => {
    const raw =
      'null value in column "area_detalle" of relation "personal" violates not-null constraint';
    assert.equal(toUserFriendlyError(raw), 'Falta completar el campo «Asignación Nómina».');
  });

  it('traduce clave duplicada', () => {
    assert.equal(
      toUserFriendlyError('duplicate key value violates unique constraint "personal_cedula_key"'),
      'Ya existe un trabajador con esa cédula.',
    );
  });

  it('usa mensaje genérico si el error es técnico sin patrón conocido', () => {
    assert.equal(
      toUserFriendlyError('PGRST204: some internal failure'),
      'No se pudo completar la operación. Revisa los datos e intenta de nuevo.',
    );
  });

  it('no oculta errores de cierre de nómina emitidos por la app', () => {
    const raw =
      'Error cierre: invalid input syntax for type numeric: "abc"';
    assert.equal(toUserFriendlyError(raw), raw);
    assert.equal(
      toUserFriendlyError('CIERRE_NOMINA:VALES_DESINCRONIZADOS trabajador=123'),
      'CIERRE_NOMINA:VALES_DESINCRONIZADOS trabajador=123',
    );
  });

  it('maneja mensaje vacío', () => {
    assert.equal(
      toUserFriendlyError(''),
      'No se pudo completar la operación. Revisa los datos e intenta de nuevo.',
    );
  });
});
