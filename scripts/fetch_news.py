#!/usr/bin/env python3
"""Coleta notícias e atos relevantes para o Radar Fiscal.

O filtro usa título + URL, evitando menus e links institucionais genéricos que podem
aparecer próximos das palavras "IBS", "CBS" ou "Reforma Tributária" no HTML.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "RadarFiscalGitHub/1.2 (+https://github.com/CassioToledo425/radarfiscal)",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
})
TIMEOUT = 25

PT_MONTHS = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5,
    "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
    "novembro": 11, "dezembro": 12,
}
REFORM_KEYWORDS = (
    "reforma tribut", "ibs", "cbs", "dere", "split payment", "nfs-e", "nota fiscal",
    "documentos fiscais", "simples nacional", "crédito tribut", "credito tribut",
    "lc 214", "lei complementar 214", "cashback", "imposto seletivo", "tributação do consumo",
    "tributacao do consumo",
)
RADAR_KEYWORDS = REFORM_KEYWORDS + (
    "dctfweb", "efd-reinf", "reinf", "e-social", "esocial", "dirbi", "darf", "irpj", "irrf",
    "pis", "cofins", "ipi", "tributário", "tributario", "fiscal", "obrigação acessória",
    "obrigacao acessoria", "sped", "receita federal",
)

SOURCES = [
    {"name": "Receita Federal — Agenda Tributária", "level": "official",
     "url": "https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria",
     "description": "Prazos, vencimentos e obrigações acessórias federais, com detalhamento por dia."},
    {"name": "Receita Federal — Reforma Tributária", "level": "official",
     "url": "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/noticias",
     "description": "Notícias e orientações oficiais sobre a Reforma Tributária do Consumo."},
    {"name": "CGIBS — Comitê Gestor do IBS", "level": "official",
     "url": "https://www.cgibs.gov.br/",
     "description": "Notícias, resoluções, atos conjuntos e materiais oficiais do IBS."},
    {"name": "FENACON", "level": "institutional",
     "url": "https://fenacon.org.br/reforma-tributaria/",
     "description": "Radar institucional do setor de serviços contábeis e empresariais."},
    {"name": "Conselho Federal de Contabilidade", "level": "institutional",
     "url": "https://cfc.org.br/search/reforma%20tributaria",
     "description": "Notícias e conteúdos técnicos/institucionais para profissionais contábeis."},
    {"name": "Portal Contábeis", "level": "specialized",
     "url": "https://www.contabeis.com.br/conteudo/tributario",
     "description": "Cobertura jornalística especializada em tributação e contabilidade."},
]


def clean(value) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def get(url: str):
    response = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
    response.raise_for_status()
    return response


def get_soup(url: str):
    return BeautifulSoup(get(url).text, "html.parser")


def save(name: str, payload):
    (DATA / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_date(text: str):
    text = clean(text).lower()
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", text)
    if m:
        d, mo, y = map(int, m.groups())
        try:
            return date(y, mo, d).isoformat()
        except ValueError:
            pass
    m = re.search(r"\b(\d{1,2})\s+de\s+([a-zçãéô]+)\s+de\s+(\d{4})\b", text)
    if m:
        d, month_name, y = m.groups()
        mo = PT_MONTHS.get(month_name)
        if mo:
            try:
                return date(int(y), mo, int(d)).isoformat()
            except ValueError:
                pass
    return None


def context_for(anchor):
    node = anchor.find_parent(["article", "li"])
    if node:
        return clean(node.get_text(" ", strip=True))
    node = anchor.parent
    best = ""
    for _ in range(3):
        if not node:
            break
        text = clean(node.get_text(" ", strip=True))
        if len(text) <= 900:
            best = text
        node = node.parent
    return best


def relevant(text: str, keywords):
    low = clean(text).lower()
    return any(k in low for k in keywords)


def extract_links(url: str, source: str, level: str, keywords, url_filter=None, limit=25):
    page = get_soup(url)
    base_host = urlparse(url).netloc.replace("www.", "")
    results, seen = [], set()

    for a in page.find_all("a", href=True):
        title = clean(a.get_text(" ", strip=True))
        if len(title) < 20 or len(title) > 260:
            continue
        href = urljoin(url, a["href"])
        parsed = urlparse(href)
        if parsed.scheme not in ("http", "https"):
            continue
        if base_host not in parsed.netloc.replace("www.", ""):
            continue
        if "/view" in parsed.path or href.lower().endswith((".jpg", ".jpeg", ".png", ".gif")):
            continue
        if url_filter and not url_filter(href):
            continue
        # Título/URL precisam ser relevantes por si mesmos. Não usa texto de menus vizinhos.
        if not relevant(f"{title} {href}", keywords):
            continue
        if href.rstrip("/") in seen:
            continue
        seen.add(href.rstrip("/"))

        context = context_for(a)
        summary = context.replace(title, "", 1).strip(" -–—|")
        # remove trechos comuns de metadados sem tentar reescrever conteúdo editorial
        summary = re.sub(r"\b(publicado|publicação)\s+\d{1,2}/\d{1,2}/\d{4}[^.]*", "", summary, flags=re.I)
        summary = clean(summary)[:320]
        results.append({
            "date": parse_date(context),
            "source": source,
            "level": level,
            "kind": "update",
            "kind_label": "Atualização",
            "title": title,
            "summary": summary,
            "url": href,
        })
        if len(results) >= limit:
            break
    return results


def receita_article(url: str):
    path = urlparse(url).path.lower().rstrip("/")
    # exige artigo individual: /assuntos/noticias/AAAA/mes/slug
    return bool(re.search(r"/assuntos/noticias/20\d{2}/[^/]+/[^/]+$", path))


def cgibs_article(url: str):
    path = urlparse(url).path.strip("/").lower()
    blocked = {
        "", "noticias", "atos-conjuntos", "resolucoes", "portarias", "regulamentos",
        "portal-de-servicos", "transparencia", "institucional", "legislacao", "contato",
    }
    return path not in blocked and "/" not in path and not path.startswith("upload")


def collect_normative(index_url: str, kind_label: str, prefix_regex: str, limit=25):
    page = get_soup(index_url)
    out, seen = [], set()
    for heading in page.find_all(["h2", "h3", "h4", "h5"]):
        title = clean(heading.get_text(" ", strip=True))
        if not re.search(prefix_regex, title, flags=re.I):
            continue
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        link = heading.find_next("a", href=True)
        href = urljoin(index_url, link["href"]) if link else index_url
        out.append({
            "date": parse_date(title) or parse_date(clean(heading.parent.get_text(" ", strip=True))),
            "source": "CGIBS",
            "level": "official",
            "kind": "normative",
            "kind_label": kind_label,
            "title": title,
            "summary": "Publicação normativa oficial do Comitê Gestor do IBS.",
            "url": href,
        })
        if len(out) >= limit:
            break
    return out


def clean_sort(items, limit):
    out, seen = [], set()
    for item in items:
        title = clean(item.get("title"))
        url = clean(item.get("url"))
        if not title or not url:
            continue
        key = url.rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        item["title"] = title
        out.append(item)
    # Com data desconhecida, o item fica depois dos datados em vez de fingir que é de hoje.
    out.sort(key=lambda x: (x.get("date") or "0000-00-00", x.get("title") or ""), reverse=True)
    return out[:limit]


def fallback_official():
    return [
        {
            "date": "2026-09-09", "source": "Receita Federal", "level": "official",
            "kind": "update", "kind_label": "DeRE",
            "title": "DeRE - Receita Federal publica versão 1.2.0 da documentação técnica da DeRE",
            "summary": "Pacote técnico inclui leiautes dos eventos transacionais, controle de deduções e reabertura de competência.",
            "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/dere-receita-federal-publica-versao-1-2-0-da-documentacao-tecnica-da-dere/",
        },
        {
            "date": "2026-09-01", "source": "Receita Federal", "level": "official",
            "kind": "update", "kind_label": "Simples Nacional / IBS / CBS",
            "title": "Receita Federal alerta sobre opção pelo Simples Nacional e modelo de recolhimento do IBS e da CBS em 2027",
            "summary": "Empresas têm até 30 de setembro para solicitar ingresso no Simples Nacional e definir a forma de recolhimento dos novos tributos.",
            "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/receita-federal-alerta-comeca-hoje-o-prazo-para-opcao-pelo-simples-nacional-e-para-a-escolha-do-modelo-de-recolhimento-do-ibs-e-da-cbs-em-2027/",
        },
        {
            "date": "2026-08-26", "source": "CGIBS", "level": "official",
            "kind": "update", "kind_label": "DeRE",
            "title": "CGIBS e RFB esclarecem os prazos de cumprimento das obrigações relativas à DeRE",
            "summary": "Esclarecimentos sobre o marco inicial de recepção e o cronograma dos eventos da DeRE.",
            "url": "https://cgibs.gov.br/cgibs-e-rfb-esclarecem-prazos-de-cumprimento-das-obrigacoes-relativas-a-dere-estabelecidos-pelo-ato-conjunto-n-4",
        },
        {
            "date": "2026-08-14", "source": "CGIBS", "level": "official",
            "kind": "update", "kind_label": "Conformidade tributária",
            "title": "Receita Federal e Comitê Gestor do IBS regulamentam Programa Nacional de Conformidade Tributária",
            "summary": "Programa apoia a adaptação dos contribuintes às novas obrigações relacionadas à emissão de documentos fiscais.",
            "url": "https://www.cgibs.gov.br/receita-federal-e-cgibs-regulamentam-programa-nacional-de-conformidade-tributaria-para-apoiar-adaptacao-a-reforma-tributaria",
        },
        {
            "date": "2026-08-01", "source": "CGIBS", "level": "official",
            "kind": "update", "kind_label": "Documentos fiscais",
            "title": "RFB e Comitê Gestor do IBS publicam Cronograma de Implementação dos Documentos Fiscais Eletrônicos",
            "summary": "Ato divulga cronograma de obrigatoriedade de emissão dos documentos fiscais e publicação dos leiautes.",
            "url": "https://www.cgibs.gov.br/receita-federal-e-comite-gestor-do-ibs-publicam-o-cronograma-de-implementacao-dos-documentos-fiscais-eletronicos",
        },
    ]


def collect_reforma():
    items = []
    jobs = [
        ("https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/noticias",
         "Receita Federal", "official", REFORM_KEYWORDS, receita_article, 25),
        ("https://www.gov.br/receitafederal/pt-br/assuntos/noticias/ultimas-noticias",
         "Receita Federal", "official", REFORM_KEYWORDS, receita_article, 25),
        ("https://www.cgibs.gov.br/noticias?classificacao=&ordem=RECENTES&pagina=1&palavraschave=&publicacaodatahorafim=&publicacaodatahoraini=",
         "CGIBS", "official", REFORM_KEYWORDS, cgibs_article, 25),
    ]
    for args in jobs:
        try:
            got = extract_links(*args)
            print(f"[reforma] {args[1]}: {len(got)} notícias")
            items.extend(got)
        except Exception as exc:
            print(f"[reforma] {args[1]}: {exc}", file=sys.stderr)

    try:
        items.extend(collect_normative("https://www.cgibs.gov.br/atos-conjuntos", "Ato conjunto", r"(?:ATO|PORTARIA)\s+CONJUNT"))
    except Exception as exc:
        print(f"[reforma] atos conjuntos: {exc}", file=sys.stderr)
    try:
        items.extend(collect_normative("https://www.cgibs.gov.br/resolucoes", "Resolução", r"RESOLUÇÃO\s+CGIBS"))
    except Exception as exc:
        print(f"[reforma] resoluções: {exc}", file=sys.stderr)

    items.extend(fallback_official())
    out = clean_sort(items, 60)
    save("reforma.json", out)
    print(f"[reforma] total limpo: {len(out)}")


def collect_radar():
    items = []
    jobs = [
        ("https://fenacon.org.br/reforma-tributaria/", "FENACON", "institutional", RADAR_KEYWORDS, None, 25),
        ("https://cfc.org.br/search/reforma%20tributaria", "CFC", "institutional", RADAR_KEYWORDS, None, 20),
        ("https://www.contabeis.com.br/conteudo/tributario", "Portal Contábeis", "specialized", RADAR_KEYWORDS, None, 30),
    ]
    for args in jobs:
        try:
            got = extract_links(*args)
            for item in got:
                item["category"] = "Radar fiscal"
                item.pop("kind_label", None)
            print(f"[radar] {args[1]}: {len(got)} notícias")
            items.extend(got)
        except Exception as exc:
            print(f"[radar] {args[1]}: {exc}", file=sys.stderr)

    out = clean_sort(items, 80)
    save("radar.json", out)
    print(f"[radar] total limpo: {len(out)}")


def collect_meta():
    statuses = []
    for src in SOURCES:
        try:
            response = get(src["url"])
            status = "ok" if response.status_code < 400 else "error"
        except Exception:
            status = "error"
        statuses.append({**src, "status": status})
    save("meta.json", {
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "sources": statuses,
    })


def main():
    failures = 0
    for job in (collect_reforma, collect_radar, collect_meta):
        try:
            job()
        except Exception as exc:
            failures += 1
            print(f"[{job.__name__}] ERRO: {exc}", file=sys.stderr)
    if failures == 3:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
