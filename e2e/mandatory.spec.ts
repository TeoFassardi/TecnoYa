import { test,expect } from '@playwright/test';

test('la navegación avisa cuando carga y respeta el movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let resume: () => void = () => {};
  const loading = new Promise<void>((resolve) => { resume = resolve; });
  await page.route(/\/api\/products\?/, async (route) => {
    await loading;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Cargando productos' })).toBeVisible();
  await expect(page.locator('.loading-shape').first()).toHaveCSS('animation-name', 'none');
  resume();
  await page.getByRole('link', { name: /Teclado de demostración/ }).click();
  await expect(page.getByRole('heading', { name: 'Teclado de demostración' })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
  await expect(page.locator('#main')).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('asistente requiere sesión y enlaza una ficha del catálogo', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/assistant');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Correo electrónico').fill('admin@example.com');
  await page.getByLabel('Contraseña').fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('link', { name: 'Asistente', exact: true }).click();
  await page.getByRole('button', { name: '¿Qué teclados tienen stock?' }).click();
  await expect(page.getByText('Encontré un teclado con stock en el catálogo.')).toBeVisible();
  const product = page.getByRole('link', { name: /Teclado de demostración/ });
  await expect(product).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'test-results/assistant-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/assistant-desktop.png', fullPage: true });
  await product.click();
  await expect(page.getByRole('heading', { name: 'Teclado de demostración' })).toBeVisible();
});

test('Swagger UI carga la especificación y consulta el catálogo', async ({ page }) => {
  await page.goto('/api/docs');
  await expect(page.getByRole('heading', { name: /API de TecnoYa/ })).toBeVisible();
  await page.locator('.opblock-tag').filter({ hasText: 'Productos' }).click();
  await page.getByText('Listar productos activos', { exact: true }).click();
  await page.getByRole('button', { name: 'Try it out' }).click();
  const response = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/products' && response.status() === 200,
  );
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  expect((await (await response).json()).items).toHaveLength(4);
});

test('administrador cambia un rol y revoca una sesión desde el panel', async ({ browser, page }) => {
  const userPage = await browser.newPage();
  try {
    await userPage.goto('/register');
    await userPage.getByLabel('Nombre', { exact: true }).fill('Usuario de sesiones');
    await userPage.getByLabel('Correo electrónico').fill('sessions@example.com');
    await userPage.getByLabel('Contraseña').fill('BrowserUser123!');
    await userPage.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(userPage).toHaveURL('/');

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@example.com');
    await page.getByLabel('Contraseña').fill('BrowserTest123!');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Usuarios y sesiones' })).toBeVisible();

    const user = page.getByRole('row', { name: /sessions@example.com/ });
    page.once('dialog', (dialog) => dialog.accept());
    await user.getByRole('button', { name: 'Hacer administrador' }).click();
    await expect(user.getByRole('cell', { name: 'Administrador' })).toBeVisible();
    await userPage.goto('/admin/users');
    await expect(userPage.getByRole('heading', { name: 'Usuarios y sesiones' })).toBeVisible();

    await user.getByRole('button', { name: 'Ver sesiones' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Revocar sesión' }).click();
    await expect(page.getByText('Este usuario no tiene sesiones activas.')).toBeVisible();
    await expect((await userPage.request.get('/api/admin/users')).status()).toBe(401);
  } finally {
    await userPage.context().close();
  }
});

test('ingreso con Google informa un intento cancelado', async ({ page }) => {
  await page.goto('/login?google=1&error=access_denied');
  await expect(page.getByRole('alert')).toContainText('No se completó el ingreso con Google');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
});

test('catálogo cambia de página y reinicia al filtrar por categoría', async ({ page }) => {
  await page.route(/\/api\/products\?/, (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('limit', '2');
    return route.continue({ url: url.toString() });
  });

  await page.goto('/');
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await expect(page.locator('.product-grid')).toHaveCount(1);
  const products = page.locator('.product-card');
  await expect(products).toHaveCount(2);
  const firstPage = await products.first().getAttribute('href');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expect(products).toHaveCount(2);
  await expect(page.locator(`[href="${firstPage}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Teclados' }).click();
  await expect(page.getByRole('heading', { name: 'Teclado de demostración' })).toBeVisible();
  await expect(products).toHaveCount(1);
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
});
test('registro, rol user y protección por URL',async({page})=>{
  await page.goto('/register');
  await page.getByLabel('Nombre',{exact:true}).fill('Usuario de prueba');
  await page.getByLabel('Correo electrónico').fill('browser-user@example.com');
  await page.getByLabel('Contraseña').fill('BrowserUser123!');
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await expect(page).toHaveURL('/');
  await page.getByRole('link', { name: /Teclado de demostración/ }).click();
  await expect(page.getByRole('heading', { name: 'Teclado de demostración' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar producto' })).toHaveCount(0);
  await page.goto('/admin/products');await expect(page.getByText('No tenés permisos')).toBeVisible();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await expect(page).toHaveURL('/');
  await page.goto('/admin/products');await expect(page).toHaveURL('/login');
});
test('administración, cancelación de modal y efecto público de las dos bajas',async({page})=>{
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
  await page.route('https://storage.example.com/fixture.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  );
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('admin@example.com');await page.getByLabel('Contraseña').fill('BrowserTest123!');
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page).toHaveURL('/');
  await page.getByRole('link',{name:'Administración'}).click();await page.getByRole('link',{name:'Nuevo producto'}).click();
  await page.getByLabel('Nombre',{exact:true}).fill('Teclado prueba navegador');await page.getByLabel('Marca').fill('Prueba');
  await page.getByLabel('Precio en ARS').fill('12345.67');await page.getByLabel('Stock').fill('4');await page.getByLabel('Descripción').fill('Producto de prueba del recorrido completo.');
  await page.getByLabel('Imagen del producto (opcional)').setInputFiles({
    name: 'teclado.png', mimeType: 'image/png', buffer: png,
  });
  await page.getByRole('button',{name:'Guardar producto'}).click();await expect(page).toHaveURL('/admin/products');
  const adminRow = page.getByRole('row', { name: /Teclado prueba navegador/ });
  const thumbnail = adminRow.locator('.admin-product-cell img');
  await expect(thumbnail).toHaveAttribute('src', 'https://storage.example.com/fixture.png');
  await expect.poll(() => thumbnail.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  await adminRow.getByRole('link', { name: 'Editar Teclado prueba navegador' }).click();
  const cancel = page.getByRole('link', { name: 'Cancelar', exact: true });
  await expect(cancel).toHaveCSS('text-decoration-line', 'none');
  await cancel.click();
  await expect(page).toHaveURL('/admin/products');
  await page.getByRole('button',{name:'Archivar Teclado prueba navegador',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('cell',{name:'Teclado prueba navegador Prueba'})).toBeVisible();
  await page.getByRole('button',{name:'Archivar Teclado prueba navegador',exact:true}).click();await page.getByRole('button',{name:'Archivar',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('button',{name:'Archivados',exact:true}).click();
  await expect(page.getByText('Teclado prueba navegador',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restaurar Teclado prueba navegador',exact:true}).click();
  await page.getByRole('link',{name:'Catálogo',exact:true}).click();await expect(page.getByRole('heading',{name:'Teclado prueba navegador'})).toBeVisible();
  const image = page.getByRole('img', { name: 'Teclado prueba navegador' });
  await expect(image).toHaveAttribute('src', 'https://storage.example.com/fixture.png');
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  await image.click();
  const detailUrl = page.url();
  await page.getByRole('link', { name: 'Editar producto' }).click();
  await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
  await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole('link', { name: 'Editar producto' }).click();
  await page.getByLabel('Stock').fill('7');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByText('7 unidades disponibles')).toBeVisible();
  await page.getByRole('link',{name:'Administración'}).click();await page.getByRole('button',{name:'Archivar Teclado prueba navegador',exact:true}).click();await page.getByRole('button',{name:'Archivar',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('button',{name:'Archivados',exact:true}).click();await page.getByRole('button',{name:'Eliminar definitivamente Teclado prueba navegador',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByText('Teclado prueba navegador',{exact:true})).not.toBeVisible();
});
test('catálogo responsive y capturas',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Un buen setup cambia tu día.'})).toBeVisible();
  const hero = page.getByRole('img', { name: 'Teclado, mouse y monitor sobre un escritorio azul claro' });
  await expect.poll(() => hero.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1200);
  await expect(page.getByRole('heading',{name:'Teclado de demostración'})).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/catalog-desktop.png',fullPage:true});
  await page.setViewportSize({width:375,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/catalog-mobile.png',fullPage:true});
});
