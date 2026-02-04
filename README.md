# Night Owl's daily note 🦉✨

Work with daily notes like a night owl. This plugin shifts "today" to a configurable rollover hour (e.g. 4 AM), so late-night writing still lands in the correct daily note. 🌙📝

## Features 🚀

- Jump to today/yesterday/tomorrow using a night-owl-aware date.
- Navigate to the previous/next existing daily note (skips missing dates).
- Command constraints hide prev/next when navigation is not possible.

## Commands 🎛️

- Jump to: Today (Night Owl)
- Jump to: Yesterday (Night Owl)
- Jump to: Tomorrow (Night Owl)
- Navigate: Previous Existing Daily Note
- Navigate: Next Existing Daily Note

## Settings ⚙️

- Rollover hour: The hour (0-23) when the new day starts.
- Date format: Moment.js format used in daily note filenames.
- Folder: Folder where daily notes are stored.

## Install (development) 🧪

```bash
npm install
npm run dev
```

## Build 🏗️

```bash
npm run build
```

## Manual install 📦

Copy these files into your vault folder:

```
<Vault>/.obsidian/plugins/night-owl-daily-note/
  main.js
  manifest.json
  styles.css
```

Then reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Notes 🗒️

- Daily note filenames must match the configured date format.
- The navigation commands only appear when a previous/next daily note exists.

## Compatibility with core Daily Notes 🤝

This plugin is separate from Obsidian's core Daily Notes. It does not change or replace core behavior, and it can be used alongside the core plugin if you keep folder and date format settings aligned. If you use different settings, this plugin will target a different set of notes by design. 🧭

To avoid confusion and redundant entries in the command palette, consider disabling the core Daily Notes plugin when you primarily use Night Owl's daily note. Your command palette will thank you. 😄

## License 📜

See `LICENSE`.
