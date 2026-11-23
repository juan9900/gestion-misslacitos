// Miss Lacitoss · avisos en el teléfono (Web Push)
// Se despliega en Supabase → Edge Functions con el nombre "avisos" y SIN verificación de JWT
// (la llama la tarea diaria). Las claves VAPID se crean aquí mismo la primera vez y se guardan
// en public.push_config, que solo puede leer el servidor: nunca pasan por el repositorio ni por nadie.
//
// Modos (cuerpo JSON):
//   { "modo": "clave" }   → devuelve la clave PÚBLICA para que el teléfono se suscriba.
//   { "modo": "prueba" }  → manda un aviso de prueba solo a los teléfonos de quien lo pide
//                           (exige la sesión de un miembro en Authorization).
//   { "modo": "diario" }  → el resumen del día a todos. Solo una vez al día y desde las 7 am (Caracas);
//                           si se llama de más, no hace nada.
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// clave de servidor que Supabase pone sola en el entorno (la nueva si existe, si no la antigua)
function claveServidor(): string {
  try {
    const o = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const v = Object.values(o)[0];
    if (typeof v === "string" && v) return v;
  } catch (_) { /* sin claves nuevas */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const sb = createClient(Deno.env.get("SUPABASE_URL")!, claveServidor(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function claves() {
  const r = await sb.from("push_config").select("vapid, publica").eq("id", 1).maybeSingle();
  if (r.data) return r.data;
  const k = await webpush.generateVapidKeys({ extractable: true });
  const fila = { id: 1, vapid: await webpush.exportVapidKeys(k), publica: await webpush.exportApplicationServerKey(k) };
  const ins = await sb.from("push_config").insert(fila).select("vapid, publica").single();
  if (ins.data) return ins.data;
  // otra llamada las creó al mismo tiempo: se usan esas
  const again = await sb.from("push_config").select("vapid, publica").eq("id", 1).single();
  if (again.error) throw again.error;
  return again.data;
}

async function enviar(subs: { endpoint: string; sub: webpush.PushSubscription }[], aviso: object) {
  const cfg = await claves();
  const vapidKeys = await webpush.importVapidKeys(cfg.vapid);
  const app = await webpush.ApplicationServer.new({
    contactInformation: "https://gestionmisslacitos.netlify.app",
    vapidKeys,
  });
  let ok = 0, borrados = 0;
  for (const s of subs) {
    try {
      await app.subscribe(s.sub).pushTextMessage(JSON.stringify(aviso), { ttl: 6 * 3600, urgency: webpush.Urgency.Normal, topic: "resumen" });
      ok++;
    } catch (e) {
      const st = e instanceof webpush.PushMessageError ? e.response.status : 0;
      if (st === 404 || st === 410) { // ese teléfono ya no existe o quitó el permiso
        await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
        borrados++;
      }
    }
  }
  return { ok, borrados, total: subs.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "solo POST" }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.modo === "clave") return json({ publica: (await claves()).publica });

    if (body.modo === "prueba") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const u = await sb.auth.getUser(token);
      const uid = u.data?.user?.id;
      if (!uid) return json({ error: "sin sesión" }, 401);
      const m = await sb.from("miembros").select("user_id").eq("user_id", uid).maybeSingle();
      if (!m.data) return json({ error: "no es miembro" }, 403);
      const s = await sb.from("push_subs").select("endpoint, sub").eq("user_id", uid);
      return json(await enviar(s.data || [], {
        title: "Miss Lacitoss",
        body: "¡Listo! Los avisos funcionan. Cada mañana te cuento lo que hay que hacer.",
        url: "./",
      }));
    }

    if (body.modo === "diario") {
      // reclama el envío de hoy (una sola vez, desde las 7 am de Caracas) y trae el resumen
      const r = await sb.rpc("ml_push_reclamar");
      if (r.error) throw r.error;
      const res = r.data as { enviar: boolean; texto?: string; motivo?: string };
      if (!res?.enviar) return json({ enviado: false, motivo: res?.motivo });
      const s = await sb.from("push_subs").select("endpoint, sub");
      return json({ enviado: true, ...(await enviar(s.data || [], { title: "Miss Lacitoss · hoy", body: res.texto, url: "./" })) });
    }
    return json({ error: "modo desconocido" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "falló" }, 500);
  }
});
