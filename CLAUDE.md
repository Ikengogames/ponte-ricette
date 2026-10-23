# Ponte Codici Ricetta — note per Claude

Strumento che converte i codici delle prestazioni di specialistica ambulatoriale tra regioni (oggi Lombardia ⇄ Toscana) passando dal codice del nomenclatore nazionale. Nato da un problema reale: ricette lombarde con codici che il CUP toscano non riconosce. Obiettivo finale: segnalare il problema alle sanità di Toscana e Lombardia con uno strumento funzionante e dati concreti.

Lingua del progetto: italiano (UI, commenti, commit).

## Comandi

- Setup (Windows): `py -m venv .venv`, `.venv\Scripts\Activate.ps1`, `pip install -r requirements.txt`
- Rigenera tutto: `py scripts\build_all.py` (fonti → `data/json` → `web/data/webdata.json` + `dist/` + report)
- Sito locale: `py -m http.server 8000 -d web` → http://localhost:8000 (serve un server: app.js usa fetch)

## Architettura

- `data/raw/` fonti originali, non modificare a mano. Nuova versione di un catalogo = sostituire il file mantenendo il nome.
- `scripts/common.py` percorsi e regex condivise. Codice nazionale: `^\d{2}\.[0-9][0-9A-Z]?(\.[0-9A-Z]{1,2})?$` (es. 89.7, 89.7A.3, 88.95.B); genetica `G1.01`.
- `scripts/build_*.py` un modulo per fonte, ognuno con `build()`; `build_all.py` li orchestra.
- `web/app.js` logica: `resolve()` (codice regionale → nazionale), `targets()` (nazionale → voci dell'altra regione), `similar()` (fallback per descrizione). I dati arrivano da `#data` inline (pagina unica) o da `data/webdata.json`.
- Regioni: `REG` in app.js. Lombardia ha logica propria (SISS); Toscana e tutte le altre sono tabelle generiche `[codice, descrizione, nazionale, branca, prescrivibile]`. Le altre arrivano da `data/regioni/*.json` (→ `R` in webdata, via `build_web.py`) o dal caricamento Excel/CSV/JSON nella pagina (salvate in `localStorage`, chiave `ponte.regioni.v1`).
- Vincolo: sito statico, niente database né backend (deve girare su qualsiasi hosting). Excel letto con SheetJS caricato da CDN solo al bisogno. Guida per chi installa: `INSTALLAZIONE.md`.
- `dist/ponte-codici-ricetta.html` è generato da `build_web.py` inlinando CSS, JS e dati: non modificarlo a mano.

## Cose scoperte sui dati (importanti)

- Toscana: il CSV ha già `COD_PRESTAZIONE_NOMENCLATORE` (codice nazionale nuovo). Nessuna voce obsoleta, quindi nessun ponte per codici vecchi.
- Lombardia, codice SISS in ricetta = prefisso branca 2 cifre + codice nazionale senza punti + eventuale `.suffisso` (`088950` → 89.50). Regola valida su ~97% dell'Excel SISS.
- Eccezione: visite di controllo (`088901.08` → 89.01.3, non 89.01). Fonte ufficiale: tabella telemedicina della DGR 3630 (pag. 129-130), in `nomenclatore_lombardia.json` → `telemedicina_codici_prescrizione`.
- L'Excel SISS open data (dati.lombardia.it, dataset 7ugz-vcug) è un'istantanea mista: ~1.300 codici puntano al vecchio nomenclatore 1996 (es. 88.94.1). Non esiste una versione pubblica più recente: va chiesta ad ARIA S.p.A. o esportata dal software di un MMG.
- Copertura attuale: nomenclatore Lombardia 2024 → Toscana = 1.280 uno-a-uno, 687 con più alternative, 85 senza corrispondenza.

## Stato e prossimi passi

- [x] Inizializzare Git in questa cartella e fare il primo commit (attribuzione: Ikengogames)
- [x] Repository GitHub **pubblico** `Ikengogames/ponte-ricette`, licenza CC0 1.0 (dominio pubblico, completamente open source: scelta dell'autore, va mantenuta)
- [ ] Testare con codici di ricette reali che hanno dato problemi
- [ ] Ottenere il catalogo SISS aggiornato al nuovo nomenclatore
- [ ] Preparare la segnalazione alle Regioni (esempi concreti + report di copertura)
- [ ] Eventuali altre regioni

Esiste anche una versione pubblicata come artifact su claude.ai ("Ponte Codici Ricetta"), costruita dallo stesso codice.
