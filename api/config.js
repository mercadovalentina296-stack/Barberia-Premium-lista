// Configuración central de Supabase. Las credenciales se cargan desde variables de entorno.
module.exports = {
  get supabaseUrl() { return process.env.SUPABASE_URL; },
  get supabaseAnonKey() { return process.env.SUPABASE_ANON_KEY; }
};
