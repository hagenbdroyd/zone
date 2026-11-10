#!/usr/bin/env python3
"""Liest einen Letterboxd-Export und schreibt data/filme.json.

Aufruf:  python3 werkzeug/export_einlesen.py <Pfad zum Export-Ordner>
"""
import csv
import json
import sys
from pathlib import Path

ZIEL = Path(__file__).resolve().parent.parent / "data" / "filme.json"


def zeilen(pfad):
    if not pfad.exists():
        return []
    with pfad.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def liste_einlesen(pfad):
    """Listen-Dateien haben einen Vorspann; die Tabelle beginnt bei 'Position,'."""
    if not pfad.exists():
        return []
    text = pfad.read_text(encoding="utf-8").splitlines()
    start = next((i for i, z in enumerate(text) if z.startswith("Position,")), None)
    if start is None:
        return []
    return list(csv.DictReader(text[start:]))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ordner = Path(sys.argv[1]).expanduser()

    filme = {}

    def schluessel(z):
        return (z["Name"], z["Year"])

    for z in zeilen(ordner / "watched.csv"):
        filme[schluessel(z)] = {
            "id": z["Letterboxd URI"].rsplit("/", 1)[-1],
            "titel": z["Name"],
            "jahr": int(z["Year"]) if z["Year"] else None,
            "url": z["Letterboxd URI"],
            "eingetragen": z["Date"],
            "wertung": None,
            "gesehen": [],
            "liebling": None,
            "herz": False,
        }

    for z in zeilen(ordner / "ratings.csv"):
        f = filme.get(schluessel(z))
        if f and z["Rating"]:
            f["wertung"] = float(z["Rating"])

    for z in zeilen(ordner / "diary.csv"):
        f = filme.get(schluessel(z))
        if f:
            f["gesehen"].append({
                "datum": z["Watched Date"] or z["Date"],
                "wertung": float(z["Rating"]) if z["Rating"] else None,
                "wieder": z["Rewatch"] == "Yes",
            })

    for z in zeilen(ordner / "reviews.csv"):
        f = filme.get(schluessel(z))
        if f and z.get("Review"):
            f["kritik"] = z["Review"]

    for z in zeilen(ordner / "likes" / "films.csv"):
        f = filme.get(schluessel(z))
        if f:
            f["herz"] = True

    for z in liste_einlesen(ordner / "lists" / "lieblingsfilme.csv"):
        f = filme.get(schluessel(z))
        if f:
            f["liebling"] = int(z["Position"])

    ausgabe = []
    for f in filme.values():
        f["gesehen"].sort(key=lambda g: g["datum"])
        f["zuletzt"] = f["gesehen"][-1]["datum"] if f["gesehen"] else f["eingetragen"]
        ausgabe.append(f)
    ausgabe.sort(key=lambda f: f["zuletzt"], reverse=True)

    merkliste = [
        {"titel": z["Name"], "jahr": int(z["Year"]) if z["Year"] else None, "url": z["Letterboxd URI"]}
        for z in zeilen(ordner / "watchlist.csv")
    ]

    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(
        json.dumps({"stand": ordner.name, "filme": ausgabe, "merkliste": merkliste},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(ausgabe)} Filme, {len(merkliste)} auf der Merkliste -> {ZIEL}")


if __name__ == "__main__":
    main()
