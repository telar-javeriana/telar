// app.js — sitio de descargas de Telar.
//
// Sin framework y sin backend a proposito: la pagina entrega cuatro enlaces y
// no tiene estado que guardar. Los datos salen de ./release.json, que genera
// scripts/sync-release.mjs desde GitHub Releases (ver el README).
//
// Todo lo dinamico se construye con textContent / createElement, nunca con
// innerHTML: aunque release.json lo generemos nosotros, la regla evita que un
// nombre de archivo raro se convierta en marcado.

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

/* ── Utilidades ─────────────────────────────────────────────────────────── */

/** MB decimales, que es la unidad con la que GitHub muestra los assets. */
const formatSize = (bytes) => `${Math.round(bytes / 1e6)} MB`

const formatDate = (iso) => {
  try {
    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

/** Crea un elemento con clase, texto e hijos en una sola expresion. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') node.className = value
    else if (key === 'text') node.textContent = value
    else if (key === 'html') node.innerHTML = value // solo para SVG estatico nuestro
    else node.setAttribute(key, value)
  }
  node.append(...children.filter(Boolean))
  return node
}

/**
 * Sistema del visitante. `userAgentData` es lo correcto donde existe
 * (Chromium); el resto cae al user agent. Android se comprueba ANTES que
 * Linux porque su user agent contiene «Linux» y si no acabaria ofreciendo
 * un .deb a un telefono.
 */
function detectOS() {
  const platform = (navigator.userAgentData?.platform ?? '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()
  const has = (needle) => platform.includes(needle) || ua.includes(needle)

  if (has('android')) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (has('win')) return 'windows'
  if (has('mac')) return 'macos'
  if (has('linux') || ua.includes('x11')) return 'linux'
  return 'unknown'
}

/* ── Iconos ─────────────────────────────────────────────────────────────── */
// Windows y Tux van RELLENOS, no en trazo como el resto del set de la app:
// en una pagina de descargas el logo de la plataforma es la senal que la gente
// busca de un vistazo, y ahi la marca pesa mas que la coherencia del set.

const ICONS = {
  windows: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M3 5.6 9.9 4.65v6.75H3zM10.9 4.5 21 3.1v8.3H10.9zM3 12.6h6.9v6.75L3 18.4zM10.9 12.6H21v8.3l-10.1-1.4z"/>
  </svg>`,
  linux: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="9" cy="20.8" rx="2.7" ry="1.35" fill="#E7A76A" transform="rotate(-14 9 20.8)"/>
    <ellipse cx="15" cy="20.8" rx="2.7" ry="1.35" fill="#E7A76A" transform="rotate(14 15 20.8)"/>
    <path fill="currentColor" d="M12 2.4c-2.6 0-4.3 2-4.3 4.5 0 .9-.5 1.6-1.1 2.5C5.4 11.2 4.6 12.9 4.6 15c0 3.4 3.2 5.6 7.4 5.6s7.4-2.2 7.4-5.6c0-2.1-.8-3.8-1.9-5.6-.6-.9-1.1-1.6-1.1-2.5 0-2.5-1.8-4.5-4.4-4.5Z"/>
    <ellipse cx="12" cy="15.2" rx="4.3" ry="4.6" fill="#FFFFFF"/>
    <ellipse cx="10.4" cy="6.6" rx="1.15" ry="1.5" fill="#FFFFFF"/>
    <ellipse cx="13.6" cy="6.6" rx="1.15" ry="1.5" fill="#FFFFFF"/>
    <circle cx="10.75" cy="6.9" r=".62" fill="#150F0C"/>
    <circle cx="13.25" cy="6.9" r=".62" fill="#150F0C"/>
    <path fill="#E7A76A" d="M12 8.1c1.2 0 2.15.62 2.15 1.4S13.2 10.9 12 10.9 9.85 10.28 9.85 9.5 10.8 8.1 12 8.1Z"/>
  </svg>`,
  download: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>
  </svg>`,
}

const OS_LABEL = { windows: 'Windows', linux: 'Linux' }

/* ── Render ─────────────────────────────────────────────────────────────── */

function renderHero(data, os) {
  const row = $('[data-hero-cta]')
  const meta = $('[data-hero-meta]')
  if (!row || !meta) return

  const pick = (target) => data.downloads.find((d) => d.os === target && d.recommended)
  const mine = pick(os)
  row.replaceChildren()

  if (mine) {
    row.append(
      el('a', {
        class: 'btn btn-accent btn-xl',
        href: mine.url,
        html: ICONS.download,
      }, ` Descargar para ${OS_LABEL[os]}`),
      el('a', { class: 'btn btn-outline btn-xl', href: '#descargas', text: 'Otras opciones' }),
    )
    meta.replaceChildren(
      el('span', { text: `Versión ${data.version} · ` }),
      el('b', { text: mine.file }),
      el('span', { text: ` · ${formatSize(mine.size)} · publicado el ${formatDate(data.publishedAt)}` }),
    )
    return
  }

  // Sin build para el sistema detectado. Se dice, en vez de ofrecer un binario
  // que no va a ejecutarse.
  const excuse = {
    macos: 'Todavía no hay una versión de Telar para macOS.',
    ios: 'Telar es una aplicación de escritorio: no funciona en móviles.',
    android: 'Telar es una aplicación de escritorio: no funciona en móviles.',
    unknown: 'No hemos podido reconocer tu sistema.',
  }[os] ?? 'No hemos podido reconocer tu sistema.'

  row.append(el('a', { class: 'btn btn-accent btn-xl', href: '#descargas', text: 'Ver descargas' }))
  meta.replaceChildren(
    el('span', { text: `${excuse} Hay versiones para Windows y Linux de 64 bits. Versión ${data.version}.` }),
  )
}

function renderPlatform(data, os, isYours) {
  const items = data.downloads
    .filter((d) => d.os === os)
    .sort((a, b) => Number(b.recommended) - Number(a.recommended))

  const list = el('ul', { class: 'dl-list' })
  for (const d of items) {
    list.append(el('li', { class: 'dl' },
      el('div', { class: 'dl-main' },
        el('div', { class: 'dl-title' },
          el('span', { text: d.label }),
          d.recommended ? el('span', { class: 'tag-rec', text: 'Recomendado' }) : null,
        ),
        el('div', { class: 'dl-hint', text: d.hint }),
        el('code', { class: 'dl-file', text: d.file }),
      ),
      el('span', { class: 'dl-size', text: formatSize(d.size) }),
      el('a', {
        class: d.recommended ? 'btn btn-accent' : 'btn',
        href: d.url,
        'aria-label': `Descargar ${d.label} para ${OS_LABEL[os]} (${formatSize(d.size)})`,
      }, 'Descargar'),
    ))
  }

  const head = el('div', { class: 'platform-head' },
    el('span', { class: 'platform-icon', html: ICONS[os] }).firstElementChild,
    el('h3', { text: OS_LABEL[os] }),
    isYours ? el('span', { class: 'badge-yours', text: 'Tu sistema' }) : null,
  )

  const foot = el('p', {
    class: 'platform-foot',
    text: os === 'windows'
      ? '64 bits. Windows 10 u 11.'
      : '64 bits (x86-64). Debian, Ubuntu, Fedora, Arch y derivadas.',
  })

  return el('section', {
    class: isYours ? 'platform is-yours' : 'platform',
    'aria-label': `Descargas para ${OS_LABEL[os]}`,
  }, head, list, foot)
}

function renderDownloads(data, os) {
  const host = $('[data-platforms]')
  if (!host) return
  host.replaceChildren(
    renderPlatform(data, 'windows', os === 'windows'),
    renderPlatform(data, 'linux', os === 'linux'),
  )
}

function renderChecksums(data) {
  const body = $('[data-sums]')
  if (!body) return
  const withSum = data.downloads.filter((d) => d.sha256)
  if (withSum.length === 0) {
    body.append(el('tr', {}, el('td', { colspan: '2', text: 'Este release no publica checksums.' })))
    return
  }
  body.replaceChildren(...withSum.map((d) => el('tr', {},
    el('td', { text: d.file }),
    el('td', { text: d.sha256 }),
  )))
}

/** Comandos que llevan dentro el nombre real del artefacto de esta versión. */
function fillTemplates(data) {
  const find = (os, kind) => data.downloads.find((d) => d.os === os && d.kind === kind)
  const deb = find('linux', 'installer')
  const appimage = find('linux', 'portable')
  const winSetup = find('windows', 'installer')
  const sums = data.checksumsUrl ? data.checksumsUrl.split('/').pop() : null

  const values = {
    'win-installer-name': winSetup?.file,
    'deb-install': deb && `sudo apt install ./${deb.file}`,
    'appimage-run': appimage && `chmod +x ${appimage.file} && ./${appimage.file}`,
    'sha-linux': sums && `sha256sum -c ${sums}`,
    'sha-win': winSetup && `Get-FileHash "${winSetup.file}" -Algorithm SHA256`,
  }

  for (const [key, value] of Object.entries(values)) {
    if (!value) continue
    const node = $(`[data-tpl="${key}"]`)
    if (node) node.textContent = value
  }
}

function renderMeta(data) {
  const chip = $('[data-version-chip]')
  if (chip) chip.textContent = `v${data.version}`
  for (const link of $$('[data-notes-url]')) link.href = data.notesUrl
  const footer = $('[data-footer-version]')
  if (footer) {
    footer.textContent =
      `Versión ${data.version}, publicada el ${formatDate(data.publishedAt)}.`
  }
}

/* ── Interacción ────────────────────────────────────────────────────────── */

/** Pestañas Windows/Linux con navegación por flechas (patrón ARIA tabs). */
function initTabs(os) {
  const tabs = $$('.tab')
  if (tabs.length === 0) return

  const select = (target, focus = false) => {
    for (const tab of tabs) {
      const on = tab.dataset.os === target
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      const panel = $(`[data-panel="${tab.dataset.os}"]`)
      if (panel) panel.hidden = !on
      if (on && focus) tab.focus()
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.os))
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }
      const step = keys[event.key]
      if (!step) return
      event.preventDefault()
      const i = tabs.indexOf(tab)
      select(tabs[(i + step + tabs.length) % tabs.length].dataset.os, true)
    })
  }

  // Se abre en la pestaña del sistema del visitante; Windows si no se sabe.
  select(os === 'linux' ? 'linux' : 'windows')
}

/** Botones «Copiar» de los bloques de comando. */
function initCopy() {
  for (const button of $$('[data-copy]')) {
    button.addEventListener('click', async () => {
      const code = button.closest('.cmd')?.querySelector('code')
      if (!code) return
      const text = code.textContent ?? ''
      try {
        await navigator.clipboard.writeText(text)
        button.textContent = 'Copiado'
        button.dataset.done = 'true'
      } catch {
        // Sin permiso de portapapeles (contexto no seguro, file://…): se
        // selecciona el comando para que baste con Ctrl+C.
        const range = document.createRange()
        range.selectNodeContents(code)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        button.textContent = 'Ctrl+C'
      }
      setTimeout(() => {
        button.textContent = 'Copiar'
        delete button.dataset.done
      }, 1800)
    })
  }
}

/** Conmutador claro ⇄ oscuro. El tema inicial ya lo puso el script del <head>;
 *  aquí solo se cambia y se guarda con el mismo formato que la app. */
function initTheme() {
  const root = document.documentElement
  const button = $('[data-theme-toggle]')
  if (!button) return
  const sync = () => {
    const dark = root.dataset.theme === 'dark'
    const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
    button.setAttribute('aria-pressed', String(dark))
    button.setAttribute('aria-label', label)
    button.title = label
  }
  sync()
  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.themeTransition = ''
    root.dataset.theme = next
    setTimeout(() => { delete root.dataset.themeTransition }, 240)
    try {
      localStorage.setItem('telar-theme', JSON.stringify({ state: { theme: next }, version: 0 }))
    } catch {
      // Sin almacenamiento (modo privado estricto): el cambio vale para esta visita.
    }
    sync()
  })
}

function showLoadError() {
  const host = $('[data-platforms]')
  if (!host) return
  const link = el('a', {
    href: 'https://github.com/telar-javeriana/telar/releases/latest',
    text: 'la página de releases en GitHub',
  })
  host.replaceChildren(el('div', { class: 'notice notice-warn' },
    el('p', { class: 'notice-body' },
      el('strong', { text: 'No se pudo cargar la lista de descargas.' }),
      'Puedes bajarlas directamente desde ', link, '.',
    ),
  ))
}

/* ── Cielo del hero ─────────────────────────────────────────────────────── */

// Sprites en píxel (rejilla = viewBox). currentColor es el color del texto y
// a1/a2/a3 los acentos del tema; f1/f2 son los dos cuadros de una animación
// (alas arriba/abajo, llama corta/larga). Son cadenas fijas nuestras.
const SPRITES = {
  flock: { vb: '0 0 24 11', html:
    '<path class="f1" d="M0 0h1v1H0z M1 1h1v1H1z M2 2h3v1H2z M5 1h1v1H5z M6 0h1v1H6z' +
    ' M9 4h1v1H9z M10 5h1v1h-1z M11 6h3v1h-3z M14 5h1v1h-1z M15 4h1v1h-1z' +
    ' M17 7h1v1h-1z M18 8h1v1h-1z M19 9h3v1h-3z M22 8h1v1h-1z M23 7h1v1h-1z"/>' +
    '<path class="f2" d="M0 2h2v1H0z M2 1h3v1H2z M5 2h2v1H5z' +
    ' M9 6h2v1H9z M11 5h3v1h-3z M14 6h2v1h-2z' +
    ' M17 9h2v1h-2z M19 8h3v1h-3z M22 9h2v1h-2z"/>' },
  plane: { vb: '0 0 20 8', html:
    '<path fill="currentColor" d="M1 1h2v2H1z M1 3h17v2H1z M18 4h1v1h-1z M7 2h4v1H7z M7 5h5v1H7z M8 6h3v1H8z"/>' +
    '<path class="a2" d="M12 3h1v1h-1z M14 3h1v1h-1z M16 3h2v1h-2z"/>' +
    '<path class="a1" d="M1 1h1v1H1z"/>' },
  rocket: { vb: '0 0 7 14', html:
    '<path fill="currentColor" d="M3 0h1v1H3z M2 1h3v8H2z M1 6h1v3H1z M5 6h1v3H5z M0 8h1v1H0z M6 8h1v1H6z"/>' +
    '<path class="a2" d="M3 3h1v2H3z"/>' +
    '<path class="a1" d="M3 0h1v1H3z M2 9h3v1H2z"/>' +
    '<path class="a3 f1" d="M2 10h3v1H2z M3 11h1v1H3z"/>' +
    '<path class="a3 f2" d="M2 10h3v2H2z M3 12h1v2H3z"/>' },
  balloon: { vb: '0 0 9 12', html:
    '<path class="a1" d="M3 0h3v1H3z M2 1h5v1H2z M1 2h7v3H1z M2 5h5v1H2z M3 6h3v1H3z"/>' +
    '<path class="a3" d="M4 0h1v7H4z M2 1h1v5H2z M6 1h1v5H6z"/>' +
    '<path fill="currentColor" d="M3 7h1v2H3z M5 7h1v2H5z M3 9h3v2H3z"/>' },
  ufo: { vb: '0 0 11 6', html:
    '<path class="a2" d="M4 0h3v1H4z M3 1h5v1H3z"/>' +
    '<path fill="currentColor" d="M1 2h9v1H1z M0 3h11v1H0z M2 4h7v1H2z"/>' +
    '<path class="a1 f1" d="M2 3h1v1H2z M8 3h1v1H8z"/>' +
    '<path class="a3 f2" d="M5 3h1v1H5z"/>' +
    '<path class="a2" d="M4 5h1v1H4z M6 5h1v1H6z"/>' },
}

// Qué cruza el cielo y cómo: escala del píxel, duración del ciclo (s) y banda
// de altura (fracción del cielo). Cruzan en el 40 % del ciclo (styles.css).
const FLYERS = [
  { kind: 'flock', scale: 2, dur: 52, y: [0.08, 0.40], cls: 'bob' },
  { kind: 'flock', scale: 2, dur: 64, y: [0.20, 0.55], cls: 'bob rtl' },
  { kind: 'plane', scale: 3, dur: 46, y: [0.04, 0.22], cls: '' },
  { kind: 'rocket', scale: 3, dur: 40, y: [0, 0], cls: '' },
  { kind: 'balloon', scale: 4, dur: 130, y: [0.25, 0.60], cls: 'bob' },
  { kind: 'ufo', scale: 3, dur: 82, y: [0.06, 0.30], cls: 'bob rtl' },
]

/** Azar con semilla (mulberry32): el cielo sale igual en cada visita. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function initSky() {
  const sky = $('.hero-sky')
  if (!sky) return
  const rnd = seeded(20261119)
  const pick = (a, b) => a + rnd() * (b - a)
  const css = (vars) => Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(';')
  const { width, height } = sky.getBoundingClientRect()
  const nodes = []

  // Estrellas: una cada ~11 000 px² del cielo; algunas en cruz y casi todas titilan.
  const stars = Math.max(24, Math.min(170, Math.round((width * height) / 11000)))
  for (let i = 0; i < stars; i++) {
    const big = rnd() < 0.12
    const size = big ? 2 : rnd() < 0.55 ? 2 : 3
    nodes.push(el('i', {
      class: `star k${Math.floor(rnd() * 5)}${big ? ' cross' : ''}${rnd() < 0.8 ? ' tw' : ''}`,
      style: css({
        x: pick(0.01, 0.99).toFixed(3), y: pick(0.02, 0.97).toFixed(3), s: `${size}px`,
        o: pick(0.35, 0.7).toFixed(2), dur: `${pick(1.8, 4.2).toFixed(1)}s`,
        delay: `${(-pick(0, 4)).toFixed(1)}s`,
      }),
    }))
  }

  // Nubes: de 36 a 170 px; las grandes (más cerca) van más rápido y se ven más.
  const clouds = Math.max(5, Math.min(12, Math.round(width / 170)))
  for (let i = 0; i < clouds; i++) {
    const w = Math.round(pick(36, 170))
    const near = (w - 36) / 134
    const dur = Math.round(150 - near * 85)
    const x = (i + rnd() * 0.8) / clouds // repartidas a lo ancho desde el inicio
    nodes.push(el('span', {
      class: `cloud${rnd() < 0.4 ? ' long' : ''}`,
      style: css({
        x: x.toFixed(3), y: pick(0.02, 0.72).toFixed(3), w: `${w}px`,
        o: (0.18 + near * 0.22).toFixed(2), dur: `${dur}s`, steps: dur * 3,
        delay: `${(-x * dur).toFixed(1)}s`,
      }),
    }))
  }

  for (const f of FLYERS) {
    const sprite = SPRITES[f.kind]
    const [, , vw] = sprite.vb.split(' ').map(Number)
    nodes.push(el('span', {
      class: `flyer ${f.kind} ${f.cls}`.trim(),
      style: css({
        w: `${vw * f.scale}px`, x: pick(0.1, 0.8).toFixed(3), y: pick(...f.y).toFixed(3),
        dur: `${f.dur}s`, steps: f.dur * 4, delay: `${(-pick(0, f.dur)).toFixed(1)}s`,
      }),
      html: `<svg viewBox="${sprite.vb}" aria-hidden="true" focusable="false">${sprite.html}</svg>`,
    }))
  }

  sky.replaceChildren(...nodes)
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

initSky()
const os = detectOS()
initTheme()
initCopy()
initTabs(os)

try {
  const response = await fetch('./release.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()

  renderMeta(data)
  renderHero(data, os)
  renderDownloads(data, os)
  renderChecksums(data)
  fillTemplates(data)
} catch (error) {
  console.error('No se pudo leer release.json:', error)
  showLoadError()
}
