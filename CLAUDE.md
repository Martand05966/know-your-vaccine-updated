# Know Your Vaccine

PharmEasy vaccine finder at `https://pharmeasy.in/know-your-vaccine/`. Built and hosted the same way as
[fever-watch](https://github.com/pharmeasyMarketing/fever-watch): Python static build, vanilla JS, no Node
toolchain, GitHub Pages for staging, Hostinger VPS (CyberPanel) behind the pharmeasy.in reverse proxy for production.

## The flow

One screen at a time, like an app:

1. **Intro**: "Vaccines are for adults too" banner, AI vaccine planner badge, one CTA
2. **About you**: age and gender on one screen. "Under 18" shows a not-eligible screen, since PharmEasy vaccinates adults only
3. **Health**: conditions and lifestyle (multi-select)
4. **Contact**: name, mobile, consent (lead capture)
5. **Building your plan**: a short AI-style loading step
6. **Results**: one card per vaccine with why you need it, your schedule, brand options (links) and "Book at home". Below them: request a callback, was this helpful, check for a family member, start over

Below the flow: "Vaccines are not just for babies" + PharmEasy guarantee + doctor banner, 5 FAQs, "Built with AI" line.

Header: PharmEasy | Know Your Vaccine lockup only (no nav menu, no search). The lockup links to
pharmeasy.in on desktop only; on mweb it is inert because the page opens inside the PharmEasy app from a banner and
users should not be sent off to the website. Footer: disclaimer and copyright only (no link columns).

Mweb and desktop have separate stylesheets (`assets/css/mobile.css`, `assets/css/desktop.css`). They are media-gated at
820px + pointer type, exactly like fever-watch. The shared tokens and components live in `assets/css/tokens.css`.

Brand option links open PharmEasy search for that brand (`options` in `content.json`). Add a `url` to an option to point
it at the exact product page. Options render as green outlined buttons (same style as the PharmEasy Notify Me button) with an arrow.
(`kyv.js` still has an unused `productCard()` for a cart-style row with Notify Me, if you ever add a `product` block to an option.)

## Where things live

| What | File |
|---|---|
| All copy, questions, options, vaccines, FAQ | `config/content.json` |
| URL, GTM, sheet webhook, skip-contact toggle | `config/site.json` |
| Recommendation rules + flow + sheet sync | `assets/js/kyv.js` (`recommend()`) |
| Page template, nav, footer, SEO, JSON-LD | `src/build_site.py` |
| Google Sheet backend | `apps_script/Code.gs` |
| Staging deploy (push to master) | `.github/workflows/deploy.yml` |
| Production deploy (manual) | `.github/workflows/deploy-cyberpanel.yml` |

## Google Sheet (form + every selected option)

`apps_script/Code.gs` writes two tabs:

- **responses**: one row per session, updated as the user moves through the flow. It holds for whom, age, gender,
  conditions, name, phone, consent, recommended vaccines, plan value, brand links clicked, "Book" clicks,
  callback requested, feedback (like/dislike), doctor click, device, UTMs, gclid/fbc/fbp, page URL and spam flag. Sessions that stop before
  the contact step still keep their answers, so you can see drop-off.
- **events**: one row per action (not_eligible, about_completed, health_completed, lead_submitted, option_click,
  book_click, callback_request, feedback, doctor_click and so on).

Setup:
1. Create a Sheet. Go to Extensions > Apps Script, paste `Code.gs`, and set `KEY` to a random string.
2. Run `setup()` once.
3. Go to Deploy > New deployment > Web app. Execute as: Me. Access: Anyone. Copy the `/exec` URL.
4. Add the repo secrets `SHEETS_WEBHOOK_URL` (the URL) and `SHEETS_KEY` (same as `KEY`).

Health answers go only to this sheet. GTM and the pixels get `generate_lead` (value and hashed phone through
Enhanced Conversions) but never conditions.

## Run locally

```
python src/build_site.py                 # -> dist/know-your-vaccine (staging, sheet off unless env set)
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXX/exec python src/build_site.py
python scripts/serve_dist.py             # http://127.0.0.1:8138/
```

## Going live

1. Create the repo `pharmeasyMarketing/know-your-vaccine`, push, and set Pages Source = GitHub Actions. That gives you staging.
2. Add the secrets `KYV_PROD_BASE_URL` (`https://pharmeasy.in/know-your-vaccine/`), `SHEETS_WEBHOOK_URL`, `SHEETS_KEY`
   and `DEPLOY_HOST/USER/SSH_KEY/PORT` (same as fever-watch). `DEPLOY_PATH` must be its own folder,
   `.../public_html/know-your-vaccine/`.
3. Ask the team that added the fever-watch edge rule to add `/know-your-vaccine/` the same way.
4. Run **Deploy Know Your Vaccine to CyberPanel (production)** from the Actions tab.

## Guardrails

- Indicative guidance only, not a diagnosis. The disclaimer is in `content.json`. Get medical and legal review before launch,
  and fill in `reviewer.names` to show the byline.
- No em dashes, en dashes or middots in copy (fever-watch house rule).
- Asset paths stay relative, so one build works on github.io and on the pharmeasy.in subpath.
