-- Pago en oro: gramos + precio USD/g usado en la conversión (monto = gramos × precio)
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS monto_gramos_oro NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS precio_oro_usd_gramo NUMERIC(12, 6);

COMMENT ON COLUMN gastos.monto_gramos_oro IS 'Gramos de oro pagados cuando el gasto se liquidó en oro';
COMMENT ON COLUMN gastos.precio_oro_usd_gramo IS 'Precio USD por gramo usado para convertir monto_gramos_oro a monto (USD)';
