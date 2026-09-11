#!/usr/bin/env python3
"""Atualiza os JSONs consumidos pelo Radar Fiscal.

Desenhado para GitHub Actions, sem segredos e sem backend persistente.
Quando uma fonte muda a estrutura HTML, a coleta daquela fonte falha de forma isolada
(e o painel mantém o último JSON válido no repositório).
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

UA = "RadarFiscalGitHub/1.0 (+https://github.com/CassioToledo425/radarfiscal)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5"})
TIMEOUT = 25

MONTH_URL = {
    1: "janeiro", 2: "fevereiro", 3: "marco", 4: "abril", 5: "maio", 6: "junho",
    7: "julho", 8: "agosto", 9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
}
PT_MONTHS = {
    "janeiro":1,"fevereiro":2,"março":3,"marco":3,"abril":4,"maio":5,"junho":6,
    "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12,
}
KEYWORDS = (
    "reforma tribut", "ibs", "cbs", "split payment", "dere", "nfs-e", "nota fiscal",
    "simples nacional", "crédito tribut", "credito tribut", "lc 214", "lei complementar 214",
)

SOURCES = [
    {"name":"Receita Federal — Agenda Tributária","level":"official","url":"https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria","description":"Prazos e vencimentos federais, incluindo detalhes por dia."},
    {"name":"Receita Federal — Reforma Tributária","level":"official","url":"https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/rtc2026","description":"Notícias e orientações oficiais sobre a Reforma Tributária do Consumo."},
    {"name":"CGIBS — Comitê Gestor do IBS","level":"official","url":"https://www.cgibs.gov.br/","description":"Notícias, resoluções, atos conjuntos e materiais oficiais do IBS."},
    {"name":"FENACON","level":"institutional","url":"https://fenacon.org.br/reforma-tributaria/","description":"Radar institucional do setor de serviços contábeis e empresariais."},
    {"name":"Conselho Federal de Contabilidade","level":"institutional","url":"https://cfc.org.br/search/reforma%20tributaria","description":"Notícias e conteúdos técnicos/institucionais para profissionais contábeis."},
    {"name":"Portal Contábeis","level":"specialized","url":"https://www.contabeis.com.br/conteudo/tributario","description":"Cobertura jornalística especializada em tributação e contabilidade."},
]


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def get(url: str) -> requests.Response:
    r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    return r


def soup(url: str) -> BeautifulSoup:
    return BeautifulSoup(get(url).text, "html.parser")


def write_json(name: str, payload) -> None:
    path = DATA / name
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def load_json(name: str, fallback):
    p = DATA / name
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def month_shift(y: int, m: int, delta: int) -> tuple[int, int]:
    n = (y * 12 + (m - 1)) + delta
    return n // 12, (n % 12) + 1


def parse_br_date(text: str) -> str | None:
    text = clean(text).lower()
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", text)
    if m:
        d, mo, y = map(int, m.groups())
        try: return date(y, mo, d).isoformat()
        except ValueError: return None
    m = re.search(r"\b(\d{1,2})\s+de\s+([a-zçãéô]+)\s+de\s+(\d{4})\b", text)
    if m:
        d, mn, y = m.groups(); mo = PT_MONTHS.get(mn)
        if mo:
            try: return date(int(y), mo, int(d)).isoformat()
            except ValueError: return None
    return None


def date_near(node) -> str | None:
    candidates = [node.get_text(" ", strip=True)]
    parent = node.parent
    for _ in range(4):
        if not parent: break
        candidates.append(parent.get_text(" ", strip=True)[:900])
        parent = parent.parent
    for text in candidates:
        d = parse_br_date(text)
        if d: return d
    return None


def meaningful_links(page_soup: BeautifulSoup, base_url: str, require_keywords=False):
    """Extrai links editoriais de modo conservador e deduplica por URL."""
    host = urlparse(base_url).netloc.replace("www.", "")
    rows, seen = [], set()
    for a in page_soup.find_all("a", href=True):
        title = clean(a.get_text(" ", strip=True))
        if len(title) < 18 or len(title) > 260: continue
        url = urljoin(base_url, a["href"])
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"): continue
        if host not in parsed.netloc.replace("www.", ""): continue
        low = f"{title} {url}".lower()
        if any(x in low for x in ("facebook", "linkedin", "instagram", "youtube", "whatsapp", "política de", "termos de", "mapa do site")): continue
        if require_keywords and not any(k in low for k in KEYWORDS):
            # pode haver palavra-chave no contêiner do card
            ctx = clean(a.parent.get_text(" ", strip=True) if a.parent else "").lower()
            if not any(k in ctx for k in KEYWORDS): continue
        if url in seen: continue
        seen.add(url)
        summary = ""
        card = a.find_parent(["article", "li", "div"])
        if card:
            whole = clean(card.get_text(" ", strip=True))
            summary = whole.replace(title, "", 1).strip(" -–—|")[:280]
        rows.append({"title":title, "url":url, "date":date_near(a), "summary":summary})
    return rows


def agenda_month_urls(y: int, m: int):
    slug = MONTH_URL[m]
    base = f"https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/{y}/{slug}"
    # Alguns meses históricos aparecem com inicial maiúscula. requests/gov.br tende a redirecionar,
    # mas mantemos fallback explícito.
    return [base, base.rsplit('/',1)[0] + '/' + slug.capitalize()]


def collect_agenda_month(y: int, m: int):
    month_soup = None; used_url = None
    for u in agenda_month_urls(y,m):
        try:
            month_soup=soup(u);used_url=u;break
        except Exception:
            continue
    if month_soup is None:
        raise RuntimeError(f"Agenda não encontrada para {y}-{m:02d}")

    links=[]
    for a in month_soup.find_all("a", href=True):
        href=urljoin(used_url,a["href"])
        mt=re.search(r"/dia-(\d{2})-(\d{2})-(\d{4})(?:/|$)",href)
        if mt and int(mt.group(2))==m and int(mt.group(3))==y:
            links.append(href)
    links=sorted(set(links))

    events=[]
    for day_url in links:
        mt=re.search(r"dia-(\d{2})-(\d{2})-(\d{4})",day_url)
        iso=f"{mt.group(3)}-{mt.group(2)}-{mt.group(1)}"
        try:
            s=soup(day_url)
            table=s.find("table")
            if not table:
                events.append({"date":iso,"group":"Agenda Receita Federal","description":"Vencimentos tributários — consulte o detalhamento na fonte oficial","url":day_url})
                continue
            rows=table.find_all("tr")
            for tr in rows[1:]:
                cells=[clean(c.get_text(" ",strip=True)) for c in tr.find_all(["td","th"])]
                if not cells: continue
                # estrutura oficial: código, grupo, descrição, período, documento, categoria/origem, base legal
                cells += [""] * (7-len(cells))
                code,group,desc,period,document,category,legal=cells[:7]
                if not any((code,group,desc)): continue
                events.append({"date":iso,"code":code,"group":group,"description":desc,"period":period,"document":document,"category":category,"legal_basis":legal,"url":day_url})
        except Exception as exc:
            print(f"[agenda] falha em {day_url}: {exc}", file=sys.stderr)
            events.append({"date":iso,"group":"Agenda Receita Federal","description":"Vencimentos tributários — detalhamento temporariamente indisponível na coleta","url":day_url})
    return {"source":"Receita Federal - Agenda Tributária","source_url":used_url,"events":events}


def collect_agenda():
    current=load_json("agenda.json", {"months":{}})
    months=current.get("months",{})
    today=date.today()
    # mantém histórico já salvo e tenta mês anterior, atual e dois seguintes
    for delta in (-1,0,1,2):
        y,m=month_shift(today.year,today.month,delta)
        key=f"{y}-{m:02d}"
        try:
            payload=collect_agenda_month(y,m)
            if payload["events"] or key not in months:
                months[key]=payload
            print(f"[agenda] {key}: {len(payload['events'])} itens")
        except Exception as exc:
            print(f"[agenda] {key}: {exc}", file=sys.stderr)
    # limita para não crescer indefinidamente: últimos/ próximos 18 meses com dados
    keys=sorted(months.keys())[-18:]
    result={"months":{k:months[k] for k in keys}}
    write_json("agenda.json", result)


def collect_source(name, url, level, kind="update", kind_label="Atualização", require_keywords=True, limit=25):
    s=soup(url)
    links=meaningful_links(s,url,require_keywords=require_keywords)
    items=[]
    for row in links[:limit*3]:
        title=row["title"]
        # evita menus/categorias muito genéricas
        if title.lower() in {"reforma tributária","notícias","tributação","serviços","institucional"}: continue
        items.append({
            "date":row["date"] or date.today().isoformat(),"source":name,"level":level,"kind":kind,
            "kind_label":kind_label,"title":title,"summary":row["summary"],"url":row["url"]
        })
        if len(items)>=limit: break
    return items


def collect_reforma():
    items=[]
    configs=[
        ("Receita Federal","https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/rtc2026","official","update","Reforma Tributária",False,20),
        ("Receita Federal","https://www.gov.br/receitafederal/pt-br/assuntos/noticias/ultimas-noticias","official","update","Notícia oficial",True,20),
        ("CGIBS","https://www.cgibs.gov.br/noticias?classificacao=&ordem=RECENTES&pagina=1&palavraschave=&publicacaodatahorafim=&publicacaodatahoraini=","official","update","Notícia oficial",True,20),
        ("CGIBS","https://www.cgibs.gov.br/atos-conjuntos","official","normative","Ato conjunto",False,15),
        ("CGIBS","https://www.cgibs.gov.br/resolucoes","official","normative","Resolução",False,15),
    ]
    for cfg in configs:
        try:
            got=collect_source(*cfg);items.extend(got);print(f"[reforma] {cfg[0]} {cfg[4]}: {len(got)}")
        except Exception as exc: print(f"[reforma] {cfg[0]}: {exc}",file=sys.stderr)
    # dedupe por URL/título e ordena
    out=[];seen=set()
    for x in items:
        key=x["url"].rstrip("/") or x["title"].lower()
        if key in seen: continue
        seen.add(key);out.append(x)
    out.sort(key=lambda x:(x.get("date") or "",x.get("title") or ""),reverse=True)
    if out: write_json("reforma.json",out[:60])


def collect_radar():
    items=[]
    configs=[
        ("FENACON","https://fenacon.org.br/reforma-tributaria/","institutional","update","Reforma Tributária",False,20),
        ("CFC","https://cfc.org.br/search/reforma%20tributaria","institutional","update","CFC",False,15),
        ("Portal Contábeis","https://www.contabeis.com.br/conteudo/tributario","specialized","update","Tributário",True,25),
    ]
    for cfg in configs:
        try:
            got=collect_source(*cfg);items.extend(got);print(f"[radar] {cfg[0]}: {len(got)}")
        except Exception as exc: print(f"[radar] {cfg[0]}: {exc}",file=sys.stderr)
    out=[];seen=set()
    for x in items:
        key=x["url"].rstrip("/") or x["title"].lower()
        if key in seen: continue
        seen.add(key)
        x["category"]=x.pop("kind_label", "Atualização")
        x.pop("kind",None)
        out.append(x)
    out.sort(key=lambda x:(x.get("date") or "",x.get("title") or ""),reverse=True)
    if out: write_json("radar.json",out[:80])


def collect_meta():
    previous=load_json("meta.json",{"sources":[]})
    previous_status={x.get("name"):x.get("status") for x in previous.get("sources",[])}
    statuses=[]
    for src in SOURCES:
        status="error"
        try:
            r=get(src["url"]);status="ok" if r.status_code<400 else "error"
        except Exception: status=previous_status.get(src["name"],"error")
        statuses.append({**src,"status":status})
    write_json("meta.json",{"updated_at":datetime.now().astimezone().isoformat(timespec="seconds"),"sources":statuses})


def main():
    jobs=[collect_agenda,collect_reforma,collect_radar,collect_meta]
    failures=0
    for job in jobs:
        try: job()
        except Exception as exc:
            failures+=1;print(f"[{job.__name__}] ERRO: {exc}",file=sys.stderr)
    if failures==len(jobs): raise SystemExit(1)

if __name__=="__main__": main()
