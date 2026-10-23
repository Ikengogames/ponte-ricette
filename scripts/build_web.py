"""Prepara i dati per il sito e la versione a file singolo.

- web/data/webdata.json      dati compatti letti da web/app.js
- dist/ponte-codici-ricetta.html  pagina unica (HTML+CSS+JS+dati inline), comoda da pubblicare o inviare
"""
import json

from common import DIST, REGIONI, WEB, norm_code, read_json


def short(s, n=220):
    s = s or ""
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def other_regions():
    """Regioni aggiuntive da data/regioni/*.json: [{id, nome, fonte, voci: [[codice, descrizione, nazionale, branca, prescrivibile]]}]"""
    out = []
    for path in sorted(REGIONI.glob("*.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        meta = obj.get("meta", {})
        sigla = (meta.get("sigla") or path.stem.split("_")[-1]).upper()
        if sigla in ("LOM", "TOS"):
            print(f"  ATTENZIONE: {path.name} usa la sigla {sigla}, riservata; ignorato")
            continue
        voci = [[norm_code(v.get("codice_regionale")), short(v.get("descrizione")), norm_code(v.get("codice_nazionale")) or "",
                 v.get("branca") or "", 0 if v.get("prescrivibile") is False else 1]
                for v in obj["voci"] if v.get("codice_regionale")]
        out.append({"id": sigla, "nome": meta.get("regione") or sigla, "fonte": meta.get("fonte") or "", "voci": voci})
        print(f"  regione aggiuntiva {sigla} da {path.name} ({len(voci)} voci)")
    return out


def build_data():
    naz = read_json("nomenclatore_nazionale.json")["voci"]
    tos = read_json("catalogo_toscana.json")["voci"]
    siss = read_json("catalogo_lombardia_siss.json")["voci"]
    lomn = read_json("nomenclatore_lombardia.json")
    return {
        "N": {v["codice"]: [short(v["descrizione"]), ", ".join(v["branche"])] for v in naz},
        # Toscana: [codice, descrizione, codice nazionale, branca, prescrivibile]
        "T": [[v["codice_regionale"], short(v["descrizione"]), v["codice_nazionale"], v["branca"] or "",
               1 if v["prescrivibile"] else 0] for v in tos],
        # Lombardia nomenclatore 2024: codice nazionale -> [descrizione, tariffa, branche]
        "LN": {v["codice_nazionale"]: [short(v["descrizione"]), v["tariffa_euro"],
                                       ", ".join(b["descrizione"] or "" for b in v["branche"])] for v in lomn["voci"]},
        # Lombardia codici SISS (open data): [siss, codice nazionale, descrizione, branca]
        "LS": [[v["codice_regionale"], v["codice_nazionale"], short(v["descrizione"]), v["branca"] or ""] for v in siss],
        # Lombardia codici di prescrizione ufficiali DGR 3630: [siss, nazionale, descrizione]
        "LT": [[v["codice_prescrizione_siss"], v["codice_nazionale"], v["descrizione"]]
               for v in lomn["telemedicina_codici_prescrizione"]],
        # Altre regioni da data/regioni/
        "R": other_regions(),
    }


def build():
    data = build_data()
    s = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (WEB / "data").mkdir(parents=True, exist_ok=True)
    (WEB / "data" / "webdata.json").write_text(s, encoding="utf-8")
    print(f"  scritto web/data/webdata.json ({len(s.encode()) // 1024} KB)")

    # Versione a file singolo: inline di CSS, JS e dati
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "style.css").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")
    safe = s.replace("</", "<\\/")  # evita che una descrizione chiuda il tag <script>
    inline_data = f'<script type="application/json" id="data">{safe}</script>'
    html = html.replace('<script src="app.js"></script>', f"{inline_data}\n<script>\n{js}\n</script>")
    DIST.mkdir(parents=True, exist_ok=True)
    (DIST / "ponte-codici-ricetta.html").write_text(html, encoding="utf-8")
    print("  scritto dist/ponte-codici-ricetta.html")


if __name__ == "__main__":
    build()
