#!/usr/bin/env python3
"""Genererar ljud med Google Cloud Text-to-Speech (fransk manlig röst).

Skapar i docs/audio/:
  ord_0001.mp3 … ord_3000.mp3        (bara ordet)
  mening_0001.mp3 … mening_3000.mp3  (exempelmeningen)
  tal_*.mp3, pris_*.mp3, tel_*.mp3, klocka_*.mp3  (sifferträningen, ur siffror.json)
  monolog_01.mp3 … monolog_30.mp3    (hela monologen, ur docs/data/monolog/)

Användning:
  export GOOGLE_TTS_API_KEY=din-nyckel        # checkas ALDRIG in
  python3 scripts/generate_tts.py --typ alla
  python3 scripts/generate_tts.py --typ ord --fran 1 --till 100
  python3 scripts/generate_tts.py --typ alla --torrkorning   # bara räkna och kostnadsuppskatta

Egenskaper: resume (hoppar över filer som redan finns), paus mellan anrop
(--paus, standard 0,15 s), loggning till scripts/tts_logg.txt.

Kostnad: Neural2 kostar ca 16 USD per miljon tecken, med 1 miljon tecken
gratis per månad. Hela kursen är ~260 000 tecken → ryms normalt i gratisnivån,
annars enstaka dollar. Kör --torrkorning för exakt siffra.
"""
import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from os import environ
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "docs" / "data"
LJUD = ROT / "docs" / "audio"
LOGG = Path(__file__).parent / "tts_logg.txt"

API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
ROST = "fr-FR-Neural2-B"  # manlig, hög kvalitet


def logga(text):
    rad = f"{datetime.now().isoformat(timespec='seconds')} {text}"
    print(rad)
    with open(LOGG, "a", encoding="utf-8") as f:
        f.write(rad + "\n")


def syntetisera(nyckel, text, takt=1.0):
    kropp = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": "fr-FR", "name": ROST},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": takt},
    }).encode("utf-8")
    beg = urllib.request.Request(
        f"{API_URL}?key={nyckel}", data=kropp,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(beg, timeout=30) as svar:
        return base64.b64decode(json.loads(svar.read())["audioContent"])


def samla_jobb(typ, fran, till):
    """Returnerar lista av (filnamn, text, takt)."""
    jobb = []
    if typ in ("ord", "mening", "alla"):
        ord_lista = json.loads((DATA / "ord.json").read_text(encoding="utf-8"))
        for o in ord_lista:
            r = o["rang"]
            if not (fran <= r <= till):
                continue
            nr = f"{r:04d}"
            if typ in ("ord", "alla"):
                # "le / la / les" läses "le, la, les"
                jobb.append((f"ord_{nr}.mp3", o["franska"].replace(" / ", ", "), 0.9))
            if typ in ("mening", "alla"):
                jobb.append((f"mening_{nr}.mp3", o["meningFr"], 1.0))
    if typ in ("siffror", "alla"):
        siffror = json.loads((DATA / "siffror.json").read_text(encoding="utf-8"))
        sedda = set()
        for niva in siffror["nivaer"]:
            for p in niva["poster"]:
                if p["ljud"] not in sedda:
                    sedda.add(p["ljud"])
                    jobb.append((f"{p['ljud']}.mp3", p["fr"], 1.0))
    if typ in ("monolog", "alla"):
        for fil in sorted((DATA / "monolog").glob("dag_*.json")):
            m = json.loads(fil.read_text(encoding="utf-8"))
            nr = fil.stem.split("_")[1]
            jobb.append((f"monolog_{nr}.mp3", m["franska"], 0.95))
    return jobb


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--typ", choices=["ord", "mening", "siffror", "monolog", "alla"], default="alla")
    p.add_argument("--fran", type=int, default=1, help="första rang (för ord/mening)")
    p.add_argument("--till", type=int, default=3000, help="sista rang (för ord/mening)")
    p.add_argument("--paus", type=float, default=0.15, help="sekunder mellan API-anrop")
    p.add_argument("--torrkorning", action="store_true", help="räkna bara, anropa inte API:t")
    arg = p.parse_args()

    jobb = samla_jobb(arg.typ, arg.fran, arg.till)
    kvar = [(f, t, takt) for f, t, takt in jobb if not (LJUD / f).exists()]
    tecken = sum(len(t) for _, t, _ in kvar)
    print(f"{len(jobb)} klipp totalt, {len(jobb) - len(kvar)} finns redan, {len(kvar)} att generera")
    print(f"~{tecken:,} tecken → ca {tecken / 1_000_000 * 16:.2f} USD med Neural2 "
          f"(0 USD om månadens gratismiljon räcker)")
    if arg.torrkorning or not kvar:
        return

    nyckel = environ.get("GOOGLE_TTS_API_KEY")
    if not nyckel:
        sys.exit("Sätt miljövariabeln GOOGLE_TTS_API_KEY (checka aldrig in nyckeln).")

    LJUD.mkdir(parents=True, exist_ok=True)
    logga(f"startar: {len(kvar)} klipp, typ={arg.typ}")
    fel = 0
    for i, (fil, text, takt) in enumerate(kvar, 1):
        try:
            ljuddata = syntetisera(nyckel, text, takt)
            (LJUD / fil).write_bytes(ljuddata)
            if i % 50 == 0 or i == len(kvar):
                logga(f"{i}/{len(kvar)} klara (senast: {fil})")
        except urllib.error.HTTPError as e:
            fel += 1
            logga(f"FEL {fil}: HTTP {e.code} {e.read()[:200]}")
            if e.code in (403, 429):
                logga("kvot/nyckelproblem — pausar 30 s")
                time.sleep(30)
        except Exception as e:  # nätfel m.m. — logga och fortsätt (resume tar resten)
            fel += 1
            logga(f"FEL {fil}: {e}")
        time.sleep(arg.paus)
    logga(f"klart: {len(kvar) - fel} genererade, {fel} fel")
    if fel:
        print("Kör scriptet igen för att försöka ta de som misslyckades (resume).")


if __name__ == "__main__":
    main()
