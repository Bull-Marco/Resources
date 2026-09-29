let DATA=null;
let currentFilter="";

async function load(){
  const r=await fetch("resources.json?ts="+Date.now(),{cache:"no-store"});
  DATA=await r.json();
  document.getElementById("exportedAt").textContent=formatDateTime(DATA.exported_at);
  render();
}

function formatDateTime(v){
  if(!v)return "-";
  const d=new Date(v);
  return d.toLocaleString("de-DE");
}
function formatDate(v){
  if(!v)return "-";
  const [y,m,d]=v.slice(0,10).split("-");
  return `${d}.${m}.${y}`;
}
function setFilter(btn,value){
  currentFilter=value;
  document.querySelectorAll(".filters button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  render();
}
function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function validBlockingBookings(resource){
  return (resource.bookings||[])
    .filter(b=>!b.deleted && !b.returned && b.start_date && b.end_date && b.end_date>=b.start_date)
    .sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.end_date.localeCompare(b.end_date));
}
function blockedPeriods(resource){
  const today=(DATA&&DATA.today)||new Date().toISOString().slice(0,10);
  const bookings=validBlockingBookings(resource).filter(b=>b.end_date>=today);
  const merged=[];
  for(const b of bookings){
    const last=merged[merged.length-1];
    if(!last){
      merged.push({start:b.start_date,end:b.end_date});
      continue;
    }
    const nextDay=new Date(last.end+"T00:00:00");
    nextDay.setDate(nextDay.getDate()+1);
    const nextDayISO=nextDay.toISOString().slice(0,10);
    if(b.start_date<=nextDayISO){
      if(b.end_date>last.end)last.end=b.end_date;
    }else{
      merged.push({start:b.start_date,end:b.end_date});
    }
  }
  return merged;
}
function statusOf(resource){
  const s=resource.status||{};
  return {code:s.code||"available",label:s.label||"Verfügbar",detail:s.detail||"Verfügbar"};
}
function periodsHtml(resource){
  const periods=blockedPeriods(resource);
  if(!periods.length){
    return `<div class="availabilityPanel">
      <div class="availabilityTitle">Belegte Zeiträume</div>
      <div class="availabilityEmpty">Keine aktuellen oder zukünftigen Belegungen eingetragen.</div>
    </div>`;
  }
  const today=(DATA&&DATA.today)||new Date().toISOString().slice(0,10);
  return `<div class="availabilityPanel">
    <div class="availabilityTitle">Belegte Zeiträume</div>
    <div class="availabilityList">
      ${periods.map(p=>`<div class="availabilityRow">
        <span class="blockDot"></span>
        <div>
          <b>${p.start<=today&&today<=p.end?"Aktuell · ":""}${formatDate(p.start)} bis ${formatDate(p.end)}</b>
          <span>${p.start<=today&&today<=p.end?"Derzeit nicht verfügbar":"In diesem Zeitraum nicht verfügbar"}</span>
        </div>
      </div>`).join("")}
    </div>
    <div class="availabilityHint">Alle nicht aufgeführten Zeiträume sind nach aktuellem Plan verfügbar.</div>
  </div>`;
}
function toggleCard(card,event){
  if(event && event.target.closest("a,button,input"))return;
  const panel=card.querySelector(".availabilityWrap");
  const hint=card.querySelector(".availabilityToggle");
  const open=card.classList.toggle("expanded");
  panel.hidden=!open;
  hint.textContent=open?"Belegte Termine ausblenden ▲":"Belegte Termine anzeigen ▼";
}
function render(){
  if(!DATA)return;
  const q=(document.getElementById("search").value||"").toLowerCase().trim();
  let resources=(DATA.resources||[]).filter(r=>!r.deleted&&!r.archived);
  const counts={available:0,out:0,due:0,overdue:0};
  resources.forEach(r=>{const c=statusOf(r).code;if(counts[c]!==undefined)counts[c]++});
  document.getElementById("summary").innerHTML=`
    <div class="sumCard"><b>${counts.available}</b><span>frei</span></div>
    <div class="sumCard"><b>${counts.out}</b><span>unterwegs</span></div>
    <div class="sumCard"><b>${counts.due}</b><span>heute zurück</span></div>
    <div class="sumCard"><b>${counts.overdue}</b><span>überfällig</span></div>`;

  resources=resources.filter(r=>{
    const s=statusOf(r);
    if(currentFilter&&s.code!==currentFilter)return false;
    const hay=[r.name,r.inventory_no,r.location,r.group_name,s.detail].filter(Boolean).join(" ").toLowerCase();
    return !q||hay.includes(q);
  });

  const list=document.getElementById("list");
  if(!resources.length){
    list.innerHTML=`<div class="empty">Keine passenden Ressourcen gefunden.</div>`;
    return;
  }

  list.innerHTML=resources.map(r=>{
    const s=statusOf(r);
    const bookings=validBlockingBookings(r).filter(b=>{
      const today=(DATA&&DATA.today)||new Date().toISOString().slice(0,10);
      return b.start_date<=today&&today<=b.end_date;
    });
    return `<article class="card ${esc(s.code)}" tabindex="0" role="button" aria-label="Belegte Termine für ${esc(r.name)} anzeigen">
      <div class="cardHeader">
        <h2>${esc(r.name)}</h2>
        <span class="badge ${esc(s.code)}">${esc(s.label)}</span>
      </div>
      <div class="meta">${esc(r.group_name||"Ohne Gruppe")} · ${esc(r.type||"Werkzeug")}<br>${esc(r.inventory_no||"ohne Inventar")} · ${esc(r.location||"")}</div>
      <div class="detail">${esc(s.detail)}</div>
      ${bookings.length?`<div class="bookings">${bookings.map(b=>`<div class="booking"><b>${esc(b.slot||"TAG")}</b> · ${formatDate(b.start_date)} bis ${formatDate(b.end_date)}${b.user_name||b.booked_by?`<br>bei ${esc(b.user_name||b.booked_by)}`:""}</div>`).join("")}</div>`:""}
      <div class="availabilityToggle">Belegte Termine anzeigen ▼</div>
      <div class="availabilityWrap" hidden>${periodsHtml(r)}</div>
    </article>`;
  }).join("");

  list.querySelectorAll(".card").forEach(card=>{
    card.addEventListener("click",e=>toggleCard(card,e));
    card.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleCard(card,e)}
    });
  });
}
load().catch(err=>{
  document.getElementById("list").innerHTML=`<div class="empty">Fehler beim Laden der resources.json: ${esc(err.message)}</div>`;
});