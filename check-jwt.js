const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  if (line.includes('=')) {
    const idx = line.indexOf('=');
    env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) { console.error(error); process.exit(1); }
  for (const u of data.users) {
    console.log(JSON.stringify({
      id: u.id,
      email: u.email,
      metadata_role: u.user_metadata?.role,
      metadata_complex_id: u.user_metadata?.complex_id,
    }));
  }
})();
