# Franska 3000 — 30 dagar 🇫🇷

Personlig webbkurs: **3000 franska ord på 30 dagar** (100 ord/dag) inför en längre
Frankrikevistelse. Statisk sajt, fungerar offline (PWA), inga konton, ingen backend.
Allt innehåll styrs av `kursplan.json` och bygger på den kvalitetssäkrade ordlistan
`data/franska_3000_ord.csv`.

## Kom igång

Sajten ligger färdigbyggd i `docs/` och kan öppnas direkt:

```bash
cd docs && python3 -m http.server 8000
# öppna http://localhost:8000
```

**Hosting:** aktivera GitHub Pages (Settings → Pages → Deploy from branch →
`main` + `/docs`) så ligger kursen på nätet. Installera den sedan som app från
webbläsarens "Lägg till på hemskärmen" — allt utom ljudet fungerar offline direkt,
och ljudet kan hämtas ner under Inställningar → "Ljud för offline".

## Modulerna

| Modul | Vad | Var |
|---|---|---|
| 0 | Dashboard: "Dag X av 30" med dagens dos som checklista, fri dagnavigering | `#/` |
| 1 | Ordkort med SRS (SM-2, som Anki): dagens 100 nya + repetitioner | `#/ord` |
| 2 | Ljud: TTS-pipeline för 6300+ klipp (se nedan) | `scripts/generate_tts.py` |
| 3 | 20 uttalslektioner med exempel ur ordlistan + självtest | `#/uttal` |
| 4 | Sifferträning: 8 nivåer (0–20 … klockslag), lyssna/blixt/tempo | `#/siffror` |
| 5 | 30 dagliga monologer med klickbart facit (n+1-validerade) | `#/monolog` |
| 6 | 30 grammatikkapitel med övningar ur kursens exempelmeningar | `#/grammatik` |

Framsteg sparas i webbläsarens localStorage. **Exportera backup** regelbundet
(Inställningar → Backup) — samma fil används för att flytta mellan enheter.
Innan ljudfilerna genererats används webbläsarens franska talsyntes som reserv.

## Ljudet (modul 2)

`scripts/generate_tts.py` anropar Google Cloud Text-to-Speech med fransk manlig
röst (`fr-FR-Neural2-B`) och skapar `docs/audio/`: `ord_0001.mp3` …,
`mening_0001.mp3` …, sifferljud och monologljud. Resume ingår — avbrutna körningar
fortsätter där de slutade.

```bash
export GOOGLE_TTS_API_KEY=din-nyckel      # checkas ALDRIG in
python3 scripts/generate_tts.py --typ alla --torrkorning   # räkna + kostnad
python3 scripts/generate_tts.py --typ alla                 # generera
```

**Kostnad:** hela kursen är ~260 000 tecken. Neural2 kostar ca 16 USD/miljon
tecken med 1 miljon tecken gratis per månad → normalt **0 kr**, annars ~20–25 kr.
(Långt under budgettaket "några hundralappar".)

## Anki-export (valfritt)

```bash
pip install genanki
python3 scripts/build_anki.py     # → franska_3000.apkg med ev. ljud inbäddat
```

Deterministiska kort-id:n: en ny export uppdaterar befintliga kort i Anki utan dubbletter.

## Bygg och validering

```bash
python3 scripts/build_data.py        # CSV → docs/data/*.json (hård validering)
python3 scripts/validate_monolog.py  # n+1-regeln: monolog N ⊆ ord med rang ≤ N×100
python3 scripts/validate_innehall.py # uttal/grammatik: rang-referenser, facit, regex
python3 scripts/merge_innehall.py    # delar/ → uttal.json + grammatik.json
```

Kör allt efter varje innehållsändring. `validate_monolog.py` är kursens hårda
grind: den tokeniserar franskan (elisioner, bindestreck), slår upp varje form mot
ordlistan + monologens lemma-mappning och listar överträdelser med förslag.

## Datastruktur

- `data/franska_3000_ord.csv` — källan. `rang` är nyckeln (obs: `pas` finns
  medvetet på både 22 och 735 — bygg aldrig unikhet på `franska`).
- `docs/data/ord.json` — genererad, med extraherade `UTTAL:`-kommentarer och
  taggar (GULD, FALSK VÄN, DUBBEL …) ur noteringarna.
- `docs/data/kursplan.json` — dag 1–30 → ordintervall, uttalslektion,
  siffernivå, grammatikkapitel, monolog.
- `docs/data/monolog/dag_NN.json` — monolog med `lemma` (böjd form → rang) och
  `friaOrd` (namn/internationella ord).

## Teknik

Vanilla JS (ES-moduler), ingen byggkedja för sajten, ~15 småfiler i `docs/js/`.
Service worker precachar appskal + data; ljud cachas vid uppspelning eller
förhämtas per dag/allt. SM-2-motorn ligger i `docs/js/srs.js`.
