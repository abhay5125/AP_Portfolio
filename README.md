<<<<<<< HEAD
# Portfolio site

A single-page portfolio template built with plain HTML/CSS/JS — no build
step, so it works out of the box on GitHub Pages.

## Files

- `index.html` — page structure and content
- `style.css` — all styling (design tokens are at the top as CSS variables)
- `script.js` — mobile nav toggle + scroll-reveal animation
- `resume.pdf` — placeholder; replace with your actual résumé

## Deploy on GitHub Pages

1. Create a new repo named exactly `your-username.github.io`
   (replace `your-username` with your actual GitHub username).
2. Push these files to the root of that repo:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/your-username/your-username.github.io.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**, and under "Build and
   deployment" set **Source** to "Deploy from a branch", branch `main`,
   folder `/root`.
4. Your site will be live at `https://your-username.github.io` within a
   minute or two.

If you'd rather host it as a project page (e.g.
`your-username.github.io/portfolio`) instead of your main profile site,
just push to any repo name and enable Pages the same way — the URL will
include the repo name.

## Customize

Everything you'll want to change first is in `index.html`:

- Swap "Jordan Ellis" for your name, and edit the hero copy.
- Replace the four project cards under `#projects` with your own —
  each one is a self-contained `<article class="job">` block.
- Update the `#skills` tag lists to match your actual stack.
- Update the email/GitHub/LinkedIn links in `#contact`.
- Drop your own `resume.pdf` in the root, replacing the placeholder.

To restyle, the color palette, fonts, and spacing scale all live as CSS
variables at the top of `style.css` under `:root` — changing those
values will cascade through the whole site.

## Ideas for expanding it later

- Add a real project detail page per case study instead of just links.
- Pull GitHub repo data live via the GitHub API to auto-populate stats.
- Add a blog section if you start writing about your work.
- Swap the SVG pipeline diagram in the hero for something animated with
  real (anonymized) metrics from a project you're proud of.
=======
# abhaypatel.github.io
>>>>>>> 450a067927eb3f46c8781f85dc384cbc7eb89942
