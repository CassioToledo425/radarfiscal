const SECTOR_STATE={filter:'all',profile:'rental'};

const SECTOR_ANCHORS=[
  {
    date:'2026-07-31',source:'Receita Federal',level:'official',kind_label:'Locação de bens móveis',
    title:'Cronograma oficial prevê NFS-e para locações de bens móveis a partir de 1º de dezembro de 2026',
    summary:'O cronograma de implementação dos documentos fiscais eletrônicos inclui expressamente a NFS-e nas locações de bens móveis, além de locações, cessões onerosas e arrendamentos de imóveis.',
    url:'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-e-comite-gestor-do-ibs-publicam-o-cronograma-de-implementacao-dos-documentos-fiscais-eletronicos-da-reforma-tributaria-do-consumo',
    sector_tags:['rental','documents']
  },
  {
    date:'2026-01-13',source:'Planalto',level:'official',kind_label:'Base legal',
    title:'IBS e CBS alcançam operações onerosas de locação, licenciamento e cessão',
    summary:'A Lei Complementar nº 214/2025, com alterações posteriores, inclui locação, licenciamento, concessão e cessão entre as operações onerosas abrangidas pelas regras gerais do IBS e da CBS.',
    url:'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm',
    sector_tags:['rental','franchise']
  },
  {
    date:'2026-08-14',source:'Receita Federal',level:'official',kind_label:'Simples Nacional',
    title:'Para optantes do Simples, as regras de IBS e CBS passam a produzir efeitos em 1º de janeiro de 2027',
    summary:'A Receita esclareceu que os efeitos de IBS e CBS para optantes do Simples Nacional começam em 2027; a mesma publicação trata da obrigatoriedade da NFS-e nacional para ME e EPP prestadoras de serviços.',
    url:'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026',
    sector_tags:['simple','documents']
  },
  {
    date:'2026-08-11',source:'Receita Federal',level:'official',kind_label:'Simples Nacional',
    title:'CGSN atualiza as regras do Simples Nacional para incorporar IBS e CBS',
    summary:'A regulamentação do Simples passa a contemplar IBS e CBS, com mudanças em arrecadação, fiscalização e opção pelo regime, tema especialmente relevante para redes com franqueados em diferentes regimes tributários.',
    url:'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/cgsn-atualiza-regras-do-simples-nacional-para-adequacao-a-reforma-tributaria-do-consumo',
    sector_tags:['simple','franchise']
  }
];

const SECTOR_PROFILES={
  franchisor:{
    label:'Franqueadora',kicker:'GOVERNANÇA DA REDE',tone:'blue',tags:['franchise','documents','simple'],
    summary:'Foco nas cobranças entre franqueadora e rede, padronização fiscal e capacidade de orientar unidades com regimes tributários diferentes.',
    impacts:[
      {title:'Royalties e demais cobranças',text:'Mapear a natureza de royalties, licenciamento, serviços, fundos e outros repasses. Evite tratar cobranças distintas como se tivessem automaticamente a mesma regra fiscal.'},
      {title:'Contratos e comunicação',text:'Revisar cláusulas de preço, tributos, repasses e documentos. Preparar comunicação padronizada para a rede antes das mudanças operacionais.'},
      {title:'Padrão de sistemas',text:'Definir requisitos mínimos de ERP, faturamento e cadastros para reduzir divergências entre unidades e facilitar a implantação de IBS/CBS.'},
      {title:'Franqueados em regimes distintos',text:'Separar orientações para Simples Nacional e regime regular. Crédito, recolhimento e obrigações podem produzir efeitos diferentes por unidade.'}
    ],
    priorities:['Inventariar todas as cobranças da franqueadora para a rede','Classificar contratos e documentos por natureza da operação','Criar matriz de regimes tributários dos franqueados','Padronizar requisitos fiscais e tecnológicos para a rede']
  },
  franchisee:{
    label:'Franqueado',kicker:'UNIDADE DA REDE',tone:'amber',tags:['simple','rental','documents','credits'],
    summary:'Foco na unidade operacional: regime tributário, emissão fiscal, preço, margem e aproveitamento econômico de créditos nas compras e equipamentos.',
    impacts:[
      {title:'Regime tributário',text:'Comparar os efeitos do Simples Nacional e do regime regular quando aplicável. A escolha pode alterar recolhimento, crédito e relação com clientes empresariais.'},
      {title:'Preço e margem',text:'Simular a formação de preço da locação e de serviços acessórios durante a transição, considerando repasse tributário, crédito e custo de aquisição dos ativos.'},
      {title:'Emissão fiscal',text:'Validar se o sistema da unidade estará preparado para os documentos exigidos na locação e para os novos campos e eventos relacionados a IBS/CBS.'},
      {title:'Compras e créditos',text:'Acompanhar a documentação das aquisições de equipamentos, peças e despesas relevantes. A qualidade do documento recebido será importante para análise de créditos.'}
    ],
    priorities:['Definir o regime aplicável e simular cenários','Revisar cadastro de clientes, itens e natureza das cobranças','Homologar emissão fiscal antes da obrigatoriedade','Mapear compras relevantes e documentação necessária para créditos']
  },
  rental:{
    label:'Operação de locação',kicker:'BENS MÓVEIS / EQUIPAMENTOS',tone:'cyan',tags:['rental','documents','credits'],
    summary:'Foco no núcleo do negócio: locação onerosa de máquinas e equipamentos, documento fiscal, contratos, sistemas e separação de receitas acessórias.',
    impacts:[
      {title:'Incidência de IBS/CBS',text:'A locação onerosa de bens móveis passa a integrar diretamente o radar da tributação sobre consumo. Parametrização e formação de preço ganham relevância central.'},
      {title:'NFS-e e faturamento',text:'A emissão fiscal para locação exige preparação operacional. ERP, cadastro do equipamento, cliente, município e integrações precisam ser testados com antecedência.'},
      {title:'Receitas acessórias',text:'Separar locação, frete, manutenção, venda, indenização, seguro e outras cobranças. Operações combinadas precisam ser analisadas pela natureza de cada componente.'},
      {title:'Crédito e renovação de frota',text:'Acompanhar regras e documentação das aquisições de equipamentos e demais insumos. O tratamento de créditos pode alterar a análise econômica da renovação de ativos.'}
    ],
    priorities:['Mapear todas as naturezas de receita da locadora','Revisar contratos e composição do preço','Homologar documento fiscal e integrações do ERP','Criar trilha de conferência de documentos de compra dos equipamentos']
  }
};

function sectorText(item){return normalizeText(`${item.title||''} ${item.summary||''} ${item.kind_label||''} ${item.category||''}`)}
function sectorTags(item){
  if(Array.isArray(item.sector_tags))return item.sector_tags;
  const t=sectorText(item),tags=[];
  if(/locacao|aluguel|bens moveis|bem movel|equipament/.test(t))tags.push('rental');
  if(/franqui|franchis|royalt|licenciamento|cessao|cessão|marca|taxa de franquia/.test(t))tags.push('franchise');
  if(/nfs-e|nf-e|documento fiscal|nota fiscal|leiaute|layout|emissao|emissão/.test(t))tags.push('documents');
  if(/simples nacional|me e epp|microempresa|empresa de pequeno porte/.test(t))tags.push('simple');
  if(/credito|crédito|creditos|créditos|ativo imobilizado|aquisicao|aquisição/.test(t))tags.push('credits');
  return [...new Set(tags)];
}
function sectorRelevant(item){return sectorTags(item).length>0}
function sectorItems(filter='all'){
  const merged=[...SECTOR_ANCHORS,...allPublications().filter(sectorRelevant)];
  const seen=new Map();
  merged.forEach(item=>{const key=(item.url||`${item.source||''}|${item.title||''}`).replace(/\/$/,'');if(!seen.has(key))seen.set(key,item)});
  let list=[...seen.values()];
  if(filter!=='all')list=list.filter(x=>sectorTags(x).includes(filter));
  return list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function profileItems(profileKey){
  const profile=SECTOR_PROFILES[profileKey];if(!profile)return[];
  return sectorItems('all').filter(item=>profile.tags.some(tag=>sectorTags(item).includes(tag)));
}
function renderSectorCounts(){
  const filters=['rental','franchise','documents','simple','credits'];
  filters.forEach(key=>{const el=$(`[data-sector-count="${key}"]`);if(el)el.textContent=sectorItems(key).length});
}
function ensureProfileSection(){
  if($('#sectorProfileSection'))return;
  const notes=$('.sector-notes');if(!notes)return;
  notes.insertAdjacentHTML('afterend',`
    <section id="sectorProfileSection" class="sector-profile-section">
      <div class="sector-profile-head">
        <div><span class="section-label">VISÃO POR PAPEL NA REDE</span><h3>Onde a Reforma Tributária bate em cada frente</h3><p>Selecione uma perspectiva para organizar impactos, prioridades e publicações relacionadas.</p></div>
      </div>
      <div class="sector-profile-tabs" role="tablist" aria-label="Perfis da operação">
        <button class="sector-profile-tab" data-sector-profile="franchisor" role="tab"><span>FRANQUEADORA</span><small>governança, contratos e rede</small></button>
        <button class="sector-profile-tab" data-sector-profile="franchisee" role="tab"><span>FRANQUEADO</span><small>regime, preço e operação local</small></button>
        <button class="sector-profile-tab" data-sector-profile="rental" role="tab"><span>OPERAÇÃO DE LOCAÇÃO</span><small>equipamentos, NFS-e e créditos</small></button>
      </div>
      <div id="sectorProfileDetail" class="sector-profile-detail"></div>
    </section>`);
  $$('[data-sector-profile]').forEach(b=>b.addEventListener('click',()=>setSectorProfile(b.dataset.sectorProfile)));
}
function renderSectorProfile(){
  ensureProfileSection();
  const p=SECTOR_PROFILES[SECTOR_STATE.profile]||SECTOR_PROFILES.rental;
  $$('[data-sector-profile]').forEach(b=>{const active=b.dataset.sectorProfile===SECTOR_STATE.profile;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false')});
  const related=profileItems(SECTOR_STATE.profile).slice(0,5);
  const detail=$('#sectorProfileDetail');if(!detail)return;
  detail.innerHTML=`
    <div class="sector-profile-summary ${p.tone}">
      <span>${escapeHTML(p.kicker)}</span><h3>${escapeHTML(p.label)}</h3><p>${escapeHTML(p.summary)}</p>
    </div>
    <div class="sector-impact-grid">
      ${p.impacts.map(i=>`<article class="sector-impact-card"><strong>${escapeHTML(i.title)}</strong><p>${escapeHTML(i.text)}</p></article>`).join('')}
    </div>
    <div class="sector-profile-bottom">
      <article class="sector-priority-box"><span class="section-label">PRIORIDADES SUGERIDAS</span><ol>${p.priorities.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ol></article>
      <article class="sector-related-box"><div class="sector-related-head"><div><span class="section-label">PUBLICAÇÕES PARA ESTE PERFIL</span><strong>${related.length} em destaque</strong></div><button class="link-btn" data-profile-feed>Ver no radar ↓</button></div>${related.length?related.map(n=>`<a class="sector-related-item" href="${safeURL(n.url)}" target="_blank" rel="noopener"><span>${escapeHTML(n.source)}</span><strong>${escapeHTML(n.title)}</strong></a>`).join(''):'<div class="empty">Nenhuma publicação relacionada encontrada.</div>'}</article>
    </div>`;
  $('[data-profile-feed]')?.addEventListener('click',()=>{SECTOR_STATE.filter=p.tags[0]||'all';renderSector();$('#sectorFeed')?.scrollIntoView({behavior:'smooth',block:'start'})});
}
function setSectorProfile(profile){if(!SECTOR_PROFILES[profile])return;SECTOR_STATE.profile=profile;renderSectorProfile()}
function renderSector(){
  renderSectorCounts();renderSectorProfile();
  const list=sectorItems(SECTOR_STATE.filter);
  const feed=$('#sectorFeed');
  if(feed)feed.innerHTML=feedHTML(list.slice(0,30),'Nenhuma publicação setorial encontrada para este filtro.');
  $$('[data-sector-filter]').forEach(b=>b.classList.toggle('active',b.dataset.sectorFilter===SECTOR_STATE.filter));
}
function setSectorFilter(filter){SECTOR_STATE.filter=filter;renderSector();$('#sectorFeed')?.scrollIntoView({behavior:'smooth',block:'start'})}
function bindSectorRadar(){
  $$('[data-sector-filter]').forEach(b=>b.addEventListener('click',()=>setSectorFilter(b.dataset.sectorFilter)));
  const sectorNav=$('.nav-item[data-view="sector"]');
  if(sectorNav)sectorNav.addEventListener('click',()=>{setTimeout(()=>{if($('#view-sector')?.classList.contains('active')){$('#pageTitle').textContent='Radar setorial';renderSector()}},0)});
  $$('[data-jump="sector"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if($('#view-sector')?.classList.contains('active')){$('#pageTitle').textContent='Radar setorial';renderSector()}},0)));
}

bindSectorRadar();
ensureProfileSection();
renderSectorProfile();
window.addEventListener('load',()=>setTimeout(renderSector,500));
setTimeout(renderSector,1500);
