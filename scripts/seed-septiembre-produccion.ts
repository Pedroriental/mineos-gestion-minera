/**
 * Script de validación e inserción de Reportes de Producción de Septiembre 2026 (La Fé)
 * Uso:
 *   npx tsx scripts/seed-septiembre-produccion.ts          # Dry-run de validación matemática
 *   npx tsx scripts/seed-septiembre-produccion.ts --insert # Inserción en Supabase
 */

import { SEPTIEMBRE_2026_DATA, COMPLEX_LA_FE_ID, REGISTRADOR_ID } from '../src/lib/data/septiembre-2026-produccion';

function runDryRun() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   VALIDACIÓN Y AUDITORÍA DE PRODUCCIÓN: SEPTIEMBRE 2026 (LA FÉ)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let totalAuSeptiembre = 0;
  let totalTonSeptiembre = 0;
  let totalSacosSeptiembre = 0;
  let totalAmalgamaSeptiembre = 0;
  let totalDiscrepancies = 0;

  const grupos: Record<string, { count: number; au: number; amalg: number; ton: number; sacos: number }> = {};

  for (const day of SEPTIEMBRE_2026_DATA) {
    const sumDayAu = day.entries.reduce((acc, e) => acc + e.oro_recuperado_g, 0);
    const sumDayTon = day.entries.reduce((acc, e) => acc + (e.toneladas_procesadas || 0), 0);
    const sumDaySacos = day.entries.reduce((acc, e) => acc + (e.sacos || 0), 0);
    const sumDayAmalg = day.entries.reduce((acc, e) => acc + (e.amalgama_1_g || 0), 0);

    const diff = Math.abs(sumDayAu - day.totalTurnoWhatsApp);
    const hasDiscrepancy = diff > 0.01;

    if (hasDiscrepancy) {
      totalDiscrepancies++;
      console.log(`⚠️  ${day.fecha} - Descuadre: Suma Entradas = ${sumDayAu.toFixed(2)}g vs WA = ${day.totalTurnoWhatsApp}g (Diff: ${diff.toFixed(4)}g)`);
    } else {
      console.log(`✅  ${day.fecha} - Total Turno: ${sumDayAu.toFixed(2)} g Au (${day.entries.length} nodos, ${sumDayTon.toFixed(2)} t, ${sumDaySacos} sacos)`);
    }

    totalAuSeptiembre += sumDayAu;
    totalTonSeptiembre += sumDayTon;
    totalSacosSeptiembre += sumDaySacos;
    totalAmalgamaSeptiembre += sumDayAmalg;

    for (const e of day.entries) {
      let grupo = e.molino;
      if (grupo.startsWith('Molino 1-2') || grupo.startsWith('Molino 2-3') || grupo.startsWith('Molinos')) {
        grupo = 'Molinos Principales';
      } else if (grupo === 'Molino 2' || grupo === 'Molino 3') {
        grupo = 'Molinos Individuales';
      }
      if (!grupos[grupo]) {
        grupos[grupo] = { count: 0, au: 0, amalg: 0, ton: 0, sacos: 0 };
      }
      grupos[grupo].count += 1;
      grupos[grupo].au += e.oro_recuperado_g;
      grupos[grupo].amalg += e.amalgama_1_g || 0;
      grupos[grupo].ton += e.toneladas_procesadas || 0;
      grupos[grupo].sacos += e.sacos || 0;
    }
  }

  console.log(`\nDías analizados: ${SEPTIEMBRE_2026_DATA.length} (16 al 30 de Septiembre 2026)`);
  console.log(`Total registros individuales: ${SEPTIEMBRE_2026_DATA.reduce((acc, d) => acc + d.entries.length, 0)}`);
  console.log(`Discrepancias matemáticas: ${totalDiscrepancies}`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN CONSOLIDADO POR NODO (PRODUCCIÓN SEPTIEMBRE 2026)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.table(
    Object.entries(grupos).map(([origen, stats]) => ({
      'Nodo / Proceso': origen,
      'Registros': stats.count,
      'Amalgama (g)': Number(stats.amalg.toFixed(2)),
      'Au Recuperado (g)': Number(stats.au.toFixed(2)),
      '% del Total': totalAuSeptiembre > 0 ? Number(((stats.au / totalAuSeptiembre) * 100).toFixed(1)) + '%' : '0%',
      'Sacos': Math.round(stats.sacos),
      'Toneladas': Number(stats.ton.toFixed(2)),
      'Tenor (g/t)': stats.ton > 0 ? Number((stats.au / stats.ton).toFixed(2)) : 0,
    }))
  );

  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`TOTAL AMALGAMA:       ${totalAmalgamaSeptiembre.toFixed(2)} g`);
  console.log(`TOTAL ORO RECUPERADO: ${totalAuSeptiembre.toFixed(2)} g Au`);
  console.log(`TOTAL SACOS:          ${Math.round(totalSacosSeptiembre)} sacos`);
  console.log(`TOTAL TONELADAS:      ${totalTonSeptiembre.toFixed(2)} ton`);
  console.log(`TENOR GLOBAL:         ${(totalAuSeptiembre / totalTonSeptiembre).toFixed(2)} g/t`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

async function insertToSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abhfedunawgzfnzeazgb.supabase.co';
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_8VD8RgaFYZ1H32HrFJGY1Q_rAEC2aAE';
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔐 Autenticando con Supabase...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.NEXT_PUBLIC_GUEST_EMAIL || 'invitado@mineos.local',
    password: process.env.NEXT_PUBLIC_GUEST_PASSWORD || 'MineOS_Viewer_2024!',
  });

  if (authErr || !auth?.user) {
    console.error('❌ Error autenticando:', authErr?.message || authErr);
    return;
  }
  console.log(`✅ Autenticado exitosamente como: ${auth.user.email}`);

  // Verificar si ya hay datos en septiembre 2026
  const { count, error: countErr } = await supabase
    .from('reportes_produccion')
    .select('*', { count: 'exact', head: true })
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-30');

  if (count && count > 0) {
    console.log(`⚠️ Ya existen ${count} registros en septiembre 2026.`);
    console.log('Eliminando registros previos de septiembre 2026 para reemplazarlos con la versión limpia...');
    const { error: delErr } = await supabase
      .from('reportes_produccion')
      .delete()
      .gte('fecha', '2026-09-01')
      .lte('fecha', '2026-09-30');
    if (delErr) {
      console.error('❌ Error eliminando registros previos:', delErr.message);
      return;
    }
    console.log('✅ Registros anteriores de septiembre eliminados.');
  }

  const allRowsToInsert: any[] = [];
  for (const day of SEPTIEMBRE_2026_DATA) {
    for (const e of day.entries) {
      allRowsToInsert.push({
        complex_id: COMPLEX_LA_FE_ID,
        fecha: e.fecha,
        turno: e.turno,
        molino: e.molino,
        material: e.material,
        material_codigo: e.material_codigo || null,
        amalgama_1_g: e.amalgama_1_g || null,
        amalgama_2_g: e.amalgama_2_g || null,
        oro_recuperado_g: e.oro_recuperado_g,
        merma_1_pct: e.merma_1_pct || null,
        merma_2_pct: e.merma_2_pct || null,
        sacos: e.sacos,
        toneladas_procesadas: e.toneladas_procesadas,
        tenor_tonelada_gpt: e.tenor_tonelada_gpt || null,
        tenor_saco_gps: e.tenor_saco_gps || null,
        observaciones: e.observaciones || null,
        registrado_por: REGISTRADOR_ID,
      });
    }
  }

  console.log(`\n🚀 Insertando ${allRowsToInsert.length} registros en la base de datos Supabase...`);

  // Insertar en lotes de 25
  const batchSize = 25;
  for (let i = 0; i < allRowsToInsert.length; i += batchSize) {
    const batch = allRowsToInsert.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from('reportes_produccion').insert(batch);
    if (insErr) {
      console.error(`❌ Error insertando lote ${i}-${i + batch.length}:`, insErr.message);
      return;
    }
    console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(allRowsToInsert.length / batchSize)} insertado (${batch.length} registros).`);
  }

  // Verificación final
  const { data: insertedData, error: verifyErr } = await supabase
    .from('reportes_produccion')
    .select('oro_recuperado_g')
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-30');

  if (verifyErr) {
    console.error('Error verificando:', verifyErr.message);
  } else {
    const totalAuBD = (insertedData || []).reduce((acc: number, r: any) => acc + Number(r.oro_recuperado_g || 0), 0);
    console.log(`\n🎉 ¡TODOS LOS ${allRowsToInsert.length} REGISTROS DE SEPTIEMBRE 2026 HAN SIDO INSERTADOS CON ÉXITO!`);
    console.log(`📊 Total Oro Recuperado verificado en BD: ${totalAuBD.toFixed(2)} g Au.`);
  }
}

async function main() {
  runDryRun();
  if (process.argv.includes('--insert')) {
    await insertToSupabase();
  } else {
    console.log('(Ejecuta con --insert para guardar definitivamente en la base de datos)');
  }
}

main();
