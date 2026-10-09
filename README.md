# dullspecies.com

The website. A field guide to Dull Species, pasted together from old magazines.

## Dev

```
make dev
```

Then open http://localhost:3000. Templates, `site.json` and everything in
`static/` are re-read on every request, so just reload.

`make build` renders the production site into `dist/` (that's what gets
deployed).

## Adding a release

1. Put the cover in `static/images/covers/` as an 800×800 WebP:

   ```
   cwebp -q 80 -resize 800 800 cover.jpg -o static/images/covers/new-single.webp
   ```

2. Add an entry to `releases` in `site.json`. Order doesn't matter; releases
   are sorted by date and numbered oldest first.

   ```json
   {
     "title": "New Single",
     "date": "2026-10-31",
     "cover": "new-single.webp",
     "color": "#ff5a28",
     "spotify": "https://open.spotify.com/track/…",
     "apple": "https://music.apple.com/us/album/…",
     "tracks": [
       { "title": "New Single", "youtube": "<video id>", "duration": "3:33" }
     ]
   }
   ```

   `color` is the accent for that release's label and record, so pick
   something loud from the cover. `youtube` is the video ID from the
   "Dull Species - Topic" channel; the on-page player uses it.

The newest release automatically becomes the "Latest specimen" in the hero,
gets the "New!" sticker, and is added to the marquee.

## Doods

Every image in `static/images/doods/` is scattered (and draggable) around the
hero and bounces around in the screensaver. The file name becomes the caption,
so `angry-pirate.webp` is labeled "angry pirate". Any of WebP, PNG, JPG or GIF
works.

## Easter eggs

- Leave the page alone for a minute, click "screensaver" in the footer, or type
  `dvd`.
- Hit a corner.

## Deployment

GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to
`main`. Pages needs to be set to deploy from GitHub Actions
(Settings → Pages → Source → GitHub Actions).
