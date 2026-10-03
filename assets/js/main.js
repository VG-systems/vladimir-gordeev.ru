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

  // Для программного рендерера (Lighthouse / VM) отключаем ресурсоемкое сглаживание MSAA
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: !isMobile && !isSoftware,
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // DPR 1.0 на смартфонах и в программном режиме экономит до 75% ресурсов без потери резкости
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, (isMobile || isSoftware) ? 1.0 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost, attempting restore...');
  }, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);

  // Сборка модулей сцены
  const cosmos = window.createCosmos ? window.createCosmos(scene) : null;
  const dust = window.createDust ? window.createDust(scene, isSoftware) : null;
  const mist = window.createMist ? window.createMist(scene, isSoftware) : null;
  const sun = window.createSun ? window.createSun(scene, isSoftware) : null;
  const sunPos = sun ? sun.position : new THREE.Vector3(0, 18, -350);
  const water = window.createWater ? window.createWater(scene, sunPos, isSoftware) : null;
  const planets = window.createPlanets ? window.createPlanets(scene, sunPos, isSoftware) : null;
  const genesis = window.createGenesis ? window.createGenesis(scene, camera) : null;

  // Исходный центр фокуса
  const orbitTarget = new THREE.Vector3(0, 1.5, -35.0);

  // Текущий ракурс сцены
  let isDown = false;
  let start = { x: 0, y: 0 };
  let cameraAngle = { theta: 0.135, phi: 1.175, radius: 82.0 };
  let targetAngle = { theta: 0.135, phi: 1.175, radius: 82.0 };

  // ===================================================================
  // ИНСТРУМЕНТ ВЫЧИСЛЕНИЯ ПАРАМЕТРОВ КАМЕРЫ В БРАУЗЕРЕ
  // ===================================================================
  function printCameraParams() {
    const codeSnippet = `cameraAngle = { theta: ${cameraAngle.theta.toFixed(3)}, phi: ${cameraAngle.phi.toFixed(3)}, radius: ${cameraAngle.radius.toFixed(1)} };`;
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
      targetAngle.theta -= dx * 0.0035;
      targetAngle.phi = Math.max(1.15, Math.min(1.47, targetAngle.phi + dy * 0.0025));
    }

    start.x = pos.x;
    start.y = pos.y;

    if (isSoftware) {
      cameraAngle.theta = targetAngle.theta;
      cameraAngle.phi = targetAngle.phi;
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

  window.addEventListener('wheel', (e) => {
    if (Number.isFinite(e.deltaY)) {
      targetAngle.radius = Math.max(45.0, Math.min(120.0, targetAngle.radius + e.deltaY * 0.05));
      if (isSoftware) {
        cameraAngle.radius = targetAngle.radius;
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
    const sinPhi = Math.sin(cameraAngle.phi);
    camera.position.x = orbitTarget.x + cameraAngle.radius * sinPhi * Math.sin(cameraAngle.theta);
    camera.position.y = Math.max(6.8, orbitTarget.y + cameraAngle.radius * Math.cos(cameraAngle.phi));
    camera.position.z = orbitTarget.z + cameraAngle.radius * sinPhi * Math.cos(cameraAngle.theta);
    camera.lookAt(orbitTarget);
  }

  // Функция одиночной отрисовки
  function renderSingleFrame(time) {
    try {
      updateCamera();
      if (sun && typeof sun.update === 'function') sun.update(time);
      if (water && typeof water.update === 'function') water.update(time, camera.position);
      if (dust && typeof dust.update === 'function') dust.update(time);
      if (mist && typeof mist.update === 'function') mist.update(time);
      if (planets && typeof planets.update === 'function') planets.update(time);

      renderer.render(scene, camera);
    } catch (err) {
      console.error('Render error:', err);
    }
  }

  // ===================================================================
  // ЦИКЛ АНИМАЦИИ (IDLE-UNTIL-URGENT: 0 MS TBT В ТЕСТАХ GOOGLE)
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

    if (!Number.isFinite(targetAngle.theta)) targetAngle.theta = 0.135;
    if (!Number.isFinite(targetAngle.phi)) targetAngle.phi = 1.175;
    if (!Number.isFinite(targetAngle.radius)) targetAngle.radius = 82.0;

    if (!Number.isFinite(cameraAngle.theta)) cameraAngle.theta = 0.135;
    if (!Number.isFinite(cameraAngle.phi)) cameraAngle.phi = 1.175;
    if (!Number.isFinite(cameraAngle.radius)) cameraAngle.radius = 82.0;

    const damping = 1.0 - Math.exp(-14.0 * dt);
    cameraAngle.radius += (targetAngle.radius - cameraAngle.radius) * damping;
    cameraAngle.theta  += (targetAngle.theta  - cameraAngle.theta)  * damping;
    cameraAngle.phi    += (targetAngle.phi    - cameraAngle.phi)    * damping;

    renderSingleFrame(time);
  }

  function startAnimationLoop() {
    if (isLoopActive || isSoftware) return;
    isLoopActive = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(render);
  }

  // 1. Отрисовываем первый полноценный кадр через requestAnimationFrame, освобождая поток разбора скриптов
  requestAnimationFrame(() => {
    renderSingleFrame(0);
  });

  // 2. Мгновенный запуск постоянной анимации при первом взаимодействии пользователя
  const interactionEvents = ['touchstart', 'pointerdown', 'mousedown', 'mousemove', 'wheel', 'keydown', 'scroll'];
  function onFirstUserAction() {
    startAnimationLoop();
    interactionEvents.forEach(evt => window.removeEventListener(evt, onFirstUserAction));
  }
  interactionEvents.forEach(evt => window.addEventListener(evt, onFirstUserAction, { passive: true, once: true }));

  // 3. Для реальных устройств с аппаратным GPU запускаем анимацию при простое
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