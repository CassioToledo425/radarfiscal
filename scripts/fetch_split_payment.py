#!/usr/bin/env python3
"""Atualiza automaticamente a seção Split Payment a partir da página oficial do CGIBS."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
TARGET = DATA / "split_payment.json"
URL = "https://www.cgibs.gov.br/split-payment"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "RadarFiscalGitHub/1.0 (+https://github.com/CassioToledo425/radarfiscal)",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
})
TIMEOUT = 25

VERSION_RE = re.compile(r"v\s*(\d+)\s+(\d+)\s+(\d+)", re.I)

def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()

def version_from(text):
    m = VERSION_RE.search(clean(text))
    return ".".join(m.groups()) if m else None

def load():
    try:
        return json.loads(TARGET.read_text(encoding="utf-8"))
    except Exception:
        return {}

def save(payload):
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def collect_documents(soup):
    docs = []
    seen = set()
    labels = (
        "Manual de Integração",
        "Manual de Operações",
        "Manual de Tempos",
        "Manual de Segurança",
        "Manual de Redes",
        "Manual de Habilitação de Participantes",
        "OpenAPI",
    )
    for a in soup.find_all("a", href=True):
        title = clean(a.get_text(" ", strip=True))
        if not title or "versões anteriores" in title.lower():
            continue
        name = next((x for x in labels if x.lower() in title.lower()), None)
        if not name:
            continue
        version = version_from(title)
        if not version:
            continue
        href = urljoin(URL, a["href"])
        key = (name, version)
        if key in seen:
            continue
        seen.add(key)
        docs.append({
            "name": name,
            "version": "v" + version,
            "status": "Atual",
            "url": href,
        })
    # A página pode listar o mesmo documento mais de uma vez; mantém a primeira ocorrência.
    order = {name: i for i, name in enumerate(labels)}
    docs.sort(key=lambda x: order.get(x["name"], 99))
    return docs

def main():
    response = SESSION.get(URL, timeout=TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    payload = load()
    previous = {(x.get("name"), x.get("version")) for x in payload.get("documents", [])}

    documents = collect_documents(soup)
    if not documents:
        raise RuntimeError("A página oficial do CGIBS não retornou documentos versionados.")

    payload["documents"] = documents
    payload["source_url"] = URL
    payload["updated_at"] = date.today().isoformat()
    payload["auto_status"] = "ok"

    new_versions = [x for x in documents if (x["name"], x["version"]) not in previous]
    if new_versions:
        history = payload.get("auto_updates", [])
        for item in new_versions:
            history.insert(0, {
                "date": date.today().isoformat(),
                "title": f"{item['name']} atualizado para {item['version']}",
                "summary": "Nova versão detectada automaticamente na página oficial do Split Payment do CGIBS.",
                "url": item["url"],
            })
        payload["auto_updates"] = history[:20]

    save(payload)
    print(f"[split] documentos atuais: {len(documents)}")
    if new_versions:
        print("[split] novas versões: " + ", ".join(f"{x['name']} {x['version']}" for x in new_versions))
    else:
        print("[split] nenhuma nova versão detectada.")

if __name__ == "__main__":
    main()
