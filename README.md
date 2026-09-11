# Radar Fiscal

Painel web estático para acompanhamento de **agenda tributária federal**, **Reforma Tributária** e **radar contábil**, hospedado no GitHub Pages e atualizado automaticamente por GitHub Actions.

## O que o painel monitora

- **Agenda Tributária Federal:** coleta a Agenda Tributária da Receita Federal por mês e abre os dias com vencimentos para registrar código, tributo, descrição, período de apuração, documento, origem/escrituração e base legal.
- **Reforma Tributária:** prioriza Receita Federal e Comitê Gestor do IBS (CGIBS), incluindo notícias e páginas normativas.
- **Radar contábil:** complementa a leitura com FENACON, Conselho Federal de Contabilidade e Portal Contábeis.
- **Fontes & status:** mostra a hierarquia de confiança e o estado da última coleta.

## Arquitetura

O frontend (`index.html`, `styles.css`, `app.js`) lê apenas arquivos JSON locais em `data/`. Isso evita CORS no navegador. O script `scripts/fetch_data.py` roda no GitHub Actions, consulta as fontes e grava novos JSONs no próprio repositório.

### Atualização automática

`.github/workflows/update-data.yml` roda:

- segunda a sexta: **09h, 13h e 18h** (horário de Brasília, considerando UTC-3);
- sábado e domingo: uma coleta diária;
- manualmente pelo botão **Run workflow** no GitHub Actions.

A coleta é tolerante a falhas: se uma fonte mudar o HTML, as demais continuam sendo processadas e o painel preserva o último arquivo válido quando possível.

## Publicação no GitHub Pages

O arquivo `.github/workflows/deploy-pages.yml` publica o site sempre que houver `push` na branch `main`.

No repositório, faça uma única configuração:

1. `Settings` → `Pages`.
2. Em **Build and deployment**, escolha **GitHub Actions** como Source.
3. Abra `Actions` e execute **Publicar GitHub Pages** (ou faça um novo push).

A URL esperada para este repositório é:

`https://cassiotoledo425.github.io/radarfiscal/`

## Rodar localmente

```bash
python -m http.server 8000
```

Abra `http://localhost:8000`.

Para testar a coleta:

```bash
pip install -r requirements.txt
python scripts/fetch_data.py
```

## Critério editorial

1. **Oficial:** Receita Federal, CGIBS e canais governamentais.
2. **Institucional:** entidades profissionais e representativas.
3. **Especializada:** portais contábeis usados como radar de temas e repercussões.

O painel é informativo. Prazos, enquadramentos e efeitos jurídicos devem ser confirmados na fonte oficial para cada situação concreta.
