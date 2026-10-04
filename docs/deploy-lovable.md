# Deploying on Lovable (Pro plan)

The app is a static Vite site, which Lovable can host, but two things need care: Lovable cannot
import an existing repository (it always creates its own, and syncs one branch of it), and it has
file-size limits around the speech model. The route below is the known workaround: let Lovable
create the repository, then replace its contents with ours and push. Twenty minutes.

Lovable expects one Vite project at the root of the repository, so a script assembles that layout
from this project into `_lovable/` (git-ignored): the frontend at the root, `data/` under
`public/data`, a simpler `vite.config.ts`, an `.npmrc` that stops `onnxruntime-node`'s GPU download
during install, and the docs the judges read.

## Steps

1. **Build the layout** (from `frontend/`, after any change to the project):
   `node scripts/make-lovable-repo.mjs`
   → `_lovable/` next to `frontend/`, model and runtime files included (about 68 MB).
2. **Create the Lovable project.** In Lovable: New project, any short prompt (the generated starter
   is thrown away), name it `geo-health-bakool`.
3. **Connect GitHub.** Project settings → GitHub (or Settings → Connectors) → Connect → authorize the
   Lovable GitHub app on your account → Create repository. Lovable creates
   `github.com/<you>/geo-health-bakool` and syncs its `main` branch.
4. **Replace the starter with the app.** On your PC:
   ```
   git clone https://github.com/<you>/geo-health-bakool
   cd geo-health-bakool
   # delete everything except .git, then copy the contents of _lovable/ here
   git add -A
   git commit -m "Geo Health Bakool: map and offline facility finder"
   git push origin main
   ```
   (Git for Windows: `Remove-Item * -Recurse -Force -Exclude .git` in PowerShell, then copy.)
5. **Check the preview in Lovable.** The project refreshes from GitHub within a minute. Open the
   preview: the map should load at `/` and the finder at `/finder.html`. If the build log complains
   about a file that is too large, use the fallback below.
6. **Publish.** Top right, Publish → `geo-health-bakool.lovable.app` (edit the subdomain before the
   first publish if you like). Every later push to `main` is synced into Lovable but is **not**
   published until you press "Publish changes".
7. **Custom domain** (paid plans): Project settings → Domains → add `geo-health.nexasee.com`, then
   create the CNAME it shows in Cloudflare (DNS only, not proxied, until it verifies).
8. **Verify on the phone** over the HTTPS URL: `/finder.html`, tap Speak once online (or "Download
   voice") → the pill turns to "Voice ready offline"; switch on aeroplane mode, reload, ask again.

## If Lovable refuses the model files

Lovable itself cannot save files over 10 MB, and publishing can be blocked by "a file that is too
large"; the threshold for files pushed from GitHub is not documented. The decoder (31 MB) and the
ONNX runtime (27 MB) are the two files at risk. Fallback, same model, same behaviour:

```
node scripts/make-lovable-repo.mjs --remote-voice
```

This leaves `public/models/` and `public/ort/` out and writes `.env` with `VITE_VOICE_REMOTE=1`:
the finder then fetches Whisper tiny from its public home on Hugging Face
(`onnx-community/whisper-tiny`, MIT) and the runtime from onnxruntime-web's CDN copy on first use,
and the service worker keeps both for offline use exactly as before. Push again, Publish changes.
Say in the video that the voice pack is then fetched from Hugging Face on first use rather than
side-loaded from the site; the typed finder is unchanged.

## What Lovable does not give you

- Custom response headers: the strict CSP and `Permissions-Policy` from `deploy/nginx/` do not
  apply; browsers allow the microphone on your own origin by default, so voice still works.
- The `/finder` short path (an Nginx rule); all links use `/finder.html`, which works.
- Lovable's AI editor expects its own React + Tailwind structure; it may not edit this project
  well, and the import route is a workaround, not a supported feature. Hosting and publishing are
  what we need from it.

## Plain alternatives (five minutes, no limits that bite)

- **Netlify**: `npm run build` in `frontend/`, then drag `frontend/dist/` onto app.netlify.com/drop;
  HTTPS and the big files are fine.
- **GitHub Pages**: push `frontend/dist/` to a `gh-pages` branch or a `docs/` folder; the 100 MB
  per-file limit is above our 31 MB.
- **Your own Nginx** (`deploy/`): the configuration with the right headers is already there.
