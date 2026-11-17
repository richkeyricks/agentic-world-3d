# assets/

Images used by the README and the repository's social preview. All files here are binary images — they are **not** part of the first snapshot push (which is text-only) and are added to the repository separately.

## What belongs here

| File | Size | Used for |
|---|---|---|
| `repo-banner.png` | 1440 × 720, ~1.4 MB | README hero image (top of the README). Night illustration of the office, food carts and UFO — an illustration, not a screenshot. The same artwork (as a 1280 × 720 JPEG, ~225 KB) is the repo's GitHub social preview. |
| `og-image.png` | — | Not in this folder — the Open Graph image served by the live site lives at `public/og-image.png` (served at `/og-image.png`). |

## Notes

- Keep images reasonably small (aim < 300 KB each) so the repo stays fast to clone. `repo-banner.png` is the one exception — it is the hero artwork.
- Screenshots of the live office belong in `docs/screenshots/` (`office.png`, `mission-control.png`), not here.
- The Open Graph image served by the live site is `public/og-image.png` — it is a separate file from the images in this folder.
- Do not commit secrets, screenshots containing access codes, or personal data here.
