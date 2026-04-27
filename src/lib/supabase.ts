import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Uso de createBrowserClient de @supabase/ssr asegura que la sesión 
// se sincronice automáticamente con las cookies para los Server Components.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
