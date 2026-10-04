(function () {
	// Rahmensatz: Standard aus img/ oder ein eigener aus frames-custom/ (gleiche Dateinamen und Maße, siehe README).
	// Umschalten über ?frames=custom bzw. ?frames=default in der Adresse; die Wahl wird gemerkt.
	let F = 'img/';
	try { const q = new URLSearchParams(location.search).get('frames'); if (q) localStorage.setItem('nxt-st-frames', q); if (localStorage.getItem('nxt-st-frames') === 'custom') F = 'frames-custom/'; } catch (e) {}
	// Geräte-Rahmen (PNG mit transparentem Bildschirm). screen = Bildschirm in % [links, oben, rechts, unten].
	// r = Eckradius des Bildschirms in Rahmen-Pixeln; nur nötig, wo die Bildecken sonst über die Außenkontur ragen (Smartphone).
	const DEV = {
		monitor: { label: 'Monitor', src: F + 'monitor.png', iw: 1800, ih: 1387, screen: [2.611, 3.389, 97.389, 72.603], vw: 1920, vh: 1080, dsf: 1, mobile: false },
		laptop: { label: 'Laptop', src: F + 'laptop.png', iw: 1800, ih: 1184, screen: [10.833, 11.318, 89.167, 88.682], vw: 1512, vh: 982, dsf: 2, mobile: false },
		tablet: { label: 'Tablet', src: F + 'tablet.png', iw: 1380, ih: 1800, screen: [5.145, 4.111, 94.855, 95.889], vw: 1032, vh: 1376, dsf: 2, mobile: true,
			quer: { src: F + 'tablet-quer.png', iw: 1800, ih: 1380, screen: [4.111, 5.145, 95.889, 94.855], vw: 1376, vh: 1032 } },
		phone: { label: 'Smartphone', src: F + 'phone.png', iw: 880, ih: 1800, screen: [5.341, 2.5, 94.659, 97.5], r: 108, vw: 402, vh: 874, dsf: 3, mobile: true,
			quer: { src: F + 'phone-quer.png', iw: 1800, ih: 880, screen: [2.5, 5.341, 97.5, 94.659], vw: 874, vh: 402 } },
	};
	// Aktive Variante (Hoch- oder Querformat) und Schlüssel für den passenden Screenshot
	const spec = (k) => (layout.d[k].quer && DEV[k].quer ? Object.assign({}, DEV[k], DEV[k].quer) : DEV[k]);
	const shotKey = (k) => k + (layout.d[k].quer && DEV[k].quer ? ':quer' : '');
	const KEYS = Object.keys(DEV);
	// Anordnungen im 2400×1500-Raster: cx = Mitte, by = Unterkante, w = Breite; order = hinten → vorne
	const PRESETS = {
		alle: { label: 'Alle vier', order: ['monitor', 'tablet', 'laptop', 'phone'], d: { monitor: [1150, 1240, 1300], tablet: [470, 1330, 520], laptop: [1760, 1400, 1050], phone: [900, 1420, 240] } },
		laptop: { label: 'Laptop + Mobil', order: ['laptop', 'tablet', 'phone'], d: { laptop: [1200, 1300, 1500], tablet: [420, 1340, 560], phone: [1960, 1380, 280] } },
		monitor: { label: 'Monitor + Handy', order: ['monitor', 'phone'], d: { monitor: [1100, 1380, 1500], phone: [1900, 1400, 330] } },
		mobil: { label: 'Nur Mobil', order: ['tablet', 'phone'], d: { tablet: [950, 1360, 760], phone: [1600, 1400, 400] } },
		reihe: { label: 'Reihe', order: ['monitor', 'laptop', 'tablet', 'phone'], d: { monitor: [640, 1200, 900], laptop: [1460, 1200, 700], tablet: [1990, 1200, 300], phone: [2250, 1200, 150] } },
	};
	const $ = (id) => document.getElementById(id);
	const stage = $('st-stage'), main = $('st-main'), input = $('st-input');
	const setStatus = (t, err) => { $('st-status').textContent = t; $('st-status').classList.toggle('is-error', !!err); };
	const shots = {};
	let layout = null, sel = null, bg = 'transparent', cast = null, win = null, winUrl = '';
	const isLive = (k) => !!(k && cast && cast.k === k);

	const host = () => { try { return new URL(input.value).hostname.replace(/^www\./, ''); } catch (e) { return 'screenshot'; } };
	const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
	const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
	const fromPreset = (p) => ({ preset: p, order: PRESETS[p].order.slice(), d: Object.fromEntries(KEYS.map((k) => [k, PRESETS[p].d[k] ? { cx: PRESETS[p].d[k][0], by: PRESETS[p].d[k][1], w: PRESETS[p].d[k][2], on: true } : { cx: 1200, by: 1300, w: 500, on: false }])) });
	const save = () => store('nxt-st-layout:' + host(), layout);

	// Geometrie
	function geo(k) {
		const d = spec(k), l = layout.d[k], h = l.w * d.ih / d.iw, s = d.screen;
		const o = { x: l.cx - l.w / 2, y: l.by - h, w: l.w, h };
		return { o, s: { x: o.x + o.w * s[0] / 100, y: o.y + o.h * s[1] / 100, w: o.w * (s[2] - s[0]) / 100, h: o.h * (s[3] - s[1]) / 100, r: l.w * (d.r || 0) / d.iw } };
	}

	// Vorschau
	const els = {};
	KEYS.forEach((k) => {
		const d = DEV[k], el = document.createElement('div');
		el.className = 'dev'; el.dataset.k = k; el.tabIndex = 0;
		el.setAttribute('aria-label', d.label + ' – ziehen zum Verschieben, Enter für eigenen Screenshot');
		el.innerHTML = `<div class="dev__screen"><span class="dev__ph">${d.label}<br>Screenshot hierher ziehen</span></div><img class="dev__frame" src="${d.src}" alt="" draggable="false">`;
		stage.append(el); els[k] = el;
		let start = null;
		el.addEventListener('pointerdown', (e) => { select(k); start = { x: e.clientX, y: e.clientY, cx: layout.d[k].cx, by: layout.d[k].by, moved: false }; el.setPointerCapture(e.pointerId); });
		el.addEventListener('pointermove', (e) => {
			if (!start) return;
			const s = scale(), dx = (e.clientX - start.x) / s, dy = (e.clientY - start.y) / s;
			if (!start.moved && Math.hypot(dx, dy) < 6) return;
			start.moved = true; el.classList.add('is-drag');
			layout.d[k].cx = Math.round(start.cx + dx); layout.d[k].by = Math.round(start.by + dy); place(k);
		});
		el.addEventListener('pointerup', () => { if (start && start.moved) { layout.preset = null; save(); markPreset(); } start = null; el.classList.remove('is-drag'); });
		el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') { e.preventDefault(); pick(k); return; }
			const m = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
			if (m) { e.preventDefault(); layout.d[k].cx += m[0]; layout.d[k].by += m[1]; layout.preset = null; place(k); save(); markPreset(); }
		});
		el.addEventListener('focus', () => select(k));
		el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('is-drop'); });
		el.addEventListener('dragleave', () => el.classList.remove('is-drop'));
		el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('is-drop'); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) setShot(k, f); });
	});
	stage.addEventListener('pointerdown', (e) => { if (e.target === stage) select(null); });

	function place(k) {
		const { o, s } = geo(k), el = els[k], scr = el.firstChild, sp = spec(k), frame = el.querySelector('.dev__frame');
		if (!frame.src.endsWith(sp.src)) frame.src = sp.src;
		const sk = shotKey(k), want = isLive(k) ? 'live' : sk;
		if (scr.dataset.shot !== want) {
			scr.dataset.shot = want;
			if (isLive(k)) { scr.replaceChildren(cast.video); cast.video.play().catch(() => {}); } // beim Einfrieren aus der Seite genommen = vom Browser pausiert, also wieder anlaufen lassen
			else scr.innerHTML = shots[sk] ? `<img src="${shots[sk].url}" alt="${DEV[k].label}-Ansicht">` : `<span class="dev__ph">${DEV[k].label}<br>Screenshot hierher ziehen</span>`;
		}
		Object.assign(el.style, { left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' });
		Object.assign(scr.style, { left: (s.x - o.x - 2) + 'px', top: (s.y - o.y - 2) + 'px', width: (s.w + 4) + 'px', height: (s.h + 4) + 'px', borderRadius: s.r + 'px' });
		el.hidden = !layout.d[k].on;
	}
	function render() {
		layout.order.forEach((k, i) => { els[k].style.zIndex = i + 1; });
		KEYS.forEach(place);
		document.querySelectorAll('#st-devs button').forEach((b) => b.classList.toggle('is-off', !layout.d[b.dataset.k].on));
		markPreset();
	}
	function markPreset() { document.querySelectorAll('#st-presets button').forEach((b) => b.classList.toggle('is-active', b.dataset.p === layout.preset)); }
	function select(k) {
		sel = k;
		KEYS.forEach((x) => els[x].classList.toggle('is-sel', x === k));
		$('st-sel').hidden = !k;
		markLive();
		if (k) $('st-size').value = layout.d[k].w;
		const canTurn = !!(k && DEV[k].quer);
		$('st-orient').hidden = !canTurn;
		if (canTurn) document.querySelectorAll('#st-orient button').forEach((b) => b.classList.toggle('is-active', (b.dataset.o === 'quer') === !!layout.d[k].quer));
	}
	document.querySelectorAll('#st-orient button').forEach((b) => b.addEventListener('click', () => {
		if (!sel || !DEV[sel].quer) return;
		const quer = b.dataset.o === 'quer', l = layout.d[sel];
		if (!!l.quer === quer) return;
		const d = spec(sel); l.w = Math.round(l.w * d.ih / d.iw); // gleiche Gerätehöhe → Breite tauschen
		l.quer = quer; layout.preset = null; place(sel); select(sel); markPreset(); save();
		if (!shots[shotKey(sel)] && input.value) fetchOne(sel, input.value).then((e) => e && setStatus(e, true));
	}));
	$('st-size').addEventListener('input', (e) => { if (!sel) return; layout.d[sel].w = +e.target.value; layout.preset = null; place(sel); markPreset(); });
	$('st-size').addEventListener('change', save);
	$('st-front').addEventListener('click', () => { if (!sel) return; layout.order = layout.order.filter((x) => x !== sel).concat(sel); layout.preset = null; render(); save(); });
	$('st-upload').addEventListener('click', () => sel && pick(sel));
	$('st-win').addEventListener('click', () => sel && openWin(sel));
	$('st-live').addEventListener('click', () => sel && goLive(sel));

	// Werkzeugleiste
	Object.entries(PRESETS).forEach(([p, v]) => {
		const b = document.createElement('button'); b.type = 'button'; b.dataset.p = p; b.textContent = v.label;
		b.addEventListener('click', () => { layout = fromPreset(p); select(null); render(); save(); });
		$('st-presets').append(b);
	});
	KEYS.forEach((k) => {
		const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = DEV[k].label;
		b.setAttribute('aria-label', DEV[k].label + ' ein- oder ausblenden');
		b.addEventListener('click', () => { const l = layout.d[k]; l.on = !l.on; if (l.on && !layout.order.includes(k)) layout.order.push(k); layout.preset = null; render(); save(); });
		$('st-devs').append(b);
	});
	document.querySelectorAll('#st-bg button').forEach((b) => b.addEventListener('click', () => {
		bg = b.dataset.bg; stage.className = 'st-stage bg-' + bg;
		document.querySelectorAll('#st-bg button').forEach((x) => x.classList.toggle('is-active', x === b));
		store('nxt-st-bg', bg);
	}));

	// Skalierung
	const scale = () => Math.min(main.clientWidth / 2400, main.clientHeight / 1500);
	function fit() { const s = scale(); stage.style.transform = `translate(${(main.clientWidth - 2400 * s) / 2}px,${(main.clientHeight - 1500 * s) / 2}px) scale(${s})`; }
	addEventListener('resize', fit);

	// Screenshots
	const fileInput = $('st-file'); let pickFor = null;
	function pick(k) { pickFor = k; fileInput.value = ''; fileInput.click(); }
	fileInput.addEventListener('change', () => { const f = fileInput.files[0]; if (f && pickFor) setShot(pickFor, f); });
	function setShot(k, blob) {
		const url = URL.createObjectURL(blob), img = new Image(), sk = shotKey(k);
		return new Promise((res) => {
			img.onload = () => {
				if (shots[sk]) URL.revokeObjectURL(shots[sk].url);
				shots[sk] = { url, img };
				if (!isLive(k)) els[k].firstChild.dataset.shot = '';
				place(k);
				$('st-raw-all').disabled = false;
				$('st-raw-ref').disabled = !(shots.laptop || shots.monitor);
				res();
			};
			img.onerror = res;
			img.src = url;
		});
	}
	// Screenshot aus der Zwischenablage: auf das gewählte Gerät, ohne Auswahl der Reihe nach auf das nächste freie
	addEventListener('paste', (e) => {
		const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.startsWith('image/'));
		if (!f) return;
		e.preventDefault();
		const k = sel || KEYS.find((x) => layout.d[x].on && !shots[shotKey(x)] && !isLive(x));
		if (!k) { setStatus('Alle Geräte sind belegt. Erst das Gerät anklicken, das ersetzt werden soll.', true); return; }
		setShot(k, f); setStatus(`Screenshot eingefügt: ${DEV[k].label}.`);
	});
	// Einfarbiges Bild erkennen: Microlink liefert für Seiten, die es nicht laden kann, ein weißes PNG mit Status 200
	function uniform(src) {
		const c = document.createElement('canvas'); c.width = c.height = 64;
		const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, 64, 64);
		const p = x.getImageData(0, 0, 64, 64).data;
		for (let i = 4; i < p.length; i++) if (Math.abs(p[i] - p[i % 4]) > 2) return false;
		return true;
	}
	async function checked(r) {
		const b = await r.blob(); if (!b.type.startsWith('image/')) throw new Error('kein Bild erhalten');
		const img = await blobImg(b), empty = uniform(img); URL.revokeObjectURL(img.src);
		if (empty) throw new Error('Dienst konnte die Seite nicht laden (leeres Bild)');
		return b;
	}
	// Screenshot-Dienst: eigene browserless-Instanz oder Microlink als Ausweich
	let svc = read('nxt-st-svc') || { url: '', token: '' };
	const hasSvc = () => !!(svc.url && svc.token);
	const markSvc = () => { $('st-svc-dot').classList.toggle('is-on', hasSvc()); $('st-svc-open').title = hasSvc() ? 'Eigener Dienst aktiv' : 'Microlink (Tageskontingent)'; };
	// Cookie-Banner der gängigen Consent-Tools ausblenden (Borlabs, Complianz, Real Cookie Banner, Cookiebot, Usercentrics, OneTrust, Klaro u. a.)
	const HIDE = '#BorlabsCookieBox,#BorlabsCookieWidget,.cmplz-cookiebanner,#cmplz-cookiebanner-container,.rcb-banner,[id^="real-cookie-banner"],#CybotCookiebotDialog,#usercentrics-root,#uc-banner-modal,#onetrust-consent-sdk,.klaro,#cookie-notice,#cookie-law-info-bar,.cky-consent-container,.cky-overlay,#moove_gdpr_cookie_info_bar,.cc-window,.cookie-banner,#cookie-banner,.cookie-consent,#cookieConsent{display:none!important}html,body{overflow:auto!important}';
	async function grab(url, d) {
		if (hasSvc()) {
			const r = await fetch(svc.url.replace(/\/$/, '') + '/screenshot?token=' + encodeURIComponent(svc.token), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url,
					options: { type: 'png' },
					viewport: { width: d.vw, height: d.vh, deviceScaleFactor: d.dsf, isMobile: !!d.mobile, hasTouch: !!d.mobile },
					gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 },
					addStyleTag: [{ content: HIDE }],
					waitForTimeout: 1500,
					bestAttempt: true,
				}),
			});
			if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Token falsch' : r.status === 429 ? 'Dienst ausgelastet' : 'Fehler ' + r.status);
			return checked(r);
		}
		const p = new URLSearchParams({ url, screenshot: 'true', meta: 'false', embed: 'screenshot.url', adblock: 'true', waitForTimeout: '2500', 'viewport.width': d.vw, 'viewport.height': d.vh, 'viewport.deviceScaleFactor': d.dsf, 'viewport.isMobile': d.mobile, 'viewport.hasTouch': d.mobile });
		const r = await fetch('https://api.microlink.io/?' + p.toString());
		if (!r.ok) throw new Error(r.status === 429 ? 'Microlink-Tageskontingent erreicht' : 'Fehler ' + r.status);
		return checked(r);
	}
	async function fetchOne(k, url) {
		els[k].classList.add('is-loading');
		let er = null;
		try { setShot(k, await grab(url, spec(k))); }
		catch (err) { er = DEV[k].label + ': ' + err.message; }
		els[k].classList.remove('is-loading');
		return er;
	}
	// Dienst-Dialog
	const svcDlg = $('st-svc');
	$('st-svc-open').addEventListener('click', () => { $('st-svc-url').value = svc.url; $('st-svc-token').value = svc.token; $('st-svc-msg').textContent = ''; svcDlg.showModal(); });
	$('st-svc-save').addEventListener('click', () => { svc = { url: $('st-svc-url').value.trim(), token: $('st-svc-token').value.trim() }; store('nxt-st-svc', svc); markSvc(); });
	$('st-svc-test').addEventListener('click', async () => {
		const m = $('st-svc-msg'), prev = svc;
		svc = { url: $('st-svc-url').value.trim(), token: $('st-svc-token').value.trim() };
		m.classList.remove('is-error'); m.textContent = 'Teste …';
		try { await grab('https://example.com', { vw: 400, vh: 300, dsf: 1, mobile: false }); m.textContent = hasSvc() ? 'Verbindung steht.' : 'Microlink erreichbar (kein eigener Dienst eingetragen).'; }
		catch (err) { m.classList.add('is-error'); m.textContent = 'Fehlgeschlagen: ' + (err.message === 'Failed to fetch' ? 'Dienst nicht erreichbar oder CORS nicht freigegeben' : err.message); }
		svc = prev;
	});
	markSvc();
	$('st-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		let url = input.value.trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
		input.value = url; store('nxt-st-url', url);
		const saved = read('nxt-st-layout:' + host()); if (saved) { layout = saved; render(); }
		const btn = e.target.querySelector('button'); btn.disabled = true;
		const todo = KEYS.filter((k) => layout.d[k].on);
		setStatus(`${todo.length} Screenshots werden erstellt … das dauert pro Gerät einige Sekunden.`);
		const errs = [];
		await Promise.all(todo.map(async (k) => { const er = await fetchOne(k, url); if (er) errs.push(er); }));
		btn.disabled = false;
		setStatus(errs.length ? errs.join(' · ') + '. Fehlende Ansichten per „Live verbinden“ aufnehmen oder als eigenen Screenshot auf das Gerät ziehen.' : 'Fertig. Geräte verschieben, Anordnung wählen, dann herunterladen. Die Anordnung wird für diese Adresse gespeichert.', !!errs.length);
	});

	// Live-Ansicht: ein Browserfenster, per Bildschirmfreigabe ins Mockup gespiegelt. Für Seiten hinter einem Login oder solche, die der Dienst nicht erreicht.
	// Es gibt genau ein Fenster und eine Freigabe, die von Gerät zu Gerät wandert: Gerät wählen → live → Ansicht einrichten → „Einfrieren“ → nächstes Gerät → „Live anzeigen“.
	// iFrames scheiden aus: viele Seiten verbieten das Einbetten, und der Browser gibt deren Bildinhalt nicht heraus.
	function openWin(k) {
		let url = input.value.trim(); if (!url) { setStatus('Bitte oben zuerst die Adresse eintragen, die im Fenster geladen werden soll.', true); return; }
		if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
		// Neues Fenster im Seitenverhältnis des Geräts, sonst bliebe im Mockup unten ein weißer Streifen. Passt das Gerät nicht auf den Bildschirm, wird es verkleinert;
		// die volle Gerätebreite gibt es dann über den Seitenzoom. 80 = Fensterrahmen, 60 = Freigabe-Leiste des Browsers. Danach richtet man das Fenster von Hand aus.
		const d = spec(k), f = Math.min(1, screen.availWidth / d.vw, (screen.availHeight - 140) / d.vh), w = Math.round(d.vw * f), h = Math.round(d.vh * f) + 60;
		const zoom = [100, 90, 80, 75, 67, 50, 33, 25].reduce((a, b) => (Math.abs(b - f * 100) < Math.abs(a - f * 100) ? b : a));
		const fresh = !(win && !win.closed), load = url !== winUrl;
		try {
			if (fresh) win = window.open(url, '_blank', `popup,width=${w},height=${h},left=${Math.max(0, screen.availWidth - w)},top=0`);
			else if (load) win.location.href = url;
			if (!win) { setStatus('Das Fenster wurde blockiert. Bitte Pop-ups für das Screenshot-Tool erlauben.', true); return; }
			win.focus();
		} catch (e) { setStatus('Das Live-Fenster lässt sich nicht mehr ansteuern. Bitte schließen und erneut „Fenster öffnen“ klicken.', true); return; }
		winUrl = url;
		setStatus(fresh ? `Fenster in ${DEV[k].label}-Größe geöffnet (${w} px breit). Dort zur gewünschten Ansicht gehen, bei Bedarf anmelden, dann „Live verbinden“ klicken und das Fenster unter „Chrome-Tab“ auswählen.` + (zoom < 100 ? ` Das Gerät (${d.vw} × ${d.vh}) ist größer als der Bildschirm: Für die volle Gerätebreite im Fenster auf ${zoom} % zoomen (⌘ −).` : '')
			: (load ? 'Neue Adresse im Live-Fenster geladen.' : 'Live-Fenster nach vorne geholt.') + ' Die Größe für das gewählte Gerät richtest du am Fenster selbst aus.');
	}
	function markLive() { if (sel) $('st-live').textContent = isLive(sel) ? 'Einfrieren' : cast ? 'Live anzeigen' : 'Live verbinden'; }
	// Freigabe auf Gerät k zeigen (null = auf keinem, sie läuft dann im Hintergrund weiter)
	function show(k) {
		const old = cast.k; cast.k = k;
		[old, k].forEach((x) => { if (x) { els[x].firstChild.dataset.shot = ''; place(x); } });
		markLive();
	}
	// Aktuelles Live-Bild als Screenshot übernehmen (leere Bilder, etwa beim Seitenwechsel oder nach dem Schließen des Fensters, werden übergangen)
	function snap(k) {
		const v = isLive(k) && cast.video;
		if (!v || v.readyState < 2 || !v.videoWidth || uniform(v)) return Promise.resolve();
		const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
		c.getContext('2d').drawImage(v, 0, 0);
		return new Promise((res) => c.toBlob((b) => (b ? setShot(k, b).then(res) : res()), 'image/png'));
	}
	const snapLive = () => (cast && cast.k ? snap(cast.k) : Promise.resolve());
	addEventListener('focus', () => { snapLive(); markLive(); });
	async function goLive(k) {
		if (isLive(k)) { const px = `${cast.video.videoWidth} × ${cast.video.videoHeight} px`; await snap(k); show(null); setStatus(`${DEV[k].label} eingefroren (${px}). Die Freigabe läuft weiter: nächstes Gerät anklicken und „Live anzeigen“ wählen.`); return; }
		if (cast) { if (cast.k) await snap(cast.k); show(k); setStatus(`${DEV[k].label} zeigt jetzt live. Passt die Ansicht, „Einfrieren“ klicken.`); return; }
		if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { setStatus('Dieser Browser kann keine Fenster spiegeln. Chrome oder Edge verwenden oder einen eigenen Screenshot auf das Gerät ziehen.', true); return; }
		const opt = { video: { displaySurface: 'browser', frameRate: 15 }, audio: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', monitorTypeSurfaces: 'exclude' };
		if (window.CaptureController) { opt.controller = new CaptureController(); try { opt.controller.setFocusBehavior('no-focus-change'); } catch (e) {} }
		let stream;
		try { stream = await navigator.mediaDevices.getDisplayMedia(opt); }
		catch (err) { const stop = err.name === 'NotAllowedError'; setStatus(stop ? 'Live-Ansicht abgebrochen.' : 'Live-Ansicht nicht möglich: ' + err.message, !stop); return; }
		const video = document.createElement('video'), track = stream.getVideoTracks()[0];
		video.muted = true; video.autoplay = true; video.playsInline = true; video.srcObject = stream;
		cast = { stream, video, k };
		// Freigabe von außen beendet (Fenster geschlossen oder „Freigabe beenden“): letzten Stand sichern, soweit noch ein Bild da ist
		track.addEventListener('ended', () => {
			if (!cast || cast.stream !== stream) return;
			const on = cast.k;
			(on ? snap(on) : Promise.resolve()).then(() => { cast = null; if (on) { els[on].firstChild.dataset.shot = ''; place(on); } markLive(); });
		});
		video.addEventListener('loadeddata', () => {
			snapLive();
			const tab = track.getSettings().displaySurface === 'browser';
			setStatus(`${DEV[k].label} ist live verbunden (${video.videoWidth} × ${video.videoHeight} px). Passt die Ansicht, „Einfrieren“ klicken und das nächste Gerät wählen.` + (tab ? '' : ' Hinweis: Für ein Bild ohne Browserleiste im Dialog einen „Chrome-Tab“ wählen, kein Fenster.'), !tab);
		}, { once: true });
		place(k); markLive();
	}

	// Downloads
	const slug = () => host().split('.')[0];
	function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
	function rawCanvas(img, w, h) {
		const c = document.createElement('canvas'); c.width = w; c.height = h;
		const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
		x.drawImage(img, 0, 0, w, img.naturalHeight * w / img.naturalWidth); return c;
	}
	// Dateiformat für alle Exporte (WebP Standard, verlustbehaftet 0.9; PNG verlustfrei; JPG ohne Transparenz)
	const FMT = { webp: { mime: 'image/webp', q: 0.9 }, png: { mime: 'image/png' }, jpg: { mime: 'image/jpeg', q: 0.9 } };
	let fmt = read('nxt-st-fmt') || 'webp';
	const markFmt = () => document.querySelectorAll('#st-fmt button').forEach((b) => b.classList.toggle('is-active', b.dataset.f === fmt));
	document.querySelectorAll('#st-fmt button').forEach((b) => b.addEventListener('click', () => { fmt = b.dataset.f; store('nxt-st-fmt', fmt); markFmt(); }));
	markFmt();
	function exportCanvas(c, base) {
		const f = FMT[fmt];
		c.toBlob((b) => {
			if (!b) { setStatus('Export fehlgeschlagen.', true); return; }
			const ext = b.type === 'image/webp' ? 'webp' : b.type === 'image/jpeg' ? 'jpg' : 'png';
			if (fmt === 'webp' && ext !== 'webp') setStatus('Dieser Browser kann kein WebP erzeugen, gespeichert als PNG.', true);
			download(b, `${base}.${ext}`);
		}, f.mime, f.q);
	}
	$('st-raw-ref').addEventListener('click', async () => {
		await snapLive();
		const s = shots.laptop || shots.monitor; if (!s) return;
		exportCanvas(rawCanvas(s.img, 1600, 1000), `${slug()}-1600x1000`);
	});
	$('st-raw-all').addEventListener('click', async () => {
		await snapLive();
		Object.keys(shots).forEach((sk, i) => {
			const s = shots[sk];
			setTimeout(() => exportCanvas(rawCanvas(s.img, s.img.naturalWidth, s.img.naturalHeight), `${slug()}-${sk.replace(':', '-')}`), i * 400);
		});
	});
	const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
	// Lokal (file://) gelten die Rahmen-Dateien als fremde Quelle und sperren den Export. Dann kommen sie als Data-URI aus frames.js des gewählten Rahmensatzes.
	const frameSrc = (src) => (window.NXT_FRAMES && window.NXT_FRAMES[src]) || src;
	if (location.protocol === 'file:') document.head.append(Object.assign(document.createElement('script'), { src: F === 'img/' ? 'frames.js' : F + 'frames.js' }));
	// Eigener Rahmensatz gewählt, aber nicht vorhanden: zurück zum Standard und Bescheid geben
	if (F !== 'img/') { const t = new Image(); t.onerror = () => { try { localStorage.removeItem('nxt-st-frames'); sessionStorage.setItem('nxt-st-noframes', '1'); } catch (e) {} location.replace(location.href.split(/[?#]/)[0]); }; t.src = DEV.monitor.src; }
	async function mockupCanvas(shotMap) {
		const S = 2, c = document.createElement('canvas'); c.width = 2400 * S; c.height = 1500 * S;
		const x = c.getContext('2d'); x.scale(S, S);
		const fill = bg !== 'transparent' ? { hell: '#f4f2f2', dunkel: '#191616', rot: '#d10707' }[bg] : (fmt === 'jpg' ? '#ffffff' : null);
		if (fill) { x.fillStyle = fill; x.fillRect(0, 0, 2400, 1500); }
		for (const k of layout.order) {
			if (!layout.d[k].on) continue;
			const { o, s } = geo(k), frame = await loadImg(frameSrc(spec(k).src)), shot = shotMap[shotKey(k)];
			x.save(); x.shadowColor = 'rgba(25,22,22,.28)'; x.shadowBlur = 80; x.shadowOffsetY = 30; x.drawImage(frame, o.x, o.y, o.w, o.h); x.restore();
			x.save(); x.beginPath(); if (x.roundRect) x.roundRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4, s.r); else x.rect(s.x - 2, s.y - 2, s.w + 4, s.h + 4); x.clip();
			x.fillStyle = '#fff'; x.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
			if (shot) x.drawImage(shot.img, s.x - 2, s.y - 2, s.w + 4, shot.img.naturalHeight * (s.w + 4) / shot.img.naturalWidth);
			x.restore();
			x.drawImage(frame, o.x, o.y, o.w, o.h);
		}
		return c;
	}
	$('st-export').addEventListener('click', async () => {
		await snapLive();
		const c = await mockupCanvas(shots);
		try { exportCanvas(c, `${slug()}-mockup`); setStatus(`Mockup als ${fmt.toUpperCase()} (4800 × 3000 px) heruntergeladen.`); }
		catch (err) { setStatus(location.protocol === 'file:' && !window.NXT_FRAMES ? 'Export blockiert: frames.js fehlt im Ordner. Lokal geöffnet braucht das Tool die Geräterahmen aus dieser Datei (siehe README).' : 'Export blockiert: Ein Screenshot stammt von einer fremden Quelle. Einzel-Screenshots herunterladen und wieder auf die Geräte ziehen.', true); }
	});

	// ZIP (ohne Kompression, Bilder sind bereits komprimiert)
	const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
	const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
	function zip(files) {
		const enc = new TextEncoder(), parts = [], central = []; let off = 0;
		for (const f of files) {
			const name = enc.encode(f.name), data = f.data, crc = crc32(data);
			const h = new DataView(new ArrayBuffer(30));
			h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
			parts.push(h, name, data);
			const cd = new DataView(new ArrayBuffer(46));
			cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, off, true);
			central.push(cd, name);
			off += 30 + name.length + data.length;
		}
		const size = central.reduce((s, p) => s + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
		end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
		return new Blob([...parts, ...central, end], { type: 'application/zip' });
	}
	const toBlob = (c) => new Promise((res) => { const f = FMT[fmt]; c.toBlob(res, f.mime, f.q); });
	const extOf = (b) => (b.type === 'image/webp' ? 'webp' : b.type === 'image/jpeg' ? 'jpg' : 'png');
	const blobImg = (b) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(b); });

	// Stapel
	const batchDlg = $('st-batch');
	let batchRunning = false;
	$('st-batch-open').addEventListener('click', () => { $('st-batch-list').value = (read('nxt-st-batch') || []).join('\n'); batchDlg.showModal(); });
	batchDlg.addEventListener('cancel', (e) => { if (batchRunning) e.preventDefault(); });
	$('st-batch-run').addEventListener('click', async () => {
		const urls = [...new Set($('st-batch-list').value.split(/\s+/).map((u) => u.trim()).filter(Boolean).map((u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u)))];
		const msg = $('st-batch-msg'), bar = $('st-batch-bar'), runBtn = $('st-batch-run'), closeBtn = $('st-batch-close');
		if (!urls.length) { msg.textContent = 'Bitte mindestens eine Adresse eintragen.'; return; }
		store('nxt-st-batch', urls);
		if (!hasSvc() && urls.length * 4 > 40 && !confirm('Ohne eigenen Dienst reicht das Microlink-Tageskontingent vermutlich nicht für alle Adressen. Trotzdem starten?')) return;
		batchRunning = true; runBtn.disabled = closeBtn.disabled = true;
		$('st-batch-prog').hidden = false; msg.classList.remove('is-error');
		const baseLayout = JSON.parse(JSON.stringify(layout)), files = [], errs = [];
		const enc = (n) => n.replace(/[^a-z0-9.-]+/gi, '-');
		let done = 0;
		for (const url of urls) {
			let h; try { h = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { errs.push(url + ': ungültige Adresse'); done++; continue; }
			const folder = enc(h), name = h.split('.')[0];
			msg.textContent = `${done + 1} / ${urls.length}: ${h}`;
			layout = read('nxt-st-layout:' + h) || JSON.parse(JSON.stringify(baseLayout));
			const map = {}, keys = KEYS.filter((k) => layout.d[k].on);
			// zwei Geräte gleichzeitig, um den Dienst nicht zu überlasten
			for (let i = 0; i < keys.length; i += 2) {
				await Promise.all(keys.slice(i, i + 2).map(async (k) => {
					try {
						const b = await grab(url, spec(k)), img = await blobImg(b);
						map[shotKey(k)] = { img };
						const out = await toBlob(rawCanvas(img, img.naturalWidth, img.naturalHeight));
						files.push({ name: `${folder}/${name}-${shotKey(k).replace(':', '-')}.${extOf(out)}`, data: new Uint8Array(await out.arrayBuffer()) });
					} catch (err) { errs.push(`${h} · ${DEV[k].label}: ${err.message}`); }
				}));
			}
			const ref = map.laptop || map.monitor;
			if (ref) { const b = await toBlob(rawCanvas(ref.img, 1600, 1000)); files.push({ name: `${folder}/${name}-1600x1000.${extOf(b)}`, data: new Uint8Array(await b.arrayBuffer()) }); }
			if (Object.keys(map).length) { const b = await toBlob(await mockupCanvas(map)); files.push({ name: `${folder}/${name}-mockup.${extOf(b)}`, data: new Uint8Array(await b.arrayBuffer()) }); }
			Object.values(map).forEach((s) => URL.revokeObjectURL(s.img.src));
			done++; bar.style.width = (done / urls.length * 100) + '%';
		}
		layout = baseLayout; render();
		if (errs.length) files.push({ name: 'fehler.txt', data: new TextEncoder().encode(errs.join('\n')) });
		if (files.length) download(zip(files), `screenshots-${new Date().toISOString().slice(0, 10)}.zip`);
		msg.classList.toggle('is-error', !!errs.length);
		msg.textContent = errs.length ? `Fertig mit ${errs.length} Fehler(n), Details in fehler.txt in der ZIP.` : `Fertig: ${urls.length} Seiten, ${files.length} Dateien.`;
		batchRunning = false; runBtn.disabled = closeBtn.disabled = false;
	});

	// Start
	input.value = read('nxt-st-url') || '';
	const b0 = read('nxt-st-bg'); if (b0) document.querySelector(`#st-bg [data-bg="${b0}"]`)?.click();
	layout = read('nxt-st-layout:' + host()) || fromPreset('alle');
	render(); fit();
	try { if (sessionStorage.getItem('nxt-st-noframes')) { sessionStorage.removeItem('nxt-st-noframes'); setStatus('Kein eigener Rahmensatz gefunden (Ordner frames-custom/, siehe README). Es werden die Standardrahmen verwendet.', true); } } catch (e) {}
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
