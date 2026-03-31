(function () {
  const cfg = window.__IPTV_SHELL_CONFIG__ || {}
  const hostedAppUrl = String(cfg.hostedAppUrl || '').trim()

  const loadingEl = document.getElementById('shell-loading')
  const statusEl = document.getElementById('shell-status')
  const errorEl = document.getElementById('shell-error')
  const errorDetailEl = document.getElementById('shell-error-detail')
  const retryBtn = document.getElementById('shell-retry')
  const frameEl = document.getElementById('shell-app-frame')

  let timeoutId = null
  let loaded = false

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message
  }

  function showLoading(message) {
    setStatus(message || 'A carregar app...')
    if (loadingEl) loadingEl.classList.remove('shell__overlay--hidden')
    if (errorEl) errorEl.classList.add('shell__overlay--hidden')
  }

  function showError(message) {
    if (errorDetailEl) errorDetailEl.textContent = message
    if (loadingEl) loadingEl.classList.add('shell__overlay--hidden')
    if (errorEl) errorEl.classList.remove('shell__overlay--hidden')
  }

  function markLoaded() {
    loaded = true
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (frameEl) {
      frameEl.classList.remove('shell__frame--hidden')
      try {
        frameEl.focus({ preventScroll: true })
        var cw = frameEl.contentWindow
        if (cw && typeof cw.focus === 'function') {
          cw.focus()
        }
      } catch (err) {}
    }
    if (loadingEl) loadingEl.classList.add('shell__overlay--hidden')
    if (errorEl) errorEl.classList.add('shell__overlay--hidden')
  }

  function startTimeoutGuard() {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(function () {
      if (!loaded) {
        showError('A app hosted nao respondeu a tempo. Verifique rede/servidor.')
      }
    }, 15000)
  }

  function buildFrameUrl(base) {
    const u = new URL(base)
    if (!u.hash) {
      u.hash = '#/'
    }
    u.searchParams.set('shell', 'tizen')
    return u.toString()
  }

  function loadHostedApp() {
    if (!hostedAppUrl) {
      showError('HOSTED_APP_URL nao configurado no shell.')
      return
    }

    if (!navigator.onLine) {
      showError('Sem internet/rede local. Ligue a rede e tente novamente.')
      return
    }

    loaded = false
    showLoading('A carregar app...')
    startTimeoutGuard()

    try {
      const finalUrl = buildFrameUrl(hostedAppUrl)
      frameEl.src = finalUrl
    } catch (e) {
      showError('URL da app hosted invalida.')
    }
  }

  window.addEventListener('offline', function () {
    if (!loaded) showError('Sem internet/rede local. Ligue a rede e tente novamente.')
  })

  window.addEventListener('online', function () {
    if (!loaded) showLoading('Rede restabelecida. A carregar app...')
  })

  if (frameEl) {
    frameEl.addEventListener('load', function () {
      markLoaded()
    })
    frameEl.addEventListener('error', function () {
      showError('Falha ao abrir a app hosted.')
    })
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      loadHostedApp()
    })
  }

  showLoading('A iniciar...')
  setTimeout(loadHostedApp, 80)
})()
