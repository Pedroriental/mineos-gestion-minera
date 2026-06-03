-- ============================================================
-- MineOS: Consistencia de tipos — unificar turno: text → varchar(20)
-- 3 tablas usaban 'text' en vez de 'varchar(20)' como el resto
-- ============================================================

ALTER TABLE reportes_voladuras  ALTER COLUMN turno TYPE VARCHAR(20);
ALTER TABLE reportes_quemado    ALTER COLUMN turno TYPE VARCHAR(20);
ALTER TABLE reportes_extraccion ALTER COLUMN turno TYPE VARCHAR(20);
