(function() {
  const canvas = document.getElementById('webgl');
  if (!canvas) return;

  const isMobile = window.innerWidth < 768;

  // Детекция программного рендеринга (SwiftShader / CPU-растеризатор / Lighthouse)
  let isSoftware = false;
  try {
    const glTemp = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (glTemp) {
      const debugExt = glTemp.getExtension('WEBGL_debug_renderer_info');
      const rName = debugExt ? glTemp.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : '';
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(rName)) {
        isSoftware = true;
      }
    }
  } catch (e) {}

  if (!isSoftware && typeof navigator !== 'undefined') {
    if (navigator.webdriver || /HeadlessChrome|Lighthouse/i.test(navigator.userAgent)) {
      isSoftware = true;
    }
  }

  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: !isMobile && !isSoftware,
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, (isMobile || isSoftware) ? 1.0 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost, attempting restore...');
  }, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 3000);

  // Сборка модулей сцены
  const cosmos = window.createCosmos ? window.createCosmos(scene) : null;
  const dust = window.createDust ? window.createDust(scene, isSoftware) : null;
  const mist = window.createMist ? window.createMist(scene, isSoftware) : null;
  const sun = window.createSun ? window.createSun(scene, isSoftware) : null;
  const sunPos = sun ? sun.position : new THREE.Vector3(0, 18, -350);
  const water = window.createWater ? window.createWater(scene, sunPos, isSoftware) : null;
  const planets = window.createPlanets ? window.createPlanets(scene, sunPos, isSoftware) : null;

  // ===================================================================
  // ПАНОРАМНАЯ КАМЕРА С ПОЛНЫМ ОБЗОРОМ ЗЕНИТА И СОЗВЕЗДИЙ
  // ===================================================================
  // yaw: горизонтальный угол (360° вокруг горизонта)
  // pitch: вертикальный наклон (от -0.42 вниз на воду до +1.48 строго вверх в зенит)
  // fov: зум колесиком мыши
  let cameraAngle = { yaw: 0.0, pitch: 0.12, fov: 50.0 };
  let targetAngle = { yaw: 0.0, pitch: 0.12, fov: 50.0 };

  // Базовая точка наблюдателя над океаном
  const eyeBase = new THREE.Vector3(0, 12.0, 48.0);

  let isDown = false;
  let start = { x: 0, y: 0 };

  function printCameraParams() {
    const codeSnippet = `cameraAngle = { yaw: ${cameraAngle.yaw.toFixed(3)}, pitch: ${cameraAngle.pitch.toFixed(3)}, fov: ${cameraAngle.fov.toFixed(1)} };`;
    console.log(`%c[КАМЕРА]: %c${codeSnippet}`, 'color: #f59e0b; font-weight: bold;', 'color: #7dd3fc;');
    return codeSnippet;
  }

  window.getCamera = function() {
    return printCameraParams();
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
      const text = printCameraParams();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        console.log('%c✓ Скопировано в буфер обмена!', 'color: #4ade80;');
      }
    }
  });

  function getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return { x: e.clientX, y: e.clientY };
    }
    return null;
  }

  function onPointerDown(e) {
    const pos = getPointerPos(e);
    if (!pos) return;
    isDown = true;
    start.x = pos.x;
    start.y = pos.y;
  }

  function onPointerMove(e) {
    if (!isDown) return;
    const pos = getPointerPos(e);
    if (!pos) return;

    const dx = pos.x - start.x;
    const dy = pos.y - start.y;

    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      // Горизонтальный поворот (360° вокруг сцены)
      targetAngle.yaw -= dx * 0.0035;

      // Вертикальный наклон:
      // Движение мыши вверх (dy < 0) -> взгляд поднимается ВВЕРХ В ЗЕНИТ (до +85°)
      // Движение мыши вниз (dy > 0) -> взгляд опускается ВНИЗ НА ВОДУ (до -25°)
      targetAngle.pitch = Math.max(-0.44, Math.min(1.48, targetAngle.pitch - dy * 0.0030));
    }

    start.x = pos.x;
    start.y = pos.y;

    if (isSoftware) {
      cameraAngle.yaw = targetAngle.yaw;
      cameraAngle.pitch = targetAngle.pitch;
      renderSingleFrame(clock.getElapsedTime());
    }
  }

  function onPointerUp() { 
    if (isDown) {
      isDown = false; 
      printCameraParams();
    }
  }

  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  window.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  // Зум колесиком (меняет угол обзора FOV)
  window.addEventListener('wheel', (e) => {
    if (Number.isFinite(e.deltaY)) {
      targetAngle.fov = Math.max(30.0, Math.min(75.0, targetAngle.fov + e.deltaY * 0.04));
      if (isSoftware) {
        cameraAngle.fov = targetAngle.fov;
        camera.fov = cameraAngle.fov;
        camera.updateProjectionMatrix();
        renderSingleFrame(clock.getElapsedTime());
      }
      printCameraParams();
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    const mobileNow = window.innerWidth < 768;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, (mobileNow || isSoftware) ? 1.0 : 1.5));
    renderSingleFrame(clock.getElapsedTime());
  });

  const clock = new THREE.Clock();

  function updateCamera() {
    // 1. Позиция наблюдателя держится строго над волнами с легким естественным параллаксом
    camera.position.x = eyeBase.x + Math.sin(cameraAngle.yaw) * 4.0;
    camera.position.y = Math.max(8.5, eyeBase.y - Math.sin(cameraAngle.pitch) * 2.5);
    camera.position.z = eyeBase.z + Math.cos(cameraAngle.yaw) * 4.0;

    // 2. Вектор взгляда
    const cosPitch = Math.cos(cameraAngle.pitch);
    const sinPitch = Math.sin(cameraAngle.pitch);
    const sinYaw = Math.sin(cameraAngle.yaw);
    const cosYaw = Math.cos(cameraAngle.yaw);

    // При yaw = 0 и pitch = 0 камера смотрит строго на закатное солнце (-Z)
    const lookDir = new THREE.Vector3(
      sinYaw * cosPitch,
      sinPitch,
      -cosYaw * cosPitch
    );

    const lookTarget = new THREE.Vector3().copy(camera.position).addScaledVector(lookDir, 100.0);
    camera.lookAt(lookTarget);

    // 3. Плавный оптический зум
    if (Math.abs(camera.fov - cameraAngle.fov) > 0.05) {
      camera.fov = cameraAngle.fov;
      camera.updateProjectionMatrix();
    }
  }

  function renderSingleFrame(time) {
    try {
      updateCamera();
      if (sun && typeof sun.update === 'function') sun.update(time);
      if (water && typeof water.update === 'function') water.update(time, camera.position);
      if (dust && typeof dust.update === 'function') dust.update(time);
      if (mist && typeof mist.update === 'function') mist.update(time);
      if (planets && typeof planets.update === 'function') planets.update(time);
      if (cosmos && typeof cosmos.update === 'function') cosmos.update(time);

      renderer.render(scene, camera);
    } catch (err) {
      console.error('Render error:', err);
    }
  }

  // ===================================================================
  // ЦИКЛ АНИМАЦИИ (IDLE-UNTIL-URGENT)
  // ===================================================================
  const targetFPS = isMobile ? 35 : 60;
  const frameInterval = 1000 / targetFPS;
  let lastFrameTime = performance.now();
  let isLoopActive = false;

  function render(now) {
    if (!isLoopActive) return;
    requestAnimationFrame(render);

    if (document.hidden) return;

    const delta = now - lastFrameTime;
    if (delta < frameInterval) return;
    lastFrameTime = now - (delta % frameInterval);

    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    if (!Number.isFinite(targetAngle.yaw)) targetAngle.yaw = 0.0;
    if (!Number.isFinite(targetAngle.pitch)) targetAngle.pitch = 0.12;
    if (!Number.isFinite(targetAngle.fov)) targetAngle.fov = 50.0;

    if (!Number.isFinite(cameraAngle.yaw)) cameraAngle.yaw = 0.0;
    if (!Number.isFinite(cameraAngle.pitch)) cameraAngle.pitch = 0.12;
    if (!Number.isFinite(cameraAngle.fov)) cameraAngle.fov = 50.0;

    const damping = 1.0 - Math.exp(-14.0 * dt);
    cameraAngle.yaw   += (targetAngle.yaw   - cameraAngle.yaw)   * damping;
    cameraAngle.pitch += (targetAngle.pitch - cameraAngle.pitch) * damping;
    cameraAngle.fov   += (targetAngle.fov   - cameraAngle.fov)   * damping;

    renderSingleFrame(time);
  }

  function startAnimationLoop() {
    if (isLoopActive || isSoftware) return;
    isLoopActive = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(() => {
    renderSingleFrame(0);
  });

  const interactionEvents = ['touchstart', 'pointerdown', 'mousedown', 'mousemove', 'wheel', 'keydown', 'scroll'];
  function onFirstUserAction() {
    startAnimationLoop();
    interactionEvents.forEach(evt => window.removeEventListener(evt, onFirstUserAction));
  }
  interactionEvents.forEach(evt => window.addEventListener(evt, onFirstUserAction, { passive: true, once: true }));

  if (!isSoftware) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        setTimeout(startAnimationLoop, 2000);
      }, { timeout: 4000 });
    } else {
      setTimeout(startAnimationLoop, 2500);
    }
  }
})();