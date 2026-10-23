"""Nomenclatore nazionale (Allegato 4, PDF) -> data/json/nomenclatore_nazionale.json"""
from collections import Counter

import pdfplumber

from common import CODE_RE, GEN_RE, SRC_NAZIONALE_PDF, clean, join_wrapped, norm_code, write_json


def build():
    rows, last = [], None
    with pdfplumber.open(SRC_NAZIONALE_PDF) as pdf:
        for pg in pdf.pages:
            for tb in pg.extract_tables():
                header = [clean(h) for h in (tb[1] if len(tb) > 1 else [])]
                if not header or header[:3] != ["NOTA", "CODICE", "DESCRIZIONE"]:
                    continue  # le pagine finali sulla genetica hanno un'altra struttura
                for r in tb[2:]:
                    r = list(r) + [None] * (8 - len(r))
                    nota, codice, desc, num_nota, *branche = r[:8]
                    codice = norm_code(codice)
                    if codice and (CODE_RE.match(codice) or GEN_RE.match(codice)):
                        last = {
                            "codice": codice,
                            "descrizione": clean(desc),
                            "flag": clean(nota),  # H / R / MR
                            "numero_nota": clean(num_nota),
                            "branche": [b for b in (join_wrapped(x) for x in branche) if b],
                        }
                        rows.append(last)
                    elif last and desc:  # continuazione su cambio pagina
                        last["descrizione"] = f"{last['descrizione']} {clean(desc)}".strip()
    dup = [c for c, n in Counter(r["codice"] for r in rows).items() if n > 1]
    if dup:
        print("  ATTENZIONE codici duplicati:", dup[:10])
    return write_json(
        "nomenclatore_nazionale.json",
        "Nomenclatore nazionale specialistica ambulatoriale",
        "Allegato 4 DPCM 12/01/2017 (testo aggiornato)",
        rows,
    )


if __name__ == "__main__":
    build()
