window.createDust = function(scene, isSoftware) {
  // Адаптивное число частиц: 300 в программном режиме, 600 на мобильных, 1000 на десктопе
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const dustCount = isSoftware ? 300 : (isMobile ? 600 : 1000);
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 260;
    dustPos[i * 3 + 1] = Math.random() * 22;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 260;
    dustSeed[i] = Math.random() * 6.28;
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));

  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * 1.8 + aSeed, 22.0);
        p.x += sin(uTime * 0.7 + aSeed) * 1.2;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(6.0 * (90.0 / -mvPos.z), 1.5, 5.0);
        gl_Position = projectionMatrix * mvPos;

        vAlpha = smoothstep(0.0, 4.0, p.y) * smoothstep(22.0, 16.0, p.y);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float glow = exp(-d * 4.0);
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.3) * glow * 2.0, vAlpha * glow);
      }
    `
  });

  const points = new THREE.Points(dustGeo, dustMat);
  scene.add(points);

  return {
    mesh: points,
    update: function(time) {
      dustMat.uniforms.uTime.value = time;
    }
  };
};