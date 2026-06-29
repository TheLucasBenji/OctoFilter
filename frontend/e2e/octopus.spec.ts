import { expect, test, type Page } from '@playwright/test';

const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAAAAABWESUoAAABDklEQVQ4EVXBIU4gURBAwd+m3qhVfQzugEOhxu3xOQQKswkhZLZqliSRJJEkzZIkkiSSpFmSRJJEkjRLkkiSSJJmSRJJEknSLEkiSSJJmiVJJEkkSbMkiSSJJGmWJJEkkSTNkiSSl49EkjRLkuj1fPskSZolSbydH1+SpFmS5P38miRpliTd5+GSpFmSdJ+HS5JmSdJ9Hi5JmiXJ3/OfP0maJUn3ebgkaZYk3efhkqRZknSfh0uSZkmS9/NrkqRZksTb+fElSZolSfR6vn2SJM2SJJKXj0SSNEuSSJJIkmZJEkkSSdIsSSJJIkmaJUkkSSRJsySJJIkkaZYkkSSRJM2SJJIkkqRZkkSSRJL0DxhOIaEgVB2RAAAAAElFTkSuQmCC',
  'base64',
);

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel(/correo/i).fill('test@mail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Test2026');
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page.getByText('test@mail.com')).toBeVisible();
}

async function setRange(page: Page, name: string, value: string) {
  await page.getByRole('slider', { name, exact: true }).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function runQuickOptimization(page: Page) {
  await page.getByRole('tab', { name: /avanzado/i }).click();
  await setRange(page, 'Población', '9');
  await setRange(page, 'Iteraciones', '5');
  await page.getByRole('spinbutton', { name: 'Semilla', exact: true }).fill('7');

  await page.getByTestId('workspace-file-input').setInputFiles({
    name: 'octopus-fixture.png',
    mimeType: 'image/png',
    buffer: fixturePng,
  });

  await expect(page.getByAltText('original')).toBeVisible();
  await expect(page.getByAltText('noisy')).toBeVisible();

  await page.getByRole('button', { name: /ejecutar/i }).click();
  await expect(page.getByAltText('result')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/convergencia/i)).toBeVisible();
}

test('valida login, optimiza, muestra historial y cierra sesión', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel(/correo/i).fill('test@mail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();

  await page.getByLabel('Contraseña', { exact: true }).fill('Test2026');
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page.getByText('test@mail.com')).toBeVisible();

  await runQuickOptimization(page);

  await page.getByRole('button', { name: /historial/i }).click();
  const historyTable = page.getByRole('table');
  await expect(historyTable).toBeVisible();
  await expect(historyTable.getByRole('cell', { name: 'OOA' })).toBeVisible();
  await expect(historyTable.getByRole('cell', { name: 'Bilateral' })).toBeVisible();

  await page.getByLabel(/cerrar sesión/i).click();
  await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
});

test('usa modo experimental y carga una optimización desde el historial', async ({ page }) => {
  await login(page);
  await runQuickOptimization(page);

  await page.getByLabel('Modo experimental').click();
  await expect(page.getByRole('button', { name: /filtro bilateral/i })).toBeVisible();
  await page.getByTestId('experimental-file-input').setInputFiles({
    name: 'octopus-experimental.png',
    mimeType: 'image/png',
    buffer: fixturePng,
  });
  await expect(page.getByText('octopus-experimental.png')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aplicar filtro' })).toBeEnabled();
  await page.getByRole('button', { name: 'Aplicar filtro' }).click();
  await expect(page.getByAltText('resultado')).toBeVisible();

  await page.getByRole('button', { name: /historial/i }).click();
  const historyTable = page.getByRole('table');
  await expect(historyTable).toBeVisible();
  await expect(historyTable.getByRole('cell', { name: 'Manual' })).toBeVisible();

  const optimizationRow = historyTable.locator('tbody tr', { hasText: 'OOA' }).first();
  await expect(optimizationRow).toBeVisible();
  await optimizationRow.getByRole('button', { name: 'Cargar config' }).click();

  await expect(page.getByRole('tab', { name: /avanzado/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('slider', { name: 'Población', exact: true })).toHaveValue('9');
  await expect(page.getByRole('slider', { name: 'Iteraciones', exact: true })).toHaveValue('5');
  await expect(page.getByRole('spinbutton', { name: 'Semilla', exact: true })).toHaveValue('7');
});
