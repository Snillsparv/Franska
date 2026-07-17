#!/usr/bin/env python3
"""Datapipeline: data/franska_3000_ord.csv → docs/data/*.json

Genererar:
  - ord.json      alla 3000 ord med extraherade uttalskommentarer och taggar
  - kursplan.json dag 1–30 → ordintervall, uttalslektion, siffernivå, grammatik, monolog
  - siffror.json  övningspooler för sifferträningen (med fransk text för TTS)

Validerar CSV:n hårt: fältantal, rang-sekvens, obligatoriska fält, genus på substantiv.
Kör:  python3 scripts/build_data.py
"""
import csv
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fr_nummer import (
    artal_till_franska,
    klockslag_till_franska,
    pris_till_franska,
    tal_till_franska,
    telefon_till_franska,
)

ROT = Path(__file__).resolve().parent.parent
CSV_FIL = ROT / "data" / "franska_3000_ord.csv"
UT = ROT / "docs" / "data"

KOLUMNER = [
    "rang", "franska", "ordklass", "genus", "svenska",
    "mening_franska", "mening_svenska", "bonusord", "notering",
]
TAGG_ORD = ["GULD", "NYANS", "FALSK VÄN", "TRIPPEL", "DUBBEL", "MULTI"]
KANDA_GENUS = {"m", "f", "m pl", "f pl", "m/f", "f/m"}

UTTAL_LEKTIONER = [
    "Alfabetet och accenterna",
    "Tysta slutbokstäver",
    "Vokalerna: u vs ou",
    "e, é, è och schwa",
    "oi, au/eau, ai/ei",
    "Nasalerna: on, an/en, in/ain, un",
    "R-ljudet",
    "gn, ill/ille, y",
    "c/ç, g/ge, s/ss/z",
    "qu, gu, h muet vs h aspiré",
    "Liaison: när den är obligatorisk",
    "Liaison: förbjuden och valfri",
    "Enchaînement och rytm",
    "Elision (l', j', d', qu')",
    "Betoning och intonation",
    "Siffrornas uttal",
    "Vanliga fällor: plus, tous, est/et, fils",
    "Homofoner",
    "Snabbt tal",
    "Finlir och avancerade undantag",
]
# dag → ny uttalslektion (övriga dagar = repetition)
UTTAL_PER_DAG = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 10: 9, 11: 10,
                 12: 11, 14: 12, 15: 13, 16: 14, 18: 15, 19: 16, 21: 17, 22: 18,
                 24: 19, 26: 20}

SIFFER_NIVAER = [
    {"id": 1, "titel": "0–20", "fran_dag": 1},
    {"id": 2, "titel": "Tiotal (20–69)", "fran_dag": 4},
    {"id": 3, "titel": "70/80/90-fällorna", "fran_dag": 7},
    {"id": 4, "titel": "100–1000", "fran_dag": 10},
    {"id": 5, "titel": "Årtal", "fran_dag": 13},
    {"id": 6, "titel": "Priser", "fran_dag": 17},
    {"id": 7, "titel": "Telefonnummer", "fran_dag": 21},
    {"id": 8, "titel": "Klockslag", "fran_dag": 25},
]

GRAMMATIK_KAPITEL = [
    "Bestämd och obestämd artikel & genus",
    "Plural",
    "Être och avoir",
    "-er-verb i presens",
    "Negation: ne … pas",
    "Frågor: est-ce que, inversion, intonation",
    "Adjektivets placering och böjning",
    "Possessiver",
    "-ir- och -re-verb",
    "Il y a / c'est",
    "Passé composé med avoir",
    "Passé composé med être",
    "Reflexiva verb",
    "Futur proche",
    "Räkneord i grammatiken: de + mängd",
    "Imparfait",
    "Passé composé vs imparfait",
    "Objektspronomen: le/la/les, lui/leur",
    "Y och en",
    "Imperativ",
    "Futur simple",
    "Komparativ och superlativ",
    "Relativpronomen: qui, que, où",
    "Conditionnel",
    "Tidsuttryck: depuis, il y a, pendant",
    "Subjonctif: introduktion",
    "Indirekt tal",
    "Gerundium: en + -ant",
    "Blandade övningar",
    "Slutprov",
]


def fel(msg):
    print(f"FEL: {msg}", file=sys.stderr)


def las_csv():
    problem = 0
    rader = []
    with open(CSV_FIL, encoding="utf-8", newline="") as f:
        lasare = csv.reader(f)
        rubrik = next(lasare)
        if rubrik != KOLUMNER:
            fel(f"oväntad rubrikrad: {rubrik}")
            problem += 1
        for i, rad in enumerate(lasare, start=2):
            if len(rad) != len(KOLUMNER):
                fel(f"rad {i}: {len(rad)} fält, förväntade {len(KOLUMNER)}")
                problem += 1
                continue
            rader.append(dict(zip(KOLUMNER, rad)))

    for i, r in enumerate(rader, start=1):
        if int(r["rang"]) != i:
            fel(f"rang-sekvens bruten vid rad {i}: rang={r['rang']}")
            problem += 1
        for falt in ["franska", "ordklass", "svenska", "mening_franska", "mening_svenska"]:
            if not r[falt].strip():
                fel(f"rang {r['rang']}: tomt fält '{falt}'")
                problem += 1
        if r["ordklass"] == "substantiv" and not r["genus"].strip():
            fel(f"rang {r['rang']}: substantiv utan genus")
            problem += 1
        if r["genus"].strip() and r["genus"].strip() not in KANDA_GENUS:
            fel(f"rang {r['rang']}: okänt genus '{r['genus']}'")
            problem += 1
    if len(rader) != 3000:
        fel(f"{len(rader)} rader, förväntade 3000")
        problem += 1
    return rader, problem


def extrahera_uttal(notering):
    m = re.search(r"UTTAL:\s*(.+)", notering)
    if not m:
        return ""
    text = m.group(1)
    # klipp vid meningsslut följt av ny mening som börjar med versal
    klipp = re.search(r"(?<=[.!?])\s+(?=[A-ZÅÄÖÉÈÊÀÇ])", text)
    return (text[: klipp.start()] if klipp else text).strip()


def extrahera_taggar(notering):
    taggar = [t for t in TAGG_ORD if t in notering]
    if "UTTAL:" in notering:
        taggar.append("UTTAL")
    return taggar


def bygg_ord(rader):
    ord_lista = []
    for r in rader:
        ord_lista.append({
            "rang": int(r["rang"]),
            "franska": r["franska"].strip(),
            "ordklass": r["ordklass"].strip(),
            "genus": r["genus"].strip(),
            "svenska": r["svenska"].strip(),
            "meningFr": r["mening_franska"].strip(),
            "meningSv": r["mening_svenska"].strip(),
            "bonusord": r["bonusord"].strip(),
            "notering": r["notering"].strip(),
            "uttal": extrahera_uttal(r["notering"]),
            "taggar": extrahera_taggar(r["notering"]),
        })
    return ord_lista


def bygg_kursplan():
    dagar = []
    for dag in range(1, 31):
        niva = max(n["id"] for n in SIFFER_NIVAER if n["fran_dag"] <= dag)
        dagar.append({
            "dag": dag,
            "ordStart": (dag - 1) * 100 + 1,
            "ordSlut": dag * 100,
            "uttal": UTTAL_PER_DAG.get(dag),  # null = repetition
            "siffror": niva,
            "grammatik": dag,
            "monolog": dag,
        })
    return {
        "dagar": dagar,
        "uttalLektioner": [{"id": i + 1, "titel": t} for i, t in enumerate(UTTAL_LEKTIONER)],
        "sifferNivaer": [{"id": n["id"], "titel": n["titel"]} for n in SIFFER_NIVAER],
        "grammatikKapitel": [{"id": i + 1, "titel": t} for i, t in enumerate(GRAMMATIK_KAPITEL)],
    }


def bygg_siffror():
    rng = random.Random(42)
    nivaer = []

    def tal_post(n):
        return {"visning": str(n), "svar": [str(n)], "fr": tal_till_franska(n), "ljud": f"tal_{n}"}

    nivaer.append({"id": 1, "titel": "0–20", "typ": "tal", "min": 0, "max": 20,
                   "poster": [tal_post(n) for n in range(0, 21)]})
    nivaer.append({"id": 2, "titel": "Tiotal (20–69)", "typ": "tal", "min": 20, "max": 69,
                   "poster": [tal_post(n) for n in range(20, 70)]})
    nivaer.append({"id": 3, "titel": "70/80/90-fällorna", "typ": "tal", "min": 70, "max": 99,
                   "poster": [tal_post(n) for n in range(70, 100)]})

    stora = sorted({*range(100, 1001, 100), *[rng.randint(101, 999) for _ in range(45)], 1000})
    nivaer.append({"id": 4, "titel": "100–1000", "typ": "tal", "min": 100, "max": 1000,
                   "poster": [tal_post(n) for n in stora]})

    artal = sorted({1789, 1815, 1848, 1871, 1914, 1918, 1939, 1945, 1958, 1968,
                    1989, 1998, 2000, 2024, 2026,
                    *[rng.randint(1950, 2030) for _ in range(30)],
                    *range(2015, 2031)})
    nivaer.append({"id": 5, "titel": "Årtal", "typ": "artal",
                   "poster": [{"visning": str(a), "svar": [str(a)],
                               "fr": artal_till_franska(a), "ljud": f"tal_{a}"}
                              for a in artal]})

    priser = []
    for _ in range(50):
        euro = rng.choice([rng.randint(1, 20), rng.randint(1, 100), rng.randint(1, 100)])
        cent = rng.choice([0, 0, 50, 20, 90, 95, 99, rng.randint(1, 99)])
        priser.append((euro, cent))
    pris_poster = []
    for euro, cent in sorted(set(priser)):
        if cent == 0:
            visning, svar = f"{euro} €", [str(euro), f"{euro},00"]
        else:
            visning, svar = f"{euro},{cent:02d} €", [f"{euro},{cent:02d}", f"{euro}.{cent:02d}"]
        pris_poster.append({"visning": visning, "svar": svar,
                            "fr": pris_till_franska(euro, cent),
                            "ljud": f"pris_{euro}_{cent:02d}"})
    nivaer.append({"id": 6, "titel": "Priser", "typ": "pris", "poster": pris_poster})

    telefoner = set()
    while len(telefoner) < 40:
        prefix = rng.choice(["06", "07", "01", "02", "04"])
        telefoner.add(prefix + "".join(str(rng.randint(0, 9)) for _ in range(8)))
    tel_poster = []
    for t in sorted(telefoner):
        par = " ".join(t[i:i + 2] for i in range(0, 10, 2))
        tel_poster.append({"visning": par, "svar": [t, par],
                           "fr": telefon_till_franska(t), "ljud": f"tel_{t}"})
    nivaer.append({"id": 7, "titel": "Telefonnummer", "typ": "telefon", "poster": tel_poster})

    tider = {(0, 0), (12, 0), (6, 30), (18, 45), (9, 15), (21, 5)}
    while len(tider) < 45:
        tider.add((rng.randint(0, 23), rng.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])))
    tid_poster = []
    for h, m in sorted(tider):
        svar = [f"{h:02d}:{m:02d}", f"{h}:{m:02d}", f"{h:02d}{m:02d}"]
        tid_poster.append({"visning": f"{h:02d}:{m:02d}", "svar": svar,
                           "fr": klockslag_till_franska(h, m),
                           "ljud": f"klocka_{h:02d}_{m:02d}"})
    nivaer.append({"id": 8, "titel": "Klockslag", "typ": "klockslag", "poster": tid_poster})
    return {"nivaer": nivaer}


def skriv(namn, data):
    UT.mkdir(parents=True, exist_ok=True)
    sokvag = UT / namn
    with open(sokvag, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"skrev {sokvag.relative_to(ROT)} ({sokvag.stat().st_size // 1024} kB)")


def main():
    rader, problem = las_csv()
    if problem:
        print(f"\n{problem} valideringsfel — avbryter.", file=sys.stderr)
        sys.exit(1)

    ord_lista = bygg_ord(rader)
    skriv("ord.json", ord_lista)
    skriv("kursplan.json", bygg_kursplan())
    skriv("siffror.json", bygg_siffror())

    med_uttal = sum(1 for o in ord_lista if o["uttal"])
    print(f"klart: {len(ord_lista)} ord, {med_uttal} med uttalskommentar")


if __name__ == "__main__":
    main()
