# HANDOFF — Gazdovský arkanoid (MVP v0.3)

Datum: 2026-07-24

## 🐛 Opravy a novinky v0.3 (2026-07-24)

### 1. Bugfix: softlock lepivého pádla (sticky)
Když vypršel časovač sticky efektu, zatímco byl míček nalepený na pádle, zůstal nalepený **navždy** — `tap()` vypouští míčky jen dokud je efekt aktivní, takže po expiraci už ťuknutí nic neudělalo a hra se softlockla.
**Oprava:** `expireEffect('sticky')` teď okamžitě vypouští všechny míčky nalepené sticky powerupem (sdílená logika `launchStuck()`). Míčky navíc nesou nový příznak **`stuckReason: 'start' | 'sticky'`**, takže expirace vypustí jen míčky nalepené powerupem — startovní míček čekající na pádle (`ballOnPaddle`) se nikdy nevystřelí předčasně. Nově sebraný sticky powerup těsně po expiraci funguje čistě (expirace řeší jen staré nalepené míčky, nový efekt nastaví vlastní časovač).

### 2. Nový powerup: Průrazný míček (`pierce`)
9. typ powerupu — stříbrná kapsle se symbolem `➤` (`#e8e8f0`), trvání **8 s**, váha ve spawn tabulce **0,09** (ostatní váhy mírně sníženy, součet stále 1,0). Po sebrání míček **prolétává skrz cihly jako střela**: poškozuje je normálně (spotřebovává hp včetně vícehitových, dává skóre, dropuje powerupy), ale **neodráží se** od nich — pokračuje v původním směru. Odrazy od stěn a pádla fungují dál normálně. Max jedna cihla na míček na snímek (`break` zachován), aby fyzika zůstala konzistentní. Průrazné míčky se vykreslují se stříbrno-bílým jádrem, azurovým glow a pohybovou stopou (trail), aby hráč efekt poznal na první pohled. Popisek banneru: „Průrazný míček!".

## 🐛 Opravy v0.2 (2026-07-24)

### 1. Životy (srdíčka) mimo obrazovku na mobilu
`renderHUD()` kreslil životy jako emoji řetězec `❤️` s `textAlign='right'` — `measureText`/zarovnání emoji (multi-byte + variant selector U+FE0F) je napříč platformami nespolehlivé, na mobilu srdíčka utekla mimo canvas doprava a viditelné bylo jen jedno.
**Oprava:** nová metoda `drawHeart(x, y, size, filled)` kreslí srdíčko jako canvas bezier path (růžová `#ff5d8f` s glow + gloss highlight). Srdíčka mají pevnou velikost 16 px a rozteč 5 px, celek je zarovnán doprava od `WORLD_W - 14`. Ztracené životy se ukazují jako ztlumené obrysy (slotů je `max(START_LIVES, lives)`), takže funguje i 5 životů na úzkém displeji. Emoji 💀 fallback odstraněn (životy 0 = Game Over obrazovka).

### 2. Levely 29–50 byly téměř identické
Původně: `rows` strop 11 už na L29, `maxHp` natvrdo 3 od L16, lineární rychlost → druhá polovina hry splývala.
**Redesign škálování (deterministické RNG `mulberry32` zachováno, API `generateLevel(n)` beze změny):**
- **rows:** `4 + ceil((n-1)/49 * 10)` → plynule 4 → 14 napříč všemi 50 levely
- **maxHp:** 5 úrovní — L1–5: 1, L6–14: 2, L15–24: 3, L25–34: 4, L35–50: 5 (nové barvy: hp4 oranžová `#ff9f1c`, hp5 fialová `#c77dff`; skóre 320/480; hit-dot pips centrovány pro až 5 hp)
- **ballSpeed:** `330 + (n-1)*7 + (n>30 ? (n-30)*9 : 0)`, strop 780 px/s — zrychlení v poslední třetině
- **ballRadius:** 7 → 5, krok každých 10 levelů (dřív 12)
- **density:** `min(0.6 + n*0.0075, 0.97)` — roste až do konce
- **3. pattern:** od L25 s pravděpodobností rostoucí k 0,6 (dřív max 2)
- **Boss levely** (10/20/30/40/50): +1 řada, +1 maxHp, density +0,1 (max 0,98), vždy min. 2 vrstvené patterny — vizuální milník
- **Pádlo:** base šířka se po L30 zmenšuje až o 25 % (`basePaddleW = PADDLE_W * (1 - min(0.25, (level-30)*0.0125))`); expand/shrink powerupy násobí tuto base hodnotu, takže nekolidují

**Ověřená čísla (test skript přes `generateLevel`):**

| Level | rows | bricks | maxHp | speed | radius |
|-------|------|--------|-------|-------|--------|
| 1     | 4    | 11     | 1     | 330   | 7      |
| 10 🔥 | 7    | 53     | 3     | 393   | 7      |
| 25    | 9    | 73     | 4     | 498   | 5      |
| 40 🔥 | 13   | 128    | 5     | 693   | 5      |
| 50 🔥 | 14   | 133    | 5     | 780   | 5      |

(🔥 = boss level; 14 řad × 26 px = vrchol cihlového pole na y=460, bezpečně nad pádlem y=644)

## ✅ Hotové

- **Kompletní hratelná hra** (Vite + TS + Canvas, ~8 kB gzip JS):
  - úvodní menu s výběrem 7 hráčů (Táta, Máma, Laura, Honza, Maty, Tobi, Miku)
  - 50 procedurálně generovaných levelů (seedovaný RNG → všichni hrají stejné levely; roste počet řad 4→14, pevnost cihel 1–5 zásahů s barvami zelená/žlutá/růžová/oranžová/fialová, rychlost míčku 330→780 px/s, menší míček i pádlo na vyšších levelech; 10 různých vzorů layoutu, na vyšších levelech se vrství 2–3 vzory, každý 10. level je bossovský milník — viz sekce Opravy v0.2)
  - fyzika odrazů: úhel podle místa dopadu na pádlo (±62°), odrazy od stěn/cihel s korekcí osy
  - všech 9 bonusů: expand, shrink, multiball (max 6 míčků), +1 život, sticky (ťuk = vypuštění, expirace efektu míčky bezpečně vypustí), fast/slow ball, laser (ťuk = střelba, cooldown 0,28 s), pierce (průraz skrz cihly bez odrazu)
  - 3 životy, Game Over obrazovka se skóre, restart, návrat do menu
  - skóre: 50/120/200/320/480 b za cihlu dle pevnosti + level×100 bonus; HUD se skóre/levelem/životy (životy = vektorová srdíčka, ne emoji)
  - částicové efekty při rozbití cihly, glow efekty, animované pozadí, synth zvuky (WebAudio, žádné assety)
- **Touch ovládání:** levá/pravá polovina = hold-to-move (multi-touch podporován), ťuk = vypuštění/laser; jemné vizuální naznačení zón dole; mouse/klávesnice fallback pro desktop test
- **PWA:** manifest.webmanifest, service worker (cache-first, verzovaný cache `gazdovsky-arkanoid-v1`), vygenerované ikony (180/192/512/maskable), apple-touch-icon, viewport-fit=cover, `touch-action: none`
- **Žebříček:** Supabase integrace hotová (upsert on `name`, ukládá se jen při překonání osobního maxima), fallback na localStorage s jasným označením v UI; `supabase-schema.sql` včetně RLS politik (update jen lepšího skóre) a seedu 7 jmen
- **Build bez chyb:** `npm run build` ✅, dev server smoke-test ✅ (manifest/sw/ikony servírovány 200)
- **Secrets:** žádné klíče v kódu — `.env.example` + README instrukce

## ▶️ Spuštění lokálně

```bash
npm install
npm run dev        # http://localhost:5173
# mobilní simulace: Chrome DevTools → Toggle device toolbar → iPhone
# nebo: npm run dev -- --host  a otevřít z iPhone na stejné Wi-Fi
npm run build && npm run preview   # produkční ověření
```

## 🔧 Co je potřeba dodělat

1. **Supabase projekt** — založit, spustit `supabase-schema.sql` v SQL Editoru, zkopírovat URL + anon key do `.env` (viz README). Do té doby žebříček běží lokálně.
2. **Nasazení** — ⚠️ OTEVŘENÁ OTÁZKA pro majitele: kam PWA nasadit? Doporučení: **Vercel** (účet a token už existují, nejjednodušší pro Vite + env proměnné; HTTPS out-of-the-box → funguje Add to Home Screen na iOS). Alternativy: Cloudflare Pages (máme CF token pro isprodukce.cz — např. subdoména `arkanoid.isprodukce.cz`), Netlify. Build: `npm run build`, output `dist/`, env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` nastavit v dashboardu hostingu.
3. **Test na reálném iPhone** — ladění citlivosti pádla (`PADDLE_SPEED` v `src/config.ts`), případně velikosti pádla/míčku. Na simulátoru se touch chová trochu jinak než na fyzickém zařízení.
4. **Bump cache verze v `public/sw.js`** při každém deployi (`gazdovsky-arkanoid-v1` → v2…), jinak stará verze zůstane v cache nainstalovaných PWA.

## ⚠️ Na co si dát pozor

- **iOS Safari PWA quirks:** service worker se registruje jen v produkčním buildu (`import.meta.env.PROD`); v dev módu offline nefunguje. „Add to Home Screen" vyžaduje HTTPS.
- **Multiball + sticky:** přilepené míčky se vypouštějí všechny najednou ťuknutím — záměr (jednoduchost pro děti).
- **Laser střílí ťuknutím** — každé ťuknutí na obrazovku při aktivním laseru vystřelí; při hold-to-move se nestřílí (tap je jen krátký dotyk… aktuálně každý touchstart). Pokud by to dětem střílelo moc často, omezit tap detekcí podle délky dotyku.
- **RLS politika** chrání před přepsáním horším skóre, ale anon klíč = kdokoli s URL může zapisovat. Pro rodinnou hru OK; kdyby se mělo zpřísnit, přejít na RPC funkci nebo Supabase Auth.
- **Zvuky:** WebAudio se na iOS odblokuje až prvním user gesturem (ťuk do canvasu) — první spuštění hry je ticho, což je normální iOS chování.
- Ikony jsou jednoduché generované (míček + pádlo) — až bude logo, nahradit v `public/icons/` nebo upravit `scripts/gen-icons.mjs`.

## Ověřeno proti zadání

- [x] `npm install && npm run dev` → hra hratelná v prohlížeči
- [x] výběr jména, hratelné levely, rostoucí obtížnost
- [x] bonusy v akci (padají náhodně z ~16 % cihel, vážené rozložení všech 9 typů)
- [x] 3 životy → Game Over se skóre
- [x] obrazovka žebříčku (bez Supabase klíčů ukazuje lokální data + upozornění „connect Supabase")
- [x] `npm run build` bez chyb
