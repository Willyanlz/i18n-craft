import { expect, test, type Page } from '@playwright/test';
import { languages } from '../src/core';

test('flexible import survives editing, reload and clipboard export', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const source = {
    'literal.key': 'Text',
    ' spaced ': 'Space',
    calendar: { firstDay: 0, days: ['Sunday', 'Monday'] },
    enabled: false,
    optional: null,
    empty: {},
    list: [],
  };
  await importJson(page, JSON.stringify(source));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Português: calendar.days[1]', exact: true })
    .fill('Changed');
  source.calendar.days[1] = 'Changed';
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Português: calendar.days[1]', exact: true }),
  ).toHaveValue('Changed');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Copiar JSON', exact: true }).click();
  await expect
    .poll(() => page.evaluate(async () => JSON.parse(await navigator.clipboard.readText())))
    .toEqual(source);
});

test('export language selection controls preview, clipboard and filename', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await importJson(page, '{"hello":"Oi"}');
  await page.getByRole('tab', { name: /English/ }).click();
  await page.getByRole('textbox', { name: 'English: hello', exact: true }).fill('Hello');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const language = dialog.getByRole('combobox');
  await expect(language).toHaveValue('en');
  await language.selectOption('pt');
  await expect(dialog.locator('pre')).toContainText('"hello": "Oi"');
  await dialog.getByRole('button', { name: 'Copiar JSON', exact: true }).click();
  await expect
    .poll(() => page.evaluate(async () => JSON.parse(await navigator.clipboard.readText())))
    .toEqual({ hello: 'Oi' });
  await language.selectOption('en');
  await expect(dialog.locator('pre')).toContainText('"hello": "Hello"');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Baixar JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('en.json');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('tab', { name: /English/ })).toHaveAttribute('aria-selected', 'true');
});

test('all fourteen destinations are processed automatically in groups of six', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá"}');
  await configureAi(page);
  for (const lang of languages.slice(3)) {
    await page.getByRole('button', { name: 'Adicionar idioma', exact: true }).click();
    await page.getByRole('option', { name: new RegExp(`^${lang.name}(?: ·|$)`) }).click();
  }
  const groups: string[][] = [];
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    groups.push(request.targets);
    await route.fulfill({
      json: {
        translations: request.entries.map((entry: { id: string }) => ({
          id: entry.id,
          values: Object.fromEntries(request.targets.map((code: string) => [code, 'Hello'])),
        })),
      },
    });
  });
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Traduzindo…', exact: true })).toHaveCount(0);
  expect(groups.map((group) => group.length)).toEqual([6, 6, 2]);
  expect(groups.flat()).toEqual(languages.slice(1).map((lang) => lang.code));
  for (const lang of languages.slice(1)) {
    await page.getByRole('tab', { name: new RegExp(lang.name) }).click();
    await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toBeVisible();
  }
});

async function importJson(page: Page, json: string) {
  await page.getByRole('button', { name: 'Importar JSON', exact: true }).click();
  await page.getByLabel('Ou cole seu JSON').fill(json);
  await page.getByRole('button', { name: 'Importar e combinar' }).click();
}
async function configureAi(page: Page) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Assistência com IA' }).check();
  await page.getByLabel('API key', { exact: true }).fill('test-key');
  await page.getByRole('button', { name: 'Editor de traduções', exact: true }).click();
}

test('keyboard editing builds nested JSON and creates rows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adicionar chave', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'CHAVE 1', exact: true })).toBeFocused();
  await page.keyboard.type('automation.example');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('textbox', { name: 'Português: automation.example', exact: true }),
  ).toBeFocused();
  await page.keyboard.insertText('Exemplo');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'CHAVE 2', exact: true })).toBeFocused();
  await expect(page.locator('pre')).toContainText('"example": "Exemplo"');
  await page.keyboard.type('title');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'CHAVE 3', exact: true })).toBeFocused();
});

test('import, filters, download and conflicts preserve translations', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"automation":{"example":"Exemplo"},"title":"Título"}');
  await page.getByRole('tab', { name: /English/ }).click();
  await page
    .getByRole('textbox', { name: 'English: automation.example', exact: true })
    .fill('Example');
  await page.getByRole('tab', { name: /Español/ }).click();
  await page
    .getByRole('textbox', { name: 'Español: automation.example', exact: true })
    .fill('Ejemplo');
  await page
    .getByRole('combobox', { name: 'Todas as chaves', exact: true })
    .selectOption('missing');
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(
    page.getByRole('textbox', { name: 'English: automation.example', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Todas as chaves', exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar todos (.zip)' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('i18nCraft.zip');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await importJson(page, '{"automation":"conflict"}');
  await expect(page.getByRole('alert')).toContainText('conflito');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(
    page.getByRole('textbox', { name: 'English: automation.example', exact: true }),
  ).toHaveValue('Example');
});

test('AI suggestions require acceptance, rejection focuses input', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá {name}"}');
  await configureAi(page);
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      json: {
        translations: [
          { id: request.entries[0].id, values: { en: 'Hello {name}', es: 'Hola {name}' } },
        ],
      },
    });
  });
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toHaveCount(1);
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: hello', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Aceitar', exact: true }).first().click();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: hello', exact: true })).toHaveValue(
    'Hello {name}',
  );
  await page.getByRole('tab', { name: /Español/ }).click();
  await page.getByRole('button', { name: 'Recusar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Español: hello', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(
    page.getByRole('textbox', { name: 'English: hello', exact: true }),
  ).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('tab', { name: /Español/ }).click();
  const missingValue = page.getByRole('textbox', { name: 'Español: hello', exact: true });
  await expect(missingValue).toHaveAttribute('aria-invalid', 'true');
  await expect(missingValue).toHaveAttribute('placeholder', 'Preencha');
  await missingValue.fill('Hola {name}');
  await expect(missingValue).not.toHaveAttribute('aria-invalid', 'true');
});

test('editing the source during an AI request discards stale suggestions', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá"}');
  await configureAi(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    await gate;
    await route.fulfill({
      json: { translations: [{ id: request.entries[0].id, values: { en: 'Hello', es: 'Hola' } }] },
    });
  });
  const pending = page.waitForRequest('**/api/translate');
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await pending;
  await page.getByRole('tab', { name: /Português/ }).click();
  await page.getByRole('textbox', { name: 'Português: hello', exact: true }).fill('Bom dia');
  release();
  await expect(page.getByRole('button', { name: 'Sugerir pendentes', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toHaveCount(0);
});

test('Gemini 404 identifies the unavailable model and lets the user retry', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá"}');
  await configureAi(page);
  await page.route('**/api/translate', (route) =>
    route.fulfill({
      status: 502,
      json: { error: 'provider', providerStatus: 404 },
    }),
  );
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('gemini-3.5-flash-lite');
  await expect(page.getByRole('status')).toContainText('Modelo não encontrado');
  await expect(page.getByRole('button', { name: 'Sugerir pendentes', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: hello', exact: true })).toHaveValue('');
});

test('AI configuration and current project survive reload', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá"}');
  await configureAi(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Modelo', { exact: true }).fill('custom-model');
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('i18ncraft.ai-settings') || 'null')),
    )
    .toEqual({ provider: 'gemini', model: 'custom-model', apikey: 'test-key' });
  await page.getByLabel('Idioma da interface').last().click();
  await page.getByRole('option', { name: /^English/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Great translations start here.' })).toBeVisible();
  await page.getByRole('tab', { name: /Português/ }).click();
  await expect(page.getByRole('textbox', { name: 'Português: hello', exact: true })).toHaveValue(
    'Olá',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue('test-key');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('custom-model');
});

test('global suggestions require source text in the interface language', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá","empty":""}');
  await configureAi(page);
  await expect(page.getByRole('button', { name: 'Sugerir', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Idioma da interface', exact: true }).click();
  await page.getByRole('option', { name: /^English/ }).click();
  await expect(page.getByRole('button', { name: 'Suggest missing', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /English/ }).click();
  await page.getByRole('textbox', { name: 'English: hello', exact: true }).fill('Hello');
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.base).toBe('en');
    expect(request.targets).toEqual(['es']);
    expect(request.entries).toHaveLength(1);
    expect(request.entries[0].text).toBe('Hello');
    await route.fulfill({
      json: { translations: [{ id: request.entries[0].id, values: { pt: 'Olá', es: 'Hola' } }] },
    });
  });
  await page.getByRole('button', { name: 'Suggest missing', exact: true }).click();
  await page.getByRole('tab', { name: /Español/ }).click();
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(1);
  await page.getByRole('tab', { name: /Português/ }).click();
  await expect(page.getByRole('textbox', { name: 'Português: hello', exact: true })).toHaveValue(
    'Olá',
  );
});

test('global suggestions process more than one hundred keys', async ({ page }) => {
  await page.goto('/');
  await importJson(
    page,
    JSON.stringify(
      Object.fromEntries(Array.from({ length: 101 }, (_, index) => ['key' + index, 'Olá'])),
    ),
  );
  await configureAi(page);
  const sizes: number[] = [];
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    sizes.push(request.entries.length);
    await route.fulfill({
      json: {
        translations: request.entries.map((entry: { id: string }) => ({
          id: entry.id,
          values: { en: 'Hello', es: 'Hola' },
        })),
      },
    });
  });
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toHaveCount(101);
  expect(sizes).toEqual([100, 1]);
});

test('requests only missing languages for each group of keys', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"one":"Um","two":"Dois","complete":"Completo"}');
  await configureAi(page);
  await page.getByRole('tab', { name: /English/ }).click();
  await page.getByRole('textbox', { name: 'English: one', exact: true }).fill('One');
  await page.getByRole('tab', { name: /Español/ }).click();
  await page.getByRole('textbox', { name: 'Español: two', exact: true }).fill('Dos');
  await page.getByRole('tab', { name: /English/ }).click();
  await page.getByRole('textbox', { name: 'English: complete', exact: true }).fill('Complete');
  await page.getByRole('tab', { name: /Español/ }).click();
  await page.getByRole('textbox', { name: 'Español: complete', exact: true }).fill('Completo');
  const requests: { key: string; targets: string[] }[] = [];
  await page.route('**/api/translate', async (route) => {
    const request = route.request().postDataJSON();
    for (const entry of request.entries)
      requests.push({ key: entry.key, targets: request.targets });
    await route.fulfill({
      json: {
        translations: request.entries.map((entry: { id: string }) => ({
          id: entry.id,
          values: Object.fromEntries(request.targets.map((code: string) => [code, 'Translation'])),
        })),
      },
    });
  });
  await page.getByRole('button', { name: 'Sugerir pendentes', exact: true }).click();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toHaveCount(1);
  expect(requests).toEqual([
    { key: 'one', targets: ['es'] },
    { key: 'two', targets: ['en'] },
  ]);
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: one', exact: true })).toHaveValue('One');
});

test('reload restores unfinished work and clearing removes the saved project', async ({ page }) => {
  await page.goto('/');
  await importJson(page, '{"hello":"Olá"}');
  await page.getByRole('tab', { name: /English/ }).click();
  await page.getByRole('textbox', { name: 'English: hello', exact: true }).fill('Hello');
  await page.getByRole('button', { name: 'Adicionar chave', exact: true }).click();
  await page.getByRole('tab', { name: /Português/ }).click();
  await page.getByRole('textbox', { name: 'Português: 2', exact: true }).fill('Sem chave ainda');
  await page.reload();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: hello', exact: true })).toHaveValue(
    'Hello',
  );
  await page.getByRole('tab', { name: /Português/ }).click();
  await expect(page.getByRole('textbox', { name: 'Português: 2', exact: true })).toHaveValue(
    'Sem chave ainda',
  );
  await page.getByRole('button', { name: 'Limpar projeto', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('i18ncraft.project')))
    .toBeNull();
  await page.reload();
  await page.getByRole('tab', { name: /English/ }).click();
  await expect(page.getByRole('textbox', { name: 'English: hello', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar chave', exact: true })).toBeVisible();
});

test('mobile layout and dark mode remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await importJson(page, '{"hello":"Olá"}');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('theme persists across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('i18ncraft.theme')))
    .toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Claro', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('i18ncraft.theme')))
    .toBe('light');
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
});
