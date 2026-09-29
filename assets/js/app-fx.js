/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-fx.js (v2 — fusion motion engine)
   Loader counter · liquid-wave shader + sparks (canvas)
   · double-ring cursor · spring reveals · word blur-up
   · sticky stack · weekly circuit lap · segmented progress
   · full-screen menu · VIP crypto gate · Tehran clock
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  const { $, $$, faNum, esc, sanitizeUrl, loadData, renderAll, initEvents, state } = window.SSB;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ════════════ loader (Lumora × KIMI veil) ════════════ */
  const loaderDone = (function () {
    let resolveFn;
    const promise = new Promise(res => { resolveFn = res; });
    const pre = document.getElementById('loader');
    const count = document.getElementById('loader-count');
    const meter = document.getElementById('loader-meter');
    const t0 = Date.now();
    const MIN = REDUCED ? 150 : 1500;
    const MAX = 4200;

    let p = 0, shown = 0, finished = false;
    const tick = setInterval(() => {
      p = Math.min(p + Math.random() * 7 + 2, 96);
      shown = p;
      render();
    }, 90);

    function render() {
      const v = Math.round(shown);
      count.textContent = faNum(String(v).padStart(3, '0'));
      meter.style.width = v + '%';
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      const wait = Math.max(0, MIN - (Date.now() - t0));
      setTimeout(() => {
        p = 100; shown = 100; render();
        setTimeout(() => {
          pre.classList.add('done');
          document.body.classList.add('ready');
          setTimeout(() => pre.remove(), 1000);
          resolveFn();
        }, 260);
      }, wait);
    }

    // gate: fonts + data (with safety timeout)
    Promise.race([
      Promise.allSettled([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        window.__ssbData
      ]),
      new Promise(res => setTimeout(res, MAX))
    ]).then(finish);
    render();
    return promise;
  })();

  /* ════════════ Tehran live clock ════════════ */
  function initClock() {
    const el = document.getElementById('clock-time');
    const mo = document.getElementById('mo-date');
    const update = () => {
      el.textContent = window.SSB.tehranClock(new Date());
      if (mo) mo.textContent = window.SSB.faDateLong(new Date());
    };
    update();
    setInterval(update, 10000);
  }

  /* ════════════ segmented scroll progress ════════════ */
  function initProgress() {
    const segs = $$('#progress-bar i');
    let raf = null;
    const anchors = () => {
      const ids = ['home', 'homework', 'schedule-sec', 'announcements'];
      const tops = ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.offsetTop : 0;
      });
      const doc = document.documentElement;
      tops.push(doc.scrollHeight - window.innerHeight);
      return tops;
    };
    const update = () => {
      raf = null;
      const tops = anchors();
      const y = window.scrollY;
      segs.forEach((s, i) => {
        const a = tops[i], b = tops[i + 1] || (a + 1);
        const f = Math.max(0, Math.min(1, (y - a) / Math.max(1, b - a)));
        s.style.setProperty('--seg', f.toFixed(3));
      });
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ double-ring cursor (Laocoön) ════════════ */
  function initCursor() {
    if (REDUCED || !FINE) return;
    const ci = document.getElementById('cursor-i');
    const co = document.getElementById('cursor-o');
    let tx = -100, ty = -100, ox = -100, oy = -100, ix = -100, iy = -100, running = false;
    window.addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('mousedown', () => co.classList.add('press'));
    document.addEventListener('mouseup', () => co.classList.remove('press'));
    document.addEventListener('mouseover', e => {
      co.classList.toggle('big', !!e.target.closest('a,button,[role="button"],input,select,textarea,.hw-card'));
    });
    function loop() {
      ix += (tx - ix) * 0.55; iy += (ty - iy) * 0.55;   // inner snaps fast
      ox += (tx - ox) * 0.16; oy += (ty - oy) * 0.16;   // outer lerps
      ci.style.transform = `translate(${ix}px,${iy}px) translate(-50%,-50%)`;
      co.style.transform = `translate(${ox}px,${oy}px) translate(-50%,-50%)`;
      if (Math.abs(tx - ox) > 0.2 || Math.abs(ty - oy) > 0.2) requestAnimationFrame(loop);
      else running = false;
    }
  }

  /* ════════════ canvas FX: liquid waves + forge sparks ════════════ */
  function initCanvas() {
    const cv = document.getElementById('fx');
    let gl = null;
    try { gl = cv.getContext('webgl', { alpha: true, antialias: false, depth: false }); } catch (e) { }
    if (!gl) return fallback2D(cv);

    const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const FRAG = `
      precision mediump float;
      uniform vec2 u_res;uniform float u_t;uniform float u_s;uniform vec2 u_m;
      void main(){
        vec2 uv=gl_FragCoord.xy/u_res;
        vec2 p=uv;p.x*=u_res.x/u_res.y;
        p+=u_m*0.05;
        float t=u_t*0.32;
        float w1=sin(p.y*2.3+t*0.9+sin(p.x*1.6-t*0.55)*1.4);
        float w2=sin(p.y*4.2-t*0.7+sin(p.x*2.2+t*0.4)*1.1);
        float w3=sin(p.y*7.4+t*1.25+w1*1.7);
        float h=w1*0.55+w2*0.3+w3*0.15;
        vec3 c0=vec3(0.949,0.663,0.039);
        vec3 c1=vec3(0.133,0.769,0.839);
        vec3 c2=vec3(0.071,0.627,0.420);
        vec3 c3=vec3(0.878,0.204,0.235);
        float s=clamp(u_s,0.,1.)*3.0;
        float bi=floor(s);float f=smoothstep(0.,1.,fract(s));
        vec3 col=bi<1.?mix(c0,c1,f):(bi<2.?mix(c1,c2,f):mix(c2,c3,f));
        float fil=1.0-smoothstep(0.0,0.055,abs(h-0.12));
        float fil2=1.0-smoothstep(0.0,0.10,abs(h+0.48));
        float glow=0.10+0.52*fil+0.22*fil2;
        float fade=smoothstep(0.02,0.30,uv.y)*smoothstep(1.04,0.55,uv.y);
        gl_FragColor=vec4(col*glow*0.85,glow*fade*0.62);
      }`;
    const PVERT = `
      attribute float a_seed;
      uniform float u_t;uniform float u_resY;
      varying float v_a;varying vec3 v_c;
      void main(){
        float sp=0.5+fract(a_seed*13.7)*0.9;
        float y=fract(u_t*0.028*sp+a_seed);
        float x=fract(a_seed*7.31)+sin(u_t*0.6+a_seed*40.0)*0.045;
        vec2 pos=vec2(x*2.0-1.0,y*2.0-1.0);
        v_a=(1.0-smoothstep(0.75,1.0,y))*smoothstep(0.0,0.08,y)*0.85;
        float ci=fract(a_seed*3.17);
        v_c=ci<0.25?vec3(0.949,0.663,0.039):(ci<0.5?vec3(0.133,0.769,0.839):(ci<0.75?vec3(0.071,0.627,0.420):vec3(0.878,0.204,0.235)));
        gl_Position=vec4(pos,0.,1.);
        gl_PointSize=(1.4+fract(a_seed*5.7)*2.6)*(u_resY/700.0);
      }`;
    const PFRAG = `
      precision mediump float;varying float v_a;varying vec3 v_c;
      void main(){
        vec2 d=gl_PointCoord-vec2(0.5);
        float m=1.0-smoothstep(0.15,0.5,length(d));
        gl_FragColor=vec4(v_c,m*v_a);
      }`;

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    function prog(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    }

    const quadP = prog(VERT, FRAG);
    const ptsP = prog(PVERT, PFRAG);
    if (!quadP) return fallback2D(cv);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const N = (window.innerWidth < 640 ? 70 : 150);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = Math.random() * 100;
    const seedBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    const u = {
      res: gl.getUniformLocation(quadP, 'u_res'),
      t: gl.getUniformLocation(quadP, 'u_t'),
      s: gl.getUniformLocation(quadP, 'u_s'),
      m: gl.getUniformLocation(quadP, 'u_m')
    };
    const pu = {
      t: gl.getUniformLocation(ptsP, 'u_t'),
      resY: gl.getUniformLocation(ptsP, 'u_resY'),
      seed: gl.getAttribLocation(ptsP, 'a_seed')
    };

    let dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.25 : 1.5);
      cv.width = Math.floor(innerWidth * dpr);
      cv.height = Math.floor(innerHeight * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let scroll = 0;
    window.addEventListener('scroll', () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - innerHeight;
      scroll = max > 0 ? window.scrollY / max : 0;
    }, { passive: true });

    let mx = 0, my = 0, smx = 0, smy = 0;
    if (FINE) window.addEventListener('mousemove', e => {
      mx = e.clientX / innerWidth - 0.5;
      my = -(e.clientY / innerHeight - 0.5);
    }, { passive: true });

    let hidden = false;
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
    const t0 = performance.now();

    function frame(now) {
      if (!hidden) {
        const t = (now - t0) / 1000;
        smx += (mx - smx) * 0.04; smy += (my - smy) * 0.04;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // waves
        gl.useProgram(quadP);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        const la = gl.getAttribLocation(quadP, 'a');
        gl.enableVertexAttribArray(la);
        gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(u.res, cv.width, cv.height);
        gl.uniform1f(u.t, t);
        gl.uniform1f(u.s, scroll);
        gl.uniform2f(u.m, smx, smy);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // sparks (additive)
        gl.useProgram(ptsP);
        gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
        gl.enableVertexAttribArray(pu.seed);
        gl.vertexAttribPointer(pu.seed, 1, gl.FLOAT, false, 0, 0);
        gl.uniform1f(pu.t, t);
        gl.uniform1f(pu.resY, cv.height);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, N);
      }
      requestAnimationFrame(frame);
    }

    if (REDUCED) {
      // static single frame
      gl.useProgram(quadP);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const la = gl.getAttribLocation(quadP, 'a');
      gl.enableVertexAttribArray(la);
      gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(u.res, cv.width, cv.height);
      gl.uniform1f(u.t, 1.5); gl.uniform1f(u.s, 0); gl.uniform2f(u.m, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      requestAnimationFrame(frame);
    }
  }

  function fallback2D(cv) {
    const ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }
    function draw(t) {
      const w = cv.width = innerWidth, h = cv.height = innerHeight;
      ctx.clearRect(0, 0, w, h);
      const cols = ['#F2A90A', '#22C4D6', '#12A06B', '#E0343C'];
      cols.forEach((c, i) => {
        const y = h * (0.3 + 0.16 * i) + Math.sin(t / 1400 + i * 1.7) * 22;
        const grd = ctx.createLinearGradient(0, y - 90, 0, y + 90);
        grd.addColorStop(0, 'transparent');
        grd.addColorStop(0.5, c + '26');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, y - 90, w, 180);
      });
    }
    if (!REDUCED) {
      (function loop(t) { draw(t || 0); requestAnimationFrame(loop); })();
    } else draw(0);
  }

  /* ════════════ spring reveals ════════════ */
  function initSprings() {
    const els = $$('[data-spring]');
    if (REDUCED) { els.forEach(el => el.classList.add('sprung')); return; }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.dataset.delay) el.style.setProperty('--dly', el.dataset.delay + 'ms');
        el.classList.add('sprung');
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    els.forEach(el => obs.observe(el));
  }

  /* ════════════ word/letter split + blur-up ════════════ */
  function splitAll(root) {
    $$('[data-split]', root || document).forEach(el => {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = '1';
      const mode = el.getAttribute('data-split');
      const txt = el.textContent.trim();
      el.textContent = '';
      const parts = mode === 'latin' ? Array.from(txt) : txt.split(/\s+/);
      parts.forEach((p, i) => {
        let node;
        if (mode !== 'latin' && p.includes('صدر')) {
          node = document.createElement('em');
          node.className = 'ht-mark';
          node.textContent = p;
        } else {
          node = document.createElement('span');
          node.textContent = p;
        }
        node.className += ' w';
        node.style.setProperty('--wd', (i * (mode === 'latin' ? 26 : 65)) + 'ms');
        el.appendChild(node);
        if (mode !== 'latin') el.appendChild(document.createTextNode(' '));
      });
    });
  }

  function initSplitReveals(root) {
    splitAll(root);
    const els = $$('[data-split]', root || document).filter(el => !el.dataset.splitObs);
    els.forEach(el => el.dataset.splitObs = '1');
    if (REDUCED) { els.forEach(el => el.classList.add('split-on')); return; }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('split-on');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.3 });
    els.forEach(el => obs.observe(el));
  }

  /* assemble Persian dates word-by-word */
  function initAssemble(root) {
    $$('[data-assemble]', root || document).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      const txt = el.getAttribute('data-assemble');
      el.setAttribute('data-split', 'words');
      el.textContent = txt;
    });
    splitAll(root);
    const els = $$('[data-assemble][data-split]', root || document).filter(el => !el.dataset.splitObs);
    els.forEach(el => {
      el.dataset.splitObs = '1';
      if (REDUCED) { el.classList.add('split-on'); return; }
      const obs = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          en.target.classList.add('split-on');
          obs.unobserve(en.target);
        });
      }, { threshold: 0.5 });
      obs.observe(el);
    });
  }

  /* ════════════ counters ════════════ */
  function initCounters() {
    const els = $$('.count');
    if (!els.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        obs.unobserve(el);
        const target = +el.dataset.count || 0;
        if (REDUCED || target === 0) { el.textContent = faNum(target); return; }
        const t0 = performance.now(), dur = 1100;
        const step = now => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = faNum(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach(el => obs.observe(el));
  }

  /* ════════════ cinema slides (scroll-driven) ════════════ */
  function initCinema() {
    const strip = document.getElementById('cinema');
    const slides = $$('.cslide', strip);
    if (!strip || !slides.length) return;
    let raf = null;
    const update = () => {
      raf = null;
      const rect = strip.getBoundingClientRect();
      const total = rect.height - innerHeight;
      const p = Math.max(0, Math.min(1, -rect.top / Math.max(1, total)));
      const idx = Math.min(slides.length - 1, Math.floor(p * slides.length));
      slides.forEach((s, i) => {
        const on = i === idx;
        const passed = i < idx;
        s.classList.toggle('is-on', on);
        s.classList.toggle('is-out', passed);
        if (on) s.classList.add('split-on'); // retrigger words if not yet
      });
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ sticky stack: covered panel recedes (KIMI) ════════════ */
  function initStack() {
    const panels = $$('.stack .panel');
    if (panels.length < 2) return;
    let raf = null;
    const update = () => {
      raf = null;
      const vh = innerHeight;
      for (let i = 0; i < panels.length - 1; i++) {
        const next = panels[i + 1].getBoundingClientRect();
        const p = Math.max(0, Math.min(1, 1 - next.top / vh));
        const el = panels[i];
        if (p <= 0) { el.style.transform = ''; el.style.filter = ''; continue; }
        const e = p * p * (3 - 2 * p); // smoothstep
        el.style.transform = `scale(${(1 - 0.09 * e).toFixed(4)})`;
        el.style.filter = `brightness(${(1 - 0.42 * e).toFixed(3)})`;
        el.style.transformOrigin = 'top center';
      }
      // checker seam on first panel
      const first = panels[0];
      const seam = first.querySelector('.checker-seam');
      if (seam) {
        const r = first.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.6)));
        seam.style.setProperty('--seam-s', (1 - 0.25 * p).toFixed(3));
        seam.style.opacity = (0.9 * (1 - p * 0.5)).toFixed(3);
      }
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ weekly circuit lap (KIMI) ════════════ */
  function initCircuit() {
    const box = document.getElementById('circuit-box');
    const track = document.getElementById('circuit-track');
    const base = document.getElementById('circuit-base');
    const head = document.getElementById('circuit-head');
    const glow = document.getElementById('circuit-head-glow');
    const hint = document.querySelector('.circuit-hint');
    if (!box || !track || !base || typeof base.getTotalLength !== 'function') return;

    const L = base.getTotalLength();
    track.style.strokeDasharray = String(L);
    track.style.strokeDashoffset = String(L);
    const fr = [0.035, 0.21, 0.40, 0.575, 0.765, 0.94];

    const run = () => {
      if (REDUCED) {
        track.style.strokeDashoffset = '0';
        $$('.day-marker').forEach(m => m.classList.add('lit'));
        if (hint) hint.classList.add('off');
        return;
      }
      const DUR = 6000;
      const t0 = performance.now();
      const litSet = new Set();
      const ease = t => 0.5 - 0.5 * Math.cos(Math.PI * t); // gentle braking feel
      function step(now) {
        const p = Math.min(1, (now - t0) / DUR);
        const e = ease(p);
        track.style.strokeDashoffset = String(L * (1 - e));
        const pt = base.getPointAtLength(L * e);
        head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
        glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y);
        head.style.opacity = glow.style.opacity = p < 1 ? '1' : '0';
        fr.forEach((f, i) => {
          if (e >= f && !litSet.has(i)) {
            litSet.add(i);
            const m = document.querySelector(`.day-marker[data-day="${i}"]`);
            if (m) m.classList.add('lit');
          }
        });
        if (p < 1) requestAnimationFrame(step);
        else {
          if (hint) hint.classList.add('off');
          idle();
        }
      }
      function idle() {
        let t0i = performance.now();
        function spin(now) {
          const e = ((now - t0i) / 17000) % 1;
          const pt = base.getPointAtLength(L * e);
          head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
          glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y);
          head.style.opacity = glow.style.opacity = '0.85';
          requestAnimationFrame(spin);
        }
        requestAnimationFrame(spin);
      }
      requestAnimationFrame(step);
    };

    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        obs.disconnect();
        setTimeout(run, 350);
      });
    }, { threshold: 0.45 });
    obs.observe(box);

    /* reticle (desktop) */
    if (FINE) {
      const rv = box.querySelector('.rv'), rh = box.querySelector('.rh'), rc = box.querySelector('.rc');
      box.addEventListener('mousemove', e => {
        const r = box.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        rv.style.left = x + 'px'; rh.style.top = y + 'px';
        rc.style.left = x + 'px'; rc.style.top = y + 'px';
      }, { passive: true });
    }
  }

  /* ════════════ hero parallax ════════════ */
  function initParallax() {
    if (REDUCED || !FINE) return;
    const art = document.querySelector('.hero-art');
    const crest = document.getElementById('hero-crest');
    const chips = $$('.chip');
    if (!art) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    window.addEventListener('mousemove', e => {
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
      if (!raf) loop();
    }, { passive: true });
    function loop() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      if (crest) crest.style.translate = `${cx * -18}px ${cy * -14}px`;
      art.style.rotate = (cx * 1.6) + 'deg';
      chips.forEach((b, i) => { b.style.translate = `${cx * (14 + i * 8)}px ${cy * (12 + i * 6)}px`; });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
      else raf = null;
    }
  }

  /* ════════════ magnetic + ripple ════════════ */
  function initButtons() {
    if (!FINE) return;
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.18}px,${y * 0.22 - 2}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }
  function initRipple() {
    $$('.btn').forEach(btn => {
      btn.addEventListener('click', e => {
        if (REDUCED) return;
        const r = btn.getBoundingClientRect();
        const d = Math.max(r.width, r.height);
        const sp = document.createElement('span');
        sp.className = 'ripple';
        sp.style.width = sp.style.height = d + 'px';
        sp.style.left = (e.clientX - r.left - d / 2) + 'px';
        sp.style.top = (e.clientY - r.top - d / 2) + 'px';
        btn.appendChild(sp);
        setTimeout(() => sp.remove(), 650);
      });
    });
  }

  /* ════════════ menu overlay ════════════ */
  function initMenu() {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu-overlay');
    const set = open => {
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', !open);
      btn.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        splitAll(menu);
        $$('.mo-nav b', menu).forEach((el, i) => {
          el.style.transitionDelay = (0.18 + i * 0.07) + 's';
          el.classList.add('split-on');
        });
      } else {
        $$('.mo-nav b', menu).forEach(el => {
          el.classList.remove('split-on');
          el.style.transitionDelay = '0s';
        });
      }
    };
    btn.addEventListener('click', () => set(!menu.classList.contains('open')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) set(false); });
  }

  /* ════════════ nav state ════════════ */
  function initNav() {
    const nav = document.getElementById('site-nav');
    const links = $$('.nav-links a');
    const bnItems = $$('.bn-item');
    let raf = null;
    const onScroll = () => {
      raf = null;
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
    onScroll();
    const map = { home: 'home', homework: 'homework', 'schedule-sec': 'schedule-sec', announcements: 'announcements', subjects: 'subjects', vip: 'vip', about: 'about', contact: 'about' };
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = map[en.target.id] || en.target.id;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
        bnItems.forEach(a => a.classList.toggle('is-active', a.dataset.bn === id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['home', 'homework', 'schedule-sec', 'announcements', 'subjects', 'vip', 'about', 'contact'].forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* ════════════ toast ════════════ */
  let toastT = null;
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 350); }, ms || 3200);
  }

  /* ════════════ VIP crypto gate (unchanged contract) ════════════ */
  const VIP = (() => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const hexToBuf = hex => new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const bufToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    function ctEqual(a, b) {
      if (a.length !== b.length) return false;
      let r = 0;
      for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return r === 0;
    }
    async function deriveBits(password, saltHex, iterations) {
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBuf(saltHex), iterations }, key, 256);
    }
    async function verify(password, vip) {
      const bits = await deriveBits(password, vip.salt, vip.iterations || 150000);
      return ctEqual(bufToHex(bits), (vip.hash || '').toLowerCase());
    }
    async function deriveKey(password, saltHex, iterations) {
      const bits = await deriveBits(password, saltHex, iterations);
      return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt', 'encrypt']);
    }
    async function openVault(password, vip) {
      if (!(vip && vip.enc && vip.enc.iv && vip.enc.data)) {
        return { ok: true, empty: true, links: [] };
      }
      const key = await deriveKey(password, vip.salt, vip.iterations || 150000);
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuf(vip.enc.iv) },
        key,
        hexToBuf(vip.enc.data)
      );
      return { ok: true, links: JSON.parse(dec.decode(plain)), key };
    }
    function remember(key) {
      try { sessionStorage.setItem('ssb_vip_key', JSON.stringify(Array.from(new Uint8Array(key)))); } catch (e) { }
    }
    async function recall(vip) {
      try {
        const raw = sessionStorage.getItem('ssb_vip_key');
        if (!raw) return null;
        const bytes = new Uint8Array(JSON.parse(raw));
        const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBuf(vip.enc.iv) }, key, hexToBuf(vip.enc.data));
        return { links: JSON.parse(dec.decode(plain)), key };
      } catch (e) { sessionStorage.removeItem('ssb_vip_key'); return null; }
    }
    return { verify, openVault, remember, recall };
  })();

  function renderVipLinks(links) {
    const box = document.getElementById('vip-links');
    if (!links || !links.length) {
      box.innerHTML = '<div class="vip-hello">فعلاً چیزی این‌جا نیست — به‌زودی سورپرایزهای ویژه اضافه می‌شه!</div>';
      return;
    }
    box.innerHTML = links.map(l => {
      const url = sanitizeUrl(l.url);
      if (!url) return '';
      return `<a class="vip-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
        <b>${esc(l.title)}</b>
        ${l.note ? `<span>${esc(l.note)}</span>` : ''}
        <i><svg viewBox="0 0 24 24"><path d="M15 5h4v4M19 5l-7 7"/><path d="M17 13v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H11"/></svg>مشاهده</i>
      </a>`;
    }).join('');
  }

  function initVip() {
    const modal = document.getElementById('vip-modal');
    const openBtn = document.getElementById('vip-open');
    const lockBtn = document.getElementById('vip-lock-btn');
    const form = document.getElementById('vip-form');
    const pass = document.getElementById('vip-pass');
    const msg = document.getElementById('vip-msg');
    const locked = document.getElementById('vip-locked');
    const unlocked = document.getElementById('vip-unlocked');
    const submit = document.getElementById('vip-submit');
    if (!openBtn) return;
    const data = state.data;
    const vip = data.vip || {};
    let attempts = 0, waitUntil = 0;

    if (!vip.enabled) {
      document.getElementById('vip-desc').textContent = 'بخش ویژه به‌زودی با سورپرایزهای صدر باز می‌شه — حواست به اعلان‌ها باشه!';
      openBtn.textContent = 'فعلاً بسته‌ست!';
      openBtn.addEventListener('click', () => toast('بخش ویژه هنوز باز نشده — به‌زودی!'));
      return;
    }

    const showUnlocked = links => {
      locked.hidden = true;
      unlocked.hidden = false;
      renderVipLinks(links);
    };

    VIP.recall(vip).then(r => { if (r) showUnlocked(r.links); }).catch(() => { });

    openBtn.addEventListener('click', () => {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => pass.focus(), 60);
    });
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
    function closeModal() {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      msg.hidden = true;
    }

    lockBtn.addEventListener('click', () => {
      sessionStorage.removeItem('ssb_vip_key');
      unlocked.hidden = true;
      locked.hidden = false;
      toast('بخش ویژه قفل شد. می‌بینمت!');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.hidden = true;
      const val = pass.value;
      if (!val) return;
      if (Date.now() < waitUntil) {
        const s = Math.ceil((waitUntil - Date.now()) / 1000);
        showMsg('err', 'یه کم عجله کردی! ' + faNum(s) + ' ثانیه صبر کن و دوباره امتحان کن.');
        return;
      }
      submit.disabled = true;
      submit.textContent = 'در حال بررسی…';
      try {
        const ok = await VIP.verify(val, vip);
        if (!ok) {
          attempts++;
          if (attempts >= 4) {
            waitUntil = Date.now() + 45000;
            attempts = 0;
            showMsg('err', 'چند بار اشتباه شد! یه جای امن بشین، ۴۵ ثانیه فکر کن و برگرد. راستی، رمز رو از مدیر بگیر.');
          } else {
            showMsg('err', 'رمز درست نیست! شاید یه حرفش از قلم افتاد — دوباره امتحان کن، یا برو از مدیر بپرس، شاید با یه بستنی راضیت کرد.');
          }
          pass.value = '';
          pass.focus();
          return;
        }
        const vault = await VIP.openVault(val, vip);
        if (vault.key) VIP.remember(vault.key);
        showUnlocked(vault.links);
        closeModal();
        toast('خوش اومدی! بخش ویژه باز شد.');
      } catch (err) {
        showMsg('err', 'رمز درست نیست یا داده‌ی ویژه در دسترس نیست. دوباره امتحان کن.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'ورود';
      }
    });

    function showMsg(kind, text) {
      msg.className = 'vip-msg ' + kind;
      msg.textContent = text;
      msg.hidden = false;
    }
  }

  /* ════════════ boot ════════════ */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('load', () => window.scrollTo(0, 0));

  async function boot() {
    window.scrollTo(0, 0);
    initClock();
    const dataPromise = loadData()
      .catch(err => {
        console.error('SSB data error:', err);
        const hw = document.getElementById('hw-list');
        if (hw) hw.innerHTML =
          '<div class="empty"><b>مخاطب عزیز، داده‌ها الان در دسترس نیستن.</b><span>اتصال اینترنتت رو چک کن و صفحه رو رفرش کن.</span></div>';
        return null;
      });
    window.__ssbData = dataPromise;

    const data = await dataPromise;
    if (data) {
      renderAll();
      initVip();
    }
    initEvents();

    await loaderDone;               // cinematic veil lifts first
    initCanvas();
    initSprings();
    initSplitReveals();
    initAssemble();
    initCounters();
    initCinema();
    initStack();
    initCircuit();
    initProgress();
    initNav();
    initMenu();
    initParallax();
    initButtons();
    initRipple();
    initCursor();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SSB.ui = { toast };
})();
