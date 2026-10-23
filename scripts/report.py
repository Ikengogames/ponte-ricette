"""Report di copertura: quante voci di ciascuna regione trovano corrispondenza nell'altra."""
from collections import Counter, defaultdict

from common import read_json


def main():
    naz = {v["codice"] for v in read_json("nomenclatore_nazionale.json")["voci"]}
    tos = [v for v in read_json("catalogo_toscana.json")["voci"] if v["prescrivibile"] and not v["obsoleto"]]
    lom = read_json("nomenclatore_lombardia.json")["voci"]
    siss = read_json("catalogo_lombardia_siss.json")["voci"]

    by_nat = defaultdict(list)
    for v in tos:
        by_nat[v["codice_nazionale"]].append(v)

    def coverage(items):
        c = Counter()
        for i in items:
            k = len(by_nat.get(i["codice_nazionale"], []))
            c["nessuna" if k == 0 else "1:1" if k == 1 else "1:N"] += 1
        return c

    lom_codes = {v["codice_nazionale"] for v in lom}
    stale = sum(1 for v in siss if v["codice_nazionale"] not in naz and v["codice_nazionale"] not in lom_codes)
    print("REPORT")
    print(f"  Nomenclatore nazionale: {len(naz)} codici")
    print(f"  Toscana prescrivibili: {len(tos)} voci")
    print(f"  Lombardia nomenclatore 2024 -> Toscana: {dict(coverage(lom))}")
    print(f"  Lombardia codici SISS -> Toscana: {dict(coverage(siss))}  (con codice nazionale superato: {stale})")


if __name__ == "__main__":
    main()
