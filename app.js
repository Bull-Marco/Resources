let DATA = null;
let filter = "";

const statusLabels = {
  available: "Verfügbar",
  out: "Unterwegs",
  due: "Rückgabe heute",
  overdue: "Überfällig"
};

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

async function loadData(){
  try{
    const r = await fetch("resources.json?ts=" + Date.now());
    DATA = await r.json();
    document.getElementById("exportedAt").textContent =
      DATA.exported_at ? new Date(DATA.exported_at).toLocaleString("de-DE") : "unbekannt";
    render();
  }catch(e){
    document.getElementById("list").innerHTML =
      `<div class="empty">resources.json konnte nicht geladen werden.</div>`;
  }
}

function setFilter(btn, value){
  filter = value;
  document.querySelectorAll(".filters button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  render();
}

function render(){
  if(!DATA) return;

  const q = (document.getElementById("search").value || "").toLowerCase();
  let resources = DATA.resources || [];

  resources = resources.filter(r => {
    const st = r.status?.code || "available";
    if(filter && st !== filter) return false;
    const hay = [
      r.name, r.type, r.inventory_no, r.location, r.group_name,
      r.status?.label, r.status?.detail
    ].join(" ").toLowerCase();
    return !q || hay.includes(q);
  });

  renderSummary(DATA.resources || []);
  renderList(resources);
}

function renderSummary(resources){
  const counts = {available:0,out:0,due:0,overdue:0};
  for(const r of resources){
    const st = r.status?.code || "available";
    counts[st] = (counts[st] || 0) + 1;
  }
  document.getElementById("summary").innerHTML = `
    <div class="sumCard"><b>${counts.available||0}</b><span>frei</span></div>
    <div class="sumCard"><b>${counts.out||0}</b><span>unterwegs</span></div>
    <div class="sumCard"><b>${counts.due||0}</b><span>heute zurück</span></div>
    <div class="sumCard"><b>${counts.overdue||0}</b><span>überfällig</span></div>
  `;
}

function renderList(resources){
  const list = document.getElementById("list");
  if(!resources.length){
    list.innerHTML = `<div class="empty">Keine Ressourcen gefunden.</div>`;
    return;
  }

  list.innerHTML = resources.map(r => {
    const st = r.status?.code || "available";
    const label = statusLabels[st] || r.status?.label || st;
    const openBookings = (r.bookings || []).filter(b => !b.returned && !b.deleted);
    const relevant = openBookings.slice(0,3);

    return `
      <article class="card ${esc(st)}">
        <div class="cardHeader">
          <h2>${esc(r.name)}</h2>
          <span class="badge ${esc(st)}">${esc(label)}</span>
        </div>
        <div class="meta">
          ${esc(r.group_name || "Ohne Gruppe")} · ${esc(r.type || "")}<br>
          ${esc(r.inventory_no || "ohne Inventar")} · ${esc(r.location || "ohne Standort")}
        </div>
        <div class="detail">${esc(r.status?.detail || "")}</div>
        ${relevant.length ? `
          <div class="bookings">
            ${relevant.map(b => `
              <div class="booking">
                <b>${esc(b.slot)}</b> · ${esc(dateDE(b.start_date))} bis ${esc(dateDE(b.end_date))}<br>
                bei ${esc(b.user_name || b.booked_by || "")}
              </div>
            `).join("")}
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function dateDE(iso){
  if(!iso || !iso.includes("-")) return iso || "";
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

loadData();
