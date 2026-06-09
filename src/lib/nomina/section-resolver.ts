import type { Personal } from '@/lib/types';
import { normalizeAreaDetalle } from '@/lib/personal-master';
import { inferAreaFromBanner } from '@/lib/nomina/section-headers';

export function inferAreaFromSection(sectionName: string): Personal['area'] {
  const lower = sectionName.toLowerCase().trim();

  const bannerArea = inferAreaFromBanner(sectionName);
  if (bannerArea) return bannerArea;

  if (lower.includes('transporte') || lower.includes('chofer') || lower.includes('volque')) {
    return 'transporte';
  }
  if (lower.includes('seguridad') || lower.includes('vigilancia')) return 'seguridad';

  // Molinos / planta — antes que administr+mina (evita "molinos" ⊃ "mina")
  if (
    lower.includes('molino') ||
    lower.includes('planta') ||
    (lower.includes('grupo') && (lower.includes('mixto') || lower.includes('molino'))) ||
    lower.includes('mixto') ||
    lower.includes('la fe') ||
    lower.includes('la fé') ||
    lower.includes('operador de molino')
  ) {
    return 'planta';
  }

  // Administrativos + mina → administracion
  if (
    lower.includes('administr') &&
    (/\bmina\b/.test(lower) || lower.includes('belén') || lower.includes('belen'))
  ) {
    return 'administracion';
  }

  if (lower.includes('administr')) return 'administracion';

  if (
    lower.includes('mina') ||
    lower.includes('vertical') ||
    lower.includes('belen') ||
    lower.includes('belén') ||
    lower.includes('cocinera') ||
    lower.includes('tecnico') ||
    lower.includes('técnico') ||
    lower.includes('compresor') ||
    (lower.includes('operador') && !lower.includes('molino'))
  ) {
    return 'mina';
  }

  return 'mina';
}

export function cleanSectionName(section: string): string {
  return section
    .replace(/^n[oó]mina\s+/i, '')
    .replace(/^semanas?\s+/i, '')
    .replace(/^mina\s+bel[eé]n\s*[-–]\s*/i, '')
    .replace(/^molinos?\s+la\s+f[eé]\s*[-–]?\s*/i, '')
    .replace(/mina\s+bel[eé]n\s*[-–]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAdminCargo(cargo: string): boolean {
  const c = cargo.toLowerCase();
  return c.includes('administr') || c.includes('oficina') || c.includes('contab');
}

export function buildParsedSectionId(area: string, cargo: string): string {
  if (cargo.includes('Novedades Especiales')) return `${area}__novedades`;
  const cargoLower = cargo.toLowerCase();
  if (/despedido/.test(cargoLower)) return `${area}__despedidos`;
  if (/pago\s+semana\s+libre/.test(cargoLower)) return `${area}__pago_semana_libre`;
  if (area === 'planta' && isAdminCargo(cargo)) return 'planta_admin';
  if (area === 'planta') return 'planta_operativos';
  if (area === 'administracion') return 'admin_mina';
  if (area === 'mina') return `mina__${cargo}`;
  return `${area}_general`;
}

export function resolveSectionMeta(area: string, cargo: string): {
  id: string;
  title: string;
  subtitle: string;
  areaDetalle: string | null;
} {
  const areaDetalle = normalizeAreaDetalle(cargo, area);
  const id = buildParsedSectionId(area, cargo);

  if (id.endsWith('__novedades')) {
    const areaTitle = area === 'mina' ? 'Mina' : area === 'planta' ? 'Planta' : 'Administración';
    return {
      id,
      title: `Novedades Especiales — ${areaTitle}`,
      subtitle: 'Registros de novedades y compensaciones de texto libre',
      areaDetalle: 'Novedades Especiales',
    };
  }

  if (id === 'planta_admin') {
    return {
      id,
      title: 'Nómina Administrativos Molinos',
      subtitle: 'Personal administrativo en planta / molino',
      areaDetalle,
    };
  }
  if (id === 'planta_operativos') {
    return {
      id,
      title: 'Semanas Molinos — Grupo operativo',
      subtitle: 'Operación de molino (esquemas rotativos y fijos)',
      areaDetalle,
    };
  }
  if (id === 'admin_mina') {
    return {
      id,
      title: 'Nómina Administrativos Mina',
      subtitle: 'Administración central y soporte mina',
      areaDetalle,
    };
  }
  if (id.endsWith('__despedidos')) {
    return {
      id,
      title: 'Personal despedido',
      subtitle: 'Pagos o liquidaciones de personal retirado',
      areaDetalle: 'Despedidos',
    };
  }
  if (id.endsWith('__pago_semana_libre')) {
    return {
      id,
      title: 'Pago semana libre',
      subtitle: 'Compensación de semana libre pendiente',
      areaDetalle: 'Pago semana libre',
    };
  }
  if (id.startsWith('mina__')) {
    const grupo = cargo || 'Sin asignación';
    return {
      id,
      title: `Semanas Mina Belén — ${grupo}`,
      subtitle: 'Agrupado por vertical / asignación',
      areaDetalle,
    };
  }
  return {
    id,
    title: `Nómina ${area}`,
    subtitle: cargo || 'Sin cargo',
    areaDetalle,
  };
}
