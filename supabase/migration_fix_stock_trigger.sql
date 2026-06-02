
-- =============================================================
-- MineOS - Migration: Fix trigger de stock de inventario
--
-- El trigger actual solo maneja AFTER INSERT.
-- Si se actualiza o elimina un movimiento, el stock queda
-- inconsistente. Este fix agrega soporte para UPDATE y DELETE.
-- =============================================================

CREATE OR REPLACE FUNCTION actualizar_stock_inventario()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.tipo_movimiento = 'entrada' THEN
            UPDATE inventario_items SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.item_id;
        ELSIF NEW.tipo_movimiento = 'salida' THEN
            UPDATE inventario_items SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.item_id;
        ELSIF NEW.tipo_movimiento = 'ajuste' THEN
            UPDATE inventario_items SET stock_actual = NEW.cantidad WHERE id = NEW.item_id;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Revertir el efecto del valor anterior, aplicar el nuevo
        IF OLD.tipo_movimiento = 'entrada' THEN
            UPDATE inventario_items SET stock_actual = stock_actual - OLD.cantidad WHERE id = OLD.item_id;
        ELSIF OLD.tipo_movimiento = 'salida' THEN
            UPDATE inventario_items SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.item_id;
        ELSIF OLD.tipo_movimiento = 'ajuste' THEN
            -- No podemos revertir un ajuste, se recalcula con el nuevo
            NULL;
        END IF;

        IF NEW.tipo_movimiento = 'entrada' THEN
            UPDATE inventario_items SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.item_id;
        ELSIF NEW.tipo_movimiento = 'salida' THEN
            UPDATE inventario_items SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.item_id;
        ELSIF NEW.tipo_movimiento = 'ajuste' THEN
            UPDATE inventario_items SET stock_actual = NEW.cantidad WHERE id = NEW.item_id;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.tipo_movimiento = 'entrada' THEN
            UPDATE inventario_items SET stock_actual = stock_actual - OLD.cantidad WHERE id = OLD.item_id;
        ELSIF OLD.tipo_movimiento = 'salida' THEN
            UPDATE inventario_items SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.item_id;
        ELSIF OLD.tipo_movimiento = 'ajuste' THEN
            -- Revertir ajuste no es posible sin el valor anterior exacto
            NULL;
        END IF;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Reemplazar el trigger existente para que cubra INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_actualizar_stock ON inventario_movimientos;

CREATE TRIGGER trigger_actualizar_stock
    AFTER INSERT OR UPDATE OR DELETE ON inventario_movimientos
    FOR EACH ROW EXECUTE FUNCTION actualizar_stock_inventario();
