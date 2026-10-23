"""Percorsi e funzioni condivise dagli script del progetto."""
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
JSON_DIR = ROOT / "data" / "json"
WEB = ROOT / "web"
DIST = ROOT / "dist"

# Fonti originali (data/raw)
SRC_NAZIONALE_PDF = RAW / "nomenclatore_nazionale_allegato4.pdf"
SRC_TOSCANA_CSV = RAW / "catalogo_toscana.csv"
SRC_LOMBARDIA_SISS_XLSX = RAW / "transcodifica_codici_siss_lombardia.xlsx"
SRC_LOMBARDIA_PDF = RAW / "nomenclatore_lombardia_dgr3630_2024.pdf"

# Codici del nomenclatore nazionale: 89.50, 89.7, 88.95.B, 89.7A.3 ...
CODE_RE = re.compile(r"^\d{2}\.[0-9][0-9A-Z]?(\.[0-9A-Z]{1,2})?$")
# Prestazioni di genetica: G1.01, G8.03, G1.31.X ...
GEN_RE = re.compile(r"^G\d\.\d{1,4}(\.[A-Z])?$")


def today():
    return date.today().isoformat()


def clean(s):
    """Normalizza spazi e a-capo; None per stringhe vuote."""
    if s is None:
        return None
    s = re.sub(r"\s*\n\s*", " ", str(s)).strip()
    return s or None


def norm_code(c):
    """Forma canonica di un codice: maiuscolo, senza spazi."""
    if c is None:
        return None
    c = str(c).strip().upper().replace(" ", "")
    return c or None


def join_wrapped(s):
    """Ricompone parole spezzate su due righe nel PDF ('Neurochirurg\\nia')."""
    if s is None:
        return None
    s = re.sub(
        r"(\w)\n(\w)",
        lambda m: m.group(1) + m.group(2) if m.group(2).islower() else m.group(1) + " " + m.group(2),
        str(s),
    )
    return clean(s)


def write_json(name, nome, fonte, voci, **extra):
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    obj = {"meta": {"nome": nome, "fonte": fonte, "generato_il": today(), "n_voci": len(voci)}, "voci": voci}
    obj["meta"].update(extra.pop("meta", {}))
    obj.update(extra)
    path = JSON_DIR / name
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  scritto {path.relative_to(ROOT)} ({len(voci)} voci)")
    return obj


def read_json(name):
    return json.loads((JSON_DIR / name).read_text(encoding="utf-8"))
