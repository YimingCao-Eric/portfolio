# Deploying this site

The site is plain static files, so almost anything can host it. Below is the
route I'd recommend, plus a no-git fallback.

---

## Recommended: GitHub Pages

Free, permanent, and the URL is a fine thing to put on a résumé.

### Name the repo carefully

GitHub gives you two different URLs depending on the repo name:

| Repo name                    | Your site lives at                                  |
| ---------------------------- | --------------------------------------------------- |
| `YimingCao-Eric.github.io`   | `https://yimingcao-eric.github.io/`  ← **use this**  |
| anything else, e.g. `portfolio` | `https://yimingcao-eric.github.io/portfolio/`     |

Use the first one. A portfolio at the root of your own domain reads better than
one buried in a subpath, and you only get one of these per account — spend it here.

### 1. Create the repo on GitHub

Go to <https://github.com/new>:

- **Repository name:** `YimingCao-Eric.github.io`
- **Public** (Pages needs public on the free plan)
- Do **not** tick "Add a README" / .gitignore / licence — the folder already has
  a commit and an extra one here would collide.

### 2. Push this folder

A git repo has already been initialised in `E:\workSpace\portfolio\site` with
everything committed. Open a terminal there (Git Bash, PowerShell, or the
terminal in your editor) and run:

```bash
cd E:\workSpace\portfolio\site
git remote add origin https://github.com/YimingCao-Eric/YimingCao-Eric.github.io.git
git branch -M main
git push -u origin main
```

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

If you buy something like `yimingcao.dev`:

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

- [ ] Replace the placeholder cards in `index.html`, or delete the ones you
      won't get to soon. Three "write-up in progress" cards look worse than one
      finished project standing alone.
- [ ] Fill in your specific contribution in the credits block of
      `projects/ddpm-diffusion-models.html` (marked with a `TODO` comment).
- [ ] Confirm the course code and institution in the same file (also a `TODO`).
- [ ] Decide whether to keep slides 10–13 of the intro deck — they're
      DALL·E / Imagen / Stable Diffusion promotional images, which are fine in a
      classroom and less clearly fine on a public site.
- [ ] Fix the typo on the derivation deck's title slide: "Deep Generative
      **Learing**" → "Learning". Re-export that deck to PDF and re-render the
      slide images afterwards (see README).

## Notes on repo size

The two original `.pptx` files add about 21 MB, most of it the intro deck's
embedded GIFs. That's well within GitHub's limits and fine to keep. If you ever
want the repo lean, drop `assets/files/ddpm-slides-intro.pptx` — the PDF and the
in-page viewer already cover every reader who isn't specifically after the
editable source.
