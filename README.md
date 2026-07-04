# AndreOS — Personal WebOS Portfolio

An interactive desktop OS experience serving as my personal portfolio.  
Based on the open-source template by **[Justinianus2001 (Hoang Le Ngoc)](https://github.com/Justinianus2001/my-portfolio)** — all credit for the original architecture, visual design, and audio system goes to him.

---

## Getting started

1. Clone this repo
2. Open `index.html` in any modern browser (Chrome recommended)
3. Click the power button to boot up
4. Click anywhere to enable audio

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Tab` | Switch windows |
| `Ctrl + W` | Close active window |
| `Ctrl + Space` | Toggle start menu |
| `Ctrl + D` | Show desktop |
| `Esc` | Close overlays |

## Customising content

Edit the following functions in `script.js` to make it yours:

- `getAboutContent()` — bio & intro
- `getResumeContent()` — work experience & education
- `getProjectsContent()` — project showcase
- `getSkillsContent()` — tech skills
- `getContactContent()` — contact details
- `getSocialContent()` — social links

Swap SVG files in `icons/` to change the desktop icons, and tweak CSS custom properties in `styles.css` for colours and themes.

## Stack

Pure HTML · CSS · Vanilla JavaScript · Web Audio API

## License

MIT — see [LICENSE](LICENSE).

---

> Based on [Justinianus2001/my-portfolio](https://github.com/Justinianus2001/my-portfolio) · MIT License
