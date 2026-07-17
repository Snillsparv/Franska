#!/usr/bin/env python3
"""Bygger ett komplett Anki-deck (.apkg) med samma kortinnehåll som sajten,
inklusive ljud om filerna finns i docs/audio/.

Krav:  pip install genanki
Kör:   python3 scripts/build_anki.py
Ut:    franska_3000.apkg (importeras i Anki/AnkiMobile/AnkiDroid)

Kort-id:n är deterministiska (guid = rang), så en ny export uppdaterar
befintliga kort i Anki i stället för att skapa dubbletter.
"""
import html
import json
import sys
from pathlib import Path

try:
    import genanki
except ImportError:
    sys.exit("genanki saknas — kör: pip install genanki")

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "docs" / "data"
LJUD = ROT / "docs" / "audio"
UT = ROT / "franska_3000.apkg"

MODELL_ID = 1607392319
DECK_ID = 2059400110

STIL = """
.card { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 20px;
        text-align: center; color: #1d2733; background: #f4f4f0; }
.ordet { font-size: 34px; font-weight: 700; margin: 8px 0; }
.meningen { font-size: 22px; margin: 8px 0; }
.meningen b { color: #2d5a94; }
.oversattning { font-size: 26px; font-weight: 600; }
.info { text-align: left; font-size: 16px; color: #444; border-top: 1px solid #ccc;
        margin-top: 14px; padding-top: 10px; }
.chip { font-size: 13px; color: #666; }
"""

MODELL = genanki.Model(
    MODELL_ID, "Franska 3000",
    fields=[{"name": f} for f in
            ["Rang", "Franska", "Ordklass", "Genus", "Svenska", "MeningFr",
             "MeningSv", "Bonusord", "Notering", "Uttal", "LjudOrd", "LjudMening"]],
    templates=[{
        "name": "Franska → svenska",
        "qfmt": """<div class="ordet">{{Franska}}</div>
<div class="meningen">{{MeningFr}}</div>
{{LjudOrd}} {{LjudMening}}""",
        "afmt": """{{FrontSide}}<hr id="answer">
<div class="oversattning">{{Svenska}}</div>
<div class="chip">{{Ordklass}} {{Genus}} · rang {{Rang}}</div>
<div class="meningen">{{MeningSv}}</div>
<div class="info">
{{#Uttal}}<p>🗣️ <b>Uttal:</b> {{Uttal}}</p>{{/Uttal}}
{{#Bonusord}}<p>➕ <b>Bonus:</b> {{Bonusord}}</p>{{/Bonusord}}
{{#Notering}}<p>💡 {{Notering}}</p>{{/Notering}}
</div>""",
    }],
    css=STIL,
)


def markera(mening, franska):
    """Fetstila ordet i meningen (samma logik som sajten)."""
    former = sorted((f.strip() for f in franska.split(" / ")), key=len, reverse=True)
    lag = mening.lower()
    for form in former:
        i, form_lag = 0, form.lower()
        while True:
            i = lag.find(form_lag, i)
            if i < 0:
                break
            fore = lag[i - 1] if i else " "
            efter = lag[i + len(form)] if i + len(form) < len(lag) else " "
            if not fore.isalpha() and not efter.isalpha():
                return (html.escape(mening[:i]) + "<b>" + html.escape(mening[i:i + len(form)])
                        + "</b>" + html.escape(mening[i + len(form):]))
            i += 1
    return html.escape(mening)


def main():
    ord_lista = json.loads((DATA / "ord.json").read_text(encoding="utf-8"))
    deck = genanki.Deck(DECK_ID, "Franska 3000 — 30 dagar")
    media = []

    for o in ord_lista:
        nr = f"{o['rang']:04d}"
        ljud_ord = ljud_mening = ""
        for prefix, falt in [("ord", "ljud_ord"), ("mening", "ljud_mening")]:
            fil = LJUD / f"{prefix}_{nr}.mp3"
            if fil.exists():
                media.append(str(fil))
                if prefix == "ord":
                    ljud_ord = f"[sound:{fil.name}]"
                else:
                    ljud_mening = f"[sound:{fil.name}]"

        not_ = genanki.Note(
            model=MODELL,
            guid=genanki.guid_for("franska3000", o["rang"]),
            fields=[
                str(o["rang"]), html.escape(o["franska"]), html.escape(o["ordklass"]),
                html.escape(o["genus"]), html.escape(o["svenska"]),
                markera(o["meningFr"], o["franska"]), html.escape(o["meningSv"]),
                html.escape(o["bonusord"]), html.escape(o["notering"]),
                html.escape(o["uttal"]), ljud_ord, ljud_mening,
            ],
            due=o["rang"],  # nya kort kommer i kursordning
        )
        deck.add_note(not_)

    paket = genanki.Package(deck)
    paket.media_files = media
    paket.write_to_file(UT)
    print(f"skrev {UT.name}: {len(ord_lista)} kort, {len(media)} ljudfiler")
    if not media:
        print("(inga ljudfiler hittades i docs/audio — kör generate_tts.py först om du vill ha ljud)")


if __name__ == "__main__":
    main()
