# SlopStopper Privacy Policy

_Last updated: October 29, 2026_

SlopStopper is a browser extension that marks YouTube videos YouTube has
labeled as made with AI. This policy explains what data it handles.

## What the extension reads

On `www.youtube.com` pages, SlopStopper reads the links of the video
thumbnails on the page to get each video's ID (for example, `dQw4w9WgXcQ`).

## What it sends, and to whom

For each video ID, SlopStopper asks YouTube (`https://www.youtube.com`) whether
that video carries YouTube's "Made with AI" label. These requests:

- go only to YouTube, the site you're already viewing;
- contain only the video ID, plus a fixed client name/version and language
  setting that YouTube's API requires;
- are sent **without your cookies**, so YouTube can't tie them to your account,
  and they don't affect your watch history or recommendations.

SlopStopper doesn't send any data to its developer or any other third party.
It has no analytics, tracking, ads, or accounts.

## What it stores

SlopStopper caches each result on your device using the browser's extension
storage: the video ID, whether it's labeled as AI, and when it was checked.
Entries expire after 3 days (not labeled) or 30 days (labeled) and are
deleted periodically. Uninstalling the extension removes them.

## What it doesn't do

- It doesn't collect personal information, browsing history, or anything from
  sites other than `www.youtube.com`.
- It doesn't sell or share data, or use it for anything other than showing
  the overlay.

## Contact

Questions or concerns: open an issue at
<https://github.com/liaocm/SlopStop/issues>.
