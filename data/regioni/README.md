# Tabelle di altre regioni

Ogni file `*.json` in questa cartella diventa una regione selezionabile nel sito, dopo `python scripts/build_all.py` (o solo `python scripts/build_web.py`).

Il modo più semplice per crearne uno: nel sito apri **Aggiungi la tabella codici di un'altra regione**, carica l'Excel/CSV della regione, controlla le colonne e premi **Scarica JSON**. Copia qui il file scaricato.

Formato:

```json
{
 "meta": {
  "regione": "Veneto",
  "sigla": "VEN",
  "fonte": "Open data Regione Veneto, catalogo 2026",
  "generato_il": "2026-10-24"
 },
 "voci": [
  {"codice_regionale": "V89005", "descrizione": "ELETTROCARDIOGRAMMA DINAMICO (Holter)", "codice_nazionale": "89.50", "branca": "Cardiologia", "prescrivibile": true}
 ]
}
```

- `sigla`: 2–4 lettere, unica. `LOM` e `TOS` sono riservate.
- `codice_nazionale`: codice del nomenclatore nazionale con i punti (`89.50`, `88.95.B`). È il ponte verso le altre regioni.
- `descrizione`, `branca`, `prescrivibile` sono facoltativi.
- Indica sempre la fonte e rispetta la sua licenza (vedi README principale).
