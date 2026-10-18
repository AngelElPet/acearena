/**
 * AceArena — Interaction layer
 * Clean, accessible, minimal JS
 */

(function () {
  'use strict';

  // Header scroll effect
  const header = document.getElementById('header');
  const onScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      menuToggle.setAttribute(
        'aria-expanded',
        nav.classList.contains('open') ? 'true' : 'false'
      );
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Contact form (demo)
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Enviando…';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = '✓ Solicitud enviada';
        btn.style.background = '#22c55e';
        form.reset();
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 2500);
      }, 900);
    });
  }

  // Smooth reveal on scroll
  const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll(
    '.tournament-card, .feature-card, .package, .ranking-table, .news-card, .faq-item, .live-card'
  ).forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
    revealObserver.observe(el);
  });

  // Sticky CTA visibility
  const stickyCta = document.getElementById('stickyCta');
  if (stickyCta) {
    const toggleSticky = () => {
      if (window.scrollY > 600) {
        stickyCta.classList.add('visible');
      } else {
        stickyCta.classList.remove('visible');
      }
    };
    window.addEventListener('scroll', toggleSticky, { passive: true });
    toggleSticky();
  }

  // Newsletter form demo
  const newsForm = document.getElementById('newsletterForm');
  if (newsForm) {
    newsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = newsForm.querySelector('button');
      const original = btn.textContent;
      btn.textContent = '¡Listo!';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
        newsForm.reset();
      }, 2000);
    });
  }

  // ===== LIVE SCORES from SportScore (free, attribution required) =====
  async function loadLiveMatches(showLoading = true) {
    const container = document.querySelector('.live-matches');
    if (!container) return;

    if (showLoading) {
      container.style.opacity = '0.5';
    }

    try {
      const res = await fetch('https://sportscore.com/api/v1/matches?sport=tennis&status=live&limit=8');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      let matches = (data.matches || []).filter(m => m.status === 'live' || m.status === 'inprogress');

      if (matches.length < 2) {
        const res2 = await fetch('https://sportscore.com/api/v1/matches?sport=tennis&status=finished&limit=6');
        if (res2.ok) {
          const data2 = await res2.json();
          const finished = (data2.matches || []).slice(0, 5);
          matches = [...matches, ...finished];
        }
      }

      if (matches.length === 0) {
        container.style.opacity = '1';
        return;
      }

      container.innerHTML = matches.map(m => {
        const isLive = m.status === 'live' || m.status === 'inprogress';
        const badge = isLive
          ? '<span class="live-badge">LIVE</span>'
          : '<span class="live-badge finished-badge">FINAL</span>';
        const homeScore = m.home_score != null ? m.home_score : '—';
        const awayScore = m.away_score != null ? m.away_score : '—';
        const winnerClassHome = (!isLive && Number(homeScore) > Number(awayScore)) ? ' winner' : '';
        const winnerClassAway = (!isLive && Number(awayScore) > Number(homeScore)) ? ' winner' : '';

        return `
        <article class="live-card ${isLive ? '' : 'finished'}">
          <div class="live-header">
            ${badge}
            <span class="live-tournament">${m.competition || 'Tennis'}</span>
          </div>
          <div class="scoreboard">
            <div class="player-row${winnerClassHome}">
              <div class="player-info">
                <span class="player-name">${m.home || 'Player 1'}</span>
              </div>
              <div class="sets">
                <span class="set current">${homeScore}</span>
              </div>
            </div>
            <div class="player-row${winnerClassAway}">
              <div class="player-info">
                <span class="player-name">${m.away || 'Player 2'}</span>
              </div>
              <div class="sets">
                <span class="set current">${awayScore}</span>
              </div>
            </div>
          </div>
          <div class="point-feed">
            <div class="point-item">
              <span class="point-time">${isLive ? 'En vivo' : 'Final'}</span>
              <span class="point-text">${isLive ? 'Partido en curso · Datos en tiempo real' : 'Partido finalizado · Sets: ' + homeScore + ' - ' + awayScore}</span>
            </div>
          </div>
        </article>`;
      }).join('');

      const note = document.querySelector('.live-note');
      if (note) {
        note.innerHTML = 'Datos en vivo · <a href="https://sportscore.com/" rel="dofollow" target="_blank" style="color:var(--accent)">Powered by SportScore</a> · Actualizado al cargar / al pulsar el botón';
      }
    } catch (err) {
      console.warn('Live scores API unavailable, keeping demo data', err);
    } finally {
      container.style.opacity = '1';
    }
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshLive');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.textContent = 'Actualizando…';
      refreshBtn.disabled = true;
      loadLiveMatches(true).finally(() => {
        refreshBtn.textContent = 'Actualizar marcadores';
        refreshBtn.disabled = false;
      });
    });
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadLiveMatches(false));
  } else {
    loadLiveMatches(false);
  }


  // Share / copy link
  const shareBtn = document.getElementById('sharePage');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = window.location.href.split('#')[0];
      try {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = '¡Copiado!';
        setTimeout(() => shareBtn.textContent = 'Copiar enlace', 2000);
      } catch {
        shareBtn.textContent = 'No se pudo copiar';
      }
    });
  }

})();
