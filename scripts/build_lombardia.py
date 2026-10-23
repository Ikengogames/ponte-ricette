"""Lombardia:
- codici SISS (open data, Excel)          -> data/json/catalogo_lombardia_siss.json
- nomenclatore DGR XII/3630 del 16/12/2024 -> data/json/nomenclatore_lombardia.json
"""
import re

import openpyxl
import pdfplumber

from common import (CODE_RE, GEN_RE, SRC_LOMBARDIA_PDF, SRC_LOMBARDIA_SISS_XLSX,
                    clean, norm_code, write_json)


def build_siss():
    wb = openpyxl.load_workbook(SRC_LOMBARDIA_SISS_XLSX, data_only=True)
    rows = list(wb["Tabella complessiva cod SISS"].iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[1]]
    out = []
    for r in rows[2:]:
        d = dict(zip(header, r))
        if not d.get("PRESTAZIONE_ID"):
            continue
        out.append({
            "codice_regionale": str(d["PRESTAZIONE_ID"]).strip(),
            "descrizione": clean(d["PRESTAZIONE_DESC"]),
            "codice_nazionale": norm_code(d["CD_NOMENCLATORE"]),
            "codice_regionale_breve": clean(d["COD_REGIONALE2"]),
            "descrizione_nomenclatore_regionale": clean(d["PRESTAZ_AMB_DESC"]),
            "tipo": clean(d["TIPO_PRESTAZ"]),
            "branca_id": clean(d["BRANCA_REG_ID"]),
            "branca": clean(d["BRANCA_REG_DESC"]),
            "set_riferimento_id": clean(d["PRESTAZ_AMB_SET_RIFERIMENTO_ID"]),
            "set_riferimento_desc": clean(d["PRESTAZ_AMB_SET_RIFERIMENTO_DESC"]),
        })
    return write_json(
        "catalogo_lombardia_siss.json",
        "Codici SISS Regione Lombardia",
        "Open Data Lombardia - Transcodifica Codici prestazioni (7ugz-vcug)",
        out,
        meta={"nota": "Istantanea in parte sul vecchio nomenclatore 1996: alcuni codici nazionali non sono più in vigore."},
    )


def _tariffa(s):
    s = clean(s)
    if not s:
        return None
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return None


SISS_LINE = re.compile(r"^(\d{5,8}[A-Z]?(?:\.\d{1,3})?)\s+(\d{2}\.[0-9][0-9A-Z]?(?:\.[0-9A-Z]{1,2})?)\s*(.*)$")


def build_nomenclatore():
    pdf = pdfplumber.open(SRC_LOMBARDIA_PDF)

    # Allegato 1: pagine 12-75
    voci, last = [], None
    for pg in pdf.pages[11:75]:
        for tb in pg.extract_tables():
            for r in tb:
                r = list(r) + [None] * (16 - len(r))
                if clean(r[1]) == "CODICE":
                    continue
                c = norm_code(clean(r[1]))
                if c and (CODE_RE.match(c) or GEN_RE.match(c) or re.match(r"^[A-Z]{2,4}\d{0,3}(\.\d+)?$", c)):
                    branche = [
                        {"id": clean(r[k]), "descrizione": clean(r[k + 1])}
                        for k in range(4, 14, 2) if clean(r[k]) or clean(r[k + 1])
                    ]
                    last = {
                        "codice_nazionale": c,
                        "descrizione": clean(r[2]),
                        "nota_regionale": clean(r[0]),
                        "nota": clean(r[3]),
                        "branche": branche,
                        "modalita": clean(r[14]),
                        "tariffa_euro": _tariffa(r[15]),
                    }
                    voci.append(last)
                elif last and clean(r[2]) and not c:
                    last["descrizione"] = f"{last['descrizione']} {clean(r[2])}"

    # Telemedicina cat. A (pag. 129-130): codice di prescrizione SISS -> codice nazionale
    tele = []
    for pg in pdf.pages[128:130]:
        for line in (pg.extract_text() or "").split("\n"):
            m = SISS_LINE.match(line.strip())
            if m:
                tele.append({"codice_prescrizione_siss": m.group(1), "codice_nazionale": m.group(2),
                             "descrizione": clean(m.group(3))})

    # Codici nazionali non (ancora) recepiti (pag. 117-126)
    non_recepiti, seen = [], set()
    for pg in pdf.pages[116:126]:
        for tb in pg.extract_tables():
            for r in tb:
                c = norm_code(clean(r[0])) if r else None
                if c and c not in seen and (CODE_RE.match(c) or GEN_RE.match(c)):
                    seen.add(c)
                    non_recepiti.append({"codice_nazionale": c, "descrizione": clean(r[1] if len(r) > 1 else None)})

    return write_json(
        "nomenclatore_lombardia.json",
        "Nomenclatore tariffario regionale Lombardia - specialistica ambulatoriale",
        "DGR XII/3630 del 16/12/2024, Allegato 1 (in vigore dal 30/12/2024)",
        voci,
        meta={"nota": "Codici del nomenclatore nazionale. Il codice SISS in ricetta è di norma: "
                      "prefisso branca (2 cifre) + codice nazionale senza punti + eventuale suffisso; "
                      "le visite di controllo fanno eccezione (vedi telemedicina_codici_prescrizione)."},
        telemedicina_codici_prescrizione=tele,
        codici_nazionali_non_recepiti=non_recepiti,
    )


def build():
    build_siss()
    build_nomenclatore()


if __name__ == "__main__":
    build()
