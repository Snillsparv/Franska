#!/usr/bin/env python3
"""Validerar monologerna mot n+1-regeln: monolog N får bara använda ord
med rang ≤ N×100 (böjda former via monologens lemma-mappning), plus namn
och uppenbara internationella ord (listade i "friaOrd").

Användning:
  python3 scripts/validate_monolog.py                 # alla monologer
  python3 scripts/validate_monolog.py docs/data/monolog/dag_03.json

Monologformat (docs/data/monolog/dag_NN.json):
  {
    "dag": 3,
    "titel": "…",
    "svenska": "…",                  # 80–150 ord
    "franska": "…",
    "lemma": { "suis": 4, "vais": 129 },   # böjd form → rang för grundordet
    "friaOrd": ["Jonas", "Stockholm"]      # namn/internationella ord (max ~5)
  }

Ett token godkänns om det är: siffra/skiljetecken · med i friaOrd · med i
lemma (och rangen ≤ gränsen) · en exakt ordform ur listan (fält som
"le / la / les" delas upp) med rang ≤ gränsen · en elision (j', l', …) vars
grundform är tillåten. Avstavade ord (est-ce) delas på bindestreck.
Utgångsstatus 1 vid överträdelser — körs i byggsteget.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "docs" / "data"

ELISIONER = {"j'": "je", "l'": "le", "d'": "de", "n'": "ne", "qu'": "que",
             "c'": "ce", "s'": "se", "m'": "me", "t'": "te"}
EJ_DELBARA = {"aujourd'hui"}   # apostrofen är del av ordet
LANKBOKSTAV = {"t"}            # va-t-il → "t" är bara uttalsstöd


def bygg_formindex():
    """ordform (gemener) → lägsta rang som har formen."""
    ord_lista = json.loads((DATA / "ord.json").read_text(encoding="utf-8"))
    index = {}
    for o in ord_lista:
        for del_ in o["franska"].lower().split(" / "):
            f = del_.strip()
            if f and (f not in index or o["rang"] < index[f]):
                index[f] = o["rang"]
            # flerordsuttryck: registrera även varje enskilt ord ("il y a" → il, y, a)
            for enskilt in f.split():
                if enskilt not in index or o["rang"] < index[enskilt]:
                    index[enskilt] = o["rang"]
    return index, {o["rang"]: o for o in ord_lista}


def tokenisera(text):
    """franska ord i texten, gemener, apostrofnormaliserade."""
    text = text.replace("’", "'")
    rått = re.findall(r"[^\W\d_]+(?:['-][^\W\d_]+)*'?", text, re.UNICODE)
    tokens = []
    for t in rått:
        t = t.lower()
        if t in EJ_DELBARA:
            tokens.append(t)
            continue
        # dela på bindestreck: est-ce → est, ce; va-t-il → va, t, il
        for del_ in t.split("-"):
            if not del_ or del_ in LANKBOKSTAV:
                continue
            # dela elision: j'ai → j', ai
            m = re.match(r"^([^\W\d_]{1,2}')(.+)$", del_)
            if m:
                tokens.extend([m.group(1), m.group(2)])
            else:
                tokens.append(del_)
    return tokens


def token_ok(tok, grans, lemma, fria, formindex):
    if tok in fria:
        return True
    if tok in lemma:
        return lemma[tok] <= grans
    if tok in formindex and formindex[tok] <= grans:
        return True
    if tok in ELISIONER:
        grund = ELISIONER[tok]
        if grund in lemma and lemma[grund] <= grans:
            return True
        return formindex.get(grund, 10**9) <= grans
    return False


def forslag(tok, formindex, per_rang, antal=3):
    """kandidater ur ordlistan för ett otillåtet token."""
    bas = unicodedata.normalize("NFD", tok)[:4]
    kandidater = []
    for form, rang in formindex.items():
        if unicodedata.normalize("NFD", form).startswith(bas):
            kandidater.append((rang, form))
    kandidater.sort()
    return [f"{form} (rang {rang})" for rang, form in kandidater[:antal]]


def validera_fil(sokvag, formindex, per_rang):
    fel = []
    varningar = []
    try:
        m = json.loads(Path(sokvag).read_text(encoding="utf-8"))
    except Exception as e:
        return [f"kan inte läsa: {e}"], []

    dag = m.get("dag")
    if not isinstance(dag, int) or not 1 <= dag <= 30:
        return [f"ogiltig dag: {dag!r}"], []
    grans = dag * 100

    for falt in ("titel", "svenska", "franska"):
        if not m.get(falt, "").strip():
            fel.append(f"tomt fält: {falt}")
    if fel:
        return fel, varningar

    sv_ord = len(m["svenska"].split())
    if not 70 <= sv_ord <= 170:
        varningar.append(f"svensk text {sv_ord} ord (riktmärke 80–150)")

    fria = {x.lower().replace("’", "'") for x in m.get("friaOrd", [])}
    if len(fria) > 8:
        varningar.append(f"{len(fria)} fria ord — håll nere antalet (namn/internationella)")
    lemma = {k.lower().replace("’", "'"): v for k, v in (m.get("lemma") or {}).items()}

    for form, rang in lemma.items():
        if rang not in per_rang:
            fel.append(f"lemma '{form}' pekar på obefintlig rang {rang}")
        elif rang > grans:
            fel.append(f"lemma '{form}' → rang {rang} över gränsen {grans} "
                       f"({per_rang[rang]['franska']})")

    otillatna = {}
    for tok in tokenisera(m["franska"]):
        if not token_ok(tok, grans, lemma, fria, formindex):
            otillatna.setdefault(tok, 0)
            otillatna[tok] += 1
    for tok, antal in sorted(otillatna.items()):
        tips = forslag(tok, formindex, per_rang)
        fel.append(f"otillåtet ord: '{tok}'×{antal}"
                   + (f" — nära: {', '.join(tips)}" if tips else "")
                   + " — lägg till i lemma (rang ≤ gränsen) eller skriv om")
    return fel, varningar


def main():
    formindex, per_rang = bygg_formindex()
    filer = [Path(a) for a in sys.argv[1:]] or sorted((DATA / "monolog").glob("dag_*.json"))
    if not filer:
        print("inga monologfiler hittade — inget att validera")
        return
    totalt_fel = 0
    for fil in filer:
        fel, varningar = validera_fil(fil, formindex, per_rang)
        status = "FEL" if fel else "ok"
        print(f"{fil.name}: {status}")
        for f in fel:
            print(f"  ✗ {f}")
        for v in varningar:
            print(f"  ⚠ {v}")
        totalt_fel += len(fel)
    if totalt_fel:
        print(f"\n{totalt_fel} överträdelser.")
        sys.exit(1)
    print(f"\nAlla {len(filer)} monologer klarar n+1-regeln.")


if __name__ == "__main__":
    main()
