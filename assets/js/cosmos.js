window.createCosmos = function(scene) {
  const skyGeo = new THREE.SphereGeometry(950, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      void main() {
        vec3 dir = normalize(vDir);
        vec3 col = vec3(0.0015, 0.001, 0.004);

        // Четкие точечные звезды (без размытых дисков)
        vec2 uv = vec2(atan(dir.z, dir.x), asin(dir.y)) * 140.0;
        vec2 id = floor(uv);
        vec2 f = fract(uv) - 0.5;
        float h = hash(id);
        if (h > 0.965 && dir.y > -0.05) {
          float dist = length(f);
          float star = exp(-dist * dist * 320.0);
          col += mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.5), fract(h * 32.1)) * star * 1.8;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
  return skyMesh;
};