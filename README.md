# Gazdovský arkanoid 🧱🕹️

Rodinná verze klasického Arkanoidu jako **PWA** — optimalizovaná pro iPhone (Safari / přidání na plochu), dotykové ovládání, 50 levelů, bonusy a rodinný žebříček.

## Stack

- **Vite + TypeScript** (vanilla, žádný game engine) — malý bundle (~8 kB gzip JS), rychlé načtení, 60 fps na mobilu
- **HTML5 Canvas** pro hru, DOM pro menu/žebříček
- **Supabase** pro žebříček (Postgres + RLS) s automatickým fallbackem na `localStorage`
- Service worker + manifest → instalovatelné na plochu, offline hratelné

## Spuštění

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # produkční build do dist/
npm run preview    # náhled produkčního buildu
```

Na mobilním testování: Chrome DevTools → device toolbar (iPhone) nebo `npm run dev -- --host` a otevřít z iPhone na stejné Wi-Fi.

## Supabase (žebříček)

1. Založ projekt na [supabase.com](https://supabase.com).
2. V SQL Editoru spusť obsah [`supabase-schema.sql`](./supabase-schema.sql) — vytvoří tabulku `leaderboard`, naplní 7 hráčů a nastaví RLS politiky (upsert jen při překonání maxima).
3. Zkopíruj `.env.example` → `.env` a doplň `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Restartni dev server.

Bez `.env` hra funguje dál — žebříček se ukládá lokálně a UI to jasně označí.

## Hra

- **Výběr hráče:** Táta, Máma, Laura, Honza, Maty, Tobi, Miku
- **Ovládání:** drž levou / pravou polovinu obrazovky → pádlo jede doleva/doprava; ťuknutí → vypuštění míčku, uvolnění lepivého pádla, střelba laseru
- **50 levelů:** procedurální generátor (10 vzorů × rostoucí hustota, počet řad, pevnost cihel 1–3 zásahy, rychlost/velikost míčku) — seed je fixní, takže všichni hrají stejné levely
- **Bonusy/malusy:** expand, shrink, multiball, extra život, sticky, fast ball, slow ball, laser
- **Skóre:** cihly 50/120/200 b podle pevnosti + level × 100 bonus za dokončení levelu
- **3 životy**, Game Over → uložení skóre (jen když překoná osobní maximum) → žebříček

## Struktura

```
src/
  config.ts        # konstanty světa, jména hráčů
  main.ts          # boot, registrace service workeru
  ui.ts            # menu, žebříček, game over (DOM overlay)
  leaderboard.ts   # Supabase + localStorage fallback (upsert na name)
  game/
    engine.ts      # herní smyčka, fyzika, bonusy, částice, HUD, dotykové zóny
    levels.ts      # procedurální generátor 50 levelů (seeded RNG)
    audio.ts       # WebAudio synth zvuky (žádné assety)
scripts/gen-icons.mjs  # generátor PWA ikon (čistý Node, bez závislostí)
public/            # manifest, sw.js, ikony
```

## Nasazení

Statický hosting (Vercel / Netlify / Cloudflare Pages / jakýkoli HTTPS server): build command `npm run build`, output `dist/`. HTTPS je povinné pro service worker a „Add to Home Screen" na iOS.
