const { createClient } = require("@supabase/supabase-js");

function createSupabaseClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_ANON_KEY en las variables de entorno.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}
  });
}

module.exports = { createSupabaseClient };
