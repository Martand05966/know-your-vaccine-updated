#!/usr/bin/env python3
"""Static site builder for Know Your Vaccine (same pattern as fever-watch/src/build_site.py).

Reads config/site.json + config/content.json and writes dist/know-your-vaccine/:
  index.html (SSR chrome + intro screen + FAQ, data baked into window.KYV)
  assets/ (tokens.css, mobile.css, desktop.css, kyv.js, fonts, img), robots.txt, sitemap.xml

Env:
  SITE_ENV=production        indexable robots + sitemap; anything else = staging (noindex, Disallow all)
  KYV_BASE_URL=...           overrides site.json base_url (production workflow passes the public URL)
  SHEETS_WEBHOOK_URL=...     overrides site.json sheets_webhook_url (Apps Script /exec URL)
  SHEETS_KEY=...             overrides site.json sheets_key (must match KEY in apps_script/Code.gs)

Stdlib only. No Node toolchain.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as fh:
        return json.load(fh)


def esc(s) -> str:
    return (str("" if s is None else s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;"))


SITE = load("config/site.json")
CONTENT = load("config/content.json")
ENV = os.environ.get("SITE_ENV", "production" if SITE.get("is_production") else "staging")
BASE = (os.environ.get("KYV_BASE_URL") or SITE["base_url"]).rstrip("/") + "/"
WEBHOOK = os.environ.get("SHEETS_WEBHOOK_URL", SITE.get("sheets_webhook_url", "")).strip()
SHEETS_KEY = os.environ.get("SHEETS_KEY", SITE.get("sheets_key", "")).strip()
SLUG = SITE.get("slug", "know-your-vaccine")
SRC = SITE.get("src_param", "knowyourvaccine")
OUT = os.path.join(ROOT, "dist", SLUG)
ASSET_FILES = ("assets/css/tokens.css", "assets/css/mobile.css", "assets/css/desktop.css", "assets/js/kyv.js")

MEDICAL_DISCLAIMER = esc(CONTENT.get("disclaimer", ""))


def asset_version() -> str:
    h = hashlib.md5()
    for rel in ASSET_FILES + ("config/content.json",):
        with open(os.path.join(ROOT, rel), "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()[:10]


def with_src(url: str) -> str:
    return url + ("&" if "?" in url else "?") + "src=" + SRC


# --- chrome (ported from fever-watch build_site.py) -------------------------

SEARCH_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'


def nav_html() -> str:
    """Header: PharmEasy | Know Your Vaccine lockup only. No nav menu, no search.
    The lockup links to pharmeasy.in on desktop only. On mweb the page lives inside the PharmEasy app
    (opened from an in-app banner), so the lockup is inert there (mobile.css + kyv.js) and users are not
    sent off to the website."""
    return (
        '<header class="fw-nav"><div class="navin">'
        '<a class="pe-logo" href="https://pharmeasy.in/" aria-label="PharmEasy home">'
        '<img class="pe-mark" src="assets/img/pe_logo-white.svg" alt="PharmEasy" width="92" height="22">'
        '<span class="pe-rule" aria-hidden="true"></span>'
        '<span class="fw-word">' + esc(SITE["site_name"]) + '<span class="kyv-word-ai">AI</span></span></a>'
        '</div></header>'
    )


def footer_html() -> str:
    # Footer link columns removed on request: only the disclaimer and copyright remain.
    return (
        '<footer class="footer"><div class="footbar"><div class="footbarin">'
        '<span class="footdisc">' + MEDICAL_DISCLAIMER + '</span>'
        '<span>&#169; ' + str(datetime.date.today().year) + ' PharmEasy. All Rights Reserved</span></div></div></footer>'
    )


# --- page sections -----------------------------------------------------------

ICON_SHIELD = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>'


SPARK = '<svg class="kyv-spark" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/><path fill="currentColor" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>'


def stage_html() -> str:
    """The one-screen-at-a-time flow. The intro is baked server-side (crawlers + first paint);
    assets/js/kyv.js re-renders it and every later screen inside #kyv-app."""
    c = CONTENT["intro"]
    ticks = "".join("<li>" + esc(t) + "</li>" for t in c["ticks"])
    return (
        '<section class="kyv-stage" id="kyv-top"><div class="kyv-app" id="kyv-app" aria-live="polite">'
        '<div class="kyv-screen kyv-intro"><span class="kyv-ai">' + SPARK + esc(CONTENT["ai_badge"]) + '</span>'
        '<div class="kyv-banner"><h1 class="kyv-banner-title">' + esc(c["banner_title"]) + '</h1>'
        '<p class="kyv-banner-sub">' + esc(c["banner_sub"]) + '</p></div>'
        '<p class="kyv-lede">' + esc(c["lede"]) + '</p>'
        '<button type="button" class="kyv-btn kyv-btn-lg" data-act="begin">' + esc(c["cta"]) + ' &#8594;</button>'
        '<ul class="kyv-ticks">' + ticks + '</ul>'
        '<noscript><p class="kyv-hint">Please enable JavaScript to use the vaccine planner.</p></noscript></div>'
        '</div></section>'
    )


def aibuilt_html() -> str:
    return ('<p class="kyv-aibuilt">' + SPARK + 'Built with AI by PharmEasy. Recommendations follow standard adult vaccination schedules.</p>')


def why_html() -> str:
    w, d = CONTENT["why"], CONTENT["doctor"]
    pts = "".join('<li><span class="kyv-vicon">' + ICON_SHIELD + '</span><div><b>' + esc(p["t"]) + '</b><span>' + esc(p["d"]) + '</span></div></li>' for p in w["points"])
    guar = "".join("<li>" + esc(g) + "</li>" for g in CONTENT["guarantee"])
    return (
        '<section id="kyv-why"><div class="kyv-wrap kyv-two">'
        '<div><h2 class="kyv-h2">' + esc(w["title"]) + '</h2><p class="kyv-sub">' + esc(w["body"]) + '</p><ul class="kyv-why-list">' + pts + '</ul></div>'
        '<div><h2 class="kyv-h2">The PharmEasy guarantee</h2><ul class="kyv-guar">' + guar + '</ul>'
        '<div class="kyv-doc"><h2>' + esc(d["title"]) + '</h2><p>' + esc(d["body"]) + '</p>'
        '<a class="kyv-btn" href="' + esc(with_src(d["url"])) + '" data-act="doctor" data-from="banner">' + esc(d["cta"]) + '</a></div></div>'
        '</div></section>'
    )


def faq_html() -> str:
    items = "".join('<details' + (' open' if i < 1 else '') + '><summary>' + esc(f["q"]) + '</summary><p>' + esc(f["a"]) + '</p></details>'
                    for i, f in enumerate(CONTENT["faq"]))
    return ('<section class="kyv-alt" id="kyv-faq"><div class="kyv-wrap"><h2 class="kyv-h2">Common questions</h2>'
            '<div class="kyv-faq">' + items + '</div></div></section>')


def jsonld() -> str:
    pub = SITE["publisher"]
    graph = [
        {"@type": "Organization", "@id": pub["url"] + "/#org", "name": pub["name"], "legalName": pub["legal_name"],
         "url": pub["url"], "logo": pub["logo"]},
        {"@type": "WebPage", "@id": BASE + "#page", "url": BASE, "name": SITE["title"], "description": SITE["description"],
         "inLanguage": SITE["language"], "publisher": {"@id": pub["url"] + "/#org"},
         "dateModified": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).strftime("%Y-%m-%dT%H:%M:%S+05:30")},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "PharmEasy", "item": pub["url"] + "/"},
            {"@type": "ListItem", "position": 2, "name": SITE["site_name"], "item": BASE}]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in CONTENT["faq"]]},
    ]
    rv = CONTENT.get("reviewer", {})
    if rv.get("names"):
        graph[1]["reviewedBy"] = [{"@type": "Person", "name": n} for n in rv["names"]]
    return '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/") + '</script>'


def head_meta() -> str:
    robots = "index,follow,max-image-preview:large" if ENV == "production" else "noindex,nofollow"
    t, d = SITE["title"], SITE["description"]
    return "\n".join([
        '<title>' + esc(t) + '</title>',
        '<meta name="description" content="' + esc(d) + '">',
        '<link rel="canonical" href="' + esc(BASE) + '">',
        '<meta name="robots" content="' + robots + '">',
        '<meta name="theme-color" content="' + SITE["theme_color"] + '">',
        '<meta name="color-scheme" content="light">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="PharmEasy">',
        '<meta property="og:title" content="' + esc(t) + '">',
        '<meta property="og:description" content="' + esc(d) + '">',
        '<meta property="og:url" content="' + esc(BASE) + '">',
        '<meta property="og:locale" content="' + SITE["locale"] + '">',
        '<meta name="twitter:card" content="summary">',
        '<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="assets/img/favicon.ico" sizes="any">',
        '<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">',
    ])


PAGE = """<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);}})(window,document,'script','dataLayer','{gtm}');</script>
<!-- End Google Tag Manager -->
{head}
{jsonld}
<link rel="preload" href="assets/fonts/inter-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/tokens.css?v={av}">
<link rel="stylesheet" href="assets/css/mobile.css?v={av}" media="(max-width: 819px), (pointer: coarse)">
<link rel="stylesheet" href="assets/css/desktop.css?v={av}" media="(min-width: 820px) and (pointer: fine)">
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
{nav}
<main>
{stage}
{why}
{faq}
{aibuilt}
</main>
{footer}
<div class="kyv-sticky" id="kyv-sticky"><a class="kyv-btn" href="#kyv-top" data-act="startcheck">Show my vaccines &#8594;</a></div>
<script>window.KYV = {kyv};</script>
<script src="assets/js/kyv.js?v={av}" defer></script>
</body>
</html>
"""


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for sub in ("css", "js", "fonts", "img"):
        shutil.copytree(os.path.join(ROOT, "assets", sub), os.path.join(OUT, "assets", sub))
    kyv = {
        "site": {"sheets_webhook_url": WEBHOOK, "sheets_key": SHEETS_KEY, "src": SRC,
                 "allow_skip_contact": bool(SITE.get("allow_skip_contact")), "env": ENV},
        "content": {k: v for k, v in CONTENT.items() if not k.startswith("_")},
    }
    html = PAGE.format(
        lang=SITE["language"], gtm=SITE["gtm_id"], head=head_meta(), jsonld=jsonld(), av=asset_version(),
        nav=nav_html(), stage=stage_html(), why=why_html(), faq=faq_html(), aibuilt=aibuilt_html(),
        footer=footer_html(), kyv=json.dumps(kyv, ensure_ascii=False).replace("</", "<\\/"))
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    # Convenience copy at the repo root so the page opens straight from the folder (asset paths are relative and
    # the repo's own assets/ folder holds the same files). The deploy workflows publish dist/, not this copy.
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    if ENV == "production":
        robots = "User-agent: *\nAllow: /\nSitemap: " + BASE + "sitemap.xml\n"
    else:
        robots = "User-agent: *\nDisallow: /\n"
    with open(os.path.join(OUT, "robots.txt"), "w") as fh:
        fh.write(robots)
    today = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))).strftime("%Y-%m-%d")
    with open(os.path.join(OUT, "sitemap.xml"), "w") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                 '<url><loc>' + esc(BASE) + '</loc><lastmod>' + today + '</lastmod></url></urlset>\n')
    print("built %s (env=%s, base=%s, sheet=%s)" % (OUT, ENV, BASE, "on" if WEBHOOK else "OFF"))


if __name__ == "__main__":
    main()
