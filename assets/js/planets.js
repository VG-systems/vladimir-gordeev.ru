/**
 * SOLAR SYSTEM SIMULATION ENGINE (NASA/JPL J2000 EPHEMERIDES)
 * Кеплеровская орбитальная механика, процедурные материалы планет и безопасный API.
 */
window.createPlanets = function(scene, sunPosition, userOptions) {
  if (typeof THREE === 'undefined') return null;

  const options = Object.assign({
    scaleMode: 'visual',
    timeAccel: 1.0,
    earthYearSeconds: 28.0,
    spinDamping: 1.0,
    ambientStarlight: 0.018
  }, userOptions || {});

  const DEG2RAD = Math.PI / 180.0;
  const IS_PHYSICAL = options.scaleMode === 'physical';
  const BASE_AU = IS_PHYSICAL ? 149.6 : 64.0;
  const DIST_EXP = IS_PHYSICAL ? 1.0 : 0.42;
  const RADIUS_EXP = IS_PHYSICAL ? 1.0 : 0.42;
  const BASE_R_EARTH = IS_PHYSICAL ? 0.00637 : 1.75;

  const SIDEREAL_YEAR_DAYS = 365.256363;
  const LUNAR_MONTH_DAYS = 27.321661;
  const LUNAR_NODAL_PRECES_DAYS = 6798.383;

  const JPL_PLANETS = [
    {
      id: 1,
      name: 'mercury',
      title: 'Меркурий',
      a0: 0.38709893,
      e0: 0.20563069,
      I0: 7.00487,
      L0: 252.250845,
      varpi0: 77.45645,
      Omega0: 48.33167,
      rEarth: 0.3829,
      periodDays: 87.9691,
      tiltDeg: 0.034,
      spinDays: 58.6462,
      flattening: 0.0,
      baseColor: [0.65, 0.62, 0.58],
      albedo: 0.142,
      vOrbitalKms: 47.36
    },
    {
      id: 2,
      name: 'venus',
      title: 'Венера',
      a0: 0.72333199,
      e0: 0.00677323,
      I0: 3.39471,
      L0: 181.97973,
      varpi0: 131.53298,
      Omega0: 76.68069,
      rEarth: 0.9499,
      periodDays: 224.7008,
      tiltDeg: 177.36,
      spinDays: 243.025,
      flattening: 0.0,
      baseColor: [0.92, 0.84, 0.62],
      albedo: 0.76,
      vOrbitalKms: 35.02
    },
    {
      id: 3,
      name: 'earth',
      title: 'Земля',
      a0: 1.00000011,
      e0: 0.01671022,
      I0: 0.00005,
      L0: 100.46435,
      varpi0: 102.94719,
      Omega0: -11.26064,
      rEarth: 1.0000,
      periodDays: 365.25636,
      tiltDeg: 23.43928,
      spinDays: 0.99726968,
      flattening: 0.00335,
      baseColor: [0.18, 0.38, 0.72],
      isEarth: true,
      albedo: 0.306,
      vOrbitalKms: 29.78
    },
    {
      id: 4,
      name: 'mars',
      title: 'Марс',
      a0: 1.52366231,
      e0: 0.09341233,
      I0: 1.85061,
      L0: -4.553432,
      varpi0: -23.94363,
      Omega0: 49.5574,
      rEarth: 0.5320,
      periodDays: 686.9796,
      tiltDeg: 25.19,
      spinDays: 1.025957,
      flattening: 0.00589,
      baseColor: [0.82, 0.36, 0.16],
      isMars: true,
      albedo: 0.25,
      vOrbitalKms: 24.07
    },
    {
      id: 5,
      name: 'jupiter',
      title: 'Юпитер',
      a0: 5.20336301,
      e0: 0.04839266,
      I0: 1.30530,
      L0: 34.40438,
      varpi0: 14.75385,
      Omega0: 100.55615,
      rEarth: 11.209,
      periodDays: 4332.589,
      tiltDeg: 3.13,
      spinDays: 0.41354,
      flattening: 0.06487,
      baseColor: [0.85, 0.72, 0.55],
      isJupiter: true,
      albedo: 0.52,
      vOrbitalKms: 13.07
    },
    {
      id: 6,
      name: 'saturn',
      title: 'Сатурн',
      a0: 9.53707032,
      e0: 0.05415060,
      I0: 2.48446,
      L0: 49.94432,
      varpi0: 92.43194,
      Omega0: 113.71504,
      rEarth: 9.449,
      periodDays: 10759.22,
      tiltDeg: 26.73,
      spinDays: 0.44401,
      flattening: 0.09796,
      baseColor: [0.88, 0.80, 0.62],
      isSaturn: true,
      albedo: 0.47,
      vOrbitalKms: 9.69
    },
    {
      id: 7,
      name: 'uranus',
      title: 'Уран',
      a0: 19.19126393,
      e0: 0.04716771,
      I0: 0.76986,
      L0: 313.23218,
      varpi0: 170.96424,
      Omega0: 74.22988,
      rEarth: 4.007,
      periodDays: 30685.4,
      tiltDeg: 97.77,
      spinDays: 0.71833,
      flattening: 0.0229,
      baseColor: [0.46, 0.78, 0.78],
      isUranus: true,
      albedo: 0.51,
      vOrbitalKms: 6.81
    },
    {
      id: 8,
      name: 'neptune',
      title: 'Нептун',
      a0: 30.06896348,
      e0: 0.00858587,
      I0: 1.76917,
      L0: -55.120029,
      varpi0: 44.97135,
      Omega0: 131.72169,
      rEarth: 3.883,
      periodDays: 60189.0,
      tiltDeg: 28.32,
      spinDays: 0.67125,
      flattening: 0.0171,
      baseColor: [0.18, 0.34, 0.76],
      isNeptune: true,
      albedo: 0.41,
      vOrbitalKms: 5.43
    }
  ];

  function solveKepler(M, e) {
    let mNorm = ((M % (2.0 * Math.PI)) + 2.0 * Math.PI) % (2.0 * Math.PI);
    if (mNorm > Math.PI) mNorm -= 2.0 * Math.PI;

    let E = mNorm + e * Math.sin(mNorm) + 0.5 * e * e * Math.sin(2.0 * mNorm);
    for (let i = 0; i < 10; i++) {
      const f = E - e * Math.sin(E) - mNorm;
      const fPrime = 1.0 - e * Math.cos(E);
      const delta = f / fPrime;
      E -= delta;
      if (Math.abs(delta) < 1e-8) break;
    }
    return E;
  }

  function getKeplerianStateVector(a, e, incRad, omegaNodeRad, argPeriRad, MRad) {
    const E = solveKepler(MRad, e);
    const xOrb = a * (Math.cos(E) - e);
    const yOrb = a * (Math.sqrt(Math.max(0.0, 1.0 - e * e)) * Math.sin(E));

    const cO = Math.cos(omegaNodeRad);
    const sO = Math.sin(omegaNodeRad);
    const cw = Math.cos(argPeriRad);
    const sw = Math.sin(argPeriRad);
    const ci = Math.cos(incRad);
    const si = Math.sin(incRad);

    const Px = cw * cO - sw * sO * ci;
    const Py = cw * sO + sw * cO * ci;
    const Pz = sw * si;

    const Qx = -sw * cO - cw * sO * ci;
    const Qy = -sw * sO + cw * cO * ci;
    const Qz = cw * si;

    const xEcl = xOrb * Px + yOrb * Qx;
    const yEcl = xOrb * Py + yOrb * Qy;
    const zEcl = xOrb * Pz + yOrb * Qz;

    return new THREE.Vector3(xEcl, zEcl, -yEcl);
  }

  const COMMON_GLSL = `
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    float fbm3(vec3 p) {
      float v = 0.0;
      v += 0.500 * noise(p); p = p * 2.02 + vec3(17.1);
      v += 0.250 * noise(p); p = p * 2.03 + vec3(31.4);
      v += 0.125 * noise(p);
      return v;
    }

    float fbm4(vec3 p) {
      float v = fbm3(p);
      p = p * 2.01 + vec3(47.2);
      v += 0.0625 * noise(p);
      return v;
    }
  `;

  const VERTEX_COMMON = `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vLocalPos;

    void main() {
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = wPos.xyz;
      vLocalPos = position;
      gl_Position = projectionMatrix * viewMatrix * wPos;
    }
  `;

  const solarSystem = new THREE.Group();
  solarSystem.position.copy(sunPosition);

  solarSystem.rotation.x = 0.42;
  solarSystem.rotation.y = -0.14;
  solarSystem.rotation.z = 0.05;

  const planetsList = [];
  const disposables = [];

  const PLANET_DATA = JPL_PLANETS.map(p => {
    const visualDist = BASE_AU * Math.pow(p.a0, DIST_EXP);
    const visualRadius = BASE_R_EARTH * Math.pow(p.rEarth, RADIUS_EXP);

    const incRad = p.I0 * DEG2RAD;
    const omegaNodeRad = p.Omega0 * DEG2RAD;
    const periRad = p.varpi0 * DEG2RAD;
    const argPeriRad = periRad - omegaNodeRad;
    const meanLongRad = p.L0 * DEG2RAD;
    const M0Rad = ((meanLongRad - periRad) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const meanMotionRadPerDay = (Math.PI * 2) / p.periodDays;

    return {
      ...p,
      visualDist: visualDist,
      visualRadius: visualRadius,
      incRad: incRad,
      omegaNodeRad: omegaNodeRad,
      argPeriRad: argPeriRad,
      M0Rad: M0Rad,
      meanMotionRadPerDay: meanMotionRadPerDay,
      tiltRad: p.tiltDeg * DEG2RAD
    };
  });

  PLANET_DATA.forEach(data => {
    const orbitPoints = [];
    const segments = 220;
    for (let s = 0; s <= segments; s++) {
      const M = (s / segments) * Math.PI * 2.0;
      orbitPoints.push(getKeplerianStateVector(
        data.visualDist,
        data.e0,
        data.incRad,
        data.omegaNodeRad,
        data.argPeriRad,
        M
      ));
    }

    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0xdeb887,
      transparent: true,
      opacity: 0.08,
      depthWrite: false
    });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    solarSystem.add(orbitLine);
    disposables.push(orbitGeo, orbitMat);

    const positionGroup = new THREE.Group();
    solarSystem.add(positionGroup);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = data.tiltRad;
    positionGroup.add(tiltGroup);

    const sphereSegments = 40;
    const sphereGeo = new THREE.SphereGeometry(data.visualRadius, sphereSegments, sphereSegments);
    disposables.push(sphereGeo);

    let planetMesh;
    let updateFn = null;

    if (data.isEarth) {
      const earthMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight },
          uTime:        { value: 0 }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          uniform float uTime;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float cont = fbm4(p * 3.2);
            float landMask = smoothstep(0.48, 0.52, cont);

            vec3 deepOcean = vec3(0.02, 0.12, 0.42);
            vec3 shallows  = vec3(0.04, 0.28, 0.62);
            vec3 oceanCol  = mix(deepOcean, shallows, smoothstep(0.35, 0.48, cont));

            vec3 grass = vec3(0.12, 0.35, 0.14);
            vec3 sand  = vec3(0.62, 0.54, 0.32);
            vec3 landCol = mix(sand, grass, smoothstep(0.49, 0.65, cont));

            float ice = smoothstep(0.72, 0.88, abs(p.y));
            landCol = mix(landCol, vec3(0.92, 0.95, 0.98), ice);
            oceanCol = mix(oceanCol, vec3(0.88, 0.92, 0.98), ice * 0.9);

            vec3 surface = mix(oceanCol, landCol, landMask);

            vec3 cloudP = p + vec3(uTime * 0.015, 0.0, uTime * 0.008);
            float clouds = smoothstep(0.48, 0.72, fbm4(cloudP * 5.2));
            surface = mix(surface, vec3(0.96), clouds * 0.82);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float nDotL = max(dot(vWorldNormal, sunDir), 0.0);

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            vec3 h = normalize(sunDir + viewDir);
            float spec = pow(max(dot(vWorldNormal, h), 0.0), 32.0) * (1.0 - landMask) * (1.0 - clouds);

            float rim = pow(1.0 - max(dot(vWorldNormal, viewDir), 0.0), 3.0);
            vec3 atmosphere = vec3(0.25, 0.55, 1.0) * rim * (nDotL * 1.2 + 0.15);

            vec3 finalColor = surface * (nDotL * 1.5 + uAmbient) + vec3(spec * 1.8) + atmosphere;
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, earthMat);
      disposables.push(earthMat);

      const moonDist = IS_PHYSICAL ? (data.visualRadius * 60.34) : (data.visualRadius * 3.6);
      const moonRad = IS_PHYSICAL ? (data.visualRadius * 0.2727) : (data.visualRadius * 0.28);

      const moonNodalGroup = new THREE.Group();
      positionGroup.add(moonNodalGroup);

      const moonIncGroup = new THREE.Group();
      moonIncGroup.rotation.x = 5.145 * DEG2RAD;
      moonNodalGroup.add(moonIncGroup);

      const moonMeshGroup = new THREE.Group();
      moonIncGroup.add(moonMeshGroup);

      const moonGeo = new THREE.SphereGeometry(moonRad, 24, 24);
      const moonMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float maria = fbm3(p * 4.0);
            vec3 highland = vec3(0.72, 0.70, 0.67);
            vec3 basalt = vec3(0.38, 0.36, 0.34);
            vec3 surface = mix(basalt, highland, smoothstep(0.38, 0.58, maria));

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.4 + uAmbient), 1.0);
          }
        `
      });

      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMeshGroup.add(moonMesh);
      disposables.push(moonGeo, moonMat);

      updateFn = function(t, earthDays) {
        earthMat.uniforms.uTime.value = t;

        const nodalAngle = -(earthDays / LUNAR_NODAL_PRECES_DAYS) * Math.PI * 2.0;
        moonNodalGroup.rotation.y = nodalAngle;

        const moonM = (earthDays / LUNAR_MONTH_DAYS) * Math.PI * 2.0;
        const moonE = solveKepler(moonM, 0.0549);
        const moonR = moonDist * (1.0 - 0.0549 * Math.cos(moonE));
        const moonNu = 2.0 * Math.atan2(
          Math.sqrt(1.0549) * Math.sin(moonE * 0.5),
          Math.sqrt(0.9451) * Math.cos(moonE * 0.5)
        );

        moonMesh.position.set(Math.cos(moonNu) * moonR, 0, Math.sin(moonNu) * moonR);
      };

    } else if (data.isJupiter) {
      const jupiterMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight },
          uTime:        { value: 0 }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          uniform float uTime;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float lat = p.y;
            float flow = sign(lat) * sin(lat * 26.0) * uTime * 0.04;
            vec3 pFlow = vec3(p.x + flow, p.y, p.z);

            float bands = sin(lat * 24.0 + fbm3(pFlow * 6.0) * 1.8) * 0.5 + 0.5;
            vec3 darkBelt = vec3(0.55, 0.32, 0.18);
            vec3 lightZone = vec3(0.92, 0.85, 0.72);
            vec3 surface = mix(darkBelt, lightZone, smoothstep(0.25, 0.75, bands));

            vec2 grsCoord = vec2((p.x - 0.2) * 2.2, (p.y + 0.37) * 4.2);
            float grsDist = length(grsCoord);
            if (grsDist < 0.35) {
              float vortex = smoothstep(0.35, 0.05, grsDist);
              vec3 grsColor = vec3(0.82, 0.28, 0.14);
              surface = mix(surface, grsColor, vortex * 0.95);
            }

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, jupiterMat);
      planetMesh.scale.set(1.0, 1.0 - data.flattening, 1.0);
      disposables.push(jupiterMat);
      updateFn = (t) => { jupiterMat.uniforms.uTime.value = t; };

    } else if (data.isSaturn) {
      const rEq = data.visualRadius;
      const ringIn = rEq * 1.239;
      const ringOut = rEq * 2.325;

      const saturnMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight },
          uRingIn:      { value: ringIn },
          uRingOut:     { value: ringOut },
          uRadiusEq:    { value: rEq }
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          varying vec3 vCenter;
          varying vec3 vRingNormal;

          void main() {
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vec4 wPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = wPos.xyz;
            vLocalPos = position;
            vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vRingNormal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
            gl_Position = projectionMatrix * viewMatrix * wPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          uniform float uRingIn;
          uniform float uRingOut;
          uniform float uRadiusEq;

          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          varying vec3 vCenter;
          varying vec3 vRingNormal;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float lat = p.y;

            float bands = sin(lat * 16.0 + fbm3(p * 4.0) * 0.4) * 0.5 + 0.5;
            vec3 cream = vec3(0.92, 0.86, 0.70);
            vec3 ochre = vec3(0.78, 0.68, 0.50);
            vec3 surface = mix(ochre, cream, smoothstep(0.3, 0.7, bands));

            if (lat > 0.88) {
              float phi = atan(p.z, p.x);
              float hexLat = 0.974 + 0.007 * cos(6.0 * phi);
              float jet = 1.0 - smoothstep(0.003, 0.016, abs(lat - hexLat));
              surface = mix(surface, vec3(0.42, 0.62, 0.58), jet * 0.9);
            }

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);

            float denom = dot(sunDir, vRingNormal);
            if (abs(denom) > 1e-4) {
              float t = -dot(vWorldPos - vCenter, vRingNormal) / denom;
              if (t > 0.0) {
                vec3 hit = vWorldPos + sunDir * t;
                float d = length(hit - vCenter);
                if (d >= uRingIn && d <= uRingOut) {
                  float rRel = d / uRadiusEq;
                  float inCassini = 1.0 - smoothstep(0.0, 0.02, abs(rRel - 1.99));
                  float shadow = (1.0 - inCassini * 0.85) * 0.82;
                  surface *= (1.0 - shadow);
                }
              }
            }

            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, saturnMat);
      planetMesh.scale.set(1.0, 1.0 - data.flattening, 1.0);
      disposables.push(saturnMat);

      const ringGeo = new THREE.RingGeometry(ringIn, ringOut, 160);
      ringGeo.rotateX(Math.PI / 2.0);

      const ringMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uRadiusEq:    { value: rEq },
          uAmbient:     { value: options.ambientStarlight }
        },
        vertexShader: `
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          varying vec3 vCenter;
          varying vec3 vNormalWorld;

          void main() {
            vLocalPos = position;
            vNormalWorld = normalize(mat3(modelMatrix) * normal);
            vec4 wPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = wPos.xyz;
            vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * wPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uRadiusEq;
          uniform float uAmbient;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          varying vec3 vCenter;
          varying vec3 vNormalWorld;

          void main() {
            float r = length(vLocalPos.xz) / uRadiusEq;

            float cRing = smoothstep(1.239, 1.27, r) * (1.0 - smoothstep(1.51, 1.526, r)) * 0.35;
            float bRing = smoothstep(1.526, 1.55, r) * (1.0 - smoothstep(1.93, 1.95, r)) * 0.98;
            float cassini = smoothstep(1.95, 1.96, r) * (1.0 - smoothstep(2.02, 2.03, r)) * 0.04;
            float aRing = smoothstep(2.03, 2.05, r) * (1.0 - smoothstep(2.25, 2.27, r)) * 0.78;
            float encke = smoothstep(0.0, 0.008, abs(r - 2.214));
            aRing *= mix(0.15, 1.0, encke);
            float fRing = (1.0 - smoothstep(0.0, 0.008, abs(r - 2.32))) * 0.42;

            float alpha = cRing + bRing + cassini + aRing + fRing;

            vec3 colC = vec3(0.68, 0.62, 0.50);
            vec3 colB = vec3(0.96, 0.90, 0.75);
            vec3 colA = vec3(0.85, 0.78, 0.64);
            vec3 color = mix(colC, colB, smoothstep(1.45, 1.65, r));
            color = mix(color, colA, smoothstep(1.95, 2.08, r));

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            vec3 toCenter = vWorldPos - vCenter;
            float tCent = -dot(toCenter, sunDir);
            if (tCent > 0.0) {
              vec3 closePt = vWorldPos + sunDir * tCent;
              if (length(closePt - vCenter) < uRadiusEq) {
                alpha *= 0.06;
              }
            }

            float light = abs(dot(vNormalWorld, sunDir)) * 0.6 + 0.4;
            gl_FragColor = vec4(color * light, alpha * 0.94);
          }
        `
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.renderOrder = 2;
      tiltGroup.add(ringMesh);
      disposables.push(ringGeo, ringMat);

    } else if (data.isMars) {
      const marsMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float mare = fbm4(p * 3.5);

            vec3 rust = vec3(0.82, 0.36, 0.16);
            vec3 darkBasalt = vec3(0.38, 0.22, 0.14);
            vec3 surface = mix(rust, darkBasalt, smoothstep(0.35, 0.65, mare));

            float pole = smoothstep(0.84, 0.94, abs(p.y));
            surface = mix(surface, vec3(0.95, 0.96, 0.98), pole);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, marsMat);
      disposables.push(marsMat);

    } else if (data.name === 'venus') {
      const venusMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight },
          uTime:        { value: 0 }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          uniform float uTime;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float rotOffset = uTime * 0.03;
            float chevron = sin(p.y * 6.0 + fbm3(vec3(p.x + rotOffset, p.y, p.z) * 3.0) * 1.6) * 0.5 + 0.5;

            vec3 baseAtm = vec3(0.92, 0.84, 0.62);
            vec3 uvWave  = vec3(0.85, 0.74, 0.52);
            vec3 surface = mix(uvWave, baseAtm, chevron);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, venusMat);
      disposables.push(venusMat);
      updateFn = (t) => { venusMat.uniforms.uTime.value = t; };

    } else if (data.isUranus) {
      const uranusMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;

          void main() {
            vec3 p = normalize(vLocalPos);
            float bands = sin(p.y * 14.0) * 0.06;
            vec3 surface = vec3(0.46, 0.78, 0.78) + vec3(bands);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, uranusMat);
      planetMesh.scale.set(1.0, 1.0 - data.flattening, 1.0);
      disposables.push(uranusMat);

      const uRingGeo = new THREE.RingGeometry(data.visualRadius * 1.65, data.visualRadius * 1.95, 96);
      uRingGeo.rotateX(Math.PI / 2.0);
      const uRingMat = new THREE.MeshBasicMaterial({
        color: 0x689b9b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      });
      const uRingMesh = new THREE.Mesh(uRingGeo, uRingMat);
      tiltGroup.add(uRingMesh);
      disposables.push(uRingGeo, uRingMat);

    } else if (data.isNeptune) {
      const neptuneMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight },
          uTime:        { value: 0 }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          uniform float uTime;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            vec3 deepAzure = vec3(0.18, 0.34, 0.76);

            vec2 gdsCoord = vec2((p.x + 0.15) * 2.5, (p.y + 0.37) * 4.5);
            float gdsDist = length(gdsCoord);
            float spot = smoothstep(0.35, 0.05, gdsDist);
            vec3 surface = mix(deepAzure, vec3(0.08, 0.16, 0.44), spot * 0.75);

            float clouds = smoothstep(0.68, 0.88, fbm3(vec3(p.x * 2.0 + uTime * 0.08, p.y * 3.0, p.z)));
            surface = mix(surface, vec3(0.92, 0.95, 1.0), clouds * 0.7);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, neptuneMat);
      planetMesh.scale.set(1.0, 1.0 - data.flattening, 1.0);
      disposables.push(neptuneMat);
      updateFn = (t) => { neptuneMat.uniforms.uTime.value = t; };

    } else {
      const mercuryMat = new THREE.ShaderMaterial({
        uniforms: {
          uSunPosition: { value: sunPosition.clone() },
          uAmbient:     { value: options.ambientStarlight }
        },
        vertexShader: VERTEX_COMMON,
        fragmentShader: `
          uniform vec3 uSunPosition;
          uniform float uAmbient;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          varying vec3 vLocalPos;
          ${COMMON_GLSL}

          void main() {
            vec3 p = normalize(vLocalPos);
            float craters = fbm4(p * 8.0) * 0.28;
            vec3 surface = vec3(0.65, 0.62, 0.58) * (0.84 + craters);

            vec3 sunDir = normalize(uSunPosition - vWorldPos);
            float light = max(dot(vWorldNormal, sunDir), 0.0);
            gl_FragColor = vec4(surface * (light * 1.5 + uAmbient), 1.0);
          }
        `
      });

      planetMesh = new THREE.Mesh(sphereGeo, mercuryMat);
      disposables.push(mercuryMat);
    }

    tiltGroup.add(planetMesh);

    planetsList.push({
      id: data.id,
      name: data.name,
      title: data.title,
      mesh: planetMesh,
      posGroup: positionGroup,
      data: data,
      orbitLine: orbitLine,
      updateCustom: updateFn,
      vOrbitalKms: data.vOrbitalKms,
      a0: data.a0,
      periodDays: data.periodDays,
      tiltDeg: data.tiltDeg
    });
  });

  scene.add(solarSystem);

  return {
    group: solarSystem,
    planets: planetsList,
    list: planetsList,

    update: function(time) {
      if (typeof time === 'undefined') time = performance.now() * 0.001;

      const elapsedEarthDays = (time / options.earthYearSeconds) * SIDEREAL_YEAR_DAYS * options.timeAccel;

      planetsList.forEach(p => {
        const d = p.data;

        const currentM = d.M0Rad + d.meanMotionRadPerDay * elapsedEarthDays;
        const pos = getKeplerianStateVector(
          d.visualDist,
          d.e0,
          d.incRad,
          d.omegaNodeRad,
          d.argPeriRad,
          currentM
        );
        p.posGroup.position.copy(pos);

        const spinAngle = (elapsedEarthDays / d.spinDays) * options.spinDamping * (Math.PI * 2.0);
        p.mesh.rotation.y = spinAngle;

        if (p.updateCustom) {
          p.updateCustom(time, elapsedEarthDays);
        }
      });
    },

    getPlanetByName: function(name) {
      if (!name) return null;
      return planetsList.find(p => p.name && p.name.toLowerCase() === name.toLowerCase()) || null;
    },

    getPlanetById: function(id) {
      return planetsList.find(p => p.id === id) || null;
    },

    getEphemeris: function() {
      return planetsList.map(p => ({
        id: p.id,
        name: p.name,
        title: p.title,
        semiMajorAxisAU: p.a0,
        periodDays: p.periodDays,
        orbitalSpeedKms: p.vOrbitalKms,
        axialTiltDeg: p.tiltDeg
      }));
    },

    dispose: function() {
      disposables.forEach(d => { if (d && d.dispose) d.dispose(); });
      scene.remove(solarSystem);
    }
  };
};