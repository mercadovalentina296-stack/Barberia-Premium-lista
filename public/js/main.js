document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("[data-current-year]").forEach(el => el.textContent = new Date().getFullYear());

  const dateInput = document.querySelector('input[type="date"]');
  if (dateInput) {
    const today = new Date();
    dateInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  if (document.querySelector("#register-form")) setupRegister();
  if (document.querySelector("#login-form")) setupLogin();
  if (document.querySelector("#booking-form")) setupBooking();
  if (document.querySelector("#appointments-list")) loadAppointments();
  if (document.querySelector("#admin-appointments")) loadAdmin();
  else if (document.querySelector("#service-list")) loadPublicServices();
  setupAdminNavigation();
  if (document.querySelector("#review-form")) setupReview();
});

async function setupAdminNavigation() {
  const nav = document.querySelector(".nav-links");
  if (!nav || !getSession()?.access_token) return;
  try {
    const result = await apiRequest("/auth/me");
    if (result.profile?.role !== "admin" || nav.querySelector('a[href="admin.html"]')) return;
    const link = document.createElement("a");
    link.href = "admin.html";
    link.textContent = "Administrador";
    link.className = "nav-admin-link";
    if (nav.tagName === "UL") {
      const item = document.createElement("li");
      item.appendChild(link);
      nav.appendChild(item);
    } else {
      nav.appendChild(link);
    }
  } catch { /* Si no hay sesión válida, no se muestra el acceso administrativo. */ }
}

async function setupRegister() {
  const form = document.querySelector("#register-form"), message = document.querySelector("#form-message");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(data) });
      if (result.session) { saveSession(result.session); location.href = "misReserva.html"; }
      else showMessage(message, result.message);
      form.reset();
    } catch (error) { showMessage(message, error.message, "error"); }
  });
}
async function setupLogin() {
  const form = document.querySelector("#login-form"), message = document.querySelector("#form-message");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const result = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      saveSession(result.session);
      location.href = "misReserva.html";
    } catch (error) { showMessage(message, error.message, "error"); }
  });
}
async function loadServiceOptions() {
  const select = document.querySelector("#service");
  const services = await apiRequest("/services");
  select.innerHTML = '<option value="">Seleccionar servicio</option>' + services.map(s =>
    `<option value="${s.id}">${escapeHTML(s.name)} — $${Number(s.price).toLocaleString("es-AR")}</option>`).join("");
}
async function setupBooking() {
  const form = document.querySelector("#booking-form"), message = document.querySelector("#form-message");
  try { await loadServiceOptions(); }
  catch (error) { showMessage(message, error.message, "error"); }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!getSession()?.access_token) {
      showMessage(message, "Primero tenés que iniciar sesión para reservar.", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    try {
      await apiRequest("/appointments", { method: "POST", body: JSON.stringify({
        service_id: data.service, appointment_date: data.date, appointment_time: data.time
      })});
      showMessage(message, "¡Turno solicitado! Podés verlo en Mis reservas.");
      form.reset();
    } catch (error) { showMessage(message, error.message, "error"); }
  });
}
async function loadAppointments() {
  const target = document.querySelector("#appointments-list");
  if (!getSession()?.access_token) {
    target.innerHTML = '<div class="empty-state">Iniciá sesión para consultar tus reservas. <a href="inicioSesion.html">Ingresar</a></div>';
    return;
  }
  try {
    const rows = await apiRequest("/appointments");
    if (!rows.length) { target.innerHTML = '<div class="empty-state">Todavía no tenés reservas.</div>'; return; }
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows.map(r =>
      `<tr><td>${escapeHTML(r.services?.name || "Servicio")}</td><td>${formatDate(r.appointment_date)}</td><td>${String(r.appointment_time).slice(0,5)}</td><td>${statusLabel(r.status)}</td><td>${r.status === "cancelled" || r.status === "completed" ? "—" : `<button class="btn btn-small btn-outline" data-cancel="${r.id}">Cancelar</button>`}</td></tr>`
    ).join("")}</tbody></table></div>`;
    target.querySelectorAll("[data-cancel]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("¿Querés cancelar esta reserva?")) return;
      try { await apiRequest(`/appointments/${btn.dataset.cancel}`, { method: "DELETE" }); await loadAppointments(); }
      catch (error) { alert(error.message); }
    }));
  } catch (error) { target.innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`; }
}
async function loadPublicServices() {
  const target = document.querySelector("#service-list");
  try {
    const services = await apiRequest("/services");
    target.innerHTML = services.map(s => `<article class="card"><div class="card-body"><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.description || "")}</p><div class="service-price">$${Number(s.price).toLocaleString("es-AR")} · ${s.duration_minutes} min</div></div></article>`).join("");
    if (!services.length) target.innerHTML = '<p class="notice">Todavía no hay servicios cargados.</p>';
  } catch { target.innerHTML = '<p class="notice">No se pudieron cargar los servicios. Revisá la conexión con Supabase.</p>'; }
}
async function setupReview() {
  const form = document.querySelector("#review-form"), message = document.querySelector("#review-message");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await apiRequest("/reviews", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      showMessage(message, "Gracias. Tu opinión fue enviada para revisión.");
      form.reset();
    } catch (error) { showMessage(message, error.message, "error"); }
  });
}
async function loadAdmin() {
  const appointmentTarget = document.querySelector("#admin-appointments");
  const serviceTarget = document.querySelector("#service-list");
  const form = document.querySelector("#service-form");
  if (!getSession()?.access_token) {
    appointmentTarget.innerHTML = '<p class="empty-state">Iniciá sesión con la cuenta administradora para acceder al panel.</p><p><a href="inicioSesion.html">Ir a Ingresar</a></p>';
    if (form) form.hidden = true;
    return;
  }
  try {
    const identity = await apiRequest("/auth/me");
    if (identity.profile?.role !== "admin") {
      appointmentTarget.innerHTML = '<p class="empty-state">Tu cuenta no tiene permisos de administrador. Ingresá con la cuenta autorizada.</p>';
      if (form) form.hidden = true;
      serviceTarget.innerHTML = "";
      return;
    }
    if (form) form.hidden = false;
    const [rows, services, reviews] = await Promise.all([
      apiRequest("/appointments"), apiRequest("/services"), apiRequest("/admin/reviews")
    ]);
    document.querySelector("#stat-appointments").textContent = rows.length;
    document.querySelector("#stat-clients").textContent = new Set(rows.map(r => r.customer_id)).size;
    document.querySelector("#stat-services").textContent = services.length;
    appointmentTarget.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Actualizar</th></tr></thead><tbody>${rows.map(r =>
      `<tr><td>${escapeHTML(r.customer?.full_name || "Cliente")}</td><td>${escapeHTML(r.services?.name || "")}</td><td>${formatDate(r.appointment_date)}</td><td>${String(r.appointment_time).slice(0,5)}</td><td>${statusLabel(r.status)}</td><td><select data-status="${r.id}"><option value="pending" ${r.status==="pending"?"selected":""}>Pendiente</option><option value="confirmed" ${r.status==="confirmed"?"selected":""}>Confirmado</option><option value="cancelled" ${r.status==="cancelled"?"selected":""}>Cancelado</option><option value="completed" ${r.status==="completed"?"selected":""}>Completado</option></select></td></tr>`
    ).join("")}</tbody></table></div>` : '<p class="empty-state">No hay reservas todavía.</p>';
    appointmentTarget.querySelectorAll("[data-status]").forEach(sel => {
      sel.dataset.previous = sel.value;
      sel.addEventListener("change", async () => {
      const previous = sel.dataset.previous || sel.value;
      try {
        await apiRequest(`/appointments/${sel.dataset.status}`, { method: "PUT", body: JSON.stringify({ status: sel.value }) });
        sel.dataset.previous = sel.value;
      } catch (error) { sel.value = previous; alert(error.message); }
      });
    });
    const reviewTarget = document.querySelector("#admin-reviews");
    if (reviewTarget) {
      reviewTarget.innerHTML = reviews.length ? reviews.map(review => `
        <div class="admin-service">
          <span><strong>${escapeHTML(review.customer?.full_name || "Cliente")}</strong> · ${review.rating}/5<br>${escapeHTML(review.comment)}<br><small>${review.approved ? "Aprobada" : "Pendiente de aprobación"}</small></span>
          <div class="admin-actions"><button class="btn btn-small btn-outline" data-review-id="${review.id}" data-approved="${!review.approved}">${review.approved ? "Ocultar" : "Aprobar"}</button></div>
        </div>`).join("") : '<p class="empty-state">Todavía no hay opiniones.</p>';
      reviewTarget.querySelectorAll("[data-review-id]").forEach(button => button.addEventListener("click", async () => {
        try {
          await apiRequest(`/reviews/${button.dataset.reviewId}`, {
            method: "PUT", body: JSON.stringify({ approved: button.dataset.approved === "true" })
          });
          await loadAdmin();
        } catch (error) { alert(error.message); }
      }));
    }
    serviceTarget.innerHTML = services.map(s => `<div class="admin-service"><span><strong>${escapeHTML(s.name)}</strong> — $${Number(s.price).toLocaleString("es-AR")}</span><div class="admin-actions"><button class="btn btn-small btn-outline" data-edit-service="${s.id}">Editar</button><button class="btn btn-small btn-outline" data-remove-service="${s.id}">Desactivar</button></div></div>`).join("");
    serviceTarget.querySelectorAll("[data-edit-service]").forEach(btn => btn.addEventListener("click", async () => {
      const item = services.find(s => s.id === btn.dataset.editService);
      const name = prompt("Nombre del servicio:", item.name);
      if (name === null || !name.trim()) return;
      const description = prompt("Descripción:", item.description || "");
      if (description === null) return;
      const price = prompt("Precio:", item.price);
      if (price === null || Number(price) < 0 || price.trim() === "") return alert("Ingresá un precio válido.");
      const duration = prompt("Duración en minutos:", item.duration_minutes);
      if (duration === null || Number(duration) <= 0) return alert("Ingresá una duración válida.");
      try {
        await apiRequest(`/services/${item.id}`, { method: "PUT", body: JSON.stringify({
          name: name.trim(), description, price: Number(price), duration_minutes: Number(duration), active: true
        })});
        loadAdmin();
      } catch (error) { alert(error.message); }
    }));
    serviceTarget.querySelectorAll("[data-remove-service]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("¿Desactivar este servicio?")) return;
      try { await apiRequest(`/services/${btn.dataset.removeService}`, { method: "DELETE" }); loadAdmin(); }
      catch (error) { alert(error.message); }
    }));
  } catch (error) {
    appointmentTarget.innerHTML = `<p class="empty-state">${escapeHTML(error.message)}. Si tu usuario debería ser administrador, revisá el campo role en profiles.</p>`;
  }
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async e => {
    e.preventDefault();
    const message = document.querySelector("#service-message");
    try {
      await apiRequest("/services", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      showMessage(message, "Servicio agregado correctamente.");
      form.reset(); loadAdmin();
    } catch (error) { showMessage(message, error.message, "error"); }
    });
  }
}
function statusLabel(status) {
  return ({ pending: "Pendiente", confirmed: "Confirmado", cancelled: "Cancelado", completed: "Completado" })[status] || status;
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}
