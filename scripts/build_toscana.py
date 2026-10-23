"""Catalogo Regione Toscana (CSV separato da |) -> data/json/catalogo_toscana.json"""
import csv

from common import SRC_TOSCANA_CSV, norm_code, write_json


def build():
    out = []
    with open(SRC_TOSCANA_CSV, encoding="utf-8", errors="replace", newline="") as f:
        rd = csv.reader(f, delimiter="|")
        header = [h.strip() for h in next(rd)]
        for r in rd:
            if len(r) < len(header):
                continue
            d = {h: (v.strip() if v.strip() not in ("NULL", "") else None) for h, v in zip(header, r)}
            out.append({
                "codice_regionale": d["COD_PRESTAZIONE_CATALOGO"],
                "descrizione": d["DESCRIZIONE_PRESTAZIONE_CATALOGO"],
                "codice_nazionale": norm_code(d["COD_PRESTAZIONE_NOMENCLATORE"]),
                "branca": d["BRANCA"],
                "prescrivibile": d["PRESCRIVIBILE"] == "S",
                "obsoleto": d["OBSOLETO_FLAG"] == "S",
                "nuovo_codice_se_obsoleto": d["OBSOLETO_NUOVO_CODICE"],
                "valido_dal": d["DATA_INIZIO"],
                "valido_al": d["DATA_FINE"],
                "tipo_catalogo": d["COD_TIPO_CATALOGO"],
                "note_linee_guida": d["LINEE_GUIDA_NOTE"],
            })
    return write_json(
        "catalogo_toscana.json",
        "Catalogo prestazioni Regione Toscana",
        "RctPrestazioni.csv - OpenData Regione Toscana (CC BY)",
        out,
    )


if __name__ == "__main__":
    build()
