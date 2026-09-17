// ══════ 3D visualizations — Three.js Kaaba + vertical Sa'i (Safa↓ Marwa↑) ══════

let tawafRig = null;

export function initTawafScene(container) {
  if (!container || tawafRig) return;
  const wait = setInterval(() => {
    if (window.THREE) { clearInterval(wait); build(window.THREE, container); }
  }, 60);
  setTimeout(() => clearInterval(wait), 8000);
}

function build(THREE, container) {
  const scene = new THREE.Scene();
  scene.background = null;

  const W = () => container.clientWidth  || 340;
  const H = () => container.clientHeight || 260;

  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.5, 500);

  // Orbit-around-Kaaba: theta = azimuth, phi = polar from +Y (0 = top-down)
  const cam = { theta: Math.PI * 0.30, phi: Math.PI * 0.36, dist: 92 };
  const target = new THREE.Vector3(0, 8, 0);
  function placeCamera() {
    camera.position.x = target.x + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta);
    camera.position.y = target.y + cam.dist * Math.cos(cam.phi);
    camera.position.z = target.z + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta);
    camera.lookAt(target);
  }
  placeCamera();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W(), H());
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2d8, 0.9);
  sun.position.set(35, 70, 25);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x88ffcc, 0.22);
  rim.position.set(-30, 20, -20);
  scene.add(rim);

  // ── Mataf marble floor + wider polished plinth ──
  const floorGeo = new THREE.CylinderGeometry(50, 50, 1.2, 48);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xece2c9, roughness: 0.7 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.6;
  scene.add(floor);

  const plinthGeo = new THREE.BoxGeometry(38, 3, 38);
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xfaf5e8, roughness: 0.4 });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 2.4;
  scene.add(plinth);

  // ── Kaaba body (black kiswa) ──
  // Convention: +X = east (right), +Z = south (forward toward camera default), +Y = up
  // Corner assignments (top of Kaaba, y=27), chosen so real bearings map to nearest axis corners:
  //   Black Stone (BS, real 112°) at (+15, y, +15) — front-right, visible from default camera
  //   Iraqi        (real 22°)     at (+15, y, -15) — back-right
  //   Yemeni       (real 202°)    at (-15, y, +15) — front-left
  //   Shami        (real 292°)    at (-15, y, -15) — back-left
  // Walls:
  //   +X wall (from Iraqi to BS)   → DOOR here (visible from default camera)
  //   -Z wall (from Shami to Iraqi) → HIJR ISMAIL + MIZAB here (behind, user rotates to see)
  //   +Z wall (front)              → plain (Multazam area near BS)
  //   -X wall (left)               → plain
  const kaabaGeo = new THREE.BoxGeometry(30, 24, 30);
  const kaabaMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.92 });
  const kaaba = new THREE.Mesh(kaabaGeo, kaabaMat);
  kaaba.position.y = 15.5;
  scene.add(kaaba);

  // Upper gold embroidery band (real hizam of the kiswa)
  const bandGeo = new THREE.BoxGeometry(30.4, 2.4, 30.4);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24d, roughness: 0.32, metalness: 0.7,
  });
  const band = new THREE.Mesh(bandGeo, goldMat);
  band.position.y = 22.5;
  scene.add(band);

  // Lower stone base ring (shadharwan)
  const shadharGeo = new THREE.BoxGeometry(30.6, 1.8, 30.6);
  const shadharMat = new THREE.MeshStandardMaterial({ color: 0x5c4327, roughness: 0.75 });
  const shadhar = new THREE.Mesh(shadharGeo, shadharMat);
  shadhar.position.y = 4.5;
  scene.add(shadhar);

  // ── Kaaba door (ornate, on +X wall offset toward BS corner) ──
  // Real Kaaba door is elevated ~2m above ground, made of solid gold, ~3m x 3.2m.
  // Layered construction: outer bronze frame + middle gold frame + bright gold surface
  // + vertical divider (double-door effect) + horizontal decorative bands.
  const doorX = 15.25;
  const doorZ = 7;
  const doorBottom = 8, doorTop = 18;
  const doorMid = (doorBottom + doorTop) / 2;
  const doorH = doorTop - doorBottom;

  // Outer dark bronze frame (heaviest, defines the portal)
  const outerFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, doorH + 1.6, 7.4),
    new THREE.MeshStandardMaterial({ color: 0x4a3814, metalness: 0.65, roughness: 0.45 }),
  );
  outerFrame.position.set(doorX - 0.1, doorMid, doorZ);
  scene.add(outerFrame);

  // Middle golden frame
  const midFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, doorH + 0.6, 6.4),
    new THREE.MeshStandardMaterial({ color: 0xa07920, metalness: 0.78, roughness: 0.28 }),
  );
  midFrame.position.set(doorX + 0.03, doorMid, doorZ);
  scene.add(midFrame);

  // Bright gold door surface
  const doorSurface = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, doorH, 5.3),
    new THREE.MeshStandardMaterial({ color: 0xf5c952, metalness: 0.9, roughness: 0.15 }),
  );
  doorSurface.position.set(doorX + 0.16, doorMid, doorZ);
  scene.add(doorSurface);

  // Vertical divider (creates the double-door illusion)
  const doorDivider = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, doorH - 1.4, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x6b4a1c, metalness: 0.7 }),
  );
  doorDivider.position.set(doorX + 0.28, doorMid, doorZ);
  scene.add(doorDivider);

  // Three horizontal decorative bands (top / middle / bottom panels)
  [1.5, doorH / 2, doorH - 1.5].forEach(offset => {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x8b6f2a, metalness: 0.75, roughness: 0.3 }),
    );
    band.position.set(doorX + 0.28, doorBottom + offset, doorZ);
    scene.add(band);
  });

  // ── Black Stone (الحجر الأسود) — silver-framed dark stone at BS corner ──
  // Set at chest height (~1.5m real → ~6 units here) at the +X/+Z corner.
  // Larger + brighter silver so it's clearly visible from the camera.
  const bsGroup = new THREE.Group();

  // Outer decorative bezel (thicker silver ring — the shrine frame)
  const bsBezel = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.15, 32),
    new THREE.MeshStandardMaterial({
      color: 0xbcbcc4, metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide,
    }),
  );
  bsBezel.position.z = -0.06;
  bsGroup.add(bsBezel);

  // Bright silver inner frame
  const bsRing = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.7, 32),
    new THREE.MeshStandardMaterial({
      color: 0xefefff, metalness: 0.95, roughness: 0.12, side: THREE.DoubleSide,
    }),
  );
  bsGroup.add(bsRing);

  // The dark stone disc (slightly inset, subtle sheen)
  const bsStone = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 32),
    new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, roughness: 0.35, metalness: 0.45,
    }),
  );
  bsStone.position.z = 0.04;
  bsGroup.add(bsStone);

  // Position at BS corner, chest height, facing OUTWARD along +X/+Z bisector
  const bisectorLen = 0.7;
  bsGroup.position.set(
    15 + bisectorLen * Math.SQRT1_2,
    6.5,
    15 + bisectorLen * Math.SQRT1_2,
  );
  bsGroup.rotation.y = -Math.PI / 4;  // face along +X/+Z direction (corner bisector)
  scene.add(bsGroup);

  // ── Mizab (gold spout on top of Kaaba, above where the Hijr side would be) ──
  // Kept because it's part of the Kaaba itself.
  const mizabGeo = new THREE.CylinderGeometry(0.9, 0.6, 7, 12);
  const mizab = new THREE.Mesh(mizabGeo, goldMat);
  mizab.position.set(0, 24.2, -18);
  mizab.rotation.x = -Math.PI / 2.5;  // tilt outward toward -Z, slightly downward
  scene.add(mizab);

  // ── User tracking dot (green sphere orbiting by GPS bearing) ──
  const dotGeo = new THREE.SphereGeometry(1.6, 20, 20);
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0x34d399, emissive: 0x1a8f66, emissiveIntensity: 0.8, roughness: 0.3,
  });
  const userDot = new THREE.Mesh(dotGeo, dotMat);
  userDot.visible = false;
  scene.add(userDot);

  // Flat halo ring on the floor under the dot
  const haloGeo = new THREE.RingGeometry(2.4, 3.2, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x34d399, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  scene.add(halo);

  // ── HTML corner labels — pinned to top-outer corners of the Kaaba ──
  // These 3D world positions correspond to just above and OUTSIDE each Kaaba
  // corner, so labels don't overlap the cube itself.
  const labelHost = document.createElement('div');
  labelHost.className = 'viz3d__labels';
  container.appendChild(labelHost);

  const labels = [
    // Black Stone label — LOWERED to actual stone height (chest level), NOT at the top corner
    { key: 'blackstone', text: 'الحجر الأسود',  pos: new THREE.Vector3(  19.5,  6, 19.5), anchor: new THREE.Vector3(  15.5, 6, 15.5) },
    // 3 other corners — still at top of Kaaba (they're just named corner points)
    { key: 'iraqi',      text: 'الركن العراقي',  pos: new THREE.Vector3(  17.5, 27.5, -17.5), anchor: new THREE.Vector3(  15, 27, -15) },
    { key: 'yemeni',     text: 'الركن اليماني',  pos: new THREE.Vector3( -17.5, 27.5,  17.5), anchor: new THREE.Vector3( -15, 27,  15) },
    { key: 'shami',      text: 'الركن الشامي',   pos: new THREE.Vector3( -17.5, 27.5, -17.5), anchor: new THREE.Vector3( -15, 27, -15) },
    // Door — on the +X wall, points to the elevated golden door
    { key: 'door',       text: 'باب الكعبة',      pos: new THREE.Vector3(  19,   19,    7   ), anchor: new THREE.Vector3(  15.5, 13,   7) },
    // Mizab — top of -Z wall (Hijr side)
    { key: 'mizab',      text: 'الميزاب',         pos: new THREE.Vector3(   0,   27,  -21   ), anchor: new THREE.Vector3(   0, 24, -18) },
  ];
  labels.forEach(l => {
    const el = document.createElement('div');
    el.className = `viz3d__label viz3d__label--${l.key}`;
    el.textContent = l.text;
    labelHost.appendChild(el);
    l.el = el;
  });

  // Info readout + hint
  const info = document.createElement('div');
  info.className = 'viz3d__info';
  info.id = 'viz-tawaf-info';
  info.textContent = 'جاري تحديد الموقع…';
  container.appendChild(info);

  const hint = document.createElement('div');
  hint.className = 'viz3d__hint';
  hint.textContent = '↔️ اسحب لتدوير الكعبة';
  container.appendChild(hint);
  setTimeout(() => hint.classList.add('fade-out'), 4200);
  setTimeout(() => hint.remove(), 5400);

  // ── Touch / mouse orbit — vertical INVERTED (swipe down → look from above) ──
  let dragging = false, lastX = 0, lastY = 0;
  const surface = renderer.domElement;

  const onStart = (e) => {
    dragging = true;
    const t = e.touches ? e.touches[0] : e;
    lastX = t.clientX;
    lastY = t.clientY;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - lastX;
    const dy = t.clientY - lastY;
    cam.theta -= dx * 0.0085;
    // INVERTED: dy > 0 (swipe down) → phi decreases → camera moves overhead (looks DOWN at top of Kaaba)
    cam.phi = Math.max(0.05, Math.min(Math.PI / 2 + 0.35, cam.phi - dy * 0.0085));
    placeCamera();
    lastX = t.clientX;
    lastY = t.clientY;
    if (e.cancelable) e.preventDefault();
  };
  const onEnd = () => { dragging = false; };

  surface.addEventListener('touchstart', onStart, { passive: true });
  surface.addEventListener('touchmove',  onMove,  { passive: false });
  surface.addEventListener('touchend',   onEnd);
  surface.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onEnd);

  // ── Resize ──
  const resize = () => {
    const w = W(), h = H();
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  new ResizeObserver(resize).observe(container);
  window.addEventListener('resize', resize);

  // ── Label projection + occlusion fade ──
  const kaabaCenter = new THREE.Vector3(0, 15, 0);
  let rectCache = null, rectExpires = 0;
  function projectLabels() {
    const now = performance.now();
    if (!rectCache || now > rectExpires) {
      rectCache = container.getBoundingClientRect();
      rectExpires = now + 250;
    }
    const rw = rectCache.width, rh = rectCache.height;
    const camDir = camera.position.clone().sub(kaabaCenter).normalize();

    labels.forEach(l => {
      const p = l.pos.clone().project(camera);
      const outFrustum = p.z >= 1 || p.z <= -1;
      const x = (p.x + 1) * 0.5 * rw;
      const y = (-p.y + 1) * 0.5 * rh;
      l.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

      // Occlusion: is the corner on the far side of the Kaaba from the camera?
      const cornerDir = l.anchor.clone().sub(kaabaCenter).normalize();
      const dot = cornerDir.dot(camDir);
      // dot ≈ 1 → corner faces camera; dot ≈ -1 → hidden behind Kaaba
      let opacity;
      if (outFrustum)      opacity = 0;
      else if (dot > 0.15) opacity = 1;
      else if (dot > -0.2) opacity = 0.35;   // partially visible / edge
      else                 opacity = 0.08;   // fully occluded — fade out
      l.el.style.opacity = String(opacity);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    projectLabels();
  }
  animate();

  tawafRig = {
    updateUser(bearing, distanceM) {
      if (bearing == null) {
        userDot.visible = false;
        halo.visible = false;
        info.textContent = 'خارج نطاق المطاف';
        return;
      }
      userDot.visible = true;
      halo.visible = true;
      // Bearing 0 (N) → -Z direction. bearing 90 (E) → +X. bearing 180 (S) → +Z.
      const rad = (bearing * Math.PI) / 180;
      const r = 22 + Math.min(16, distanceM / 3);
      const x = r * Math.sin(rad);
      const z = -r * Math.cos(rad);
      userDot.position.set(x, 6, z);
      halo.position.set(x, 3.6, z);
      info.textContent = `${Math.round(distanceM)}م من الكعبة`;
    },
  };

  resize();
}

export function updateTawafViz(bearing, distanceM) {
  if (tawafRig) tawafRig.updateUser(bearing, distanceM);
}

// ══════ SA'I — vertical layout, Safa at BOTTOM, Marwa at TOP ══════
// Walker starts at Safa (bottom, pct=0) and moves UP toward Marwa (pct=100%).
export function updateSaiViz({ pctFromSafa, target, inGreenZone, isMale }) {
  const walker = document.getElementById('viz-sai-walker');
  const path   = document.getElementById('viz-sai-path');
  const green  = document.getElementById('viz-sai-green');
  const info   = document.getElementById('viz-sai-info');
  if (!walker) return;

  const clamped = Math.max(0, Math.min(1, pctFromSafa || 0));
  // In v2.4 layout, Safa is at the BOTTOM of the path. pct=0 → bottom, pct=1 → top.
  // Use `bottom` CSS property so pct maps naturally: bottom:0% = Safa, bottom:100% = Marwa.
  walker.style.setProperty('--pct', (clamped * 100) + '%');

  // Walker faces direction of travel
  walker.classList.toggle('facing-marwa', target === 'MARWA');   // going up
  walker.classList.toggle('facing-safa',  target === 'SAFA');    // going down

  const showHaraula = inGreenZone && isMale;
  if (path)  path.classList.toggle('haraula', showHaraula);
  if (green) green.classList.toggle('active', inGreenZone);

  if (info) {
    if (showHaraula)      info.textContent = '🏃 منطقة الهرولة — أسرِع الخُطى';
    else if (inGreenZone) info.textContent = 'أنت بين الميلين الأخضرين';
    else if (target)      info.textContent = `تتوجّه إلى ${target === 'SAFA' ? 'الصفا ↓' : 'المروة ↑'}`;
    else                  info.textContent = '';
  }
}
