window.createPlanets = function(scene, sunPosition) {
  // Главная группа эклиптики Солнечной системы
  const solarSystem = new THREE.Group();
  solarSystem.position.copy(sunPosition);

  // Наклон плоскости эклиптики для обзора с расстояния (кинематографичный ракурс)
  solarSystem.rotation.x = 0.48; // наклон орбит к зрителю
  solarSystem.rotation.y = -0.15;
  solarSystem.rotation.z = 0.08;

  // ===================================================================
  // 1. АСТРОНОМИЧЕСКИЕ ДАННЫЕ ПЛАНЕТ
  // ===================================================================
  // Дистанции и скорости согласованы с законом Кеплера (T ~ R^(3/2))
  const PLANET_DATA = [
    {
      name: 'mercury',
      radius: 1.1,
      dist: 32.0,
      orbitSpeed: 3.2,
      tilt: 0.03,
      spinSpeed: 0.05,
      color: 0x9e9e9e
    },
    {
      name: 'venus',
      radius: 1.8,
      dist: 45.0,
      orbitSpeed: 1.5,
      tilt: 3.10, // Ретроградное вращение Венеры
      spinSpeed: -0.02,
      color: 0xe3bb7b
    },
    {
      name: 'earth',
      radius: 2.1,
      dist: 62.0,
      orbitSpeed: 1.0,
      tilt: 0.41, // 23.44° наклон оси
      spinSpeed: 1.0,
      isEarth: true
    },
    {
      name: 'mars',
      radius: 1.4,
      dist: 78.0,
      orbitSpeed: 0.53,
      tilt: 0.44, // 25.19°
      spinSpeed: 0.97,
      isMars: true
    },
    {
      name: 'jupiter',
      radius: 4.8,
      dist: 106.0,
      orbitSpeed: 0.28,
      tilt: 0.05,
      spinSpeed: 2.4, // Быстрый спин гиганта (~10 часов)
      isJupiter: true
    },
    {
      name: 'saturn',
      radius: 3.8,
      dist: 140.0,
      orbitSpeed: 0.17,
      tilt: 0.47, // 26.73°
      spinSpeed: 2.2,
      isSaturn: true
    },
    {
      name: 'uranus',
      radius: 2.6,
      dist: 174.0,
      orbitSpeed: 0.11,
      tilt: 1.71, // 97.77° вращение "лежа на боку"
      spinSpeed: -1.3,
      color: 0x68c5c2
    },
    {
      name: 'neptune',
      radius: 2.5,
      dist: 206.0,
      orbitSpeed: 0.07,
      tilt: 0.49,
      spinSpeed: 1.4,
      color: 0x274996
    }
  ];

  const planets = [];

  // ===================================================================
  // 2. СОЗДАНИЕ ОРБИТ И ПЛАНЕТ
  // ===================================================================

  PLANET_DATA.forEach(data => {
    // А) Тонкая светящаяся траектория орбиты
    const orbitPoints = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(theta) * data.dist, 0, Math.sin(theta) * data.dist));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0xffd580,
      transparent: true,
      opacity: 0.02, // Едва заметная нить траектории
      depthWrite: false
    });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    solarSystem.add(orbitLine);

    // Б) Опорный узел орбиты
    const orbitPivot = new THREE.Group();
    solarSystem.add(orbitPivot);

    // В) Узел наклона оси планеты (Axial Tilt)
    const tiltGroup = new THREE.Group();
    tiltGroup.position.x = data.dist;
    tiltGroup.rotation.z = data.tilt;
    orbitPivot.add(tiltGroup);

    // Г) Создание тела планеты
    let planetMesh;
    const sphereGeo = new THREE.SphereGeometry(data.radius, 32, 32);

    if (data.isEarth) {
      // Земля: океаны, материки, белые облака и атмосфера
      const earthMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition }
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          void main() {
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vLocalPos = position;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunPosition;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;

          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          }
          float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
              f.z
            );
          }

          void main() {
            vec3 n = normalize(vLocalPos);
            float land = smoothstep(0.48, 0.52, noise(n * 4.5) + noise(n * 9.0) * 0.3);
            float clouds = smoothstep(0.55, 0.75, noise(n * 8.0 + vec3(1.2)));

            vec3 ocean = vec3(0.05, 0.25, 0.65);
            vec3 continent = vec3(0.18, 0.45, 0.15);
            vec3 surface = mix(ocean, continent, land);
            surface = mix(surface, vec3(0.95), clouds * 0.7);

            // Физическое освещение от Солнца
            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + 0.1), 1.0);
          }
        `
      });
      planetMesh = new THREE.Mesh(sphereGeo, earthMat);

      // Вращающаяся Луна вокруг Земли
      const moonOrbit = new THREE.Group();
      const moonGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xb5b5b5 });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.position.x = 5.8;
      moonOrbit.add(moonMesh);
      tiltGroup.add(moonOrbit);
      data.moonOrbit = moonOrbit;

    } else if (data.isJupiter) {
      // Юпитер: атмосферные полосы и Большое Красное Пятно
      const jupiterMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition }
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          void main() {
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vLocalPos = position;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunPosition;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          void main() {
            vec3 p = normalize(vLocalPos);
            // Атмосферные полосы вдоль параллелей
            float bands = sin(p.y * 22.0) * 0.5 + 0.5;
            vec3 lightBand = vec3(0.88, 0.76, 0.60);
            vec3 darkBand  = vec3(0.62, 0.38, 0.22);
            vec3 surface = mix(darkBand, lightBand, bands);

            // Большое Красное Пятно
            float spot = smoothstep(0.18, 0.0, length(vec2((p.x - 0.2) * 1.4, p.y + 0.35)));
            surface = mix(surface, vec3(0.75, 0.22, 0.12), spot * 0.85);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.6 + 0.08), 1.0);
          }
        `
      });
      planetMesh = new THREE.Mesh(sphereGeo, jupiterMat);

    } else if (data.isSaturn) {
      // Сатурн с культовыми кольцами
      const saturnMat = new THREE.MeshBasicMaterial({ color: 0xe2bf7d });
      planetMesh = new THREE.Mesh(sphereGeo, saturnMat);

      // Знаменитые кольца Сатурна с щелью Кассини
      const ringGeo = new THREE.RingGeometry(5.2, 10.5, 64);
      ringGeo.rotateX(Math.PI / 2); // кольца лежат в плоскости экватора

      const ringMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            // Пространство колец: от внутреннего края до внешнего
            float ring = smoothstep(0.48, 0.54, r) * smoothstep(0.98, 0.92, r);

            // Щель Кассини (темный разрыв)
            float cassini = 1.0 - smoothstep(0.02, 0.0, abs(r - 0.74));
            ring *= cassini;

            // Золотисто-песочные кольца
            vec3 ringCol = mix(vec3(0.85, 0.72, 0.52), vec3(0.95, 0.85, 0.65), r);
            gl_FragColor = vec4(ringCol, ring * 0.75);
          }
        `
      });
      const ringsMesh = new THREE.Mesh(ringGeo, ringMat);
      tiltGroup.add(ringsMesh);

    } else if (data.isMars) {
      // Марс: оксидный красный шар с белыми полярными шапками
      const marsMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition }
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          void main() {
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vLocalPos = position;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunPosition;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          void main() {
            vec3 p = normalize(vLocalPos);
            vec3 rust = vec3(0.76, 0.28, 0.12);
            vec3 darkBasalt = vec3(0.45, 0.18, 0.08);
            vec3 surface = mix(rust, darkBasalt, smoothstep(0.2, 0.7, abs(p.x * p.z)));

            // Белые полярные ледяные шапки на полюсах
            float pole = smoothstep(0.85, 0.95, abs(p.y));
            surface = mix(surface, vec3(0.95, 0.95, 0.98), pole);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + 0.1), 1.0);
          }
        `
      });
      planetMesh = new THREE.Mesh(sphereGeo, marsMat);

    } else {
      // Меркурий, Венера, Уран, Нептун
      const basicMat = new THREE.MeshBasicMaterial({ color: data.color });
      planetMesh = new THREE.Mesh(sphereGeo, basicMat);
    }

    tiltGroup.add(planetMesh);

    planets.push({
      orbitPivot: orbitPivot,
      planetMesh: planetMesh,
      moonOrbit: data.moonOrbit,
      orbitSpeed: data.orbitSpeed,
      spinSpeed: data.spinSpeed,
      initialAngle: Math.random() * Math.PI * 2
    });
  });

  scene.add(solarSystem);

  // ===================================================================
  // 3. АНИМАЦИОННЫЙ ЦИКЛ ОРБИТ И СПИНОВ
  // ===================================================================
  return {
    group: solarSystem,
    update: function(time) {
      // Базовый темп движения солнечной системы
      const celestialTempo = time * 0.18;

      planets.forEach(p => {
        // Орбитальное движение вокруг Солнца по закону Кеплера
        p.orbitPivot.rotation.y = p.initialAngle + celestialTempo * p.orbitSpeed;

        // Вращение планеты вокруг своей наклонной оси (суточный спин)
        p.planetMesh.rotation.y = time * p.spinSpeed;

        // Обращение Луны вокруг Земли
        if (p.moonOrbit) {
          p.moonOrbit.rotation.y = time * 1.8;
        }
      });
    }
  };
};