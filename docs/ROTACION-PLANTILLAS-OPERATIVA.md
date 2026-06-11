# Plantillas de rotación — operación en nómina

## Flujo operativo

1. **Diseñar** plantilla en sandbox (cuadrillas + semanas + personal).
2. **Guardar** plantilla (`Guardar plantilla`).
3. **Iniciar ciclo** en pestaña *Plantillas Rotación* (fecha = lunes de semana visible).
4. **Nómina semanal**: filas proyectadas desde plantilla (badge `Plantilla · Cuadrilla · Estatus`).
5. **Cerrar y distribuir**: audita cuadrillas y avanza `posicion_activa` por cuadrilla.
6. **Revertir semana**: retrocede posición de rotación vinculada.

## Reglas de cierre

- Avance **independiente por cuadrilla** (modelo acordado).
- No se cierra posición N si posición N-1 de la misma cuadrilla no está `CERRADA_AUDITADA`.
- Trabajadores con `rotacion_plantilla_id` **no** entran en `nomina_ciclos` automático.

## Precedencia de proyección

1. Registro cerrado (`nomina_registros`)
2. Instancia de plantilla activa
3. Perfil + `nomina_ciclos`
4. `esquema_rotacion` legacy
5. Fijo semanal

## Migraciones

```bash
npm run supabase:migrate:rotacion
```

O manualmente:

```bash
supabase db query --linked -f supabase/migration_rotacion_plantillas.sql
supabase db query --linked -f supabase/migration_rotacion_plantillas_cuadrillas.sql
supabase db query --linked -f supabase/migration_rotacion_operativa.sql
```

## Tests

```bash
npm run test:rotacion-plantillas
```

## Smoke checklist (local)

- [ ] Aplicar migraciones rotación
- [ ] Crear plantilla preset 14×14 completo y guardar
- [ ] Iniciar ciclo desde pestaña Plantillas
- [ ] Ver proyección en vista Semanal (badges plantilla)
- [ ] Cerrar nómina semana 1 → cuadrilla avanza
- [ ] Intentar saltar sin auditar → botón bloqueado + mensaje
- [ ] Revertir semana → posición retrocede
- [ ] Export Balance desde panel plantillas

## Archivos clave

| Módulo | Archivo |
|--------|---------|
| Proyección | `src/lib/rotacion-plantillas/projection.ts` |
| Cierre | `src/lib/rotacion-plantillas/cierre-rotacion.ts` |
| Instancias | `src/lib/actions/rotacion-instancias.ts` |
| UI panel | `src/components/nomina/RotacionInstanciaPanel.tsx` |
| Hook nómina | `src/lib/actions/nomina-v3.ts` |
