(() => {
  const SEITE = 60;
  const WUNSCH_SCHLUESSEL = "filmdenker.wunschliste";
  const $ = (s) => document.querySelector(s);
  const zustand = {
    filme: [], nachId: {}, denker: {}, links: {}, wunsch: [],
    vorrat: [], versatz: 0, notizen: [], entwurf: null, notizSuche: "",
    treffer: [], gezeigt: 0, filter: "alle", suche: "", sortierung: "zuletzt", jahrzehnt: "",
  };

  const text = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const absaetze = (s) => s.split("\n\n").map((a) => `<p>${text(a)}</p>`).join("");
  const sterne = (w) => (w == null ? "" : "★".repeat(Math.floor(w)) + (w % 1 ? "½" : ""));
  const datum = (iso) => {
    const [j, m, t] = iso.split("-");
    return `${t}.${m}.${j}`;
  };
  const normal = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Ein Film ist über seine Letterboxd-Kennung und über einen Titel-Jahr-Schlüssel auffindbar.
  // Filme aus dem Live-Feed haben nur den zweiten; so bleiben Notizen und Verknüpfungen nach einem neuen Export gültig.
  const aliasVon = (titel, jahr) => `s:${normal(titel).replace(/[^a-z0-9]+/g, "-")}-${jahr ?? ""}`;
  const linkVon = (f) => zustand.links[f.id] ?? zustand.links[f.alias];
  const gleicherFilm = (a, b) => a === b || (!!zustand.nachId[a] && zustand.nachId[a] === zustand.nachId[b]);
  const aufWunsch = (f) => zustand.wunsch.some((id) => gleicherFilm(id, f.id));
  const denkerVon = (f) => (linkVon(f) ? zustand.denker[linkVon(f).d] : null);

  // Wunschliste: Filme, für die eine Denker-Verknüpfung angefragt ist (nur auf diesem Gerät).
  function wunschLaden() {
    try { zustand.wunsch = JSON.parse(localStorage.getItem(WUNSCH_SCHLUESSEL)) || []; } catch { zustand.wunsch = []; }
  }
  function wunschSpeichern() {
    try { localStorage.setItem(WUNSCH_SCHLUESSEL, JSON.stringify(zustand.wunsch)); } catch { /* ohne Speicher gilt die Liste nur bis zum Schließen */ }
  }
  function wunschUmschalten(id) {
    zustand.wunsch = zustand.wunsch.some((x) => gleicherFilm(x, id)) ? zustand.wunsch.filter((x) => !gleicherFilm(x, id)) : [...zustand.wunsch, id];
    wunschSpeichern();
    denkerZeichnen();
  }

  const filter = {
    alle: () => true,
    denker: (f) => !!linkVon(f),
    liebling: (f) => f.liebling != null,
    hoch: (f) => f.wertung >= 4.5,
    herz: (f) => f.herz,
    wieder: (f) => f.gesehen.length > 1 || f.gesehen.some((g) => g.wieder),
  };
  const ordnung = {
    zuletzt: (a, b) => b.zuletzt.localeCompare(a.zuletzt),
    wertung: (a, b) => (b.wertung ?? -1) - (a.wertung ?? -1) || a.titel.localeCompare(b.titel, "de"),
    "jahr-neu": (a, b) => (b.jahr ?? 0) - (a.jahr ?? 0),
    "jahr-alt": (a, b) => (a.jahr ?? 9999) - (b.jahr ?? 9999),
    titel: (a, b) => a.titel.localeCompare(b.titel, "de"),
  };

  function berechnen() {
    const q = normal(zustand.suche.trim());
    const istLiebling = zustand.filter === "liebling" && zustand.sortierung === "zuletzt";
    zustand.treffer = zustand.filme
      .filter(filter[zustand.filter])
      .filter((f) => !q || f.such.includes(q))
      .filter((f) => !zustand.jahrzehnt || (f.jahr && Math.floor(f.jahr / 10) * 10 === +zustand.jahrzehnt))
      .sort(istLiebling ? (a, b) => a.liebling - b.liebling : ordnung[zustand.sortierung]);
    zustand.gezeigt = 0;
    $("#liste").innerHTML = "";
    $("#leer").hidden = zustand.treffer.length > 0;
    $("#zaehler").textContent =
      zustand.treffer.length === zustand.filme.length
        ? `${zustand.filme.length} Filme`
        : `${zustand.treffer.length} von ${zustand.filme.length} Filmen`;
    mehr();
  }

  const filmZeile = (f) => {
    const d = denkerVon(f);
    return `<li><button class="film" data-id="${f.id}">
      <span class="titel">${f.liebling != null ? `<span class="marke">${f.liebling}. </span>` : ""}${text(f.titel)}<span class="jahr">${f.jahr ?? ""}</span></span>
      <span class="sterne" aria-label="${f.wertung ?? "keine"} Sterne">${sterne(f.wertung)}</span>
      <span class="unten">${f.neu ? '<span class="neu">Neu</span> · ' : ""}${d ? `<span class="marke">${text(d.name)}</span> · ` : ""}Gesehen ${datum(f.zuletzt)}${f.gesehen.length > 1 ? ` · ${f.gesehen.length}× im Tagebuch` : ""}${f.herz ? " · ♥" : ""}</span>
    </button></li>`;
  };

  function mehr() {
    const teil = zustand.treffer.slice(zustand.gezeigt, zustand.gezeigt + SEITE);
    if (!teil.length) return;
    zustand.gezeigt += teil.length;
    $("#liste").insertAdjacentHTML("beforeend", teil.map(filmZeile).join(""));
  }

  function denkerAbschnitt(f) {
    const v = linkVon(f);
    if (!v) {
      const an = aufWunsch(f);
      return `<h3>Denker</h3>
        <p class="kasten">${an
          ? "Steht auf deiner Wunschliste. Die Liste findest du im Bereich Denker."
          : "Zu diesem Film gibt es noch keine philosophische Verknüpfung."}</p>
        <button class="knopf" data-wunsch="${f.id}">${an ? "Von der Wunschliste nehmen" : "Denker anfragen"}</button>`;
    }
    const d = zustand.denker[v.d];
    return `<h3>Denker</h3>
      <button class="denker-kopf" data-denker="${v.d}">
        <span class="denker-name">${text(d.name)}</span>
        <span class="leise">${text(v.begriff)}</span>
      </button>
      ${v.idee ? `
        <h4>Die Grundidee</h4><div class="fliess"><p>${text(v.idee)}</p></div>
        ${v.zitat ? `<blockquote>${text(v.zitat)}<footer>${text(v.quelle)}</footer></blockquote>` : ""}
        <h4>Im Film</h4><ul class="punkte">${v.szenen.map((x) => `<li>${text(x)}</li>`).join("")}</ul>
        <h4>Einwand</h4><div class="fliess"><p>${text(v.einwand)}</p></div>
        <h4>Fragen zum Weiterdenken</h4><ol class="punkte fragen">${v.fragen.map((x) => `<li>${text(x)}</li>`).join("")}</ol>`
      : `<div class="fliess">${absaetze(v.text)}</div>
        ${v.zitat ? `<blockquote>${text(v.zitat)}<footer>${text(v.quelle)}</footer></blockquote>` : ""}`}
      ${v.lesen ? `<p class="lesen"><span>Zum Weiterlesen</span>${text(v.lesen)}</p>` : ""}`;
  }

  function filmOeffnen(id) {
    const f = zustand.nachId[id];
    if (!f) return;
    const eintraege = f.gesehen.length
      ? `<h3>Tagebuch</h3><ul>${[...f.gesehen]
          .reverse()
          .map((g) => `<li><span>${datum(g.datum)}${g.wieder ? " · erneut gesehen" : ""}</span><span class="sterne">${sterne(g.wertung)}</span></li>`)
          .join("")}</ul>`
      : "";
    blattZeigen(`
      <h2 id="blatt-titel">${text(f.titel)}</h2>
      <p class="leise">${f.jahr ?? ""}${f.liebling != null ? ` · Platz ${f.liebling} deiner Lieblingsfilme` : ""}${f.herz ? " · ♥" : ""}</p>
      <p class="sterne">${sterne(f.wertung) || '<span class="leise">Ohne Wertung</span>'}</p>
      ${denkerAbschnitt(f)}
      ${notizenAbschnitt("film", f.id)}
      ${f.kritik ? `<h3>Deine Kritik</h3><blockquote>${text(f.kritik)}</blockquote>` : ""}
      ${eintraege}
      <a class="knopf" href="${f.url}" target="_blank" rel="noopener">Auf Letterboxd öffnen</a>`);
    $("#blatt").dataset.film = id;
  }

  const filmeVon = (denkerId) =>
    zustand.filme.filter((f) => linkVon(f)?.d === denkerId).sort(ordnung.wertung);

  function denkerOeffnen(id) {
    const d = zustand.denker[id];
    if (!d) return;
    blattZeigen(`
      <h2 id="blatt-titel">${text(d.name)}</h2>
      <p class="leise">${text(d.daten)}</p>
      <div class="fliess"><p>${text(d.kurz)}</p></div>
      <p class="lesen"><span>Zum Einstieg</span>${text(d.werk)}</p>
      ${filmeVon(id).length ? `<h3>Deine Filme dazu</h3>
      <ul class="liste eng">${filmeVon(id)
        .map((f) => `<li><button class="film" data-id="${f.id}">
          <span class="titel">${text(f.titel)}<span class="jahr">${f.jahr ?? ""}</span></span>
          <span class="sterne">${sterne(f.wertung)}</span>
          <span class="unten">${text(linkVon(f).begriff)}</span></button></li>`)
        .join("")}</ul>` : ""}
      ${notizenAbschnitt("denker", id)}`);
    delete $("#blatt").dataset.film;
  }

  function denkerZeichnen() {
    const liste = Object.entries(zustand.denker)
      .map(([id, d]) => ({ id, d, anzahl: filmeVon(id).length }))
      .filter((e) => e.anzahl)
      .sort((a, b) => b.anzahl - a.anzahl || a.d.name.localeCompare(b.d.name, "de"));
    const wunschFilme = zustand.wunsch.map((id) => zustand.nachId[id]).filter(Boolean);
    $("#ansicht-denker").innerHTML = `
      <div class="block">
        <h2>Denker</h2>
        <p class="leise">${liste.length} Denker, verknüpft mit ${Object.keys(zustand.links).length} deiner Filme</p>
      </div>
      <ul class="liste">${liste
        .map((e) => `<li><button class="film" data-denker="${e.id}">
          <span class="titel">${text(e.d.name)}</span>
          <span class="leise">${e.anzahl} ${e.anzahl === 1 ? "Film" : "Filme"}</span>
          <span class="unten">${text(e.d.daten)}</span></button></li>`)
        .join("")}</ul>
      <div class="block">
        <h2>Wunschliste</h2>
        ${wunschFilme.length
          ? `<p class="leise">Für diese Filme hast du eine Verknüpfung angefragt. Kopiere die Liste und schick sie Claude.</p>
             <ul class="liste eng">${wunschFilme
               .map((f) => `<li><button class="film" data-id="${f.id}"><span class="titel">${text(f.titel)}<span class="jahr">${f.jahr ?? ""}</span></span><span class="sterne">${sterne(f.wertung)}</span></button></li>`)
               .join("")}</ul>
             <button class="knopf" id="wunsch-kopieren">Liste kopieren</button>
             <p id="wunsch-meldung" class="leise" role="status"></p>`
          : `<p class="leise">Noch leer. Öffne einen Film ohne Verknüpfung und tippe auf „Denker anfragen“.</p>`}
      </div>`;
  }

  async function wunschKopieren() {
    const zeilen = zustand.wunsch.map((id) => zustand.nachId[id]).filter(Boolean).map((f) => `- ${f.titel} (${f.jahr ?? "?"}) [${f.id}]`);
    const inhalt = `Bitte Denker-Verknüpfungen für diese Filme ergänzen:\n${zeilen.join("\n")}`;
    let ok = false;
    try { await navigator.clipboard.writeText(inhalt); ok = true; } catch { ok = false; }
    $("#wunsch-meldung").textContent = ok ? "Kopiert." : "Kopieren nicht möglich. Bitte die Titel von Hand abschreiben.";
  }

  // Tagesimpuls: fester Wechsel aus geschriebenen Impulsen und Film-Verknüpfungen, ein Eintrag pro Kalendertag.
  const START = new Date(2026, 10, 10);
  const tagNummer = (versatz) => {
    const h = new Date();
    return Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - START) / 864e5) + versatz;
  };
  function vorratBauen(impulse) {
    const filme = Object.keys(zustand.links).filter((id) => zustand.nachId[id]).map((id) => ({ film: id }));
    const vorrat = [];
    for (let i = 0; i < Math.max(impulse.length, filme.length); i++) {
      if (impulse[i]) vorrat.push(impulse[i]);
      if (filme[i]) vorrat.push(filme[i]);
    }
    return vorrat;
  }
  function heuteZeichnen() {
    const n = zustand.vorrat.length;
    if (!n) return;
    const nr = tagNummer(zustand.versatz);
    const e = zustand.vorrat[((nr % n) + n) % n];
    const tag = new Date(START.getFullYear(), START.getMonth(), START.getDate() + nr);
    const kopf = `<div class="block tag">
        <button class="pfeil" data-tag="-1" aria-label="Vorheriger Tag">‹</button>
        <p class="leise">${zustand.versatz === 0 ? "Heute · " : ""}${tag.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
        <button class="pfeil" data-tag="1" aria-label="Nächster Tag" ${zustand.versatz >= 0 ? "disabled" : ""}>›</button>
      </div>`;
    let inhalt;
    if (e.film) {
      const f = zustand.nachId[e.film];
      const v = linkVon(f);
      const d = zustand.denker[v.d];
      inhalt = `<p class="art">Aus deinen Filmen</p>
        <h2>${text(v.begriff)}</h2>
        <p class="leise">${text(d.name)} · ${text(f.titel)} (${f.jahr ?? ""})</p>
        <div class="fliess">${absaetze(v.text.split("\n\n")[0])}</div>
        ${v.zitat ? `<blockquote>${text(v.zitat)}<footer>${text(v.quelle)}</footer></blockquote>` : ""}
        <div class="knoepfe">
          <button class="knopf" data-id="${f.id}">Zum Film</button>
          <button class="knopf" data-denker="${v.d}">Über ${text(d.name)}</button>
        </div>`;
    } else {
      const d = zustand.denker[e.d];
      inhalt = `<p class="art">${e.zitat ? "Zitat" : "Gedanke"}</p>
        <h2>${text(e.titel)}</h2>
        <p class="leise">${text(d.name)} · ${text(d.daten)}</p>
        ${e.zitat ? `<blockquote class="gross">${text(e.zitat)}<footer>${text(e.quelle)}</footer></blockquote>` : ""}
        <div class="fliess">${absaetze(e.text)}</div>
        <div class="frage"><span>Für dein Notizbuch</span>${text(e.frage)}</div>
        <div class="knoepfe"><button class="knopf" data-denker="${e.d}">Über ${text(d.name)}</button></div>`;
    }
    const notizen = e.film ? notizenAbschnitt("film", e.film) : notizenAbschnitt("impuls", `${e.d}|${e.titel}`);
    $("#ansicht-heute").innerHTML = `${kopf}<article class="impuls">${inhalt}<div class="impuls-notizen">${notizen}</div></article>`;
  }

  // ---- Live-Abgleich mit Letterboxd ----
  const FEED_SCHLUESSEL = "filmdenker.feed";
  let feedZuletzt = 0;
  function verzeichnen(f) {
    f.alias = aliasVon(f.titel, f.jahr);
    f.such = normal(`${f.titel} ${f.jahr ?? ""}`);
    zustand.nachId[f.id] = f;
    zustand.nachId[f.alias] ??= f;
  }
  // Trägt Feed-Einträge in die Filmliste ein. Mehrfaches Einarbeiten derselben Einträge ändert nichts.
  function feedEinarbeiten(eintraege) {
    let neu = 0;
    for (const e of [...eintraege].sort((a, b) => a.datum.localeCompare(b.datum))) {
      if (!e?.titel || !/^\d{4}-\d{2}-\d{2}$/.test(e.datum ?? "")) continue;
      let f = zustand.nachId[aliasVon(e.titel, e.jahr)];
      if (!f) {
        f = { id: aliasVon(e.titel, e.jahr), titel: e.titel, jahr: e.jahr ?? null, url: e.url || "https://letterboxd.com", eingetragen: e.datum,
              wertung: null, gesehen: [], liebling: null, herz: false, zuletzt: e.datum, neu: true };
        zustand.filme.push(f);
        verzeichnen(f);
      }
      if (!f.gesehen.some((g) => g.datum === e.datum)) {
        f.gesehen.push({ datum: e.datum, wertung: e.wertung ?? null, wieder: !!e.wieder });
        f.gesehen.sort((a, b) => a.datum.localeCompare(b.datum));
        neu++;
      }
      if (e.datum >= f.zuletzt) {
        f.zuletzt = e.datum;
        if (e.wertung != null) f.wertung = e.wertung;
        if (e.herz) f.herz = true;
      }
    }
    return neu;
  }
  function allesZeichnen() {
    berechnen();
    denkerZeichnen();
    heuteZeichnen();
    notizenZeichnen();
  }
  async function feedHolen() {
    const adresse = window.ZONE_FEED;
    const status = (t) => { $("#feed-status").textContent = t; };
    if (!adresse) return status("Stand des Exports. Der Live-Abgleich mit Letterboxd ist noch nicht eingerichtet.");
    if (Date.now() - feedZuletzt < 120000) return;
    feedZuletzt = Date.now();
    try {
      const antwort = await fetch(adresse);
      if (!antwort.ok) throw new Error(`Status ${antwort.status}`);
      const daten = await antwort.json();
      if (daten.fehler || !Array.isArray(daten.filme)) throw new Error(daten.fehler || "unerwartete Antwort");
      try { localStorage.setItem(FEED_SCHLUESSEL, JSON.stringify(daten)); } catch { /* dann eben ohne Zwischenspeicher */ }
      const neu = feedEinarbeiten(daten.filme);
      if (neu) allesZeichnen();
      status(`Mit Letterboxd abgeglichen um ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`);
    } catch (fehler) {
      console.error(fehler);
      feedZuletzt = 0;
      status("Letterboxd gerade nicht erreichbar. Du siehst den zuletzt geladenen Stand.");
    }
  }

  // ---- Notizen ----
  const zeit = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  function bezugText(b) {
    if (b.art === "film") { const f = zustand.nachId[b.id]; return `Film · ${f ? `${f.titel} (${f.jahr ?? ""})` : b.id}`; }
    if (b.art === "denker") return `Denker · ${zustand.denker[b.id]?.name ?? b.id}`;
    if (b.art === "impuls") return `Tagesimpuls · ${b.id.split("|")[1] ?? b.id}`;
    return "Freie Notiz";
  }
  const notizenFuer = (art, id) =>
    zustand.notizen.filter((n) => n.bezug.art === art && (n.bezug.id === id || (art === "film" && gleicherFilm(n.bezug.id, id)))).sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  const notizKarte = (n, mitBezug) => `<li><button class="notiz" data-notiz="${n.id}">
      <span class="leise">${mitBezug ? `${text(bezugText(n.bezug))} · ` : ""}${zeit(n.geaendert)}${n.fotos.length ? ` · ${n.fotos.length} ${n.fotos.length === 1 ? "Foto" : "Fotos"}` : ""}</span>
      ${n.text ? `<span class="notiz-text">${text(n.text.length > 220 ? `${n.text.slice(0, 220)}…` : n.text)}</span>` : ""}
      ${n.fotos.length ? `<span class="daumen">${n.fotos.slice(0, 4).map((u) => `<img src="${u}" alt="">`).join("")}</span>` : ""}
    </button></li>`;
  function notizenAbschnitt(art, id) {
    const liste = notizenFuer(art, id);
    return `<h3>Deine Notizen</h3>
      ${liste.length ? `<ul class="notizen">${liste.map((n) => notizKarte(n, false)).join("")}</ul>` : ""}
      <button class="knopf" data-neu="${art}" data-neu-id="${text(id)}">Notiz schreiben</button>`;
  }

  function notizBearbeiten(notiz, zurueck) {
    zustand.entwurf = { notiz: { ...notiz, fotos: [...notiz.fotos] }, neu: !zustand.notizen.some((n) => n.id === notiz.id), geaendert: false, zurueck };
    const e = zustand.entwurf;
    blattZeigen(`
      <h2 id="blatt-titel">Notiz</h2>
      <p class="leise">${text(bezugText(e.notiz.bezug))}</p>
      <textarea id="notiz-text" rows="8" placeholder="Deine Gedanken …" aria-label="Notiztext">${text(e.notiz.text)}</textarea>
      <div id="notiz-fotos" class="fotos"></div>
      <label class="knopf">Foto hinzufügen<input id="notiz-datei" type="file" accept="image/*" multiple hidden></label>
      <p id="notiz-meldung" class="leise" role="status"></p>
      <div class="knoepfe">
        <button class="knopf haupt" id="notiz-speichern">Speichern</button>
        <button class="knopf" id="notiz-abbrechen">Abbrechen</button>
        ${e.neu ? "" : '<button class="knopf warn" id="notiz-loeschen">Löschen</button>'}
      </div>`);
    delete $("#blatt").dataset.film;
    fotosZeichnen();
    $("#notiz-text").addEventListener("input", (ev) => { e.notiz.text = ev.target.value; e.geaendert = true; });
    $("#notiz-datei").addEventListener("change", fotosHinzufuegen);
  }
  function fotosZeichnen() {
    $("#notiz-fotos").innerHTML = zustand.entwurf.notiz.fotos
      .map((u, i) => `<span class="foto"><img src="${u}" alt="Foto ${i + 1}" data-bild="${i}"><button data-foto-weg="${i}" aria-label="Foto ${i + 1} entfernen">×</button></span>`)
      .join("");
  }
  async function bildVerkleinern(datei) {
    const url = URL.createObjectURL(datei);
    try {
      const bild = new Image();
      bild.src = url;
      await bild.decode();
      const f = Math.min(1, 1600 / Math.max(bild.width, bild.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bild.width * f);
      c.height = Math.round(bild.height * f);
      c.getContext("2d").drawImage(bild, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function fotosHinzufuegen(ev) {
    const e = zustand.entwurf;
    let fehler = 0;
    for (const datei of ev.target.files) {
      try { e.notiz.fotos.push(await bildVerkleinern(datei)); e.geaendert = true; } catch { fehler++; }
    }
    ev.target.value = "";
    if (zustand.entwurf !== e) return;
    fotosZeichnen();
    $("#notiz-meldung").textContent = fehler ? `${fehler} ${fehler === 1 ? "Bild konnte" : "Bilder konnten"} nicht gelesen werden.` : "";
  }
  function entwurfBeenden() {
    const zurueck = zustand.entwurf?.zurueck;
    zustand.entwurf = null;
    notizenZeichnen();
    heuteZeichnen();
    if (zurueck) zurueck(); else schliessen();
  }
  async function notizSpeichern() {
    const e = zustand.entwurf;
    const n = e.notiz;
    if (!n.text.trim() && !n.fotos.length) { $("#notiz-meldung").textContent = "Die Notiz ist noch leer."; return; }
    const jetzt = new Date().toISOString();
    const fertig = { ...n, text: n.text.trim(), erstellt: n.erstellt ?? jetzt, geaendert: jetzt };
    try {
      await Speicher.sichern(fertig);
    } catch (fehler) {
      console.error(fehler);
      $("#notiz-meldung").textContent = "Speichern fehlgeschlagen. Vermutlich ist der Speicher voll; entferne Fotos und versuche es erneut.";
      return;
    }
    zustand.notizen = [...zustand.notizen.filter((x) => x.id !== fertig.id), fertig];
    entwurfBeenden();
  }
  async function notizLoeschen() {
    const id = zustand.entwurf.notiz.id;
    if (!confirm("Diese Notiz endgültig löschen?")) return;
    try { await Speicher.loeschen(id); } catch (fehler) { console.error(fehler); $("#notiz-meldung").textContent = "Löschen fehlgeschlagen."; return; }
    zustand.notizen = zustand.notizen.filter((x) => x.id !== id);
    entwurfBeenden();
  }
  const neueNotiz = (art, id) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    bezug: { art, id }, text: "", fotos: [],
  });

  function notizenZeichnen() {
    const q = normal(zustand.notizSuche.trim());
    const liste = zustand.notizen
      .filter((n) => !q || normal(`${n.text} ${bezugText(n.bezug)}`).includes(q))
      .sort((a, b) => b.geaendert.localeCompare(a.geaendert));
    $("#notizen-liste").innerHTML = liste.length
      ? `<ul class="notizen">${liste.map((n) => notizKarte(n, true)).join("")}</ul>`
      : `<p class="leise">${zustand.notizen.length ? "Keine Notiz passt zur Suche." : "Noch keine Notizen. Schreib eine freie Notiz oder öffne einen Film, Denker oder Tagesimpuls."}</p>`;
    $("#notizen-zahl").textContent = `${zustand.notizen.length} ${zustand.notizen.length === 1 ? "Notiz" : "Notizen"}, nur auf diesem Gerät gespeichert`;
  }

  async function sicherungSpeichern() {
    const melde = (t) => { $("#sicherung-meldung").textContent = t; };
    const name = `filmdenker-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    const datei = new File(
      [JSON.stringify({ app: "filmdenker", version: 1, erstellt: new Date().toISOString(), notizen: zustand.notizen, wunsch: zustand.wunsch })],
      name, { type: "application/json" }
    );
    if (navigator.canShare?.({ files: [datei] })) {
      try { await navigator.share({ files: [datei] }); return melde("Sicherung übergeben."); } catch (fehler) { if (fehler.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(datei);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    melde(`Sicherung als ${name} gespeichert.`);
  }
  async function sicherungEinlesen(ev) {
    const melde = (t) => { $("#sicherung-meldung").textContent = t; };
    const datei = ev.target.files[0];
    ev.target.value = "";
    if (!datei) return;
    let daten;
    try { daten = JSON.parse(await datei.text()); } catch { return melde("Die Datei ist keine gültige Sicherung."); }
    if (daten?.app !== "filmdenker" || !Array.isArray(daten.notizen)) return melde("Die Datei ist keine Filmdenker-Sicherung.");
    let neu = 0;
    try {
      for (const n of daten.notizen) {
        if (!n?.id || !n.bezug || !Array.isArray(n.fotos)) continue;
        const da = zustand.notizen.find((x) => x.id === n.id);
        if (da && da.geaendert >= n.geaendert) continue;
        await Speicher.sichern(n);
        zustand.notizen = [...zustand.notizen.filter((x) => x.id !== n.id), n];
        neu++;
      }
    } catch (fehler) {
      console.error(fehler);
      notizenZeichnen();
      return melde(`Einlesen abgebrochen nach ${neu} Notizen. Vermutlich ist der Speicher voll.`);
    }
    if (Array.isArray(daten.wunsch)) { zustand.wunsch = [...new Set([...zustand.wunsch, ...daten.wunsch])]; wunschSpeichern(); denkerZeichnen(); }
    notizenZeichnen();
    heuteZeichnen();
    melde(`${neu} ${neu === 1 ? "Notiz" : "Notizen"} übernommen, vorhandene neuere blieben unverändert.`);
  }

  function blattZeigen(html) {
    $("#blatt-koerper").innerHTML = html;
    $("#blatt").hidden = false;
    $(".blatt-inhalt").scrollTop = 0;
    document.body.style.overflow = "hidden";
  }
  function schliessen() {
    if (zustand.entwurf?.geaendert && !confirm("Änderungen an der Notiz verwerfen?")) return;
    zustand.entwurf = null;
    $("#blatt").hidden = true;
    document.body.style.overflow = "";
  }

  function verdrahten() {
    $("#suche").addEventListener("input", (e) => { zustand.suche = e.target.value; berechnen(); });
    $("#sortierung").addEventListener("change", (e) => { zustand.sortierung = e.target.value; berechnen(); });
    $("#jahrzehnt").addEventListener("change", (e) => { zustand.jahrzehnt = e.target.value; berechnen(); });
    $("#notiz-suche").addEventListener("input", (e) => { zustand.notizSuche = e.target.value; notizenZeichnen(); });
    $("#sicherung-datei").addEventListener("change", sicherungEinlesen);
    $("#chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      zustand.filter = b.dataset.filter;
      document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("an", c === b));
      berechnen();
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("#wunsch-kopieren")) return wunschKopieren();
      if (e.target.closest("#bild")) { $("#bild").hidden = true; return; }
      if (e.target.closest("#notiz-speichern")) return notizSpeichern();
      if (e.target.closest("#notiz-loeschen")) return notizLoeschen();
      if (e.target.closest("#notiz-abbrechen")) {
        if (zustand.entwurf.geaendert && !confirm("Änderungen an der Notiz verwerfen?")) return;
        return entwurfBeenden();
      }
      if (e.target.closest("#sicherung-speichern")) return sicherungSpeichern();
      const fotoWeg = e.target.closest("[data-foto-weg]");
      if (fotoWeg) { zustand.entwurf.notiz.fotos.splice(+fotoWeg.dataset.fotoWeg, 1); zustand.entwurf.geaendert = true; return fotosZeichnen(); }
      const bild = e.target.closest("[data-bild]");
      if (bild) { $("#bild img").src = bild.src; $("#bild").hidden = false; return; }
      const neu = e.target.closest("[data-neu]");
      const notiz = e.target.closest("[data-notiz]");
      if (neu || notiz) {
        // Aus einem Film- oder Denker-Blatt heraus geöffnet: nach dem Speichern dorthin zurück.
        const imBlatt = !!e.target.closest("#blatt");
        const n = notiz ? zustand.notizen.find((x) => x.id === notiz.dataset.notiz) : neueNotiz(neu.dataset.neu, neu.dataset.neuId);
        if (!n) return;
        const zurueck = !imBlatt ? null : n.bezug.art === "film" ? () => filmOeffnen(n.bezug.id) : n.bezug.art === "denker" ? () => denkerOeffnen(n.bezug.id) : null;
        return notizBearbeiten(n, zurueck);
      }
      const tag = e.target.closest("[data-tag]");
      if (tag) { zustand.versatz = Math.min(0, zustand.versatz + +tag.dataset.tag); return heuteZeichnen(); }
      const wunsch = e.target.closest("[data-wunsch]");
      if (wunsch) { wunschUmschalten(wunsch.dataset.wunsch); return filmOeffnen(wunsch.dataset.wunsch); }
      const denker = e.target.closest("[data-denker]");
      if (denker) return denkerOeffnen(denker.dataset.denker);
      const film = e.target.closest("[data-id]");
      if (film) return filmOeffnen(film.dataset.id);
      if (e.target.closest("[data-zu]")) schliessen();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") schliessen(); });
    document.querySelector(".leiste").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ziel]");
      if (!b) return;
      document.querySelectorAll(".leiste button").forEach((x) => x.classList.toggle("an", x === b));
      document.querySelectorAll(".ansicht").forEach((a) => a.classList.toggle("aktiv", a.id === `ansicht-${b.dataset.ziel}`));
      $("#zaehler").hidden = b.dataset.ziel !== "filme";
      window.scrollTo(0, 0);
    });
    new IntersectionObserver((e) => { if (e[0].isIntersecting) mehr(); }, { rootMargin: "600px" }).observe($("#nachladen"));
  }

  async function start() {
    verdrahten();
    wunschLaden();
    try {
      const [daten, denker, impulse, vertiefung] = await Promise.all(
        ["data/filme.json", "data/denker.json", "data/impulse.json", "data/vertiefung.json"].map(async (u) => (await fetch(u)).json())
      );
      zustand.filme = daten.filme;
      zustand.filme.forEach(verzeichnen);
      try { feedEinarbeiten(JSON.parse(localStorage.getItem(FEED_SCHLUESSEL))?.filme ?? []); } catch { /* kein gemerkter Feed */ }
      zustand.denker = { ...denker.denker, ...impulse.denker };
      zustand.links = denker.verknuepfungen;
      for (const [id, v] of Object.entries(vertiefung)) if (zustand.links[id]) Object.assign(zustand.links[id], v);
      zustand.vorrat = vorratBauen(impulse.impulse);
      try {
        zustand.notizen = await Speicher.alle();
        navigator.storage?.persist?.().catch(() => {});
      } catch (fehler) {
        console.error(fehler);
        $("#sicherung-meldung").textContent = "Der Notizspeicher ist in diesem Browser nicht verfügbar (z. B. im privaten Modus).";
      }
      heuteZeichnen();
      notizenZeichnen();
      const jahrzehnte = [...new Set(zustand.filme.filter((f) => f.jahr).map((f) => Math.floor(f.jahr / 10) * 10))].sort((a, b) => b - a);
      $("#jahrzehnt").insertAdjacentHTML("beforeend", jahrzehnte.map((j) => `<option value="${j}">${j}er</option>`).join(""));
      berechnen();
      denkerZeichnen();
      feedHolen();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) feedHolen(); });
    } catch (fehler) {
      $("#leer").hidden = false;
      $("#leer").textContent = "Die Daten konnten nicht geladen werden.";
      console.error(fehler);
    }
  }

  start();
})();
