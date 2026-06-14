-- MineOS: limpiar semanas mina huérfanas del bug INSERT sin area (default 'mina')
-- Ejecutar en Supabase SQL Editor si al guardar Molino aparece:
--   Cruce prohibido: semana … (area=mina) ↔ periodo_id … (area=planta)
--
-- Causa: findOrCreateNominaSemanaForCierre no enviaba area → DEFAULT 'mina' en BD.
-- Código corregido en cierre-semana-db.ts (area en INSERT/UPDATE).

BEGIN;

DELETE FROM nomina_registros nr
USING nomina_semanas ns, nomina_periodos p
WHERE nr.semana_id = ns.id
  AND ns.periodo_id = p.id
  AND ns.area = 'mina'
  AND p.metadata->>'area' = 'planta';

DELETE FROM nomina_cierres nc
USING nomina_semanas ns, nomina_periodos p
WHERE nc.semana_id = ns.id
  AND ns.periodo_id = p.id
  AND ns.area = 'mina'
  AND p.metadata->>'area' = 'planta';

DELETE FROM nomina_periodo_semanas nps
USING nomina_semanas ns, nomina_periodos p
WHERE nps.semana_id = ns.id
  AND ns.periodo_id = p.id
  AND ns.area = 'mina'
  AND p.metadata->>'area' = 'planta';

DELETE FROM nomina_semanas ns
USING nomina_periodos p
WHERE ns.periodo_id = p.id
  AND ns.area = 'mina'
  AND p.metadata->>'area' = 'planta';

-- Periodo 4ta semana Molino: recalcular total
UPDATE nomina_periodos p
SET total_usd = COALESCE((
  SELECT ROUND(SUM(ns.total_pagado)::numeric, 2)
  FROM nomina_periodo_semanas nps
  JOIN nomina_semanas ns ON ns.id = nps.semana_id
  WHERE nps.periodo_id = p.id AND ns.area = 'planta'
), 0)
WHERE p.id = 'a4bd60ae-c4e2-424f-964a-4ea1fcf1be5a';

COMMIT;

SELECT ns.id, ns.semana_inicio, ns.area, ns.periodo_id, ns.origen, ns.total_pagado
FROM nomina_semanas ns
WHERE ns.id = '94222a50-7b50-4854-8e0c-1d6a2d0bed07'
   OR (ns.periodo_id = 'a4bd60ae-c4e2-424f-964a-4ea1fcf1be5a')
ORDER BY ns.semana_inicio, ns.area;
