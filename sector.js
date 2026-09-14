const SECTOR_STATE={filter:'all'};

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
function renderSectorCounts(){
  const filters=['rental','franchise','documents','simple','credits'];
  filters.forEach(key=>{const el=$(`[data-sector-count="${key}"]`);if(el)el.textContent=sectorItems(key).length});
}
function renderSector(){
  renderSectorCounts();
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
