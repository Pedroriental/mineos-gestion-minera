-- Guardar etiquetas legibles (Mina Belén) en lugar de códigos internos (mina_belen).

UPDATE biblioteca_variables bv
SET valor = bv.etiqueta
FROM biblioteca_categorias bc
WHERE bv.categoria_id = bc.id
  AND bc.slug IN ('minas', 'molinos', 'ubicaciones_laborales')
  AND bv.valor ~ '^[a-z0-9_]+$'
  AND lower(bv.valor) <> lower(bv.etiqueta);

UPDATE reportes_extraccion
SET mina = 'Mina Belén'
WHERE mina IN ('mina_belen', 'mina-belen');

UPDATE reportes_voladuras
SET mina = 'Mina Belén'
WHERE mina IN ('mina_belen', 'mina-belen');

UPDATE reportes_acarreo
SET mina = 'Mina Belén'
WHERE mina IN ('mina_belen', 'mina-belen');

UPDATE reportes_acarreo
SET molino = 'Molino La Fé'
WHERE molino IN ('molino_la_fe', 'molino-la-fe');

UPDATE reportes_produccion
SET molino = 'Molino La Fé'
WHERE molino IN ('molino_la_fe', 'molino-la-fe');
