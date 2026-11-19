// Conexión a Supabase (cuenta personal, NO la de MDN).
// Copia aquí "Project URL" y la clave "anon" / "publishable" de
// Supabase → Project Settings → API.
// Esa clave es pública por diseño: lo que protege los datos son las reglas
// de supabase/schema.sql. NUNCA pongas aquí la clave "service_role".
// Si se deja vacío, la app funciona como antes: solo en el teléfono.
window.ML_CONFIG = {
  supabaseUrl: 'https://iblrgjsybhphrkcxwdmw.supabase.co',
  supabaseKey: 'sb_publishable_ML8fPVpFnSgw86pV0SZ05w_vt7VlL65'
};
