import { expect, test } from '@playwright/test'

test('la bienvenida lleva al listado visible sin desbordar en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{
      id: 1, nombre: 'CONGRESO UNESCO - TYAN HANDS-ON SCHOOLS EN BOLIVIA 2025 3RA VERSION',
      estado: 1, gestion: 2025, fecha_inicio: '2025-07-31',
    }]),
  }))
  await page.route('http://localhost:3000/eventos/1/imparticiones', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Bienvenido al sistema académico/i })).toBeVisible()
  await expect(page.getByText('Plataforma de eventos y cursos académicos')).toBeVisible()
  await expect(page.locator('#footer')).toContainText('Monoblock Central, edificio TIC')
  await expect(page.locator('#footer')).not.toContainText('TWAS')
  await expect(page.locator('nav img[alt="FCPN"]').first()).toHaveAttribute('alt', 'FCPN')
  await page.getByRole('link', { name: /Explorar eventos/i }).click()
  await expect(page).toHaveURL(/\/eventos$/)
  await expect(page.getByRole('navigation', { name: 'Listado de eventos' }).getByRole('link', { name: /CONGRESO UNESCO/i })).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('el listado permanece visible y el banner mantiene proporción con zoom reducido', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 3500 })
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { id: 1, nombre: 'Primer evento', estado: 1, gestion: 2025, imagen_fondo: 'fondo-primero.jpg' },
      { id: 2, nombre: 'Segundo evento', estado: 1, gestion: 2026, imagen_fondo: 'fondo-segundo.jpg' },
    ]),
  }))
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('http://localhost:3000/uploads/fondos/*.jpg', route => {
    if (route.request().url().includes('fondo-segundo.jpg')) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FncAAAAASUVORK5CYII=', 'base64'),
    })
  })
  await page.goto('/eventos', { waitUntil: 'domcontentloaded' })
  const listado = page.getByRole('navigation', { name: 'Listado de eventos' })
  await expect(listado.locator('a[href^="/eventos/"]')).toHaveCount(2)
  const hero = page.locator('#inicio')
  await expect(hero).toHaveCount(0)
  await listado.getByRole('link', { name: /Primer evento/i }).click()
  await expect(hero.locator('img[alt="Fondo del evento"]')).toHaveAttribute('src', 'http://localhost:3000/uploads/fondos/fondo-primero.jpg')
  expect((await hero.boundingBox())!.height).toBeLessThanOrEqual(1200)
  await page.getByRole('link', { name: /Ver todos los eventos/i }).click()
  await listado.getByRole('link', { name: /Segundo evento/i }).click()
  await expect(hero.getByRole('heading', { name: 'Segundo evento' })).toBeVisible()
  await expect(hero.locator('img[alt="Fondo del evento"]')).toHaveAttribute('src', '/logo/fondoejeml.jpg')
})

test('acceso conserva los campos originales y el diálogo de recuperación', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.locator('#email')).toHaveCSS('border-top-width', '1px')
  await expect(page.locator('#email')).toHaveCSS('padding-left', '48px')
  await page.locator('#email').fill('demo@umsa.bo')
  await expect(page.locator('#email')).toHaveValue('demo@umsa.bo')
  await page.locator('#password').fill('prueba123')
  await page.locator('form button[type=button]').first().click()
  await expect(page.locator('#password')).toHaveAttribute('type', 'text')

  await page.locator('button').filter({ hasText: /Recuperar/i }).click()
  await expect(page.locator('.v-dialog #swal-email')).toBeVisible()
  await page.locator('.v-dialog').getByRole('button', { name: /Enviar Solicitud/i }).click()
  await expect(page.locator('.v-dialog [role=alert]')).toContainText('Por favor completa')
  await page.locator('.v-dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.v-dialog')).toHaveCount(0)
})

test('el acceso y registro se desplazan al aumentar el zoom o reducir la altura', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 520 }, { width: 390, height: 640 }]) {
    await page.setViewportSize(viewport)
    for (const path of ['/login', '/register']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const nav = await page.locator('nav').boundingBox()
      const card = await page.locator('main > div > div').first().boundingBox()
      expect(nav).not.toBeNull()
      expect(card).not.toBeNull()
      expect(card!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height)
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(viewport.height)
      await page.locator('form button[type=submit]').scrollIntoViewIfNeeded()
      await expect(page.locator('form button[type=submit]')).toBeInViewport()
    }
  }
})

test('registro conserva los campos y la carga de aval originales', async ({ page }) => {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#nombres')).toBeVisible()
  await page.locator('#nombres').fill('María')
  await expect(page.locator('#nombres')).toHaveValue('María')
  await page.locator('#genero').selectOption('1')
  await expect(page.locator('#genero')).toHaveValue('1')
  await expect(page.locator('#archivo_aval')).toBeVisible()
  await page.locator('#archivo_aval').setInputFiles({
    name: 'aval.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n'),
  })
  await expect(page.getByText('Principal: aval.pdf')).toBeVisible()
})

test('administración abre formularios y confirmaciones Vuetify', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.route('http://localhost:3000/**/admin/grados-administrativos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 7, nombre: 'Decano', abreviatura: 'Dec.' }]),
  }))
  await page.goto('/admin/grados-administrativos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Nuevo Grado/ }).click()
  await expect(page.locator('.v-dialog .v-text-field')).toHaveCount(2)
  await page.locator('.v-dialog input').first().fill('Director')
  await page.locator('.v-dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.v-dialog')).toHaveCount(0)

  await page.getByTitle('Eliminar').click()
  await expect(page.locator('.v-dialog')).toContainText('¿Eliminar grado?')
  await page.locator('.v-dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.v-dialog')).toHaveCount(0)
})

test('los controles del directorio de eventos no se superponen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.goto('/admin/eventos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Nuevo Evento/i }).click()
  await page.getByText('Directorio', { exact: true }).click()

  const label = page.locator('label').filter({ hasText: 'Mostrar Correos' }).last()
  const checkbox = label.locator('input[type=checkbox]')
  const selectAll = page.getByRole('button', { name: /Seleccionar Todos/i }).last()
  await expect(checkbox).toBeVisible()
  await checkbox.check()
  await expect(checkbox).toBeChecked()
  for (const width of [1280, 900]) {
    await page.setViewportSize({ width, height: 800 })
    const labelBox = await label.boundingBox()
    const buttonBox = await selectAll.boundingBox()
    expect(labelBox && buttonBox).toBeTruthy()
    expect(labelBox!.x + labelBox!.width <= buttonBox!.x || labelBox!.y + labelBox!.height <= buttonBox!.y).toBeTruthy()
  }
})

test('la cabecera administrativa cabe sin desplazamiento horizontal', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.goto('/admin/grados-administrativos', { waitUntil: 'domcontentloaded' })
  for (const width of [390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const fits = await page.locator('header').evaluate(header => header.scrollWidth <= header.clientWidth)
    expect(fits, `cabecera a ${width}px`).toBe(true)
  }
})

test('la plantilla de certificados muestra un solo rol y campos utilizables', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.goto('/admin/eventos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Nuevo Evento/i }).click()
  await page.getByText('Certificados', { exact: true }).last().click()

  const role = page.locator('select').filter({ has: page.locator('option', { hasText: 'Expositor' }) })
  await expect(role).toHaveCount(1)
  await role.selectOption('2')
  await expect(role).toHaveValue('2')
  const title = page.getByPlaceholder('Ej: Certificado de Asistencia')
  await expect(title).toHaveCSS('border-top-width', '2px')
  await title.fill('Certificado de exposición')
  await expect(title).toHaveValue('Certificado de exposición')
  const tenor = page.getByPlaceholder(/Se certifica que/)
  await tenor.fill('Participó en el evento')
  await expect(tenor).toHaveValue('Participó en el evento')
  const diploma = page.locator('.group\\/cert')
  const previewHeading = page.getByText('Previsualizador de Alta Fidelidad')
  const diplomaBox = await diploma.boundingBox()
  const headingBox = await previewHeading.boundingBox()
  expect(diplomaBox && headingBox).toBeTruthy()
  expect(headingBox!.y).toBeGreaterThanOrEqual(diplomaBox!.y + diplomaBox!.height)
  for (const width of [900, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `paso de certificados a ${width}px`).toBeLessThanOrEqual(width)
  }
})

test('los campos de identidad del evento conservan borde y valores únicos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.goto('/admin/eventos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Nuevo Evento/i }).click()

  const name = page.getByPlaceholder('NOMBRE DEL EVENTO')
  await expect(name).toHaveCSS('border-top-width', '1px')
  await name.fill('Encuentro académico')
  await expect(name).toHaveValue('Encuentro académico')

  const priority = page.getByText('Orden de Prioridad').locator('..').locator('select')
  await expect(priority).toHaveCount(1)
  await priority.selectOption('3')
  await expect(priority).toHaveValue('3')
  await expect(priority.locator('option:checked')).toHaveText('3º (Tercero)')
})

test('superusuario y coordinador cambian colores con muestra, HEX y vista previa', async ({ browser }) => {
  for (const role of [
    { path: '/admin/eventos', id: 6, name: 'Super Usuario' },
    { path: '/coordinador/gestion-eventos', id: 7, name: 'Coordinador' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    try {
      await context.addInitScript(() => localStorage.setItem('token', 'prueba'))
      await context.route('http://localhost:3000/**', route => route.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }))
      await context.route('http://localhost:3000/**/auth/me', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'gestor@test.com', alcance_eventos: 'libre', usuariosRoles: [{ rol: { id: role.id, nombre_rol: role.name } }] }),
      }))
      const page = await context.newPage()
      await page.goto(role.path, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: /Nuevo Evento/i }).click()
      await expect(page.getByText('Color del título principal', { exact: true })).toBeVisible()
      await expect(page.getByText('Paleta UMSA')).toBeHidden()
      await page.getByRole('button', { name: 'Elegir color del título principal' }).click()
      await expect(page.getByText('Paleta UMSA')).toBeVisible()
      await page.getByRole('button', { name: 'Usar Dorado para color del título principal' }).click()
      await expect(page.locator('h1').filter({ hasText: 'CONGRESO' })).toHaveCSS('color', 'rgb(188, 156, 49)')
      await page.getByRole('button', { name: 'Elegir color del título principal' }).click()
      const hex = page.getByRole('textbox', { name: 'Código hexadecimal de color del título principal' })
      await expect(hex).toHaveValue('#BC9C31')
      await hex.fill('#123456')
      await expect(page.locator('h1').filter({ hasText: 'CONGRESO' })).toHaveCSS('color', 'rgb(18, 52, 86)')
      await hex.fill('incorrecto')
      await hex.blur()
      await expect(hex).toHaveValue('#123456')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
    } finally {
      await context.close()
    }
  }
})

test('usuarios del evento se buscan por rol y muestran sus certificados en un modal desplazable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 10, nombre: 'Congreso de prueba', estado: 1, gestion: '2026', actividades: [{ id: 20, nombre: 'Seminario', inscripciones: [] }] }]),
  }))
  await page.route('http://localhost:3000/admin/certificados', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 100, usuario: { id: 2 }, infoCertificado: { evento: { id: 10 }, cabecera: 'Certificado de ponente' }, codigo_certificado: 'CERT-100', estado: 1 }]),
  }))
  const participantes = [
    { id: 1, nombre: 'Camila Flores', email: 'camila@test.com', roles: ['Estudiante'], actividades: ['Seminario'] },
    { id: 2, nombre: 'Luis Rojas', email: 'luis@test.com', roles: ['Ponente'], actividades: ['Seminario'] },
    { id: 3, nombre: 'Marta Soto', email: 'marta@test.com', roles: ['Coordinador'], actividades: [] },
    ...Array.from({ length: 25 }, (_, index) => ({ id: 10 + index, nombre: `Estudiante ${index}`, email: `estudiante${index}@test.com`, roles: ['Estudiante'], actividades: ['Seminario'] })),
  ]
  await page.route('http://localhost:3000/admin/eventos/10/usuarios', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(participantes),
  }))
  await page.goto('/admin/gestion', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Usuarios del evento/i }).click()

  const dialogo = page.locator('.v-dialog').filter({ hasText: 'Usuarios del evento' })
  await expect(dialogo).toBeVisible()
  await expect(dialogo.getByText('Camila Flores')).toBeVisible()
  await expect(dialogo.getByText('Luis Rojas')).toBeVisible()
  await expect(dialogo.getByText('CERT-100')).toBeVisible()
  const lista = dialogo.getByTestId('lista-usuarios-evento')
  expect(await lista.evaluate(elemento => elemento.scrollHeight > elemento.clientHeight)).toBe(true)

  await dialogo.getByRole('button', { name: 'Ponentes' }).click()
  await expect(lista.getByText('Luis Rojas')).toBeVisible()
  await expect(lista.getByText('Camila Flores')).toHaveCount(0)
  await dialogo.getByRole('button', { name: 'Coordinadores' }).click()
  await expect(lista.getByText('Marta Soto')).toBeVisible()
  await dialogo.getByRole('button', { name: /^Todos/ }).click()
  await dialogo.getByRole('searchbox').fill('camila')
  await expect(lista.getByText('Camila Flores')).toBeVisible()
  await expect(lista.getByText('Luis Rojas')).toHaveCount(0)
  await dialogo.getByRole('button', { name: 'Cerrar usuarios del evento' }).click()
  await expect(dialogo).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 700 })
  await page.getByRole('button', { name: /Usuarios del evento/i }).click()
  await expect(dialogo).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('usuarios del evento se cargan con rutas existentes si la ruta nueva devuelve 404', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 1, email: 'admin@test.com', usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }))
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 10, nombre: 'Congreso real', estado: 1, actividades: [{ id: 20, nombre: 'Taller', inscripciones: [{ usuario: { id: 11, email: 'ana@test.com', persona: { nombres: 'Ana', primer_apellido: 'Paz' } } }] }] }]),
  }))
  await page.route('http://localhost:3000/admin/eventos/10/usuarios', route => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Cannot GET /admin/eventos/10/usuarios' }),
  }))
  await page.route('http://localhost:3000/imparticiones?eventoId=10', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ usuario: { id: 12, email: 'luis@test.com', persona: { nombres: 'Luis', primer_apellido: 'Rojas' } }, actividadAcademica: { nombre: 'Taller' } }]),
  }))
  await page.route('http://localhost:3000/eventos/10/coordinaciones', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ usuario: { id: 13, email: 'marta@test.com', persona: { nombres: 'Marta', primer_apellido: 'Soto' } } }]),
  }))
  await page.route('http://localhost:3000/usuarios**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 13, email: 'marta@test.com', usuariosRoles: [{ rol: { nombre_rol: 'Coordinador' } }], persona: { nombres: 'Marta', primer_apellido: 'Soto' } }]),
  }))
  await page.route('http://localhost:3000/admin/certificados', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 101, usuario: { id: 11 }, actividadAcademica: { id: 20, nombre: 'Taller' }, codigo_certificado: 'CERT-101', estado: 1 }]),
  }))

  await page.goto('/admin/gestion', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Usuarios del evento/i }).click()
  const dialogo = page.locator('.v-dialog').filter({ hasText: 'Usuarios del evento' })
  await expect(dialogo.getByText('Ana Paz')).toBeVisible()
  await expect(dialogo.getByText('Luis Rojas')).toBeVisible()
  await expect(dialogo.getByText('Marta Soto')).toBeVisible()
  await expect(dialogo.getByText('CERT-101')).toBeVisible()
  await expect(dialogo.getByText('No se pudo cargar el listado de usuarios.')).toHaveCount(0)
})

test('coordinador ve usuarios y certificados emitidos del evento', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'))
  await page.route('http://localhost:3000/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('http://localhost:3000/**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 7, email: 'coordinador@test.com', usuariosRoles: [{ rol: { id: 7, nombre_rol: 'Coordinador' } }] }),
  }))
  await page.route('http://localhost:3000/admin/eventos/lista?limit=100', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 10, nombre: 'Congreso de prueba', estado: 1, gestion: '2026', actividades: [{ id: 20, nombre: 'Seminario', estado: 1 }] }]),
  }))
  await page.route('http://localhost:3000/admin/certificados', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 100, usuario: { id: 2 }, actividadAcademica: { id: 20, nombre: 'Seminario' }, codigo_certificado: 'CERT-100', estado: 1 }]),
  }))
  await page.route('http://localhost:3000/admin/eventos/10/usuarios', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 2, nombre: 'Luis Rojas', email: 'luis@test.com', roles: ['Ponente'], actividades: ['Seminario'] }]),
  }))
  await page.goto('/coordinador/gestion-eventos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Certificados emitidos 1/i })).toBeVisible()
  await page.getByRole('button', { name: /Certificados emitidos 1/i }).click()
  await expect(page.locator('.v-dialog').filter({ hasText: 'Certificados emitidos' }).getByText('CERT-100')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar certificados del evento' }).click()
  await page.getByRole('button', { name: 'Usuarios del evento' }).click()
  const dialogo = page.locator('.v-dialog').filter({ hasText: 'Usuarios del evento' })
  await expect(dialogo.getByText('Luis Rojas')).toBeVisible()
  await expect(dialogo.getByText('CERT-100')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Estudiantes' }).click()
  await expect(dialogo.getByText('Luis Rojas')).toHaveCount(0)
})
