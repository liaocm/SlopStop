# Chrome Web Store submission kit

Everything to paste or upload in the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
tab by tab. Text inside code blocks is ready to copy as-is (the store's
description field is plain text).

## Package

| What | File |
| --- | --- |
| Extension zip | `dist/slopstopper-chrome-<version>.zip` (build with `scripts/package.sh`) |

## Store listing tab

**Name** (comes from `manifest.json`): SlopStopper

**Summary** (comes from the manifest `description`, max 132 characters):

```
Covers YouTube thumbnails of videos YouTube labels as made with AI, so you can spot them before clicking.
```

**Description:**

```
SlopStopper puts a big "AI slop" overlay on the thumbnails of YouTube videos that YouTube itself has labeled as made with AI, so you can see them before you click.

When a video is disclosed as made with AI, YouTube shows an "AI" badge under its title and a "How this was made: Made with AI" note in its description. But you only see that label after you open the video. SlopStopper checks the videos in the list you're browsing and marks the labeled ones right on the thumbnail.

WHERE IT WORKS
• Home
• Subscriptions
• Search results
• Channel pages
• The sidebar next to the video you're watching
• Regular videos and Shorts

HOW IT WORKS
When a thumbnail scrolls into view, SlopStopper asks YouTube for that video's AI label, the same label YouTube shows on the video's page. Results are cached on your device, so each video is only checked once.

PRIVACY
• Lookups go only to youtube.com and are sent without your cookies. They aren't tied to your account and don't affect your watch history or recommendations.
• No analytics, no tracking, no accounts. Nothing is sent to the developer or anyone else.
• Open source: https://github.com/liaocm/SlopStop

GOOD TO KNOW
• SlopStopper only flags videos that YouTube has labeled. AI videos that weren't disclosed or labeled won't be marked.
• You can still click a covered thumbnail to watch the video.

SlopStopper is an independent project. It is not affiliated with or endorsed by YouTube or Google.
```

**Category:** Functionality & UI. If the dropdown doesn't offer it, use Tools.

**Language:** English

**Graphic assets:**

| Field | File |
| --- | --- |
| Store icon (128×128) | `icons/icon128.png` |
| Screenshot 1 | `store/screenshots/1-search-results.png` |
| Screenshot 2 | `store/screenshots/2-channel-grid.png` |
| Screenshot 3 | `store/screenshots/3-before-after.png` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `store/promo-marquee-1400x560.png` |

**Homepage URL:** `https://github.com/liaocm/SlopStop`

**Support URL:** `https://github.com/liaocm/SlopStop/issues`

**Mature content:** off

## Privacy practices tab

**Single purpose description:**

```
SlopStopper marks YouTube video thumbnails with an "AI slop" overlay when YouTube has labeled the video as made with AI, so users can see the label before opening the video.
```

**Permission justification – storage:**

```
Caches each video's AI-label lookup result on the device (video ID, true/false, timestamp) so the same video isn't looked up again on every page. Entries expire after 3 to 30 days.
```

**Permission justification – host permission** (the content script on `https://www.youtube.com/*`):

```
The content script runs only on www.youtube.com. It finds the video thumbnails on the page, asks YouTube (same site, without cookies) whether each video carries YouTube's "Made with AI" label, and draws the overlay on labeled ones. It doesn't run on any other site.
```

**Are you using remote code?** No, I am not using remote code.

```
All JavaScript ships in the package. The extension only fetches JSON data from youtube.com; it never loads or evaluates remote scripts.
```

**Data usage – what user data do you collect?** Tick **Website content**.
The extension reads video links on YouTube pages and sends those video IDs to
YouTube to look up their labels. Nothing goes to the developer, but disclosing
this is the conservative choice and avoids a mismatch with what reviewers see
in the code. Leave every other category unticked.

**Certifications:** tick all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/liaocm/SlopStop/blob/main/PRIVACY.md`

## Test instructions tab

No account or credentials needed.

```
No login is required.
1. Install the extension and open https://www.youtube.com/results?search_query=ai+cat+shorts+veo
2. Thumbnails of videos that YouTube labels as made with AI are covered by a dark overlay reading "AI slop". Videos without YouTube's label are left alone.
3. To compare with YouTube's own label, open a covered video: an "AI" badge appears under its title, and the description has a "How this was made: Made with AI" section.
Another page with many labeled videos: https://www.youtube.com/@Milo-m7n7q/videos
```

## Distribution tab

- **Payments:** Free
- **Visibility:** Public (or Unlisted to share by link only)
- **Regions:** All regions

## Regenerating the images

```bash
npm install && npx playwright install chromium
npm run screenshots                 # store/raw/*.png, logged-out Chromium
python3 scripts/make_store_assets.py
```
