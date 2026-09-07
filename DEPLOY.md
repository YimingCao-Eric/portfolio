# Deploying this site

The site is plain static files, so almost anything can host it. Below is the
route I'd recommend, plus a no-git fallback.

---

## Recommended: GitHub Pages

Free, permanent, and the URL is a fine thing to put on a résumé.

### Name the repo

Call it **`portfolio`**. The repo URL is then
`github.com/YimingCao-Eric/portfolio` and the site lands at:

```
https://yimingcao-eric.github.io/portfolio/
```

The `/portfolio/` subpath is the trade-off. GitHub only serves a site from the
root of your account if the repo is named exactly `YimingCao-Eric.github.io`,
which repeats your name in the repo URL. If the subpath ever bothers you, a
custom domain removes it completely (see below) — and that works without
renaming or moving anything, so nothing here is a one-way door.

Every path in this site is relative, so it works from a subdirectory with no
config changes.

### 1. Create the repo on GitHub

Go to <https://github.com/new>:

- **Repository name:** `portfolio`
- **Public** (Pages needs public on the free plan)
- Do **not** tick "Add a README" / .gitignore / licence — the folder already has
  commits and an extra one here would collide.

### 2. Push this folder

A git repo has already been initialised in `E:\workSpace\portfolio\site` with
everything committed.

**Use PowerShell or Git Bash, not WSL.** Git on a Windows drive through WSL is
slow and the credential prompt is fussier. In PowerShell or Git Bash:

```bash
cd E:\workSpace\portfolio\site
git remote add origin https://github.com/YimingCao-Eric/portfolio.git
git branch -M main
git push -u origin main
```

<details>
<summary>If you insist on WSL</summary>

Bash doesn't understand `E:\...` — backslashes are escape characters there and
drive letters mean nothing. Your E: drive lives under `/mnt/e`:

```bash
cd /mnt/e/workSpace/portfolio/site
```

If `/mnt/e` doesn't exist, mount it:

```bash
sudo mkdir -p /mnt/e && sudo mount -t drvfs E: /mnt/e
```

Git will then probably refuse with a "dubious ownership" warning, because the
repo was created under a different user. One line clears it for good:

```bash
git config --global --add safe.directory /mnt/e/workSpace/portfolio/site
```

Then the same remote/push commands as above.
</details>

If git asks who you are, set it once:

```bash
git config --global user.name  "Yiming Cao"
git config --global user.email "caoyimingeric@gmail.com"
```

For the password prompt, GitHub no longer accepts your account password — use a
**personal access token** (github.com → Settings → Developer settings → Personal
access tokens → Tokens (classic) → Generate new token, tick `repo`), and paste
that as the password. Or install [GitHub CLI](https://cli.github.com/) and run
`gh auth login` once, which handles it for you.

### 3. Turn on Pages

In the repo: **Settings → Pages**.

- **Source:** Deploy from a branch
- **Branch:** `main`, folder `/ (root)`
- Save.

Wait 1–3 minutes for the first build. The URL appears at the top of that same
page. Later pushes redeploy automatically, usually within a minute.

### 4. Updating it later

```bash
git add .
git commit -m "add the JHA write-up"
git push
```

That's the whole loop.

---

## Custom domain (optional)

This is what removes the `/portfolio/` subpath. If you buy something like
`yimingcao.dev`, the site is served from the root of that domain instead and the
repo name becomes invisible:

1. At your registrar, add a `CNAME` record for `www` pointing to
   `yimingcao-eric.github.io`, and four `A` records for the apex domain pointing
   to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
2. In **Settings → Pages → Custom domain**, enter the domain and save. GitHub
   writes a `CNAME` file into the repo.
3. Tick **Enforce HTTPS** once the certificate is issued (can take an hour).

---

## No-git fallback: Netlify Drop

If you'd rather not touch git today:

1. Go to <https://app.netlify.com/drop>.
2. Drag the whole `site` folder onto the page.
3. It's live in about ten seconds at a random URL you can rename in site settings.

The catch is that updating means dragging the folder again — fine for a one-off,
worse as a habit. Use it to see the site on a real URL today, move to Pages when
you're ready.

---

## Before you make it public — checklist

### 1. Placeholder cards on the home page

`index.html` has three cards carrying `class="card card--draft"` — JHA, the geospatial
work, and the RAG chatbot. They render greyed out and say "Write-up in progress."

They were scaffolding, to show you where new projects slot in. Two finished case
studies standing alone looks deliberate; two finished ones beside three
"in progress" placeholders looks like an abandoned site. Delete the three
`<article class="card card--draft">` blocks and add them back as each write-up
gets written.

### 2. Your contribution (both credits blocks) — **now written, worth re-reading**

See the note in the conversation: I did not write "I did all of it" because
that isn't a claim a group project can support, and one of the 501 decks has
another author's name in its file metadata. The current wording states you were
first author and names the areas you worked across. If you later recall a
sharper split, tighten it — but do not broaden it.

### 3. Course codes — **done**

Now reads "EECE 501, UBC" and "EECE 523, UBC" in the Context field of each page.
If either number is wrong, fix the one line in the `case-meta` block. A wrong
course code is the kind of small error that makes a reader doubt the big claims.

### 4. Third-party images in the 501 intro deck — **decided: keeping**

Slides 10–13 show DALL·E, Imagen, Stable Diffusion and Midjourney marketing
images. Kept as a 2023 classroom artefact, credited on the slides themselves.
Nothing to do.

### 5. The "Learing" typo — still open

The 501 derivation deck's title slide reads "Deep Generative **Learing**". It is
the first thing anyone sees when they switch to that deck in the viewer. To fix:

```bash
# after correcting the title in PowerPoint and re-exporting:
soffice --headless --convert-to pdf --outdir . "your-corrected-deck.pptx"
cd assets/img/slides-math
pdftoppm -jpeg -jpegopt quality=82 -scale-to-x 1280 -scale-to-y -1 "your-corrected-deck.pdf" slide
```

Then replace `assets/files/ddpm-slides-derivation.pdf` and `.pptx` too, so the
download matches what the viewer shows.

### 6. EECE 541 (Bayer-pattern fake-image detection) — credits still open

`projects/bayer-fake-image-detection.html` carries a `TODO(Yiming)` comment in
its Credits block. It currently says only "Produced jointly with three team
members … Yiming Cao is third author on the paper." Tell me your division of
work and I'll write it in; teammates stay unnamed on the page, as everywhere else.

The team's code repository is not bundled (it is a teammate's GitHub repo and
contains a ChatGPT chat log). If you want a code artefact on the page, the
options are: link the repo, or bundle only the `python/` scripts. Your call.

## Notes on repo size

The two original `.pptx` files add about 21 MB, most of it the intro deck's
embedded GIFs. That's well within GitHub's limits and fine to keep. If you ever
want the repo lean, drop `assets/files/ddpm-slides-intro.pptx` — the PDF and the
in-page viewer already cover every reader who isn't specifically after the
editable source.
