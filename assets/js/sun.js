window.createSun = function(scene) {
  const sunGroup = new THREE.Group();

  // ================================================================
  // SUN POSITION
  // ================================================================
  const position = new THREE.Vector3(0, 18, -350);
  sunGroup.position.copy(position);

  // ================================================================
  // 1. СОЛНЕЧНОЕ ЯДРО
  // ================================================================
  const coreGeo = new THREE.SphereGeometry(15.5, 64, 64);

  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: Math.random() * 100.0 }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      uniform float time;

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
          mix(
            mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
            f.y
          ),
          mix(
            mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
            f.y
          ),
          f.z
        );
      }

      void main() {
        float facing = max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0);
        float limb = pow(facing, 0.65);

        vec3 p = normalize(vLocalPos);
        float n1 = noise(p * 6.0);
        float n2 = noise(p * 15.0);
        float surface = n1 * 0.6 + n2 * 0.4;
        surface += sin(time * 0.2 + p.x * 6.0) * 0.03;

        vec3 deepAmber = vec3(1.2, 0.55, 0.12);
        vec3 pureGold  = vec3(2.5, 1.85, 0.75);
        vec3 whiteHot  = vec3(5.5, 5.2, 4.8);

        vec3 color = mix(deepAmber, pureGold, smoothstep(0.15, 0.75, limb));
        color = mix(color, whiteHot, pow(limb, 2.2));
        color *= 0.92 + surface * 0.16;

        float edgeSoftness = smoothstep(0.0, 0.08, facing);
        gl_FragColor = vec4(color, edgeSoftness);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true
  });

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  sunGroup.add(coreMesh);

  // ================================================================
  // 2. ВНУТРЕННЯЯ КОРОНА
  // ================================================================
  function createGlow(size, intensity, falloff) {
    const geo = new THREE.PlaneGeometry(size, size);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true, // Включено: не лезет поверх океана
      uniforms: {
        intensity: { value: intensity },
        falloff: { value: falloff }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
          vec3 up    = normalize(vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
          vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 worldPos = center + right * position.x + up * position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float intensity;
        uniform float falloff;

        void main() {
          vec2 uv = vUv - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;

          float glow = exp(-pow(d * falloff, 1.8));
          float core = exp(-pow(d * 4.2, 3.0));

          vec3 inner = vec3(1.2, 0.92, 0.55);
          vec3 outer = vec3(1.0, 0.55, 0.10);

          vec3 color = mix(inner, outer, smoothstep(0.0, 0.85, d));
          float alpha = glow * 0.75 + core * 0.8;
          color *= intensity;

          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const mesh = new THREE.Mesh(geo, mat);
    sunGroup.add(mesh);
    return mesh;
  }

  createGlow(140, 1.2, 2.2);
  createGlow(90,  1.6, 3.2);
  createGlow(55,  2.0, 4.4);

  // ================================================================
  // 3. ШИРОКАЯ АТМОСФЕРНАЯ ЗАСВЕТКА
  // ================================================================
  const atmosphereGeo = new THREE.PlaneGeometry(560, 240);

  const atmosphereMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true, // Включено: не дает среза на переднем плане
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
        float x = abs(vUv.x - 0.5) * 2.0;
        float y = abs(vUv.y - 0.5) * 2.0;

        float horizontal = exp(-x * x * 2.2);
        float vertical   = exp(-y * y * 3.2);
        float glow = horizontal * vertical * 0.55;

        vec3 color = vec3(1.0, 0.60, 0.16);
        gl_FragColor = vec4(color * glow * 1.5, glow);
      }
    `
  });

  const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  atmosphere.position.set(0, -4, 1);
  sunGroup.add(atmosphere);

  // ================================================================
  // 4. ДАЛЬНЯЯ МЯГКАЯ ЗАСВЕТКА ГОРИЗОНТА
  // ================================================================
  const distantGeo = new THREE.PlaneGeometry(750, 280);

  const distantMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true, // Включено: корректно уходит за горизонт
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
        float x = abs(vUv.x - 0.5) * 2.0;
        float y = vUv.y;

        float horizontal = exp(-x * x * 1.6);
        float vertical   = exp(-y * 3.6);
        float alpha = horizontal * vertical * 0.28;

        vec3 color = vec3(1.0, 0.48, 0.08);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `
  });

  const distant = new THREE.Mesh(distantGeo, distantMat);
  distant.position.set(0, -10, 4);
  sunGroup.add(distant);

  // ================================================================
  // 5. LIGHT
  // ================================================================
  const sunLight = new THREE.PointLight(0xffd580, 7.0, 900, 1.4);
  sunLight.position.set(0, 0, 0);
  sunGroup.add(sunLight);

  // ================================================================
  // 6. ДИНАМИКА
  // ================================================================
  sunGroup.userData.update = function(time) {
    if (coreMat.uniforms.time) {
      coreMat.uniforms.time.value = time;
    }
    const pulse = 1.0 + Math.sin(time * 0.35) * 0.006;
    sunGroup.scale.setScalar(pulse);
  };

  scene.add(sunGroup);

  return {
    group: sunGroup,
    position: position,
    light: sunLight,
    update: sunGroup.userData.update
  };
};