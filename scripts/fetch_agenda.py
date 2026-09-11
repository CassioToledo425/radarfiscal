#!/usr/bin/env python3
"""Coleta a Agenda Tributária federal da Receita Federal.

A página diária da Receita separa alguns registros de tributos em duas linhas HTML:
1) código/grupo/descrição/período; 2) documento/origem/base legal.
Este coletor recompõe o registro e também captura as tabelas de obrigações acessórias.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

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
MONTHS = {
    1: "janeiro", 2: "fevereiro", 3: "marco", 4: "abril", 5: "maio", 6: "junho",
    7: "julho", 8: "agosto", 9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
}


def clean(value) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def get_soup(url: str) -> BeautifulSoup:
    response = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def load_existing():
    path = DATA / "agenda.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"months": {}}


def write(payload):
    path = DATA / "agenda.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def shift_month(y: int, m: int, delta: int):
    n = y * 12 + (m - 1) + delta
    return n // 12, n % 12 + 1


def month_page(y: int, m: int):
    slug = MONTHS[m]
    candidates = [
        f"https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/{y}/{slug}",
        f"https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/{y}/{slug.capitalize()}",
    ]
    for url in candidates:
        try:
            return url, get_soup(url)
        except Exception:
            pass
    raise RuntimeError(f"Agenda mensal indisponível: {y}-{m:02d}")


def table_cells(tr):
    return [clean(c.get_text(" ", strip=True)) for c in tr.find_all(["td", "th"])]


def is_payment_header(cells):
    text = " ".join(cells).lower()
    return any(term in text for term in (
        "código de receita", "codigo de receita", "grupo de tributo",
        "documento arrecadação", "documento arrecadacao",
        "categoria da declaração", "categoria da declaracao", "fundamentação legal",
    ))


def is_accessory_header(cells):
    text = " ".join(cells).lower()
    return any(term in text for term in (
        "declarações, demonstrativos", "declaracoes, demonstrativos",
        "período de referência", "periodo de referencia", "base normativa",
    ))


def accessory_label(description: str):
    first = re.split(r"\s+[–—-]\s+", clean(description), maxsplit=1)[0]
    if first and len(first) <= 52:
        return first
    return "Obrigação acessória"


def parse_payment_table(table, iso: str, url: str):
    events = []
    pending = None
    for tr in table.find_all("tr"):
        cells = table_cells(tr)
        if not cells or is_payment_header(cells):
            continue

        if len(cells) >= 7:
            code, group, desc, period, document, category, legal = (cells + [""] * 7)[:7]
            if code and desc:
                events.append({
                    "date": iso, "kind": "payment", "code": code,
                    "group": group or "Tributo federal", "description": desc,
                    "period": period, "document": document, "category": category,
                    "legal_basis": legal, "url": url,
                })
            pending = None
            continue

        # Primeira metade do registro: código, grupo, descrição, período.
        if len(cells) >= 4:
            if pending:
                code, group, desc, period = pending
                if code and desc:
                    events.append({
                        "date": iso, "kind": "payment", "code": code,
                        "group": group or "Tributo federal", "description": desc,
                        "period": period, "document": "", "category": "",
                        "legal_basis": "", "url": url,
                    })
            pending = cells[:4]
            continue

        # Segunda metade: documento, origem da escrituração, base legal.
        if len(cells) >= 3 and pending:
            code, group, desc, period = pending
            document, category, legal = cells[:3]
            events.append({
                "date": iso, "kind": "payment", "code": code,
                "group": group or "Tributo federal", "description": desc,
                "period": period, "document": document, "category": category,
                "legal_basis": legal, "url": url,
            })
            pending = None

    if pending:
        code, group, desc, period = pending
        if code and desc:
            events.append({
                "date": iso, "kind": "payment", "code": code,
                "group": group or "Tributo federal", "description": desc,
                "period": period, "document": "", "category": "",
                "legal_basis": "", "url": url,
            })
    return events


def parse_accessory_table(table, iso: str, url: str):
    events = []
    for tr in table.find_all("tr"):
        cells = table_cells(tr)
        if not cells or is_accessory_header(cells):
            continue
        cells += [""] * (4 - len(cells))
        interested, description, period, legal = cells[:4]
        if not description:
            continue
        events.append({
            "date": iso,
            "kind": "accessory",
            "group": accessory_label(description),
            "description": description,
            "period": period,
            "document": "Obrigação acessória",
            "category": f"Interessado: {interested}" if interested else "Declaração / demonstrativo",
            "legal_basis": legal,
            "url": url,
        })
    return events


def parse_day(url: str, iso: str):
    page = get_soup(url)
    events = []
    for table in page.find_all("table"):
        text = clean(table.get_text(" ", strip=True)).lower()
        if "código de receita" in text or "codigo de receita" in text or "grupo de tributo" in text:
            events.extend(parse_payment_table(table, iso, url))
        elif "declarações, demonstrativos" in text or "declaracoes, demonstrativos" in text:
            events.extend(parse_accessory_table(table, iso, url))
    return events


def collect_month(y: int, m: int):
    source_url, page = month_page(y, m)
    daily = []
    for a in page.find_all("a", href=True):
        href = urljoin(source_url, a["href"])
        match = re.search(r"/dia-(\d{2})-(\d{2})-(\d{4})(?:/|$)", href)
        if match and int(match.group(2)) == m and int(match.group(3)) == y:
            daily.append(href)
    daily = sorted(set(daily))

    events = []
    for url in daily:
        match = re.search(r"dia-(\d{2})-(\d{2})-(\d{4})", url)
        iso = f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
        try:
            day_events = parse_day(url, iso)
            if day_events:
                events.extend(day_events)
            else:
                events.append({
                    "date": iso, "kind": "unknown", "group": "Agenda Receita Federal",
                    "description": "Item da agenda oficial — consulte os detalhes na fonte.", "url": url,
                })
        except Exception as exc:
            print(f"[agenda] {iso}: {exc}", file=sys.stderr)
            events.append({
                "date": iso, "kind": "unknown", "group": "Agenda Receita Federal",
                "description": "Não foi possível detalhar este dia; consulte a fonte oficial.", "url": url,
            })

    # Remove duplicatas exatas sem perder tributos com mesmo código em descrições diferentes.
    unique, seen = [], set()
    for event in events:
        key = (
            event.get("date"), event.get("kind"), event.get("code"), event.get("group"),
            event.get("description"), event.get("period"), event.get("document"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(event)

    return {
        "source": "Receita Federal - Agenda Tributária",
        "source_url": source_url,
        "events": unique,
    }


def main():
    existing = load_existing()
    months = existing.get("months", {})
    today = date.today()

    for delta in (-1, 0, 1, 2):
        y, m = shift_month(today.year, today.month, delta)
        key = f"{y}-{m:02d}"
        try:
            result = collect_month(y, m)
            # Não substitui conteúdo válido por mês ainda não publicado/vazio.
            if result["events"]:
                months[key] = result
            elif key not in months:
                print(f"[agenda] {key}: mês ainda sem agenda publicada", file=sys.stderr)
            print(f"[agenda] {key}: {len(result['events'])} registros consolidados")
        except Exception as exc:
            print(f"[agenda] {key}: {exc}", file=sys.stderr)

    # Remove meses futuros vazios que possam ter sido criados por versões antigas do coletor.
    months = {k: v for k, v in months.items() if (v.get("events") or [])}
    write({"months": dict(sorted(months.items())[-18:])})


if __name__ == "__main__":
    main()
