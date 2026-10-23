# Installare Ponte Codici Ricetta sul proprio server

Guida breve per chi vuole pubblicare lo strumento su un proprio sito (ASL, associazione, studio medico, privato).

## In breve

Ponte Codici Ricetta è un **sito statico**: solo file HTML, CSS, JavaScript e JSON.

- **Nessun database**, nessun PHP/Node/Python sul server, nessun account da gestire.
- Qualsiasi hosting che serve file va bene: Apache, nginx, IIS, hosting condiviso via FTP, GitHub Pages, Netlify, Cloudflare Pages.
- Le tabelle che gli utenti caricano dalla pagina restano **nel loro browser** (`localStorage`): non arrivano al server e non serve spazio per salvarle.

Python serve solo sul tuo computer, e solo se vuoi rigenerare i dati dalle fonti.

## Opzione 1 – Un solo file (la più semplice)

1. Prendi `dist/ponte-codici-ricetta.html` dal repository: contiene già pagina, stile, codice e dati.
2. Rinominalo `index.html` (facoltativo) e caricalo sul server, per esempio in `/ponte/`.
3. Apri `https://tuosito.it/ponte/`. Fatto.

## Opzione 2 – Cartella `web/`

Carica sul server il contenuto della cartella `web/` così com'è:

```
index.html
style.css
app.js
data/webdata.json
```

È equivalente all'opzione 1, ma i dati restano in un file separato: per aggiornarli basta sostituire `data/webdata.json`.

## Esempi di configurazione

**Apache / hosting condiviso**: non serve configurazione, carica i file via FTP.

**nginx**:

```nginx
server {
    listen 443 ssl;
    server_name ponte.example.it;
    root /var/www/ponte;          # contenuto di web/ oppure il file singolo come index.html
    index index.html;

    gzip on;                      # i dati passano da ~1,2 MB a ~250 KB
    gzip_types application/json application/javascript text/css;

    location /data/ { add_header Cache-Control "no-cache"; }   # dati sempre aggiornati
}
```

**HTTPS**: usa un certificato gratuito Let's Encrypt (per esempio con `certbot --nginx`). Molti hosting lo attivano da pannello.

**GitHub Pages** (gratis, senza server):

1. Fai un fork del repository su GitHub.
2. *Settings → Pages → Build and deployment*: scegli **GitHub Actions** e il modello **Static HTML**.
3. Nel file del workflow proposto imposta `path: 'web'` e salva. Il sito sarà su `https://<utente>.github.io/ponte-ricette/`.

## Aggiornare i dati

Sul tuo computer, nella cartella del progetto:

```bash
python -m venv .venv
pip install -r requirements.txt
python scripts/build_all.py
```

(Su Windows attiva prima l'ambiente con `.venv\Scripts\Activate.ps1`; se `python` non c'è prova `py`.)

Poi ricarica sul server `dist/ponte-codici-ricetta.html` oppure `web/data/webdata.json`.

## Aggiungere una regione in modo permanente

Le tabelle caricate dalla pagina sono visibili solo a chi le ha caricate. Per renderle disponibili a tutti i visitatori del tuo sito:

1. Nella pagina carica il file della regione e premi **Scarica JSON**.
2. Metti il file in `data/regioni/` (dettagli in [data/regioni/README.md](data/regioni/README.md)).
3. Rilancia `python scripts/build_web.py` e ricarica i file sul server.

Se pensi che possa servire anche ad altri, proponi il file con una pull request.

## Privacy e risorse esterne

- Nessun cookie, nessun tracciamento, nessun dato inviato al server.
- La pagina carica da internet solo i **caratteri tipografici** (Google Fonts) e, **solo quando qualcuno carica un file Excel**, la libreria SheetJS da `cdn.sheetjs.com`. CSV e JSON vengono letti senza librerie esterne.
- Per un'installazione senza alcuna risorsa esterna (intranet): scarica `xlsx.full.min.js` da <https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js>, mettilo accanto a `index.html` e in `app.js` cambia la costante `SHEETJS` in `'xlsx.full.min.js'`; togli dal `<head>` di `index.html` i tre link a `fonts.googleapis.com` (verranno usati i caratteri di sistema).

## Licenza

Puoi installare, modificare e ridistribuire lo strumento liberamente: è di dominio pubblico (CC0 1.0, vedi [LICENSE](LICENSE)). I dati delle fonti in `data/raw` mantengono le condizioni dei rispettivi enti.
