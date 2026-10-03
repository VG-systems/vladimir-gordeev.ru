window.createMist = function(scene, isSoftware) {
  // Адаптивное число сгустков: исключает fill-rate перегрузку FBM-шума
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const count = isSoftware ? 8 : (isMobile ? 12 : 20);
  const geo = new THREE.BufferGeometry();

  const positions = new Float32Array(count * 4 * 3);
  const uvs = new Float32Array(count * 4 * 2);
  const centers = new Float32Array(count * 4 * 3);
  const sizes = new Float32Array(count * 4 * 2);
  const seeds = new Float32Array(count * 4);
  const speeds = new Float32Array(count * 4);
  const indices = [];

  for (let i = 0; i < count; i++) {
    const cx = (Math.random() - 0.5) * 220;
    const cz = -130.0 + Math.random() * 150.0;
    const cy = 2.4 + Math.random() * 2.0;

    const sw = 45.0 + Math.random() * 25.0;
    const sh = 20.0 + Math.random() * 14.0;

    const seed = Math.random();
    const speed = 0.7 + Math.random() * 0.6;

    const vIdx = i * 4;

    positions.set([
      -0.5, -0.5, 0.0,
       0.5, -0.5, 0.0,
       0.5,  0.5, 0.0,
      -0.5,  0.5, 0.0
    ], vIdx * 3);

    uvs.set([
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0
    ], vIdx * 2);

    for (let j = 0; j < 4; j++) {
      const idx3 = (vIdx + j) * 3;
      const idx2 = (vIdx + j) * 2;
      const idx1 = vIdx + j;

      centers[idx3 + 0] = cx;
      centers[idx3 + 1] = cy;
      centers[idx3 + 2] = cz;

      sizes[idx2 + 0] = sw;
      sizes[idx2 + 1] = sh;

      seeds[idx1] = seed;
      speeds[idx1] = speed;
    }

    indices.push(
      vIdx + 0, vIdx + 1, vIdx + 2,
      vIdx + 2, vIdx + 3, vIdx + 0
    );
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 2));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      attribute vec3 aCenter;
      attribute vec2 aSize;
      attribute float aSeed;
      attribute float aSpeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;

        float progress = fract(aSeed + uTime * aSpeed * 0.026);
        vAlpha = pow(sin(progress * 3.14159265), 1.5);

        vec3 center = aCenter;
        center.y += progress * 4.2;

        center.x += sin(uTime * 0.14 + aSeed * 6.28) * 8.0 + progress * 5.0;
        center.z += cos(uTime * 0.11 + aSeed * 4.15) * 6.0;

        vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
        vec3 up = vec3(0.0, 1.0, 0.0);

        vec3 worldPos = center + right * (position.x * aSize.x) + up * (position.y * aSize.y);
        vWorldPos = worldPos;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbmSmoke(vec2 p, float t) {
        vec2 flow1 = vec2(t * 0.06, -t * 0.03);
        vec2 flow2 = vec2(-t * 0.04, t * 0.05);
        float n = 0.52 * noise(p + flow1);
        n += 0.28 * noise(p * 2.05 + flow2);
        n += 0.14 * noise(p * 4.1);
        return n;
      }

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;

        float dist = length(vec2(p.x * 0.8, p.y * 1.3));
        if (dist > 1.0) discard;

        float envelope = exp(-dist * dist * 2.8);
        float smoke = fbmSmoke(vUv * 2.6, uTime * 0.12);
        float density = smoke * envelope * vAlpha;

        float inSunPath = exp(-abs(vWorldPos.x) * 0.022);
        vec3 colSilverOpal = vec3(0.45, 0.62, 0.82);
        vec3 colSolarGold  = vec3(1.0, 0.82, 0.38);
        vec3 color = mix(colSilverOpal, colSolarGold, inSunPath * 0.85);

        float alpha = density * 0.42;
        gl_FragColor = vec4(color * density * 2.0, alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  return {
    mesh: mesh,
    update: function(time) {
      mat.uniforms.uTime.value = time;
    }
  };
};