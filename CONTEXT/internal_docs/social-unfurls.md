# Social Unfurls (Open Graph + Twitter Cards)

How the museum's link previews work across Facebook, LinkedIn, Twitter/X,
Discord, iMessage, Telegram, and Slack — and why one of them (LinkedIn)
gets a different metadata payload than the rest.

## What ships

| Asset                               | Path                            | Notes                                                          |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Poster (1.91:1, OG-canonical)       | `public/og/stage-poster.png`    | 1200×630, ~432 KB. Used by every platform's preview.           |
| Poster (full-res)                   | `public/og/stage-poster-hd.png` | 1920×1080. Secondary; some platforms prefer it.                |
| Stage clip                          | `public/og/stage.mp4`           | 1920×1080, ~9s, 8.45 MB, H.264 + `+faststart`, audio stripped. |
| Twitter player page                 | `public/og/player.html`         | Embeds the MP4 in an autoplay/muted/loop `<video>`.            |
| Favicon (rasterized hex+tri)        | `src/app/favicon.ico`           | 16/32/48px, transparent bg, baked Full-Stack blue.             |
| Favicon (canonical, theme-adaptive) | `src/app/icon.svg`              | Stroked hex + inscribed triangle, radial gradient.             |

Tags are emitted from `generateMetadata` in
[src/app/(museum)/layout.tsx](<../../src/app/(museum)/layout.tsx>). Next.js
resolves all relative URLs against `metadataBase`. The function reads the
`User-Agent` header and branches the metadata shape (see below).

## Platform matrix

| Platform  | Card type seen                 | What renders                                    |
| --------- | ------------------------------ | ----------------------------------------------- |
| Facebook  | OG website                     | Poster + title + description.                   |
| LinkedIn  | OG website (after UA-strip)    | Poster + title + description.                   |
| Twitter/X | `twitter:card=player`          | Inline player loads `player.html`.              |
| Discord   | OG video                       | **Inline MP4 plays in the unfurl.**             |
| iMessage  | OG video                       | **Inline MP4 plays in the unfurl.**             |
| Telegram  | OG video                       | **Inline MP4 plays in the unfurl.**             |
| Slack     | OG image (sometimes plays MP4) | Poster + play affordance (workspace-dependent). |

## The LinkedIn carve-out

**Symptom (pre-fix):** LinkedIn Post Inspector reported `Type: Video`,
`Image: No image found`. The poster never surfaced in the unfurl.

**Cause:** LinkedIn's parser classifies any page emitting `og:video*` tags
as a Video page, then its video renderer expects a LinkedIn-hosted video
URN (per their Videos API — `learn.microsoft.com/en-us/linkedin/marketing/
community-management/shares/videos-api`), **not an external MP4 URL**.
When it doesn't find a URN, it fails open and drops `og:image` from the
parse. This is structural, not a cache bug:

- LinkedIn has no public spec for external-MP4 unfurls.
- `og:type=article`, `og:image:secure_url`, `og:video:image`, reordering
  tags, multiple `og:image` entries — all folklore. None of them clear
  the video-mode classification.
- Microlink, Facebook, and direct HTML inspection all parse the same OG
  block correctly. LinkedIn is the outlier.

**Fix:** `generateMetadata` in the museum layout detects `LinkedInBot` in
the `User-Agent` and serves a video-free metadata shape — drops `og:video*`
and `twitter:player*`, downgrades `twitter:card` to `summary_large_image`,
keeps everything else. LinkedIn falls back to the standard website parser,
finds `og:image`, and renders the poster card.

Every other crawler keeps the full payload. Discord/iMessage/Telegram
still play the inline video.

This converts the museum landing route from static to dynamic — the metadata
varies by request header, so it can't be prerendered. Acceptable trade for a
low-traffic landing page.

## Quirks worth remembering

- **LinkedIn renders the inline-feed unfurl at ~520×270.** They downscale
  hard for two-column feed layouts. There is no tag, no setting, no UA trick
  that opts out. Design the poster for legibility at that size — large
  typography, tight composition. Fine detail (the unfolded hex billboard's
  inner copy) is unreadable in the feed.
- **Facebook silently drops `og:video` for non-whitelisted publishers** —
  has since 2017. It will show the poster only. This is _not_ a bug in our
  tags; FB requires a `fb:app_id` + their video player wrapper for inline
  video unfurls. The `og:video*` tags do their job elsewhere; FB just falls
  back to `og:image`.
- **Twitter ignores `og:video` entirely.** It only honors `twitter:player`,
  which requires a real HTML page (not a raw MP4 URL) that embeds the video.
  That's what `public/og/player.html` is for.
- **`+faststart` is mandatory** on the MP4. Recorders typically write the
  `moov` atom at file end; crawlers that try to stream-render need it at
  the start. Re-mux with `ffmpeg -i in.mp4 -c copy -movflags +faststart -an out.mp4`.
- **`og:image` should be ≥1200×627** for LinkedIn's high-res card. Below
  401px wide, LinkedIn falls back to a thumbnail layout. We ship 1200×630,
  which clears the threshold.

## Verification recipes

After any change to OG metadata:

```bash
# Confirm both UA branches on production
curl -sA "LinkedInBot/1.0" https://unlv-museum.infinite-syndicate.com/ \
  | grep -oE '<meta (property|name)="(og:|twitter:)[^"]+" content="[^"]+"'

curl -s https://unlv-museum.infinite-syndicate.com/ \
  | grep -oE '<meta (property|name)="(og:|twitter:)[^"]+" content="[^"]+"' | wc -l
# Default UA should report 23 tags; LinkedInBot should report 14.

# Confirm assets resolve
for url in stage-poster.png stage.mp4 player.html; do
  curl -sI "https://unlv-museum.infinite-syndicate.com/og/$url" \
    | grep -iE 'HTTP|content-type|content-length'
done
```

Then force re-scrape at each debugger (they cache aggressively):

- Facebook: https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Funlv-museum.infinite-syndicate.com%2F
- LinkedIn: https://www.linkedin.com/post-inspector/inspect/https%3A%2F%2Funlv-museum.infinite-syndicate.com%2F
- Cheapest live test: DM the URL to yourself in Discord (video should
  play inline) and Slack (poster should render).

## Regenerating the favicon

`src/app/icon.svg` is canonical (theme-adaptive via `var()` + `oklch()`,
neither of which librsvg can resolve). The `.ico` is rasterized from a
static variant with Full-Stack blue (#3b82f6) baked in:

```bash
pnpm exec tsx scripts/build-favicon.ts
```

Writes `src/app/favicon.ico` at 16/32/48px, transparent background. Edit
`STATIC_SVG` in `scripts/build-favicon.ts` if the glyph or color changes —
keep it in sync with `icon.svg`.
