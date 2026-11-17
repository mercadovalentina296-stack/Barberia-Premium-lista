require("dotenv").config();
const express = require("express");
const path = require("path");
const { createSupabaseClient } = require("./supabase");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

function sendError(res, error, status = 400) {
  console.error(error);
  res.status(status).json({ error: error.message || "Ocurrió un error." });
}
function getToken(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}
function requireUser(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Iniciá sesión para continuar." });
  try {
    req.supabase = createSupabaseClient(token);
    next();
  } catch (error) { sendError(res, error, 500); }
}
async function requireAdmin(req, res, next) {
  try {
    const { data: { user }, error } = await req.supabase.auth.getUser(getToken(req));
    if (error || !user) return res.status(401).json({ error: "Sesión no válida." });
    const { data: profile, error: profileError } = await req.supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "admin") return res.status(403).json({ error: "Esta sección es solo para administradores." });
    req.user = user;
    next();
  } catch (error) { sendError(res, error, 500); }
}
const asyncRoute = (handler) => (req, res) => Promise.resolve(handler(req, res)).catch((e) => sendError(res, e));

app.get("/api/health", (_req, res) => res.json({ ok: true, message: "API de Barbería Premium funcionando" }));

// Registro e inicio de sesión se realizan con Supabase Auth.
app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { nombre, telefono, email, password } = req.body;
  if (!nombre?.trim() || !telefono?.trim() || !email || !password || password.length < 8)
    return res.status(400).json({ error: "Completá todos los campos. La contraseña debe tener al menos 8 caracteres." });
  const sb = createSupabaseClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: nombre.trim(), phone: telefono.trim() } }
  });
  if (error) throw error;
  res.status(201).json({ message: data.session ? "Cuenta creada correctamente." : "Cuenta creada. Revisá tu correo para confirmar el registro.", session: data.session });
}));
app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Ingresá tu correo y contraseña." });
  const { data, error } = await createSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  res.json({ session: data.session, user: data.user });
}));
app.post("/api/auth/refresh", asyncRoute(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "No hay una sesión para renovar." });
  const { data, error } = await createSupabaseClient().auth.refreshSession({ refresh_token });
  if (error) throw error;
  res.json({ session: data.session });
}));
app.get("/api/auth/me", requireUser, asyncRoute(async (req, res) => {
  const { data: { user }, error } = await req.supabase.auth.getUser(getToken(req));
  if (error || !user) return res.status(401).json({ error: "Sesión no válida." });
  const { data: profile, error: pError } = await req.supabase.from("profiles").select("*").eq("id", user.id).single();
  if (pError) throw pError;
  res.json({ user, profile });
}));
app.post("/api/auth/logout", (_req, res) => res.json({ message: "Sesión cerrada en este dispositivo." }));

// Servicios: lectura pública y mantenimiento exclusivo del administrador.
app.get("/api/services", asyncRoute(async (_req, res) => {
  const { data, error } = await createSupabaseClient().from("services").select("*").eq("active", true).order("name");
  if (error) throw error;
  res.json(data);
}));
app.post("/api/services", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const { name, description, price, duration_minutes } = req.body;
  const parsedPrice = Number(price);
  const parsedDuration = Number(duration_minutes);
  if (!name?.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedDuration) || parsedDuration < 1)
    return res.status(400).json({ error: "Revisá el nombre, el precio y la duración del servicio." });
  const { data, error } = await req.supabase.from("services").insert({ name: name.trim(), description: String(description || "").trim(), price: parsedPrice, duration_minutes: parsedDuration }).select().single();
  if (error) throw error; res.status(201).json(data);
}));
app.put("/api/services/:id", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const { name, description, price, duration_minutes, active } = req.body;
  const parsedPrice = Number(price);
  const parsedDuration = Number(duration_minutes);
  if (!name?.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedDuration) || parsedDuration < 1 || typeof active !== "boolean")
    return res.status(400).json({ error: "Revisá los datos del servicio." });
  const { data, error } = await req.supabase.from("services").update({ name: name.trim(), description: String(description || "").trim(), price: parsedPrice, duration_minutes: parsedDuration, active }).eq("id", req.params.id).select().single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "No se encontró el servicio." });
  res.json(data);
}));
app.delete("/api/services/:id", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const { error } = await req.supabase.from("services").update({ active: false }).eq("id", req.params.id);
  if (error) throw error; res.json({ message: "Servicio desactivado." });
}));

// Reservas: clientes consultan las propias; administrador puede gestionar todas.
app.get("/api/appointments", requireUser, asyncRoute(async (req, res) => {
  const { data: { user }, error: authError } = await req.supabase.auth.getUser(getToken(req));
  if (authError || !user) return res.status(401).json({ error: "Sesión no válida." });
  const { data: profile } = await req.supabase.from("profiles").select("role").eq("id", user.id).single();
  let query = req.supabase.from("appointments").select("*, services(name, price, duration_minutes), customer:profiles!appointments_customer_id_fkey(full_name, phone)").order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true });
  if (profile?.role !== "admin") query = query.eq("customer_id", user.id);
  const { data, error } = await query;
  if (error) throw error; res.json(data);
}));
app.post("/api/appointments", requireUser, asyncRoute(async (req, res) => {
  const { service_id, appointment_date, appointment_time, notes } = req.body;
  if (!service_id || !appointment_date || !appointment_time) return res.status(400).json({ error: "Elegí un servicio, fecha y horario." });
  const date = new Date(`${appointment_date}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date < today || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(appointment_time))
    return res.status(400).json({ error: "Elegí una fecha válida desde hoy y un horario correcto." });
  const { data: service, error: serviceError } = await req.supabase.from("services").select("id").eq("id", service_id).eq("active", true).maybeSingle();
  if (serviceError) throw serviceError;
  if (!service) return res.status(400).json({ error: "El servicio elegido ya no está disponible." });
  const { data: { user }, error: authError } = await req.supabase.auth.getUser(getToken(req));
  if (authError || !user) return res.status(401).json({ error: "Sesión no válida." });
  const { data, error } = await req.supabase.from("appointments").insert({ customer_id: user.id, service_id, appointment_date, appointment_time, notes: String(notes || "").trim() }).select("*, services(name, price)").single();
  if (error?.code === "23505") return res.status(409).json({ error: "Ese horario ya está reservado. Elegí otro." });
  if (error) throw error; res.status(201).json(data);
}));
app.put("/api/appointments/:id", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const { status, appointment_date, appointment_time } = req.body;
  const { data, error } = await req.supabase.from("appointments").update({ status, appointment_date, appointment_time }).eq("id", req.params.id).select().single();
  if (error?.code === "23505") return res.status(409).json({ error: "Ese horario ya está ocupado." });
  if (error) throw error; res.json(data);
}));
app.delete("/api/appointments/:id", requireUser, asyncRoute(async (req, res) => {
  // Se conserva el historial: cancelar cambia el estado, no borra el turno.
  const { data, error } = await req.supabase.rpc("cancel_own_appointment", { p_appointment_id: req.params.id });
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "No se encontró una reserva pendiente o confirmada para cancelar." });
  res.json({ message: "Tu turno fue cancelado." });
}));

// Promociones y opiniones públicas aprobadas.
app.get("/api/promotions", asyncRoute(async (_req, res) => {
  const { data, error } = await createSupabaseClient().from("promotions").select("*").eq("active", true).order("created_at", { ascending: false });
  if (error) throw error; res.json(data);
}));
app.get("/api/reviews", asyncRoute(async (_req, res) => {
  const { data, error } = await createSupabaseClient().from("reviews").select("id,rating,comment,created_at").eq("approved", true).order("created_at", { ascending: false });
  if (error) throw error; res.json(data);
}));
app.get("/api/admin/reviews", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const { data, error } = await req.supabase.from("reviews")
    .select("id,rating,comment,approved,created_at,customer:profiles!reviews_customer_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  res.json(data);
}));
app.put("/api/reviews/:id", requireUser, requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body.approved !== "boolean") return res.status(400).json({ error: "Indicá si la opinión debe aprobarse." });
  const { data, error } = await req.supabase.from("reviews").update({ approved: req.body.approved })
    .eq("id", req.params.id).select("id,approved").maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "No se encontró la opinión." });
  res.json(data);
}));

app.post("/api/reviews", requireUser, asyncRoute(async (req, res) => {
  const { rating, comment } = req.body;
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5 || !comment?.trim())
    return res.status(400).json({ error: "Ingresá una calificación de 1 a 5 y un comentario." });
  const { data: { user } } = await req.supabase.auth.getUser(getToken(req));
  const { data, error } = await req.supabase.from("reviews").insert({ customer_id: user.id, rating: Number(rating), comment: comment.trim() }).select().single();
  if (error) throw error; res.status(201).json({ ...data, message: "Opinión enviada. Quedará visible cuando sea aprobada." });
}));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Ruta API no encontrada." });
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Vercel importa la aplicación; en local se inicia el servidor.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Barbería Premium disponible en http://localhost:${port}`));
}
module.exports = app;
