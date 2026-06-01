/**
 * XUL App Launcher Widget
 * Embed in any XUL app with:
 *   <script src="https://mytrack.xul.es/xul-launcher.js" data-current="mytrack"></script>
 *
 * data-current options: mytrack | xultech | deeptalk | briefing | crm | ecofin | prompts | bcorp | giros
 */
;(function () {
  const APPS = [
    { id: 'mytrack',   href: 'https://mytrack.xul.es',  label: 'MyTrack',       color: '#6366F1', svg: '<path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v5l3 3"/>' },
    { id: 'xultech',   href: 'https://xultech.xul.es',  label: 'Xul Tech',      color: '#7C4DFF', svg: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    { id: 'deeptalk',  href: 'https://deeptalk.xul.es', label: 'DeepTalk',      color: '#10B981', svg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
    { id: 'briefing',  href: 'https://briefing.xul.es', label: 'Briefing',      color: '#8B5CF6', svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>' },
    { id: 'crm',       href: 'https://crm.xul.es',      label: 'CRM XUL',      color: '#06B6D4', svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>' },
    { id: 'ecofin',    href: 'https://ecofin.xul.es',   label: 'EcoFin',        color: '#059669', svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    { id: 'prompts',   href: 'https://prompts.xul.es',  label: 'Systems Prompt',color: '#F59E0B', svg: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    { id: 'bcorp',     href: 'https://bcorp.xul.es',    label: 'B Corp',        color: '#14B8A6', svg: '<path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v8M8 12h8"/>' },
    { id: 'giros',     href: 'https://giros.xul.es',    label: 'Giros',         color: '#F97316', svg: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>' },
  ]

  const CURRENT = (document.currentScript?.dataset?.current || '').toLowerCase()

  const CSS = `
    #xul-launcher-btn {
      width:32px;height:32px;border-radius:8px;
      border:1px solid rgba(128,128,128,0.3);
      background:rgba(128,128,128,0.1);
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      color:#888;transition:all .15s;flex-shrink:0;
    }
    #xul-launcher-btn:hover, #xul-launcher-btn.open {
      background:rgba(124,77,255,0.12);color:#7C4DFF;border-color:rgba(124,77,255,0.3);
    }
    #xul-launcher-panel {
      position:fixed;z-index:99999;
      background:rgba(10,10,20,0.98);
      backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
      border:1px solid rgba(255,255,255,0.09);border-radius:18px;
      box-shadow:0 24px 64px rgba(0,0,0,0.6);
      padding:14px;width:252px;
      animation:xulFadeIn .15s ease;
    }
    @keyframes xulFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    #xul-launcher-panel .xul-header {
      display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;
    }
    #xul-launcher-panel .xul-title {
      font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;
      color:rgba(255,255,255,0.3);font-family:system-ui,sans-serif;
    }
    #xul-launcher-panel .xul-all {
      font-size:10px;color:#A78BFA;text-decoration:none;font-weight:600;
      font-family:system-ui,sans-serif;
    }
    #xul-launcher-panel .xul-grid {
      display:grid;grid-template-columns:repeat(3,1fr);gap:6px;
    }
    #xul-launcher-panel .xul-app {
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:6px;padding:10px 4px;border-radius:12px;
      border:1.5px solid rgba(255,255,255,0.07);
      background:rgba(255,255,255,0.05);
      cursor:pointer;transition:all .12s;
      font-family:system-ui,sans-serif;
    }
    #xul-launcher-panel .xul-app.active {
      cursor:default;
    }
    #xul-launcher-panel .xul-app:not(.active):hover {
      background:rgba(255,255,255,0.1);
    }
    #xul-launcher-panel .xul-icon {
      width:40px;height:40px;border-radius:11px;
      display:flex;align-items:center;justify-content:center;
      transition:all .12s;
    }
    #xul-launcher-panel .xul-icon svg {
      width:18px;height:18px;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;
    }
    #xul-launcher-panel .xul-label {
      font-size:10px;font-weight:500;color:rgba(255,255,255,0.5);
      text-align:center;line-height:1.2;
    }
    #xul-launcher-panel .xul-app.active .xul-label {
      font-weight:700;color:#fff;
    }
  `

  function createIcon(svgPath, color) {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="${color}">${svgPath}</svg>`
  }

  function render() {
    // Inject styles
    if (!document.getElementById('xul-launcher-style')) {
      const s = document.createElement('style')
      s.id = 'xul-launcher-style'
      s.textContent = CSS
      document.head.appendChild(s)
    }

    // Create button
    const btn = document.createElement('button')
    btn.id = 'xul-launcher-btn'
    btn.title = 'Apps XUL'
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`

    let panel = null

    function closePanel() {
      if (panel) { panel.remove(); panel = null }
      btn.classList.remove('open')
    }

    function openPanel() {
      const rect = btn.getBoundingClientRect()
      panel = document.createElement('div')
      panel.id = 'xul-launcher-panel'
      panel.style.top = (rect.bottom + 8) + 'px'
      panel.style.left = rect.left + 'px'

      const gridHTML = APPS.map(app => {
        const isActive = app.id === CURRENT
        const iconBg   = isActive ? app.color : app.color + '28'
        const shadow   = isActive ? `0 4px 16px ${app.color}55` : 'none'
        const border   = isActive ? `1.5px solid ${app.color}70` : ''
        const bg       = isActive ? app.color + '2a' : ''
        return `
          <button class="xul-app${isActive ? ' active' : ''}"
            data-href="${app.href}" data-active="${isActive}"
            style="${border ? 'border:' + border + ';' : ''}${bg ? 'background:' + bg + ';' : ''}"
            onmouseenter="if(!this.dataset.active||this.dataset.active==='false'){this.style.background='${app.color}22';this.style.borderColor='${app.color}55'}"
            onmouseleave="if(!this.dataset.active||this.dataset.active==='false'){this.style.background='';this.style.borderColor=''}">
            <div class="xul-icon" style="background:${iconBg};box-shadow:${shadow}">
              ${createIcon(app.svg, isActive ? '#fff' : app.color)}
            </div>
            <span class="xul-label">${app.label}</span>
          </button>`
      }).join('')

      panel.innerHTML = `
        <div class="xul-header">
          <span class="xul-title">Apps XUL</span>
          <a class="xul-all" href="https://appcenter.xul.es" target="_blank" rel="noopener noreferrer">Ver todas →</a>
        </div>
        <div class="xul-grid">${gridHTML}</div>
      `

      panel.querySelectorAll('.xul-app').forEach(el => {
        el.addEventListener('click', () => {
          const href = el.dataset.href
          const isActive = el.dataset.active === 'true'
          if (!isActive) window.open(href, '_blank', 'noopener,noreferrer')
          closePanel()
        })
      })

      document.body.appendChild(panel)
      btn.classList.add('open')

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('mousedown', function handler(e) {
          if (!panel?.contains(e.target) && e.target !== btn) {
            closePanel()
            document.removeEventListener('mousedown', handler)
          }
        })
      }, 0)
    }

    btn.addEventListener('click', () => {
      if (panel) closePanel()
      else openPanel()
    })

    // Expose so host can place it anywhere
    window.XULLauncher = { btn, mount: (target) => target.appendChild(btn) }

    // Auto-mount if body is ready
    if (document.body) document.body.prepend(btn)
    else document.addEventListener('DOMContentLoaded', () => document.body.prepend(btn))
  }

  render()
})()
