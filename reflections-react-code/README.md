# RepoPress

**RepoPress** is a Git-native publishing platform for authors. Use **GitHub** as your content system: store Markdown and images in a repository with effectively unlimited storage, edit in the browser with AI assistance, and publish to the web or export an EPUB.

This repository is a **live example** of RepoPress in use: the author uses it here to create, refine, and share personal ideas and long-form writing.

## Live site

[**a-reflections.web.app**](https://a-reflections.web.app)

## What RepoPress provides

- **GitHub as CMS** — chapters and sections as Markdown; images in-repo
- **Web publishing** — React reader hosted on Firebase
- **GitHub sign-in** — OAuth via Firebase Authentication for in-browser editing
- **AI writing** — section rewording, translation, summaries, text-to-speech
- **AI images** — generate and manage illustrations tied to sections
- **EPUB export** — preview and download books for Apple Books, Kindle, and other stores

## Content on this site

The published writing explores Islamic topics, psychology, Egyptology, and related themes — a personal, methodical reading of texts rather than inherited commentary alone.

## Technology stack

- React
- Material-UI
- React-Markdown
- Firebase Hosting & Authentication (GitHub provider)
- GitHub API

## Local development

1. Copy `.env.example` to `.env` (optional — the app includes defaults for the `a-reflections` Firebase project).
2. Enable **GitHub** as a sign-in provider in [Firebase Authentication](https://console.firebase.google.com/) for project `a-reflections`.
3. Install and run:

```bash
npm ci
npm start
```

To override Firebase settings, set:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=a-reflections.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=a-reflections
REACT_APP_FIREBASE_APP_ID=...
```

Restart the dev server after changing `.env`.

## License

MIT — feel free to read, share, or fork.
