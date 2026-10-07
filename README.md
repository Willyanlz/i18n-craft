# i18nCraft

**i18nCraft** is an **open-source internationalization (i18n) JSON file editor focused on ultra-fast keyboard UX and AI-assisted translation**. Built for developers and product teams who need to scale multinational SaaS platforms without wasting time manually editing local files.

Define a key once, translate it across languages, and export consistent JSON files. Start from scratch or import existing translations, work with flat or nested keys, and use optional AI suggestions while keeping control over every translation.

## Features

- **Keyboard-first editing** — move between keys and translations with Tab, and create new rows with Enter.
- **Shared keys across languages** — edit Portuguese, English, Spanish, French, German, Italian, and Japanese side by side.
- **Nested JSON** — write `automation.example` to generate nested objects automatically.
- **Import and merge** — select the file's language and choose whether to keep or replace existing values.
- **Copy and export** — preview JSON or its tree structure, copy a language, download an individual JSON file, or export all languages as a ZIP.
- **Optional AI assistance** — request suggestions through Gemini, Claude, OpenAI, or OpenRouter using your own API key and an editable model selection.
- **Translation suggestions** — accept or reject each suggestion, see empty values highlighted in red, and filter missing translations.
- **Placeholder checks** — validate variables and HTML tags before showing AI suggestions.
- **Workspace preferences** — Portuguese, English, and Spanish interfaces, translation source matching the interface language, and light/dark themes.
- **Saved AI settings** — provider, model, and API key are saved automatically in localStorage.

No account or database is required. The current project is saved automatically in sessionStorage and restored after reloading the tab.

## Quick start

Use Node.js 22.12+ or a supported newer version (`24.x` or `26+`) and npm.

```sh
git clone https://github.com/Willyanlz/i18n-craft.git
cd i18n-craft
npm install
npm run dev
```

Open the local URL printed by Vite. The development server also serves `/api/translate`, so AI assistance can be used locally after configuring a provider and API key.

## Editing workflow

1. Add a key or import a JSON file and select its language.
2. Select the languages you need. The interface language is also the source language for AI translations.
3. Fill each language's value, or enable AI assistance and request suggestions.
4. Review suggestions and check missing translations using the editor filters.
5. Copy or download your JSON files before closing the page.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Tab` | Move to the next cell; create a row after the final translation cell. |
| `Shift+Tab` | Move to the previous cell. |
| `Enter` | Create a row and focus its key. |
| `Shift+Enter` | Insert a line break in a translation value. |

### Nested keys

Enter `automation.example` as the key and `Example` as the English value:

```json
{
  "automation": {
    "example": "Example"
  }
}
```

Keys are shared across selected languages; values are independent. Missing translations are exported as empty strings. Duplicate keys and conflicts between object paths and text values must be resolved before export.

### Import format

Import JSON objects whose leaf values are strings. Arrays, numbers, nested empty objects, and literal keys containing dots are rejected to avoid ambiguous conversions. Import limits are 2 MB per file, 5,000 keys, and 20 levels of nesting.

When merging an existing language, choose whether imported values replace existing values or leave them intact.

## AI-assisted translation

Enable AI assistance in the editor or Settings, select a provider, and enter your API key. The initial model names are editable defaults; model availability and usage costs depend on your provider account.

A single global action requests suggestions for all eligible keys in batches of up to 100. Keys are grouped by their missing target languages, so only empty fields are requested from the provider. It appears only when AI is enabled and a valid key has a non-empty value in the interface language and a missing translation in another selected language. Rows without source text are skipped.

- **Accept** fills the translation and clears its missing-value warning.
- **Reject** moves focus to the input for manual editing.
- Existing translations are not automatically replaced.
- Suggestions based on a source that changed while the request was running are discarded.


The application checks placeholders such as `{name}`, `{{count}}`, `${value}`, supported printf tokens, and HTML tags before displaying suggestions. This is not a complete ICU MessageFormat parser.

Requests send source text through `/api/translate` to the selected provider. Avoid including patient data or other sensitive records in translation content. Real provider calls require valid credentials and access to the selected model; automated integration tests use simulated responses.

## Session data and API keys

Keys, translations, and selected languages are saved automatically in `sessionStorage` under `i18ncraft.project`. **Reloading the tab restores your current work**, including unfinished rows. Use **Clear project** to remove the current keys, values, and saved session before starting again. This is session storage, not a permanent project archive; export files for long-term storage. Theme and pending AI suggestions are not restored.

The interface language is saved automatically in `localStorage`. AI settings are also saved automatically under `i18ncraft.ai-settings` in this format:

```json
{
  "provider": "gemini",
  "model": "gemini-3.5-flash-lite",
  "apikey": "your-api-key"
}
```

These values are stored directly, without encryption or an unlock password, and restored when the page reloads. Switching providers selects its default model and clears the API key field so a key is not sent to a different provider.

In production, requests use HTTPS. The translation endpoint uses the API key for the provider request without logging or persisting it.

## Development

Built with React, TypeScript, Vite, Lucide icons, and fflate. Vitest covers JSON handling and the translation endpoint; Playwright covers browser workflows.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the editor and local translation endpoint. |
| `npm run build` | Type-check and build the production frontend. |
| `npm run preview` | Preview the static production build, without the AI endpoint. |
| `npm test` | Run unit and endpoint tests. |
| `npm run test:e2e` | Run browser tests. |

Install Playwright's Chromium before running browser tests for the first time:

```sh
npx playwright install chromium
npm run test:e2e
```

### Project structure

```text
api/translate.ts       Server endpoint for AI providers
src/App.tsx           Editor and settings interface
src/core.ts           JSON handling and translation validation
src/i18n.ts           Interface translations
src/ai-settings.ts    Saved provider, model, and API key settings
src/styles.css        Responsive light and dark themes
tests/                Unit and endpoint tests
e2e/                  Browser workflow tests
vercel.json           Build, function, and security-header configuration
```

## Deploy to Vercel

1. Push the project to your GitHub repository and import it into Vercel.
2. Select the Vite preset and a supported Node.js version.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Deploy. Vercel serves `api/translate.ts` as a server function using the configuration in `vercel.json`.

No environment variables or Supabase setup are required: users provide their own API keys in the interface. Other hosting platforms must serve both the frontend and a compatible translation endpoint to support AI assistance.

## Contributing

Issues and pull requests are welcome. Include a clear description of the problem or proposed improvement, keep changes focused, and run the relevant tests and production build before submitting.

## License

[MIT](LICENSE) — Copyright (c) 2026 Willyan.
