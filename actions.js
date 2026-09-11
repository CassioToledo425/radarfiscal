const ACTION_STATE={filter:'all'};

function actionText(item){return normalizeText(`${item.title||''} ${item.summary||''} ${item.kind_label||''}`)}
function extractDeadline(item){
  const raw=`${item.title||''} ${item.summary||''}`;
  const patterns=[
    /\baté\s+\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+(?:\s+de\s+\d{4})?/i,
    /\ba\s+partir\s+de\s+\d{1,2}(?:º)?\s+de\s+[A-Za-zÀ-ÿ]+(?:\s+de\s+\d{4})?/i,
    /\b(?:dia|em)\s+\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+(?:\s+de\s+\d{4})?/i,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    /\b\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}\b/i
  ];
  for(const re of patterns){const m=raw.match(re);if(m)return m[0].replace(/^em\s+/i,'')}
  return '';
}
function actionCategory(item){
  const t=actionText(item);
  if(item.kind==='normative'||/ato conjunto|resolucao|portaria|regulament/.test(t))return 'normative';
  if(/nota tecnica|documentacao tecnica|leiaute|layout|manual|api|versao|evento transacional|schema|xml/.test(t))return 'technical';
  if(/documento fiscal|nota fiscal|nfs-e|nf-e|nfc-e|ct-e|mdf-e|emissao|emissão/.test(t))return 'document';
  if(/prazo|ate \d|a partir de|obrigator|cronograma|escolha|opcao|opção/.test(t))return 'deadline';
  return 'general';
}
function actionPriority(item){
  const t=actionText(item),deadline=extractDeadline(item);
  if(deadline||/tem ate|têm até|prazo|obrigator|necessario|necessário|devera|deverá|escolha do modelo|opcao pelo|opção pelo/.test(t))return 'act';
  if(/nota tecnica|documentacao tecnica|leiaute|layout|manual|api|credencia|documento fiscal|nota fiscal|nfs-e|nf-e|cronograma|implementacao|implementação|adaptacao|adaptação/.test(t))return 'prepare';
  return 'monitor';
}
function suggestedAction(item,category,priority){
  const t=actionText(item);
  if(/credencia|api/.test(t))return 'Acionar TI/Fiscal para validar credenciais, integrações e ambiente de testes antes da entrada em produção.';
  if(/dere/.test(t)&&/documentacao tecnica|leiaute|layout|versao|evento/.test(t))return 'Comparar a nova versão técnica com a implementação atual, registrar diferenças e planejar testes de integração da DeRE.';
  if(/simples nacional/.test(t)&&(/opcao|opção|escolha|recolhimento/.test(t)))return 'Validar empresas afetadas, simular a alternativa aplicável e formalizar a decisão interna antes do prazo publicado.';
  if(category==='document')return 'Mapear documentos e sistemas afetados, conferir o cronograma oficial e validar com ERP/faturamento as adequações necessárias.';
  if(category==='technical')return 'Encaminhar para Fiscal + TI, comparar leiautes/regras com a versão anterior e abrir plano de testes e homologação.';
  if(category==='normative')return 'Ler o ato na fonte oficial, identificar processos e cadastros impactados e registrar responsáveis pelas adequações.';
  if(priority==='act')return 'Confirmar o prazo e o público afetado na fonte oficial, definir responsável e registrar a providência no plano de ação.';
  return 'Avaliar impacto no processo fiscal e manter o tema monitorado até haver prazo, obrigatoriedade ou especificação operacional.';
}
function changeSummary(item){
  if(item.summary&&item.summary.trim())return item.summary.trim();
  const t=item.title||'Publicação oficial';
  return `Nova publicação monitorada: ${t}`;
}
function actionLabel(category){return ({deadline:'PRAZO / DECISÃO',document:'DOCUMENTO FISCAL',technical:'TÉCNICO / LEIAUTE',normative:'ATO / NORMA',general:'ATUALIZAÇÃO'})[category]||'ATUALIZAÇÃO'}
function priorityLabel(priority){return ({act:'AGIR AGORA',prepare:'PREPARAR',monitor:'MONITORAR'})[priority]}

function buildActionItems(){
  return (STATE.reforma||[]).filter(n=>n.level==='official').map(item=>{
    const category=actionCategory(item),priority=actionPriority(item),deadline=extractDeadline(item);
    return {...item,action_category:category,action_priority:priority,action_deadline:deadline,action_next:suggestedAction(item,category,priority),action_change:changeSummary(item)};
  }).sort((a,b)=>{
    const p={act:3,prepare:2,monitor:1};
    return (p[b.action_priority]-p[a.action_priority])||((b.date||'').localeCompare(a.date||''));
  });
}
function actionCardHTML(a){
  return `<article class="action-card ${a.action_priority}">
    <div class="action-card-rail"><span class="action-priority ${a.action_priority}">${priorityLabel(a.action_priority)}</span><span class="action-type">${actionLabel(a.action_category)}</span></div>
    <div class="action-card-main">
      <div class="action-meta"><span class="source-badge official">OFICIAL</span><strong>${escapeHTML(a.source)}</strong><span>•</span><time>${fmtDate(a.date)}</time></div>
      <h3>${escapeHTML(a.title)}</h3>
      <div class="action-columns">
        <div class="action-block"><span>O QUE MUDOU</span><p>${escapeHTML(a.action_change)}</p></div>
        <div class="action-block next"><span>PRÓXIMO PASSO SUGERIDO</span><p>${escapeHTML(a.action_next)}</p></div>
      </div>
      ${a.action_deadline?`<div class="deadline-callout"><span>DATA-CHAVE IDENTIFICADA</span><strong>${escapeHTML(a.action_deadline)}</strong><small>Confirme a abrangência e a vigência na publicação oficial.</small></div>`:''}
    </div>
    <div class="action-card-side"><a href="${safeURL(a.url)}" target="_blank" rel="noopener">Abrir fonte ↗</a></div>
  </article>`;
}
function renderActions(){
  const all=buildActionItems();
  const act=all.filter(x=>x.action_priority==='act').length;
  const prep=all.filter(x=>x.action_priority==='prepare').length;
  const deadlines=all.filter(x=>x.action_deadline).length;
  const docs=all.filter(x=>x.action_category==='document').length;
  if($('#actionKpiAct'))$('#actionKpiAct').textContent=act;
  if($('#actionKpiPrepare'))$('#actionKpiPrepare').textContent=prep;
  if($('#actionKpiDeadline'))$('#actionKpiDeadline').textContent=deadlines;
  if($('#actionKpiDocs'))$('#actionKpiDocs').textContent=docs;
  let list=all;
  if(ACTION_STATE.filter==='act')list=all.filter(x=>x.action_priority==='act');
  if(ACTION_STATE.filter==='deadline')list=all.filter(x=>x.action_deadline);
  if(['document','technical','normative'].includes(ACTION_STATE.filter))list=all.filter(x=>x.action_category===ACTION_STATE.filter);
  if($('#actionFeed'))$('#actionFeed').innerHTML=list.length?list.map(actionCardHTML).join(''):'<div class="empty">Nenhuma atualização encontrada para este filtro.</div>';
}

function bindActionSummary(){
  $$('[data-action-filter]').forEach(b=>b.addEventListener('click',()=>{
    ACTION_STATE.filter=b.dataset.actionFilter;
    $$('[data-action-filter]').forEach(x=>x.classList.toggle('active',x===b));
    renderActions();
  }));
  const actionNav=$('.nav-item[data-view="actions"]');
  if(actionNav)actionNav.addEventListener('click',()=>{
    $('#pageTitle').textContent='Resumo de ações';
    renderActions();
  });
  $$('[data-jump="actions"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if($('#view-actions')?.classList.contains('active')){$('#pageTitle').textContent='Resumo de ações';renderActions()}},0)));
}

bindActionSummary();
