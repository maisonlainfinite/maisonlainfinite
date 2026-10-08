# LA INFINITÉ

Italian luxury storefront on GitHub Pages: **https://maisonlainfinite.github.io/**.
Source: `main` branch, root directory.

Storefront: static HTML/CSS/JS generated from `scripts/build.py`. Run `python3 scripts/build.py` to regenerate.
Operations (new): `/admin/` — premium secure dashboard backed by Firebase Auth, Cloud Functions and Firestore. **Not live until your Firebase project is configured and functions/rules are deployed**.

See [Operations architecture and activation](docs/OPERATIONS.md) for what exists, setup steps and remaining implementation phases.

Run validation: `npm run check` (Node.js and Python 3).
