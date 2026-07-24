# HANDOFF — Gazdovský arkanoid (MVP v0.1)

Datum: 2026-07-24

## ✅ Hotové

- **Kompletní hratelná hra** (Vite + TS + Canvas, ~8 kB gzip JS):
  - úvodní menu s výběrem 7 hráčů (Táta, Máma, Laura, Honza, Maty, Tobi, Miku)
  - 50 procedurálně generovaných levelů (seedovaný RNG → všichni hrají stejné levely; roste počet řad, pevnost cihel 1–3 zásahy s barvami zelená/žlutá/růžová, rychlost míčku 330→640 px/s, menší míček na vyšších levelech; 10 různých vzorů layoutu, na vyšších levelech se vrství 2 vzory)
  - fyzika odrazů: úhel podle místa dopadu na pádlo (±62°), odrazy od stěn/cihel s korekcí osy
  - všech 8 bonusů: expand, shrink, multiball (max 6 míčků), +1 život, sticky (ťuk = vypuštění), fast/slow ball, laser (ťuk = střelba, cooldown 0,28 s)
  - 3 životy, Game Over obrazovka se skóre, restart, návrat do menu
  - skóre: 50/120/200 b za cihlu dle pevnosti + level×100 bonus; HUD se skóre/levelem/životy
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
- [x] bonusy v akci (padají náhodně z ~16 % cihel, vážené rozložení všech 8 typů)
- [x] 3 životy → Game Over se skóre
- [x] obrazovka žebříčku (bez Supabase klíčů ukazuje lokální data + upozornění „connect Supabase")
- [x] `npm run build` bez chyb
