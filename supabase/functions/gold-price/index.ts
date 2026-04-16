// supabase/functions/gold-price/index.ts
// Deploy with: npx supabase functions deploy gold-price
// Set secret with: npx supabase secrets set GOLD_API_KEY=your-key-here

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const GOLD_API_KEY = Deno.env.get('GOLD_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Check cache first (same day)
    const today = new Date().toISOString().split('T')[0]
    const { data: cached } = await supabase
      .from('precio_oro_cache')
      .select('*')
      .eq('fecha', today)
      .single()

    if (cached) {
      return new Response(JSON.stringify({
        precio_usd_gramo: cached.precio_usd_por_gramo,
        precio_usd_onza: cached.precio_usd_por_onza,
        fuente: 'cache',
        fecha: cached.fecha,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch from GoldAPI.io
    const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: { 'x-access-token': GOLD_API_KEY, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`GoldAPI responded with ${response.status}`)
    }

    const goldData = await response.json()
    const precioGramo = goldData.price_gram_24k
    const precioOnza = goldData.price

    // Save to cache
    await supabase.from('precio_oro_cache').upsert({
      fecha: today,
      precio_usd_por_gramo: precioGramo,
      precio_usd_por_onza: precioOnza,
      fuente: 'goldapi',
    }, { onConflict: 'fecha,fuente' })

    return new Response(JSON.stringify({
      precio_usd_gramo: precioGramo,
      precio_usd_onza: precioOnza,
      fuente: 'api',
      fecha: today,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
