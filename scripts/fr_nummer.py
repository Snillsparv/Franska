"""Konvertering av tal till franska räkneord.

Traditionell stavning (bindestreck inom tiotal, "et un" utan bindestreck).
Används av build_data.py (sifferpooler) och generate_tts.py (sifferljud).
"""

ENHETER = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
    "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf",
]
TIOTAL = {20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante"}


def _under_100(n: int) -> str:
    if n < 20:
        return ENHETER[n]
    if n < 70:
        tio, rest = (n // 10) * 10, n % 10
        if rest == 0:
            return TIOTAL[tio]
        if rest == 1:
            return f"{TIOTAL[tio]} et un"
        return f"{TIOTAL[tio]}-{ENHETER[rest]}"
    if n < 80:
        rest = n - 60
        if rest == 11:
            return "soixante et onze"
        return f"soixante-{ENHETER[rest]}"
    # 80–99
    rest = n - 80
    if rest == 0:
        return "quatre-vingts"
    return f"quatre-vingt-{ENHETER[rest]}"


def _under_1000(n: int) -> str:
    if n < 100:
        return _under_100(n)
    hundratal, rest = n // 100, n % 100
    if hundratal == 1:
        h = "cent"
    elif rest == 0:
        h = f"{ENHETER[hundratal]} cents"
    else:
        h = f"{ENHETER[hundratal]} cent"
    return h if rest == 0 else f"{h} {_under_100(rest)}"


def tal_till_franska(n: int) -> str:
    """0–999 999 → franska räkneord."""
    if not 0 <= n <= 999_999:
        raise ValueError(f"utanför intervallet: {n}")
    if n < 1000:
        return _under_1000(n)
    tusental, rest = n // 1000, n % 1000
    if tusental == 1:
        t = "mille"
    else:
        # "mille" är oböjligt; "quatre-vingts"/"cents" tappar s före mille
        prefix = _under_1000(tusental)
        if prefix.endswith("quatre-vingts"):
            prefix = prefix[:-1]
        elif prefix.endswith("cents"):
            prefix = prefix[:-1]
        t = f"{prefix} mille"
    return t if rest == 0 else f"{t} {_under_1000(rest)}"


def artal_till_franska(n: int) -> str:
    """Årtal läses som vanliga tal: 1984 = mille neuf cent quatre-vingt-quatre."""
    return tal_till_franska(n)


def pris_till_franska(euro: int, cent: int = 0) -> str:
    """12,50 € → "douze euros cinquante"."""
    if euro == 0:
        c = "centime" if cent == 1 else "centimes"
        return f"{tal_till_franska(cent)} {c}"
    e = "euro" if euro == 1 else "euros"
    if cent == 0:
        return f"{tal_till_franska(euro)} {e}"
    return f"{tal_till_franska(euro)} {e} {tal_till_franska(cent)}"


def telefon_till_franska(nummer: str) -> str:
    """"0612345678" → "zéro six, douze, trente-quatre, cinquante-six, soixante-dix-huit"."""
    siffror = [c for c in nummer if c.isdigit()]
    if len(siffror) != 10:
        raise ValueError(f"telefonnummer måste ha 10 siffror: {nummer}")
    par = ["".join(siffror[i : i + 2]) for i in range(0, 10, 2)]
    delar = []
    for p in par:
        if p[0] == "0":
            delar.append(f"zéro {ENHETER[int(p[1])]}" if p[1] != "0" else "zéro zéro")
        else:
            delar.append(tal_till_franska(int(p)))
    return ", ".join(delar)


def klockslag_till_franska(timme: int, minut: int) -> str:
    """Officiell 24-timmarsstil: 15:30 → "quinze heures trente"."""
    if timme == 0 and minut == 0:
        return "minuit"
    if timme == 12 and minut == 0:
        return "midi"
    h = "une heure" if timme == 1 else f"{tal_till_franska(timme)} heures"
    if minut == 0:
        return h
    return f"{h} {tal_till_franska(minut)}"


if __name__ == "__main__":
    prov = {
        0: "zéro", 1: "un", 16: "seize", 17: "dix-sept", 20: "vingt",
        21: "vingt et un", 22: "vingt-deux", 31: "trente et un",
        61: "soixante et un", 70: "soixante-dix", 71: "soixante et onze",
        72: "soixante-douze", 79: "soixante-dix-neuf", 80: "quatre-vingts",
        81: "quatre-vingt-un", 90: "quatre-vingt-dix", 91: "quatre-vingt-onze",
        99: "quatre-vingt-dix-neuf", 100: "cent", 101: "cent un",
        200: "deux cents", 201: "deux cent un", 555: "cinq cent cinquante-cinq",
        999: "neuf cent quatre-vingt-dix-neuf", 1000: "mille",
        1001: "mille un", 1789: "mille sept cent quatre-vingt-neuf",
        1984: "mille neuf cent quatre-vingt-quatre", 2000: "deux mille",
        2026: "deux mille vingt-six", 80000: "quatre-vingt mille",
        200000: "deux cent mille",
    }
    fel = 0
    for n, facit in prov.items():
        got = tal_till_franska(n)
        if got != facit:
            print(f"FEL: {n}: {got!r} != {facit!r}")
            fel += 1
    assert telefon_till_franska("0612345678") == "zéro six, douze, trente-quatre, cinquante-six, soixante-dix-huit"
    assert pris_till_franska(12, 50) == "douze euros cinquante"
    assert pris_till_franska(1, 0) == "un euro"
    assert klockslag_till_franska(15, 30) == "quinze heures trente"
    assert klockslag_till_franska(1, 5) == "une heure cinq"
    assert klockslag_till_franska(0, 0) == "minuit"
    print("OK" if fel == 0 else f"{fel} fel")
