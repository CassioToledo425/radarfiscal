(async function(){
  const load=async p=>{try{const r=await fetch(p+"?v="+Date.now());return await r.json()}catch(e){return null}};
  const d=await load("data/split_payment.json"); if(!d)return;
  const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
  const tone=s=>s==="ok"?"ok":s==="warn"?"warn":"monitor";
  const view=$("#view-split");
  if(!view)return;
  $("#splitUpdated").textContent=d.updated_at?new Date(d.updated_at+"T12:00:00").toLocaleDateString("pt-BR"):"—";
  $("#splitKpis").innerHTML=(d.kpis||[]).map(x=>'<article class="split-kpi '+tone(x.tone)+'"><span>'+esc(x.label)+'</span><strong>'+esc(x.value)+'</strong><small>'+esc(x.detail)+'</small></article>').join("");
  $("#splitStages").innerHTML=(d.stages||[]).map(x=>'<div class="split-stage '+tone(x.status)+'"><i></i><div><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></div></div>').join("");
  $("#splitDocs").innerHTML=(d.documents||[]).map(x=>'<div class="split-doc"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.status)+'</small></div><b>'+esc(x.version)+'</b></div>').join("");
  $("#splitTimeline").innerHTML=(d.milestones||[]).map(x=>'<article class="split-event"><div class="split-event-date">'+new Date(x.date+"T12:00:00").toLocaleDateString("pt-BR")+'</div><div><strong>'+esc(x.title)+'</strong><p>'+esc(x.summary)+'</p><a href="'+esc(x.url)+'" target="_blank" rel="noopener">Fonte oficial ↗</a></div></article>').join("");
  $("#splitHouse").innerHTML=(d.house_impact||[]).map(x=>'<article class="split-impact"><span>'+esc(x.priority)+'</span><h4>'+esc(x.title)+'</h4><p>'+esc(x.detail)+'</p></article>').join("");
  $("#splitNotes").innerHTML=(d.notes||[]).map(x=>'<li>'+esc(x)+'</li>').join("");
  const src=$("#splitSource"); if(src)src.href=d.source_url;
})();