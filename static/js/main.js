// Dull Species: draggable doods, the TV (a YouTube player that works through
// the whole discography) and the DVD screensaver.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const shuffle = (list) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

// Grab these before initDoods thins them out; the screensaver uses them all.
const doodSources = [...document.querySelectorAll('.dood img')].map((img) => img.src);

// The doods steer clear of the text, so measure it in its real fonts.
Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 1500))]).then(initDoods);
initTV();
initScreensaver(doodSources);

// Scatter the doods around the hero and let people fling them.
function initDoods() {
  const field = document.querySelector('.doods');
  if (!field) return;

  const box = field.getBoundingClientRect();
  let { width, height } = box;
  const els = shuffle([...field.querySelectorAll('.dood')]);
  const count = clamp(Math.round((width * height) / 80000), 4, els.length);
  els.slice(count).forEach((el) => el.remove());

  // Start them clear of the nav and buttons so nothing is hidden on load.
  const keepClear = [...document.querySelectorAll('.hero .nav, .hero .latest')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width)
    .map((r) => ({ x: r.left - box.left - 16, y: r.top - box.top - 16, w: r.width + 32, h: r.height + 32 }));
  const covered = (x, y, w, h) => keepClear.reduce((area, r) =>
    area + Math.max(0, Math.min(x + w, r.x + r.w) - Math.max(x, r.x)) * Math.max(0, Math.min(y + h, r.y + r.h) - Math.max(y, r.y)), 0);

  let top = count;
  const placed = [];
  const doods = els.slice(0, count).map((el, i) => {
    const d = { el, w: el.offsetWidth, h: el.offsetHeight, x: 0, y: 0, r: rand(-14, 14), vx: 0, vy: 0, spin: 0 };
    // Best of a few random spots: clear of the UI and far from the others.
    let best = -Infinity;
    for (let k = 0; k < 24; k++) {
      const x = rand(0, width - d.w);
      const y = rand(0, height - d.h);
      const overlap = covered(x, y, d.w, d.h);
      const score = overlap ? -overlap : Math.min(width, ...placed.map((p) => Math.hypot(p.x - x, p.y - y)));
      if (score > best) [best, d.x, d.y] = [score, x, y];
    }
    placed.push(d);
    el.style.zIndex = i + 1;
    el.style.setProperty('--i', i);
    draw(d);
    return d;
  });

  function draw(d) {
    d.el.style.transform = `translate(${d.x}px, ${d.y}px)`;
    d.el.style.setProperty('--r', `${d.r}deg`);
  }

  // Keep a dood inside the hero, bouncing it off the edges.
  function contain(d) {
    const maxX = width - d.w;
    const maxY = height - d.h;
    if (d.x < 0) [d.x, d.vx] = [0, Math.abs(d.vx) * 0.6];
    if (d.x > maxX) [d.x, d.vx] = [maxX, -Math.abs(d.vx) * 0.6];
    if (d.y < 0) [d.y, d.vy] = [0, Math.abs(d.vy) * 0.6];
    if (d.y > maxY) [d.y, d.vy] = [maxY, -Math.abs(d.vy) * 0.6];
  }

  let frame = 0;
  let then = 0;
  function step(now) {
    const dt = Math.min(0.05, (now - then) / 1000);
    then = now;
    let moving = false;
    for (const d of doods) {
      if (d.held || Math.hypot(d.vx, d.vy) < 4) continue;
      moving = true;
      const decay = Math.exp(-2.6 * dt);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.r += d.spin * dt;
      d.vx *= decay;
      d.vy *= decay;
      d.spin *= decay;
      contain(d);
      draw(d);
    }
    frame = moving ? requestAnimationFrame(step) : 0;
  }
  function fling() {
    if (frame) return;
    then = performance.now();
    frame = requestAnimationFrame(step);
  }

  for (const d of doods) {
    let origin, last;
    d.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      d.el.setPointerCapture(e.pointerId);
      origin = { x: e.clientX - d.x, y: e.clientY - d.y };
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      d.held = true;
      d.vx = d.vy = d.spin = 0;
      d.el.style.zIndex = ++top;
      d.el.classList.add('is-grabbed');
    });
    d.el.addEventListener('pointermove', (e) => {
      if (!d.held) return;
      const dt = Math.max(8, e.timeStamp - last.t) / 1000;
      d.vx = 0.7 * ((e.clientX - last.x) / dt) + 0.3 * d.vx;
      d.vy = 0.7 * ((e.clientY - last.y) / dt) + 0.3 * d.vy;
      d.x = e.clientX - origin.x;
      d.y = e.clientY - origin.y;
      d.r += (e.clientX - last.x) * 0.04;
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      draw(d);
    });
    const letGo = (e) => {
      if (!d.held) return;
      d.held = false;
      d.el.classList.remove('is-grabbed');
      if (e.timeStamp - last.t > 90) d.vx = d.vy = 0; // stopped before letting go
      d.spin = d.vx * 0.05;
      contain(d);
      draw(d);
      fling();
    };
    d.el.addEventListener('pointerup', letGo);
    d.el.addEventListener('pointercancel', letGo);
  }

  field.classList.add('is-ready');

  new ResizeObserver(() => {
    ({ width, height } = field.getBoundingClientRect());
    for (const d of doods) {
      d.w = d.el.offsetWidth;
      d.h = d.el.offsetHeight;
      contain(d);
      draw(d);
    }
  }).observe(field);
}

// The TV: a YouTube player docked in the corner with its own controls, which
// plays through every track on the page in order.
function initTV() {
  const tv = document.querySelector('.tv');
  const links = [...document.querySelectorAll('[data-track]')];
  if (!tv || !links.length) return;

  const queue = links.map((el) => ({
    el,
    card: el.closest('.release'),
    id: el.dataset.youtube,
    title: el.dataset.title,
    release: el.dataset.release,
    color: el.dataset.color,
  }));
  const ui = {
    title: tv.querySelector('[data-tv-title]'),
    release: tv.querySelector('[data-tv-release]'),
    seek: tv.querySelector('[data-tv-seek]'),
    time: tv.querySelector('[data-tv-time]'),
    duration: tv.querySelector('[data-tv-duration]'),
    toggle: tv.querySelector('[data-tv="toggle"]'),
  };
  const pageTitle = document.title;

  let player; // resolves to a YT.Player once the API has loaded
  let current = -1;
  let playing = false;
  let seeking = false;
  let failures = 0;
  let broken = false; // YouTube couldn't load; let links open normally

  function youtube() {
    player ??= new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube took too long')), 10000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        const yt = new YT.Player('tv-player', {
          host: 'https://www.youtube-nocookie.com',
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: () => resolve(yt),
            onStateChange: ({ data }) => stateChanged(data),
            onError: () => (++failures < queue.length ? next() : setPlaying(false)),
          },
        });
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('YouTube blocked'));
      document.head.append(script);
    });
    return player;
  }

  async function play(i) {
    current = (i + queue.length) % queue.length;
    const track = queue[current];
    open();
    tv.style.setProperty('--accent', track.color);
    ui.title.textContent = track.title;
    ui.release.textContent = track.title === track.release ? 'Dull Species' : `Dull Species · ${track.release}`;
    ui.seek.value = 0;
    ui.seek.style.setProperty('--p', '0%');
    ui.time.textContent = ui.duration.textContent = '0:00';
    for (const q of queue) {
      q.el.classList.toggle('is-current', q === track);
      q.el.setAttribute('aria-current', q === track);
      q.card.classList.toggle('is-current', q.card === track.card);
    }

    try {
      const yt = await youtube();
      if (queue[current] === track) yt.loadVideoById(track.id);
    } catch {
      broken = true;
      close();
      window.open(`https://www.youtube.com/watch?v=${track.id}`, '_blank', 'noopener');
    }
  }

  const next = () => play(current + 1);
  async function prev() {
    const yt = await player;
    if (yt.getCurrentTime() > 3) yt.seekTo(0, true);
    else play(current - 1);
  }
  async function toggle() {
    const yt = await player;
    playing ? yt.pauseVideo() : yt.playVideo();
  }

  function stateChanged(state) {
    if (state === YT.PlayerState.PLAYING) {
      failures = 0;
      setPlaying(true);
    } else if (state === YT.PlayerState.PAUSED) {
      setPlaying(false);
    } else if (state === YT.PlayerState.ENDED) {
      current < queue.length - 1 ? next() : setPlaying(false);
    }
  }

  function setPlaying(on) {
    playing = on;
    tv.classList.toggle('is-playing', on);
    ui.toggle.setAttribute('aria-label', on ? 'Pause' : 'Play');
    queue[current]?.card.classList.toggle('is-paused', !on);
    document.title = on ? `▶ ${queue[current].title} · ${pageTitle}` : pageTitle;
  }

  function open() {
    if (tv.classList.contains('is-open')) return;
    tv.hidden = false;
    void tv.offsetWidth; // lay it out offscreen first so it slides in
    tv.classList.add('is-open');
    document.documentElement.style.setProperty('--tv-space', `${tv.offsetHeight + 16}px`);
  }

  async function close() {
    setPlaying(false);
    tv.classList.remove('is-open');
    document.documentElement.style.removeProperty('--tv-space');
    for (const q of queue) {
      q.el.classList.remove('is-current');
      q.el.removeAttribute('aria-current');
      q.card.classList.remove('is-current', 'is-paused');
    }
    current = -1;
    (await player.catch(() => null))?.stopVideo();
  }
  tv.addEventListener('transitionend', (e) => {
    if (e.target === tv && e.propertyName === 'translate' && !tv.classList.contains('is-open')) tv.hidden = true;
  });

  setInterval(async () => {
    if (!playing || seeking) return;
    const yt = await player;
    const [t, d] = [yt.getCurrentTime(), yt.getDuration()];
    if (!d) return;
    ui.seek.value = Math.round((t / d) * 1000);
    ui.seek.style.setProperty('--p', `${(t / d) * 100}%`);
    ui.time.textContent = time(t);
    ui.duration.textContent = time(d);
  }, 250);

  ui.seek.addEventListener('input', async () => {
    seeking = true;
    const d = (await player).getDuration();
    ui.seek.style.setProperty('--p', `${ui.seek.value / 10}%`);
    ui.time.textContent = time((ui.seek.value / 1000) * d);
  });
  ui.seek.addEventListener('change', async () => {
    const yt = await player;
    yt.seekTo((ui.seek.value / 1000) * yt.getDuration(), true);
    seeking = false;
  });

  tv.addEventListener('click', (e) => {
    const action = e.target.closest('[data-tv]')?.dataset.tv;
    if (action) ({ prev, next, toggle, close })[action]();
  });

  document.addEventListener('click', (e) => {
    if (broken || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const all = e.target.closest('[data-play-all]');
    const track = e.target.closest('[data-track]');
    const cover = e.target.closest('[data-play-release]');
    let i;
    if (all) i = 0;
    else if (track) i = links.indexOf(track);
    else if (cover) i = queue.findIndex((q) => q.card === cover.closest('.release'));
    else return;

    e.preventDefault();
    const sameRelease = cover && queue[current]?.card === queue[i].card;
    if (current >= 0 && (i === current || sameRelease)) toggle();
    else play(i);
  });
}

function time(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// A doods DVD screensaver. Comes on after a minute of doing nothing, from the
// footer button, or by typing "dvd". The screen changes color every time it
// hits a wall; hit a corner and you'll know.
function initScreensaver(sources) {
  if (!sources.length) return;
  const idleMs = 60_000;
  const speed = 150; // px per second

  let screen = null;
  let idle = 0;
  let typed = '';

  function start() {
    if (screen) return;
    clearTimeout(idle);
    screen = document.createElement('div');
    screen.className = 'dvd';
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = '<img alt=""><p class="dvd-hint">Move or press anything to wake up</p><p class="dvd-corner">Corner!</p>';
    document.body.append(screen);

    const img = screen.querySelector('img');
    const corner = screen.querySelector('.dvd-corner');
    let src = pick(sources);
    img.src = src;

    let x = rand(0, innerWidth - img.offsetWidth);
    let y = rand(0, innerHeight - img.offsetHeight);
    let vx = speed * (Math.random() < 0.5 ? -1 : 1);
    let vy = speed * (Math.random() < 0.5 ? -1 : 1);
    let hitX = -Infinity;
    let hitY = -Infinity;
    let then = performance.now();
    recolor();

    function recolor() {
      screen.style.setProperty('--dvd-bg', `hsl(${Math.floor(rand(0, 360))} ${Math.floor(rand(65, 95))}% ${Math.floor(rand(48, 62))}%)`);
    }

    const step = (now) => {
      if (!screen) return;
      const dt = Math.min(0.05, (now - then) / 1000);
      then = now;
      const maxX = innerWidth - img.offsetWidth;
      const maxY = innerHeight - img.offsetHeight;
      x += vx * dt;
      y += vy * dt;
      let hit = false;
      if (x <= 0 || x >= maxX) [x, vx, hitX, hit] = [clamp(x, 0, maxX), -vx, now, true];
      if (y <= 0 || y >= maxY) [y, vy, hitY, hit] = [clamp(y, 0, maxY), -vy, now, true];
      if (hit) {
        recolor();
        if (sources.length > 1) {
          let nextSrc;
          do nextSrc = pick(sources); while (nextSrc === src);
          img.src = src = nextSrc;
        }
        if (Math.abs(hitX - hitY) < 150) {
          corner.classList.remove('is-on');
          void corner.offsetWidth; // restart the animation
          corner.classList.add('is-on');
        }
      }
      img.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // Let the click or keypress that started it finish before listening.
    setTimeout(() => {
      let moved = 0;
      const wake = (e) => {
        if (e.type === 'pointermove' && (moved += Math.abs(e.movementX) + Math.abs(e.movementY)) < 24) return;
        stop();
      };
      for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(type, wake, { passive: true });
      stop.listener = wake;
    }, 400);
  }

  function stop() {
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) removeEventListener(type, stop.listener);
    screen?.remove();
    screen = null;
    restart();
  }

  function restart() {
    clearTimeout(idle);
    if (!screen && !reduceMotion.matches) idle = setTimeout(start, idleMs);
  }

  for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll', 'wheel']) {
    addEventListener(type, () => screen || restart(), { passive: true });
  }
  addEventListener('keydown', (e) => {
    typed = (typed + e.key).slice(-3).toLowerCase();
    if (typed === 'dvd' && !e.target.closest('input, textarea')) start();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-screensaver]')) start();
  });
  restart();
}
