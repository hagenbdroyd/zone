# Zone

Web-App fürs iPhone: meine Letterboxd-Filme, verknüpft mit Philosophen, dazu ein täglicher Impuls und eigene Notizen.

- **Heute:** ein Zitat oder Gedanke pro Tag, abwechselnd mit einer Verknüpfung aus meinen Filmen.
- **Filme:** alle Filme aus dem Letterboxd-Export, neue Einträge kommen live über den Feed dazu.
- **Denker:** Philosophen mit Kurzporträt, Einstiegswerk und den passenden Filmen. Weitere Filme lassen sich über die Wunschliste anfragen.
- **Notizen:** eigene Gedanken und Fotos aus dem Notizbuch zu Film, Denker oder Tagesimpuls. Sie liegen nur auf dem Gerät; im Bereich Notizen gibt es eine Sicherung.

Keine KI zur Laufzeit: Alle Texte sind fest in `data/` hinterlegt.

## Dateien

- `index.html`, `styles.css`, `app.js` – die App
- `speicher.js` – Notizen in der Browser-Datenbank des Geräts
- `config.js` – Adresse des Google-Skripts für den Live-Abgleich
- `feed/Code.gs` – das Google-Apps-Skript, das den Letterboxd-Feed durchreicht
- `data/filme.json` – Filme aus dem Export (`python3 werkzeug/export_einlesen.py <Export-Ordner>`)
- `data/denker.json` – Denker und Film-Verknüpfungen
- `data/vertiefung.json` – ausführliche Fassung je Verknüpfung (Grundidee, Szenen, Einwand, Fragen)
- `data/impulse.json` – Tagesimpulse
- `sw.js`, `manifest.webmanifest`, `icons/` – Homebildschirm und Offline-Betrieb

## Neue Version hochladen

```bash
git add -A && git commit -m "Update" && git push
```
