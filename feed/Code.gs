/**
 * Zwischenstation für die Zone-App: holt den öffentlichen Letterboxd-Feed
 * und gibt die Tagebuch-Einträge als JSON zurück, das die Web-App lesen darf.
 *
 * Einrichtung: script.google.com → Neues Projekt → diesen Code einfügen →
 * Bereitstellen → Neue Bereitstellung → Typ „Web-App“ →
 * Ausführen als „Ich“, Zugriff „Jeder“ → URL kopieren.
 */
const NUTZER = "PeterHentai";

function doGet() {
  const cache = CacheService.getScriptCache();
  let text = cache.get("feed");
  if (!text) {
    const daten = feedLesen();
    text = JSON.stringify(daten);
    // Zwei Minuten merken, damit Letterboxd nicht bei jedem Öffnen gefragt wird. Fehler werden nicht gemerkt.
    if (!daten.fehler && text.length < 90000) cache.put("feed", text, 120);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function feedLesen() {
  const antwort = UrlFetchApp.fetch("https://letterboxd.com/" + NUTZER + "/rss/", { muteHttpExceptions: true });
  if (antwort.getResponseCode() !== 200) {
    return { fehler: "Letterboxd antwortet mit Status " + antwort.getResponseCode() };
  }
  const lb = XmlService.getNamespace("https://letterboxd.com");
  const eintraege = XmlService.parse(antwort.getContentText())
    .getRootElement().getChild("channel").getChildren("item");
  const filme = [];
  eintraege.forEach(function (e) {
    const titel = e.getChildText("filmTitle", lb);
    const gesehen = e.getChildText("watchedDate", lb);
    if (!titel || !gesehen) return; // Listen und Einträge ohne Datum überspringen
    const wertung = e.getChildText("memberRating", lb);
    const jahr = e.getChildText("filmYear", lb);
    filme.push({
      titel: titel,
      jahr: jahr ? Number(jahr) : null,
      wertung: wertung ? Number(wertung) : null,
      datum: gesehen,
      wieder: e.getChildText("rewatch", lb) === "Yes",
      herz: e.getChildText("memberLike", lb) === "Yes",
      url: e.getChildText("link"),
    });
  });
  return { stand: new Date().toISOString(), filme: filme };
}

/** Zum Ausprobieren im Editor: „probe“ auswählen und auf Ausführen klicken. */
function probe() {
  const daten = feedLesen();
  Logger.log(daten.fehler || (daten.filme.length + " Einträge, neuester: " + daten.filme[0].titel));
}
