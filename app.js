const STATE={agenda:{months:{}},reforma:[],radar:[],meta:{sources:[]},monthKey:null,selectedDate:null,reformaFilter:'all'};
const PT_MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TOPICS=[
  {label:'IBS',patterns:[/\bibs\b/]},
  {label:'CBS',patterns:[/\bcbs\b/]},
  {label:'Simples Nacional',patterns:[/\bsimples\s+nacional\b/]},
  {label:'NFS-e',patterns:[/\bnfs[\s-]?e\b/]},
  {label:'DeRE',patterns:[/\bdere\b/]},
  {label:'Split payment',patterns:[/\bsplit\s+payment\b/]},
  {label:'Créditos',patterns:[/\bcreditos?\b/]},
  {label:'DCTFWeb',patterns:[/\bdctfweb\b/]},
  {label:'PIS/Cofins',patterns:[/\bpis\s*(?:\/|e)?\s*cofins\b/]},
  {label:'ICMS',patterns:[/\bicms\b/]}
];

async function loadJSON(path,fallback){try{const r=await fetch(`${path}?v=${Date.now()}`);if(!r.ok)throw new Error(r.status);return await r.json()}catch(e){console.warn('Falha ao carregar',path,e);return fallback}}
function escapeHTML(s=''){return String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function safeURL(u=''){try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}}
function fmtDate(iso,opts={day:'2-digit',month:'short',year:'numeric'}){if(!iso)return '—';const d=new Date(`${iso.slice(0,10)}T12:00:00`);return d.toLocaleDateString('pt-BR',opts)}
function sourceClass(level='specialized'){return ['official','institutional','specialized'].includes(level)?level:'specialized'}
function levelLabel(level){return ({official:'OFICIAL',institutional:'INSTITUCIONAL',specialized:'ESPECIALIZADA'})[level]||'FONTE'}
function normalizeText(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function publicationText(n){return normalizeText(`${n.title||''} ${n.summary||''} ${n.kind_label||''} ${n.category||''}`)}
function allPublications(){const seen=new Map();[...STATE.reforma,...STATE.radar].forEach(n=>{const key=(n.url||`${n.source||''}|${n.title||''}|${n.date||''}`).trim();if(!seen.has(key))seen.set(key,n)});return [...seen.values()]}
function topicItems(label){const topic=TOPICS.find(t=>t.label===label);if(!topic)return[];return allPublications().filter(n=>{const text=publicationText(n);return topic.patterns.some(p=>p.test(text))}).sort((a,b)=>(b.date||'').localeCompare(a.date||''))}

async function init(){
  const [agenda,reforma,radar,meta]=await Promise.all([
    loadJSON('data/agenda.json',{months:{}}),loadJSON('data/reforma.json',[]),loadJSON('data/radar.json',[]),loadJSON('data/meta.json',{sources:[]})
  ]);
  STATE.agenda=agenda;STATE.reforma=reforma;STATE.radar=radar;STATE.meta=meta;
  const now=new Date();STATE.monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if(!STATE.agenda.months[STATE.monthKey])STATE.monthKey=Object.keys(STATE.agenda.months).sort().reverse()[0]||STATE.monthKey;
  setToday();renderAll();bind();
}
function setToday(){const d=new Date();$('#todayDay').textContent=String(d.getDate()).padStart(2,'0');$('#todayMonth').textContent=PT_MONTHS[d.getMonth()];$('#todayWeekday').textContent=d.toLocaleDateString('pt-BR',{weekday:'long'});}
function renderAll(){renderMeta();renderOverview();renderCalendar();renderReforma();renderRadar();renderSources();}
function renderMeta(){const updated=STATE.meta.updated_at?new Date(STATE.meta.updated_at):null;const txt=updated&&!isNaN(updated)?`Atualizado ${updated.toLocaleDateString('pt-BR')} ${updated.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:'Dados locais';$('#syncText').textContent=txt;$('#sideUpdated').textContent=txt;}
function allEvents(){return Object.values(STATE.agenda.months||{}).flatMap(m=>m.events||[])}
function renderOverview(){
  const now=new Date();now.setHours(0,0,0,0);const week=new Date(now);week.setDate(week.getDate()+7);
  const upcoming=allEvents().filter(e=>{const d=new Date(`${e.date}T12:00:00`);return d>=now&&d<=week});
  const official=STATE.reforma.filter(n=>n.level==='official');
  $('#kpiDeadlines').textContent=upcoming.length;$('#kpiOfficial').textContent=official.length;$('#kpiRadar').textContent=STATE.radar.length;$('#kpiSources').textContent=(STATE.meta.sources||[]).filter(s=>s.status!=='error').length;
  const grouped={};allEvents().filter(e=>new Date(`${e.date}T12:00:00`)>=now).slice(0,80).forEach(e=>(grouped[e.date]??=[]).push(e));
  const dates=Object.keys(grouped).sort().slice(0,5);$('#upcomingList').innerHTML=dates.length?dates.map(d=>{const ev=grouped[d];const dt=new Date(`${d}T12:00:00`);return `<div class="deadline-item"><div class="date-chip"><strong>${dt.getDate()}</strong><span>${PT_MONTHS[dt.getMonth()].slice(0,3)}</span></div><div class="deadline-copy"><strong>${escapeHTML(ev[0].group||ev[0].title||'Obrigação tributária')}</strong><span>${escapeHTML(ev[0].description||ev[0].title||'Consulte os detalhes na agenda')}</span></div><span class="count-badge">${ev.length} item${ev.length>1?'s':''}</span></div>`}).join(''):'<div class="empty">Nenhum vencimento carregado para os próximos dias.</div>';
  $('#officialHighlights').innerHTML=official.slice(0,4).map(n=>`<div class="compact-item"><div class="meta"><span class="source-badge official">OFICIAL</span><span>${escapeHTML(n.source)}</span><span>•</span><span>${fmtDate(n.date,{day:'2-digit',month:'2-digit'})}</span></div><a href="${safeURL(n.url)}" target="_blank" rel="noopener">${escapeHTML(n.title)}</a></div>`).join('')||'<div class="empty">Aguardando a primeira coleta oficial.</div>';
  const counts=TOPICS.map(t=>[t.label,topicItems(t.label).length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);
  $('#topicCloud').innerHTML=(counts.length?counts:TOPICS.slice(0,6).map(t=>[t.label,0])).map(([t,c])=>`<button type="button" class="topic" data-topic="${escapeHTML(t)}" ${c?'': 'disabled'} aria-label="${c?`Ver ${c} publicações sobre ${escapeHTML(t)}`:`Nenhuma publicação sobre ${escapeHTML(t)}`}">${escapeHTML(t)}${c?` <strong>${c}</strong>`:''}</button>`).join('');
}
function monthParts(key){const [y,m]=key.split('-').map(Number);return {y,m}}
function shiftMonth(key,delta){const {y,m}=monthParts(key);const d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function renderCalendar(){
  const {y,m}=monthParts(STATE.monthKey);$('#monthLabel').textContent=`${PT_MONTHS[m-1]} de ${y}`;
  const events=(STATE.agenda.months[STATE.monthKey]?.events||[]);const byDate={};events.forEach(e=>(byDate[e.date]??=[]).push(e));
  const first=new Date(y,m-1,1), start=new Date(y,m-1,1-first.getDay());const today=new Date();
  let html='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const ev=byDate[iso]||[];const outside=d.getMonth()!==m-1;const isToday=d.toDateString()===today.toDateString();const sel=STATE.selectedDate===iso;html+=`<button class="cal-day ${outside?'outside':''} ${isToday?'today':''} ${sel?'selected':''}" data-date="${iso}"><span class="day-num">${d.getDate()}</span>${ev.length?`<span class="event-dots">${ev.slice(0,2).map(x=>`<span class="event-mini">${escapeHTML(x.group||x.title||'Obrigação')}</span>`).join('')}${ev.length>2?`<span class="event-mini more">+${ev.length-2} itens</span>`:''}</span>`:''}</button>`}
  $('#calendar').innerHTML=html;$$('.cal-day').forEach(b=>b.addEventListener('click',()=>selectDate(b.dataset.date,byDate[b.dataset.date]||[])));
  if(STATE.selectedDate&&byDate[STATE.selectedDate])selectDate(STATE.selectedDate,byDate[STATE.selectedDate]); else {$('#selectedDate').textContent='Selecione uma data';$('#selectedCount').textContent='Clique em um dia destacado no calendário.';$('#dayEvents').innerHTML='<div class="empty">Os dias com obrigações aparecem destacados no calendário.</div>'}
}
function selectDate(iso,events){STATE.selectedDate=iso;$$('.cal-day').forEach(b=>b.classList.toggle('selected',b.dataset.date===iso));$('#selectedDate').textContent=fmtDate(iso,{weekday:'long',day:'2-digit',month:'long'});$('#selectedCount').textContent=events.length?`${events.length} obrigação${events.length>1?'ões':''} encontrada${events.length>1?'s':''}.`:'Nenhuma obrigação carregada para este dia.';$('#dayEvents').innerHTML=events.length?events.map(e=>`<div class="day-event"><strong>${escapeHTML(e.group||e.title||'Obrigação')} — ${escapeHTML(e.description||'')}</strong><dl>${e.code?`<dt>Código</dt><dd>${escapeHTML(e.code)}</dd>`:''}${e.period?`<dt>Apuração</dt><dd>${escapeHTML(e.period)}</dd>`:''}${e.document?`<dt>Documento</dt><dd>${escapeHTML(e.document)}</dd>`:''}${e.category?`<dt>Origem</dt><dd>${escapeHTML(e.category)}</dd>`:''}${e.legal_basis?`<dt>Base legal</dt><dd>${escapeHTML(e.legal_basis)}</dd>`:''}</dl><a href="${safeURL(e.url)}" target="_blank" rel="noopener">Abrir na Receita Federal ↗</a></div>`).join(''):'<div class="empty">Sem itens para esta data.</div>'}
function renderReforma(){let list=STATE.reforma;if(STATE.reformaFilter==='official')list=list.filter(n=>n.level==='official');if(STATE.reformaFilter==='normative')list=list.filter(n=>n.kind==='normative');$('#reformaFeed').innerHTML=feedHTML(list,'Nenhuma publicação coletada ainda.');}
function feedHTML(list,empty){return list.length?list.map(n=>`<article class="news-card"><div class="news-source"><span class="source-badge ${sourceClass(n.level)}">${levelLabel(n.level)}</span><strong>${escapeHTML(n.source)}</strong><span>${escapeHTML(n.kind_label||n.category||'Atualização')}</span></div><div class="news-copy"><a href="${safeURL(n.url)}" target="_blank" rel="noopener">${escapeHTML(n.title)}</a>${n.summary?`<p>${escapeHTML(n.summary)}</p>`:''}</div><div class="news-actions"><time>${fmtDate(n.date)}</time><a class="external" href="${safeURL(n.url)}" target="_blank" rel="noopener">Abrir fonte ↗</a></div></article>`).join(''):`<div class="empty">${empty}</div>`}
function renderRadar(){const q=($('#radarSearch')?.value||'').trim().toLowerCase();const list=STATE.radar.filter(n=>!q||`${n.title} ${n.summary||''} ${n.source}`.toLowerCase().includes(q));$('#radarFeed').innerHTML=feedHTML(list,'Nenhuma notícia encontrada.');}
function renderSources(){const src=STATE.meta.sources||[];$('#sourcesGrid').innerHTML=src.length?src.map(s=>`<article class="source-card"><div class="source-card-head"><span class="source-badge ${sourceClass(s.level)}">${levelLabel(s.level)}</span><span class="status ${s.status==='ok'?'ok':'warn'}">${s.status==='ok'?'ONLINE':'ATENÇÃO'}</span></div><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.description||'Fonte monitorada automaticamente pelo Radar Fiscal.')}</p><a href="${safeURL(s.url)}" target="_blank" rel="noopener">Abrir fonte ↗</a></article>`).join(''):'<div class="empty">Status das fontes será exibido após a coleta automática.</div>'}
function showView(name){$$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${name}`).classList.add('active');$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));$('#pageTitle').textContent=({overview:'Visão geral',agenda:'Agenda tributária',reforma:'Reforma Tributária',radar:'Radar contábil',sources:'Fontes & status'})[name];window.scrollTo({top:0,behavior:'smooth'})}

function ensureTopicModal(){
  if($('#topicModal'))return;
  const style=document.createElement('style');style.id='topicUxStyles';style.textContent=`
    .topic{appearance:none;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease}
    .topic:not(:disabled):hover{background:#edf4ff;border-color:#b9d3f6;color:var(--blue);transform:translateY(-1px)}
    .topic:focus-visible{outline:2px solid var(--blue);outline-offset:2px}.topic:disabled{cursor:default;opacity:.7}
    .topic-modal-backdrop{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:28px;background:rgba(4,15,30,.62);backdrop-filter:blur(4px)}
    .topic-modal-backdrop.open{display:flex}.topic-modal{width:min(1040px,100%);max-height:calc(100vh - 56px);display:flex;flex-direction:column;overflow:hidden;background:var(--bg);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28)}
    .topic-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 22px 17px;background:var(--panel);border-bottom:1px solid var(--line)}
    .topic-modal-head h2{margin:3px 0 4px;font-size:22px;letter-spacing:-.4px}.topic-modal-head p{margin:0;color:var(--muted);font-size:10px}.topic-modal-close{width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font-size:22px;line-height:1}
    .topic-modal-feed{overflow:auto;padding:18px}.topic-modal-feed .news-card{grid-template-columns:140px 1fr auto}.topic-modal-open{overflow:hidden}
    @media(max-width:780px){.topic-modal-backdrop{padding:12px}.topic-modal{max-height:calc(100vh - 24px)}.topic-modal-head{padding:16px}.topic-modal-feed{padding:12px}.topic-modal-feed .news-card{grid-template-columns:1fr;gap:10px}.topic-modal-feed .news-actions{justify-items:start}}
  `;document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend',`<div id="topicModal" class="topic-modal-backdrop" aria-hidden="true"><section class="topic-modal" role="dialog" aria-modal="true" aria-labelledby="topicModalTitle"><header class="topic-modal-head"><div><div class="section-label">TERMÔMETRO</div><h2 id="topicModalTitle">Assunto</h2><p id="topicModalSubtitle"></p></div><button type="button" id="topicModalClose" class="topic-modal-close" aria-label="Fechar">×</button></header><div id="topicModalFeed" class="news-feed topic-modal-feed"></div></section></div>`);
  $('#topicModalClose').addEventListener('click',closeTopicModal);
  $('#topicModal').addEventListener('click',e=>{if(e.target.id==='topicModal')closeTopicModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#topicModal')?.classList.contains('open'))closeTopicModal()});
}
function openTopicModal(label){ensureTopicModal();const items=topicItems(label);$('#topicModalTitle').textContent=label;$('#topicModalSubtitle').textContent=`${items.length} publicação${items.length===1?'':'ões'} encontrada${items.length===1?'':'s'} nas fontes monitoradas.`;$('#topicModalFeed').innerHTML=feedHTML(items,`Nenhuma publicação encontrada sobre ${escapeHTML(label)}.`);$('#topicModalFeed').scrollTop=0;$('#topicModal').classList.add('open');$('#topicModal').setAttribute('aria-hidden','false');document.body.classList.add('topic-modal-open');$('#topicModalClose').focus()}
function closeTopicModal(){const modal=$('#topicModal');if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('topic-modal-open')}

function bind(){
  ensureTopicModal();
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
  $('#prevMonth').addEventListener('click',()=>{STATE.monthKey=shiftMonth(STATE.monthKey,-1);STATE.selectedDate=null;renderCalendar()});$('#nextMonth').addEventListener('click',()=>{STATE.monthKey=shiftMonth(STATE.monthKey,1);STATE.selectedDate=null;renderCalendar()});$('#todayBtn').addEventListener('click',()=>{const d=new Date();STATE.monthKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;STATE.selectedDate=null;renderCalendar()});
  $$('[data-reforma-filter]').forEach(b=>b.addEventListener('click',()=>{STATE.reformaFilter=b.dataset.reformaFilter;$$('[data-reforma-filter]').forEach(x=>x.classList.toggle('active',x===b));renderReforma()}));$('#radarSearch').addEventListener('input',renderRadar);$('#themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('radar-theme',document.body.classList.contains('dark')?'dark':'light')});if(localStorage.getItem('radar-theme')==='dark')document.body.classList.add('dark');
  $('#topicCloud').addEventListener('click',e=>{const button=e.target.closest('[data-topic]');if(button&&!button.disabled)openTopicModal(button.dataset.topic)});
}
init();
