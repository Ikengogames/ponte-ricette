"""Rigenera tutto: JSON dalle fonti in data/raw, poi i dati del sito e la pagina unica.

Uso:  python scripts/build_all.py
"""
import build_lombardia
import build_nazionale
import build_toscana
import build_web
import report

print("1/4 Nomenclatore nazionale")
build_nazionale.build()
print("2/4 Catalogo Toscana")
build_toscana.build()
print("3/4 Lombardia (codici SISS + nomenclatore DGR 3630)")
build_lombardia.build()
print("4/4 Sito")
build_web.build()
print()
report.main()
