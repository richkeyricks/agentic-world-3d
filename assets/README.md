# assets/

Images used by the README and the repository's social preview. All files here are binary images — they are **not** part of the first snapshot push (which is text-only) and are added to the repository separately.

## What belongs here

| File | Size | Used for |
|---|---|---|
| `banner.png` | 1280 × 640 | README hero image (top of the README) and GitHub social preview |
| `social_card.png` | 1280 × 640 | Alternate social preview card (link shares on X / Telegram / WhatsApp) |
| `screenshot-*.png` | 1280 × 800 | Screenshots of the live office used inside the README / docs |

## Notes

- Keep images reasonably small (aim < 300 KB each) so the repo stays fast to clone.
- The Open Graph image served by the live site is `public/og-image.png` (served at `/og-image.png`) — it is a separate file from the images in this folder.
- Do not commit secrets, screenshots containing access codes, or personal data here.
