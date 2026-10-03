window.createWater = function(scene, sunPosition, isSoftware) {
  const waterVertexShader = `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vElevation;

    // Трохоидальная волна Герстнера с индивидуальной фазой и физическим затуханием крутизны
    vec3 gerstner(vec2 dir, float steepness, float wavelength, float speed, float phase, vec2 p, inout vec3 tangent, inout vec3 binormal, float groupMod) {
      float k = 2.0 * 3.14159265 / wavelength;
      float c = sqrt(9.8 / k) * speed;
      vec2 d = normalize(dir);
      float f = k * (dot(d, p) - c * uTime * 0.65) + phase;
      float a = (steepness / k) * groupMod;

      tangent += vec3(
        -d.x * d.x * (steepness * sin(f) * groupMod),
        d.x * (steepness * cos(f) * groupMod),
        -d.x * d.y * (steepness * sin(f) * groupMod)
      );
      binormal += vec3(
        -d.x * d.y * (steepness * sin(f) * groupMod),
        d.y * (steepness * cos(f) * groupMod),
        -d.y * d.y * (steepness * sin(f) * groupMod)
      );

      return vec3(d.x * (a * cos(f)), a * sin(f), d.y * (a * cos(f)));
    }

    void main() {
      vec3 p = position;
      vec3 tangent = vec3(1.0, 0.0, 0.0);
      vec3 binormal = vec3(0.0, 0.0, 1.0);

      // Двухслойное вихревое смещение координат (устраняет линейность и сетку)
      vec2 pXZ = position.xz;
      float swirl1 = sin(pXZ.y * 0.012 + uTime * 0.11) * cos(pXZ.x * 0.014 - uTime * 0.09);
      float swirl2 = cos(pXZ.y * 0.025 - uTime * 0.07) * sin(pXZ.x * 0.022 + uTime * 0.08);
      vec2 warpedCoord = pXZ + vec2(swirl1 * 5.0 + swirl2 * 2.5, -swirl1 * 4.5 + swirl2 * 2.0);

      // Две независимые асинхронные огибающие (пакеты волн)
      float waveGroup1 = 0.78 + 0.32 * sin(warpedCoord.y * 0.011 - warpedCoord.x * 0.006 + uTime * 0.075);
      float waveGroup2 = 0.82 + 0.28 * cos(warpedCoord.x * 0.015 + warpedCoord.y * 0.009 - uTime * 0.062);

      // Естественный океанический спектр с асинхронными фазами и перекрестным волнением
      p += gerstner(vec2(0.12, 0.99), 0.11, 88.0, 1.00, 0.00, warpedCoord, tangent, binormal, waveGroup1);
      p += gerstner(vec2(-0.28, 0.96), 0.13, 54.0, 1.04, 2.14, warpedCoord, tangent, binormal, waveGroup2);
      p += gerstner(vec2(0.42, 0.91), 0.16, 31.5, 0.97, 4.38, warpedCoord, tangent, binormal, waveGroup1);
      p += gerstner(vec2(-0.52, 0.85), 0.19, 18.2, 1.08, 1.72, warpedCoord, tangent, binormal, waveGroup2);
      p += gerstner(vec2(0.65, 0.76), 0.21, 10.4, 1.15, 3.85, warpedCoord, tangent, binormal, 1.0);
      p += gerstner(vec2(-0.35, 0.94), 0.18, 5.6, 1.22, 5.29, warpedCoord, tangent, binormal, 1.0);
      p += gerstner(vec2(0.80, 0.60), 0.14, 3.2, 1.30, 2.61, warpedCoord, tangent, binormal, 1.0);

      vNormal = normalize(cross(binormal, tangent));
      vElevation = p.y;

      vec4 worldPos = modelMatrix * vec4(p, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const waterFragmentShader = `
    uniform vec3 uSunPosition;
    uniform vec3 uCameraPos;
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vElevation;

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    // Органическая вихревая гидродинамика
    float liquidTexture(vec2 p, float t) {
      vec2 q = p * 0.4;
      float n = 0.0;
      float amp = 0.55;
      mat2 m = rot(1.15);

      for (int i = 0; i < 4; i++) {
        vec2 flow = vec2(
          sin(q.y * 1.8 + t * 0.45 + float(i)),
          cos(q.x * 1.8 - t * 0.35 - float(i))
        ) * 0.35;

        n += amp * (sin((q.x + flow.x) * 2.2) * cos((q.y + flow.y) * 2.2));
        q = m * q * 1.95;
        amp *= 0.45;
      }
      return n;
    }

    vec3 getFluidNormal(vec2 p, float t, float strength) {
      vec2 eps = vec2(0.06, 0.0);
      float hCenter = liquidTexture(p, t);
      float hRight  = liquidTexture(p + eps.xy, t);
      float hUp     = liquidTexture(p + eps.yx, t);

      vec2 grad = vec2(hRight - hCenter, hUp - hCenter) / eps.x;
      return normalize(vec3(-grad.x * strength, 1.0, -grad.y * strength));
    }

    // Защищенный GGX без деления на ноль
    float D_GGX(float NdotH, float roughness) {
      float a = max(roughness * roughness, 0.002);
      float a2 = a * a;
      float clampedNdotH = clamp(NdotH, 0.0, 1.0);
      float d = clampedNdotH * clampedNdotH * (a2 - 1.0) + 1.0;
      return a2 / (3.14159265 * max(d * d, 1e-6));
    }

    void main() {
      vec3 toCam = uCameraPos - vWorldPos;
      vec3 viewDir = length(toCam) > 0.001 ? normalize(toCam) : vec3(0.0, 1.0, 0.0);
      vec3 toSun = uSunPosition - vWorldPos;
      vec3 sunDir = length(toSun) > 0.001 ? normalize(toSun) : vec3(0.0, 0.0, -1.0);

      // Затухание микроряби вдалеке для предотвращения мерцания горизонта
      float dist = length(toCam);
      float distFade = clamp(1.0 - dist / 320.0, 0.25, 1.0);

      // Нормали органической текучей воды
      vec3 fluidNorm = getFluidNormal(vWorldPos.xz, uTime * 0.7, 0.32 * distFade);
      vec3 normal = normalize(vNormal + vec3(fluidNorm.x, 0.0, fluidNorm.z));

      // Закон Френеля для прозрачной глубокой воды
      float NdotV = clamp(dot(normal, viewDir), 0.0, 1.0);
      float oneMinusNdotV = clamp(1.0 - NdotV, 0.0, 1.0);
      float fresnel = 0.02 + 0.98 * pow(oneMinusNdotV, 5.0);

      // Освещенность солнцем
      float NdotL = clamp(dot(normal, sunDir), 0.0, 1.0);

      // Искрящаяся солнечная дорожка GGX
      vec3 sumH = sunDir + viewDir;
      vec3 H = length(sumH) > 0.001 ? normalize(sumH) : vec3(0.0, 1.0, 0.0);
      float NdotH = clamp(dot(normal, H), 0.0, 1.0);
      float specSharp = D_GGX(NdotH, 0.02) * 1.6;
      float specTrail = D_GGX(NdotH, 0.14) * 0.9;
      vec3 sunSpecular = (vec3(1.0, 0.98, 0.92) * specSharp + vec3(1.0, 0.76, 0.22) * specTrail) * NdotL * fresnel;

      // Реалистичное подповерхностное рассеивание (SSS)
      float dotSunBehind = clamp(dot(sunDir, -viewDir), 0.0, 1.0);
      float sunBehind = dotSunBehind > 0.0 ? pow(dotSunBehind, 6.0) : 0.0;
      float crestRim  = smoothstep(1.2, 2.8, vElevation) * pow(oneMinusNdotV, 3.0);
      vec3 sssGold = vec3(1.0, 0.72, 0.22) * (sunBehind * crestRim * 1.1);

      // Глубинная толща воды: благородный темный сапфир Нуна
      vec3 deepAbyss   = vec3(0.002, 0.008, 0.022); // Бездна во впадинах
      vec3 sapphireMid = vec3(0.008, 0.055, 0.125); // Прозрачная лазурь
      vec3 waterColumn = mix(deepAbyss, sapphireMid, smoothstep(-2.5, 2.0, vElevation)) + sssGold;

      // Отражение звездного неба: мягкий сапфировый свет космоса
      vec3 reflDir = reflect(-viewDir, normal);
      float dotRefl = clamp(dot(reflDir, sunDir), 0.0, 1.0);
      float horizonSunAura = dotRefl > 0.0 ? pow(dotRefl, 14.0) : 0.0;
      vec3 skyReflect = vec3(0.008, 0.015, 0.035) + vec3(1.0, 0.7, 0.25) * horizonSunAura * 1.2;

      // Итоговая сборка воды
      vec3 finalColor = mix(waterColumn, skyReflect, fresnel) + sunSpecular;

      // Мягкий космический горизонт (глубокий индиго вместо глухого черного)
      float fog = smoothstep(140.0, 380.0, dist);
      vec3 horizonAtmosphere = vec3(0.008, 0.010, 0.022);
      finalColor = mix(finalColor, horizonAtmosphere, fog);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // Оптимизированная геометрия: 32 для программного SwiftShader, 40 для мобильных, 64 для аппаратного GPU.
  // Устраняет узкое место в 68 121 вершину без визуальных потерь благодаря попиксельному расчету нормалей.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const segments = isSoftware ? 32 : (isMobile ? 40 : 64);
  const oceanGeo = new THREE.PlaneGeometry(550, 550, segments, segments);
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSunPosition: { value: sunPosition },
      uCameraPos: { value: new THREE.Vector3() }
    }
  });

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  scene.add(oceanMesh);

  return {
    mesh: oceanMesh,
    material: oceanMat,
    update: function(time, cameraPos) {
      oceanMat.uniforms.uTime.value = time;
      oceanMat.uniforms.uCameraPos.value.copy(cameraPos);
    }
  };
};