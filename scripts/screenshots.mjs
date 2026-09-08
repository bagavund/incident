// Скриншоты интерфейса для SYSTEM_ANALYSIS.md.
// Требует запущенного приложения на BASE (по умолчанию http://localhost:8000)
// и установленного playwright: npm i -D playwright && npx playwright install chromium
//
//   node scripts/screenshots.mjs
//
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8000';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: 'login', path: '/', auth: false },
  { name: 'dashboard', path: '/', auth: true },
  { name: 'incidents', path: '/incidents', auth: true },
  { name: 'incident-detail', path: 'first-incident', auth: true },
  { name: 'create-incident', path: '/create', auth: true },
  { name: 'admin', path: '/admin', auth: true },
];

// Системный Chrome/Edge — не тянем отдельный бинарь playwright.
const browser = await chromium.launch({ channel: process.env.BROWSER ?? 'msedge' });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function login() {
  await page.goto(BASE + '/');
  await page.getByPlaceholder('vkomlev').fill('admin');
  await page.locator('input[type=password]').fill('password');
  await page.getByRole('button', { name: /Войти/i }).click();
  await page.waitForSelector('aside');
}

let loggedIn = false;
for (const s of shots) {
  if (s.auth && !loggedIn) {
    await login();
    loggedIn = true;
  }
  if (s.path === 'first-incident') {
    await page.goto(BASE + '/incidents');
    await page.waitForSelector('tbody tr');
    await page.locator('tbody tr').first().click();
    await page.waitForSelector('h1, h2');
  } else if (s.auth) {
    await page.goto(BASE + s.path);
    await page.waitForLoadState('networkidle');
  } else {
    await page.goto(BASE + s.path);
    await page.waitForSelector('input[type=password]');
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  console.log('✓', s.name);
}

await browser.close();
