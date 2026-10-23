# Ponte Codici Ricetta

Strumento per trovare la corrispondenza tra i codici delle prestazioni di specialistica ambulatoriale di regioni diverse (per ora **Lombardia ⇄ Toscana**).

Il medico scrive sulla ricetta il codice del catalogo della *sua* regione; se il paziente prenota in un'altra regione, il CUP usa un catalogo diverso. Il collegamento passa dal **codice del nomenclatore nazionale**, che ogni catalogo regionale riporta.

```
codice regionale (es. Lombardia 088950)
        → codice nazionale (89.50, Holter)
        → codici dell'altra regione (Toscana 1601, B89005, B89006 …)
```

## Struttura

```
data/
  raw/            fonti originali (PDF, CSV, Excel) — non modificarle a mano
  json/           JSON normalizzati generati dagli script
scripts/          conversione fonti → JSON → dati del sito
web/              sito: index.html, style.css, app.js, data/webdata.json
dist/             pagina unica con tutto incluso (da pubblicare o inviare)
```

## Requisiti

- Python 3.10 o superiore
- Le librerie in `requirements.txt`

Su Windows (PowerShell), dalla cartella del progetto:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Rigenerare i dati

```powershell
py scripts\build_all.py
```

Legge `data/raw`, scrive i JSON in `data/json`, aggiorna `web/data/webdata.json` e `dist/ponte-codici-ricetta.html`, poi stampa un report di copertura.

Quando esce una nuova versione di un catalogo, sostituisci il file in `data/raw` mantenendo lo stesso nome e rilancia lo script.

## Avviare il sito in locale

Il sito carica i dati con `fetch`, quindi va aperto tramite un piccolo server (il doppio clic su `index.html` non basta):

```powershell
py -m http.server 8000 -d web
```

Poi apri <http://localhost:8000>.

`dist/ponte-codici-ricetta.html` invece contiene già tutto e si apre anche con doppio clic.

## Le fonti

| File in `data/raw` | Contenuto | Origine |
|---|---|---|
| `nomenclatore_nazionale_allegato4.pdf` | Nomenclatore nazionale, ~2.100 prestazioni | Allegato 4 DPCM 12/01/2017 aggiornato |
| `catalogo_toscana.csv` | Catalogo prescrivibile Toscana, ~5.500 voci, con codice nazionale | [OpenData Toscana](https://dati.toscana.it/dataset/rt-prestazioni-specialistica) (CC BY) |
| `nomenclatore_lombardia_dgr3630_2024.pdf` | Nomenclatore tariffario Lombardia, in vigore dal 30/12/2024 | DGR XII/3630 del 16/12/2024 |
| `transcodifica_codici_siss_lombardia.xlsx` | Codici SISS usati in ricetta in Lombardia | [Open Data Lombardia](https://www.dati.lombardia.it/Sanit-/Transcodifica-Codici-prestazioni/7ugz-vcug) |

## Cose da sapere sui codici lombardi

- Il codice SISS in ricetta è di norma: **prefisso di branca (2 cifre) + codice nazionale senza punti + eventuale suffisso**. Esempio: `088950` → 89.50.
- Le **visite di controllo** fanno eccezione (`088901.08` → 89.01.3, visita cardiologica di controllo): per queste vale la tabella ufficiale della DGR 3630, estratta in `nomenclatore_lombardia.json` → `telemedicina_codici_prescrizione`.
- L'Excel SISS pubblico è un'istantanea parzialmente ferma al **vecchio nomenclatore del 1996**: alcuni codici puntano a codici nazionali non più in vigore. Il sito lo segnala e propone voci simili per descrizione, da verificare.

## Limiti

Strumento indicativo: le corrispondenze derivano dai cataloghi pubblici e possono essere incomplete o superate. Prima di prenotare, confermare il codice con il CUP o con il medico prescrittore.

## Licenza: dominio pubblico, completamente open source

Questo progetto è **di dominio pubblico** e **completamente open source**, rilasciato con [CC0 1.0 Universal](LICENSE).

Puoi usarlo, copiarlo, modificarlo, ridistribuirlo e integrarlo in altri strumenti, anche commerciali o della pubblica amministrazione, senza chiedere permesso e senza obbligo di citazione. Regioni, ASL, CUP, sviluppatori e cittadini sono invitati a riprenderlo e migliorarlo.

CC0 vale per il codice (script, sito) e per i dati elaborati da questo progetto. I file in `data/raw` sono atti e dati pubblici di terzi e restano soggetti alle condizioni della loro fonte (vedi la tabella [Le fonti](#le-fonti)): ad esempio il catalogo toscano è CC BY, quindi chi lo ridistribuisce deve citare Regione Toscana.

Contributi benvenuti: segnalazioni di codici non convertiti, cataloghi di altre regioni, correzioni. Apri una issue o una pull request.

## Idee per i prossimi passi

- Aggiungere altre regioni (serve il loro catalogo con il codice nazionale).
- Ottenere da ARIA S.p.A. il catalogo SISS aggiornato al nuovo nomenclatore.
- Raccogliere esempi reali di ricette non convertibili, da allegare alla segnalazione alle Regioni.
