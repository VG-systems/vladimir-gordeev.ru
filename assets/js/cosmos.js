/**
 * ASTRONOMICAL CELESTIAL SPHERE & INTERACTIVE STAR CATALOG ENGINE (J2000)
*/
window.createCosmos = function createCosmos(scene) {
  if (typeof THREE === 'undefined' || !scene || typeof scene.add !== 'function') return null;

  const cosmosGroup = new THREE.Group();
  scene.add(cosmosGroup);

  const DEG2RAD = Math.PI / 180;
  const CELESTIAL_RADIUS = 920;
  const PICK_RADIUS_PX = 14;

  // Базис галактической системы координат (J2000).
  const GALACTIC_NORTH = new THREE.Vector3(-0.1988, 0.4559, 0.8676).normalize();
  const GALACTIC_CENTER = new THREE.Vector3(-0.8734, -0.4840, 0.0549).normalize();
  const GALACTIC_QUARTER = new THREE.Vector3()
    .crossVectors(GALACTIC_NORTH, GALACTIC_CENTER)
    .normalize();

  let disposed = false;
  let activeCamera = null;
  let activeRenderer = null;
  let activeCanvas = null;
  let isPointerDown = false;
  let pointerInside = false;
  let hoveredStar = null;

  const mouseCoords = new THREE.Vector2(-100, -100);
  const raycaster = new THREE.Raycaster();

  // Points.threshold задаётся в мировых единицах, а не в CSS-пикселях.
  raycaster.params.Points.threshold = 1;

  const catalogAbortController = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null;

  // ------------------------------------------------------------
  // 1. АСТРОФИЗИЧЕСКИЙ РАСЧЁТ ЦВЕТА (Ballesteros + Tanner Helland)
  // ------------------------------------------------------------
  function bvToRgb(bvValue) {
    const bv = THREE.MathUtils.clamp(
      Number.isFinite(bvValue) ? bvValue : 0.65,
      -0.40,
      2.00
    );

    const temperature = 4600 * (
      1 / (0.92 * bv + 1.70) +
      1 / (0.92 * bv + 0.62)
    );

    const t = THREE.MathUtils.clamp(temperature / 100, 10, 400);

    let r, g, b;

    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      b = 255;
    }

    return [
      THREE.MathUtils.clamp(r / 255, 0, 1),
      THREE.MathUtils.clamp(g / 255, 0, 1),
      THREE.MathUtils.clamp(b / 255, 0, 1)
    ];
  }

  function celestialToCartesian(raDeg, decDeg, radius) {
    const ra = raDeg * DEG2RAD;
    const dec = decDeg * DEG2RAD;
    const cosDec = Math.cos(dec);

    return new THREE.Vector3(
      radius * cosDec * Math.sin(ra),
      radius * Math.sin(dec),
      -radius * cosDec * Math.cos(ra)
    );
  }

  // CSV может содержать quoted-поля с запятыми и экранированными кавычками.
  function parseCSVRow(line) {
    const fields = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }

    fields.push(field.trim());
    return fields;
  }

  // ------------------------------------------------------------
  // 2. КАТАЛОГ ГЛАВНЫХ ЗВЁЗД СОЗВЕЗДИЙ
  // ------------------------------------------------------------
  const STARS = [
    // Малая Медведица
    {
      id: 'polaris',
      name: 'Полярная (Polaris)',
      constName: 'Малая Медведица (α UMi)',
      ra: 37.95, dec: 89.26, mag: 1.98, bv: 0.60,
      spectral: 'F7Ib', distLy: '433'
    },
    {
      id: 'kochab',
      name: 'Кохаб (Kochab)',
      constName: 'Малая Медведица (β UMi)',
      ra: 222.68, dec: 74.16, mag: 2.08, bv: 1.47,
      spectral: 'K4III', distLy: '130'
    },
    {
      id: 'pherkad',
      name: 'Феркад (Pherkad)',
      constName: 'Малая Медведица (γ UMi)',
      ra: 230.19, dec: 71.83, mag: 3.05, bv: 0.05,
      spectral: 'A3II-III', distLy: '487'
    },
    {
      id: 'yildun',
      name: 'Йильдун (Yildun)',
      constName: 'Малая Медведица (δ UMi)',
      ra: 261.12, dec: 86.59, mag: 4.36, bv: 0.02,
      spectral: 'A1Vn', distLy: '183'
    },

    // Большая Медведица
    {
      id: 'dubhe',
      name: 'Дубхе (Dubhe)',
      constName: 'Большая Медведица (α UMa)',
      ra: 165.93, dec: 61.75, mag: 1.79, bv: 1.07,
      spectral: 'K0IIIa', distLy: '123'
    },
    {
      id: 'merak',
      name: 'Мерак (Merak)',
      constName: 'Большая Медведица (β UMa)',
      ra: 165.46, dec: 56.38, mag: 2.37, bv: -0.02,
      spectral: 'A1V', distLy: '79.7'
    },
    {
      id: 'phecda',
      name: 'Фекда (Phecda)',
      constName: 'Большая Медведица (γ UMa)',
      ra: 178.46, dec: 53.69, mag: 2.44, bv: 0.00,
      spectral: 'A0Ve', distLy: '83.2'
    },
    {
      id: 'megrez',
      name: 'Мегрец (Megrez)',
      constName: 'Большая Медведица (δ UMa)',
      ra: 183.85, dec: 57.03, mag: 3.31, bv: 0.08,
      spectral: 'A3V', distLy: '80.5'
    },
    {
      id: 'alioth',
      name: 'Алиот (Alioth)',
      constName: 'Большая Медведица (ε UMa)',
      ra: 193.50, dec: 55.96, mag: 1.77, bv: -0.02,
      spectral: 'A0pCr', distLy: '82.6'
    },
    {
      id: 'mizar',
      name: 'Мицар (Mizar)',
      constName: 'Большая Медведица (ζ UMa)',
      ra: 200.98, dec: 54.92, mag: 2.23, bv: 0.02,
      spectral: 'A1Vp', distLy: '82.9'
    },
    {
      id: 'alkaid',
      name: 'Бенетнаш (Alkaid)',
      constName: 'Большая Медведица (η UMa)',
      ra: 206.88, dec: 49.31, mag: 1.86, bv: -0.19,
      spectral: 'B3V', distLy: '103.9'
    },

    // Кассиопея
    {
      id: 'caph',
      name: 'Каф (Caph)',
      constName: 'Кассиопея (β Cas)',
      ra: 2.29, dec: 59.15, mag: 2.28, bv: 0.34,
      spectral: 'F2III-IV', distLy: '54.7'
    },
    {
      id: 'schedar',
      name: 'Шедар (Schedar)',
      constName: 'Кассиопея (α Cas)',
      ra: 10.13, dec: 56.54, mag: 2.23, bv: 1.17,
      spectral: 'K0IIIa', distLy: '228'
    },
    {
      id: 'gammacas',
      name: 'Нави (γ Cas)',
      constName: 'Кассиопея (γ Cas)',
      ra: 14.18, dec: 60.72, mag: 2.15, bv: -0.15,
      spectral: 'B0IVe', distLy: '550'
    },
    {
      id: 'ruchbah',
      name: 'Рукбах (Ruchbah)',
      constName: 'Кассиопея (δ Cas)',
      ra: 21.45, dec: 60.23, mag: 2.68, bv: 0.13,
      spectral: 'A5III-IV', distLy: '99.4'
    },
    {
      id: 'segin',
      name: 'Сегин (Segin)',
      constName: 'Кассиопея (ε Cas)',
      ra: 28.60, dec: 63.67, mag: 3.37, bv: -0.15,
      spectral: 'B3III', distLy: '460'
    },

    // Орион
    {
      id: 'betelgeuse',
      name: 'Бетельгейзе (Betelgeuse)',
      constName: 'Орион (α Ori)',
      ra: 88.79, dec: 7.41, mag: 0.50, bv: 1.85,
      spectral: 'M1-2Ia-Iab', distLy: '548'
    },
    {
      id: 'rigel',
      name: 'Ригель (Rigel)',
      constName: 'Орион (β Ori)',
      ra: 78.63, dec: -8.20, mag: 0.13, bv: -0.03,
      spectral: 'B8Ia', distLy: '860'
    },
    {
      id: 'bellatrix',
      name: 'Беллатрикс (Bellatrix)',
      constName: 'Орион (γ Ori)',
      ra: 81.28, dec: 6.35, mag: 1.64, bv: -0.22,
      spectral: 'B2III', distLy: '250'
    },
    {
      id: 'saiph',
      name: 'Саиф (Saiph)',
      constName: 'Орион (κ Ori)',
      ra: 86.94, dec: -9.67, mag: 2.06, bv: -0.17,
      spectral: 'B0.5Ia', distLy: '650'
    },
    {
      id: 'alnitak',
      name: 'Альнитак (Alnitak)',
      constName: 'Орион / Пояс (ζ Ori)',
      ra: 85.19, dec: -1.94, mag: 1.77, bv: -0.21,
      spectral: 'O9.7Ib', distLy: '1260'
    },
    {
      id: 'alnilam',
      name: 'Альнилам (Alnilam)',
      constName: 'Орион / Пояс (ε Ori)',
      ra: 84.05, dec: -1.20, mag: 1.69, bv: -0.19,
      spectral: 'B0Ia', distLy: '2000'
    },
    {
      id: 'mintaka',
      name: 'Минтака (Mintaka)',
      constName: 'Орион / Пояс (δ Ori)',
      ra: 83.00, dec: -0.30, mag: 2.23, bv: -0.22,
      spectral: 'O9.5II', distLy: '1200'
    },
    {
      id: 'meissa',
      name: 'Мейсса (Meissa)',
      constName: 'Орион (λ Ori)',
      ra: 83.78, dec: 9.93, mag: 3.39, bv: -0.18,
      spectral: 'O8III', distLy: '1100'
    },

    // Большой и Малый Псы
    {
      id: 'sirius',
      name: 'Сириус (Sirius)',
      constName: 'Большой Пёс (α CMa)',
      ra: 101.29, dec: -16.72, mag: -1.46, bv: 0.00,
      spectral: 'A1Vm', distLy: '8.6'
    },
    {
      id: 'murzim',
      name: 'Мурзим (Mirzam)',
      constName: 'Большой Пёс (β CMa)',
      ra: 95.68, dec: -17.96, mag: 1.98, bv: -0.23,
      spectral: 'B1II-III', distLy: '490'
    },
    {
      id: 'adhara',
      name: 'Адара (Adhara)',
      constName: 'Большой Пёс (ε CMa)',
      ra: 104.66, dec: -28.97, mag: 1.50, bv: -0.21,
      spectral: 'B2II', distLy: '430'
    },
    {
      id: 'wezen',
      name: 'Везен (Wezen)',
      constName: 'Большой Пёс (δ CMa)',
      ra: 107.10, dec: -26.39, mag: 1.83, bv: 0.68,
      spectral: 'F8Ia', distLy: '1600'
    },
    {
      id: 'aludra',
      name: 'Алудра (Aludra)',
      constName: 'Большой Пёс (η CMa)',
      ra: 111.02, dec: -29.30, mag: 2.45, bv: -0.08,
      spectral: 'B5Ia', distLy: '2000'
    },
    {
      id: 'procyon',
      name: 'Процион (Procyon)',
      constName: 'Малый Пёс (α CMi)',
      ra: 114.82, dec: 5.22, mag: 0.38, bv: 0.42,
      spectral: 'F5IV-V', distLy: '11.5'
    },

    // Телец
    {
      id: 'aldebaran',
      name: 'Альдебаран (Aldebaran)',
      constName: 'Телец (α Tau)',
      ra: 68.98, dec: 16.51, mag: 0.85, bv: 1.54,
      spectral: 'K5+III', distLy: '65.3'
    },
    {
      id: 'elnath',
      name: 'Эль-Нат (Elnath)',
      constName: 'Телец (β Tau)',
      ra: 81.57, dec: 28.61, mag: 1.65, bv: -0.13,
      spectral: 'B7III', distLy: '134'
    },
    {
      id: 'alcyone',
      name: 'Альциона (Alcyone)',
      constName: 'Плеяды (η Tau)',
      ra: 56.87, dec: 24.10, mag: 2.87, bv: -0.09,
      spectral: 'B7IIIe', distLy: '440'
    },

    // Близнецы и Возничий
    {
      id: 'pollux',
      name: 'Поллукс (Pollux)',
      constName: 'Близнецы (β Gem)',
      ra: 116.33, dec: 28.03, mag: 1.14, bv: 1.00,
      spectral: 'K0IIIb', distLy: '33.8'
    },
    {
      id: 'castor',
      name: 'Кастор (Castor)',
      constName: 'Близнецы (α Gem)',
      ra: 113.65, dec: 31.89, mag: 1.58, bv: 0.03,
      spectral: 'A1V', distLy: '51.6'
    },
    {
      id: 'alhena',
      name: 'Альхена (Alhena)',
      constName: 'Близнецы (γ Gem)',
      ra: 99.43, dec: 16.40, mag: 1.93, bv: 0.00,
      spectral: 'A0IV', distLy: '109'
    },
    {
      id: 'capella',
      name: 'Капелла (Capella)',
      constName: 'Возничий (α Aur)',
      ra: 79.17, dec: 45.99, mag: 0.08, bv: 0.80,
      spectral: 'G5IIIe', distLy: '42.9'
    },
    {
      id: 'menkalinan',
      name: 'Менкалина́н (Menkalinan)',
      constName: 'Возничий (β Aur)',
      ra: 89.88, dec: 44.95, mag: 1.90, bv: 0.03,
      spectral: 'A2IV', distLy: '81.1'
    },

    // Летний треугольник
    {
      id: 'vega',
      name: 'Вега (Vega)',
      constName: 'Лира (α Lyr)',
      ra: 279.23, dec: 38.78, mag: 0.03, bv: 0.00,
      spectral: 'A0Va', distLy: '25.0'
    },
    {
      id: 'deneb',
      name: 'Денеб (Deneb)',
      constName: 'Лебедь (α Cyg)',
      ra: 310.36, dec: 45.28, mag: 1.25, bv: 0.09,
      spectral: 'A2Ia', distLy: '2600'
    },
    {
      id: 'sadr',
      name: 'Садр (Sadr)',
      constName: 'Лебедь (γ Cyg)',
      ra: 305.56, dec: 40.26, mag: 2.23, bv: 0.68,
      spectral: 'F8Ib', distLy: '1800'
    },
    {
      id: 'gienah',
      name: 'Гиена (Aljanah)',
      constName: 'Лебедь (ε Cyg)',
      ra: 311.55, dec: 33.97, mag: 2.48, bv: 1.03,
      spectral: 'K0-III', distLy: '73'
    },
    {
      id: 'albireo',
      name: 'Альбирео (Albireo)',
      constName: 'Лебедь (β Cyg)',
      ra: 292.68, dec: 27.96, mag: 3.05, bv: 1.13,
      spectral: 'K3II+B9.5V', distLy: '430'
    },
    {
      id: 'altair',
      name: 'Альтаир (Altair)',
      constName: 'Орёл (α Aql)',
      ra: 297.70, dec: 8.87, mag: 0.77, bv: 0.22,
      spectral: 'A7V', distLy: '16.7'
    },
    {
      id: 'tarazed',
      name: 'Таразед (Tarazed)',
      constName: 'Орёл (γ Aql)',
      ra: 296.54, dec: 10.61, mag: 2.72, bv: 1.52,
      spectral: 'K3II', distLy: '395'
    },

    // Волопас, Дева, Лев
    {
      id: 'arcturus',
      name: 'Арктур (Arcturus)',
      constName: 'Волопас (α Boo)',
      ra: 213.91, dec: 19.18, mag: -0.05, bv: 1.23,
      spectral: 'K1.5III', distLy: '36.7'
    },
    {
      id: 'spica',
      name: 'Спика (Spica)',
      constName: 'Дева (α Vir)',
      ra: 201.30, dec: -11.16, mag: 0.98, bv: -0.23,
      spectral: 'B1III-IV', distLy: '250'
    },
    {
      id: 'regulus',
      name: 'Регул (Regulus)',
      constName: 'Лев (α Leo)',
      ra: 152.09, dec: 11.97, mag: 1.36, bv: -0.11,
      spectral: 'B7V', distLy: '79.3'
    },
    {
      id: 'denebola',
      name: 'Денебола (Denebola)',
      constName: 'Лев (β Leo)',
      ra: 177.26, dec: 14.57, mag: 2.14, bv: 0.09,
      spectral: 'A3V', distLy: '35.9'
    },
    {
      id: 'algieba',
      name: 'Альгиеба (Algieba)',
      constName: 'Лев (γ Leo)',
      ra: 154.99, dec: 19.84, mag: 2.08, bv: 1.15,
      spectral: 'K1-IIIb', distLy: '130'
    },

    // Скорпион и Южный Крест
    {
      id: 'antares',
      name: 'Антарес (Antares)',
      constName: 'Скорпион (α Sco)',
      ra: 247.35, dec: -26.43, mag: 1.06, bv: 1.83,
      spectral: 'M1.5Iab', distLy: '550'
    },
    {
      id: 'shaula',
      name: 'Шаула (Shaula)',
      constName: 'Скорпион (λ Sco)',
      ra: 263.40, dec: -37.10, mag: 1.62, bv: -0.22,
      spectral: 'B2IV', distLy: '570'
    },
    {
      id: 'dschubba',
      name: 'Джубба (Dschubba)',
      constName: 'Скорпион (δ Sco)',
      ra: 240.08, dec: -22.62, mag: 2.29, bv: -0.12,
      spectral: 'B0.3IV', distLy: '490'
    },
    {
      id: 'acrux',
      name: 'Акрукс (Acrux)',
      constName: 'Южный Крест (α Cru)',
      ra: 186.65, dec: -63.10, mag: 0.77, bv: -0.24,
      spectral: 'B0.5IV', distLy: '320'
    },
    {
      id: 'mimosa',
      name: 'Мимоза (Mimosa)',
      constName: 'Южный Крест (β Cru)',
      ra: 191.93, dec: -59.69, mag: 1.25, bv: -0.23,
      spectral: 'B0.5III', distLy: '280'
    },
    {
      id: 'gacrux',
      name: 'Гакрукс (Gacrux)',
      constName: 'Южный Крест (γ Cru)',
      ra: 187.79, dec: -57.11, mag: 1.64, bv: 1.59,
      spectral: 'M3.5III', distLy: '88.6'
    },
    {
      id: 'alphacen',
      name: 'Альфа Центавра (Rigil Kentaurus)',
      constName: 'Центавр (α Cen A)',
      ra: 219.90, dec: -60.83, mag: -0.27, bv: 0.71,
      spectral: 'G2V', distLy: '4.37'
    },
    {
      id: 'hadar',
      name: 'Хадар (Hadar)',
      constName: 'Центавр (β Cen)',
      ra: 210.95, dec: -60.37, mag: 0.61, bv: -0.23,
      spectral: 'B1III', distLy: '390'
    }
  ];

  const starMap = new Map();

  STARS.forEach((star) => {
    star.position = celestialToCartesian(star.ra, star.dec, CELESTIAL_RADIUS);
    star.color = bvToRgb(star.bv);
    starMap.set(star.id, star);
  });

  // ------------------------------------------------------------
  // 3. ЛИНИИ СОЗВЕЗДИЙ
  // ------------------------------------------------------------
  const CONSTELLATION_LINES = [
    ['dubhe', 'merak'],
    ['merak', 'phecda'],
    ['phecda', 'megrez'],
    ['megrez', 'dubhe'],
    ['megrez', 'alioth'],
    ['alioth', 'mizar'],
    ['mizar', 'alkaid'],

    ['polaris', 'yildun'],
    ['yildun', 'pherkad'],
    ['pherkad', 'kochab'],

    ['caph', 'schedar'],
    ['schedar', 'gammacas'],
    ['gammacas', 'ruchbah'],
    ['ruchbah', 'segin'],

    ['betelgeuse', 'bellatrix'],
    ['bellatrix', 'mintaka'],
    ['mintaka', 'alnilam'],
    ['alnilam', 'alnitak'],
    ['alnitak', 'saiph'],
    ['saiph', 'rigel'],
    ['rigel', 'mintaka'],
    ['betelgeuse', 'alnitak'],
    ['betelgeuse', 'meissa'],
    ['meissa', 'bellatrix'],

    ['sirius', 'murzim'],
    ['sirius', 'wezen'],
    ['wezen', 'adhara'],
    ['adhara', 'aludra'],

    ['vega', 'deneb'],
    ['deneb', 'altair'],
    ['altair', 'vega'],
    ['deneb', 'sadr'],
    ['sadr', 'albireo'],
    ['sadr', 'gienah'],

    ['aldebaran', 'elnath'],
    ['castor', 'pollux'],
    ['pollux', 'alhena'],

    ['regulus', 'algieba'],
    ['algieba', 'denebola'],

    ['dschubba', 'antares'],
    ['antares', 'shaula'],

    ['acrux', 'gacrux'],
    ['mimosa', 'gacrux'],
    ['alphacen', 'hadar']
  ];

  // ------------------------------------------------------------
  // 4. МЛЕЧНЫЙ ПУТЬ (ШЕЙДЕРНАЯ СФЕРА)
  // ------------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(950, 64, 48);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,

    vertexShader: `
      varying vec3 vDir;

      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      varying vec3 vDir;

      float hash2(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
          mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec3 d = normalize(vDir);

        vec3 galPole = normalize(vec3(-0.1988, 0.4559, 0.8676));
        vec3 galCenter = normalize(vec3(-0.8734, -0.4840, 0.0549));
        vec3 galQuarter = normalize(vec3(0.4449, -0.7468, 0.4944));

        float sinB = clamp(dot(d, galPole), -1.0, 1.0);
        float b = asin(sinB);
        float l = atan(dot(d, galQuarter), dot(d, galCenter));

        float disk = exp(-b * b * 18.0);
        float cloud = noise2(vec2(l * 5.0 + 1.7, b * 32.0 + 3.1));
        float cloudFine = noise2(vec2(l * 11.0 - 2.4, b * 68.0 + 8.0));
        float dust = smoothstep(0.42, 0.78, cloudFine);

        float milkyStructure =
          disk * (0.6 + 0.7 * cloud) * (1.0 - 0.4 * dust);

        float centreAngle = max(dot(d, galCenter), 0.0);
        float coreBulge = exp(-b * b * 9.0) * pow(centreAngle, 16.0);

        vec3 bgDeepCosmos = vec3(0.002, 0.0025, 0.0045);
        vec3 milkyColor = vec3(0.045, 0.055, 0.085);
        vec3 coreColor = vec3(0.12, 0.09, 0.06);

        vec3 color =
          bgDeepCosmos +
          milkyColor * milkyStructure +
          coreColor * coreBulge;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const skySphere = new THREE.Mesh(skyGeo, skyMat);
  cosmosGroup.add(skySphere);

  // ------------------------------------------------------------
  // 5. ГЛАВНЫЕ ЗВЁЗДЫ СОЗВЕЗДИЙ
  // ------------------------------------------------------------
  const brightCount = STARS.length;

  const bPos = new Float32Array(brightCount * 3);
  const bCol = new Float32Array(brightCount * 3);
  const bSize = new Float32Array(brightCount);
  const bBrightness = new Float32Array(brightCount);
  const bSeed = new Float32Array(brightCount);

  STARS.forEach((star, idx) => {
    bPos[idx * 3] = star.position.x;
    bPos[idx * 3 + 1] = star.position.y;
    bPos[idx * 3 + 2] = star.position.z;

    bCol[idx * 3] = star.color[0];
    bCol[idx * 3 + 1] = star.color[1];
    bCol[idx * 3 + 2] = star.color[2];

    const flux = Math.pow(10, -0.4 * (star.mag - 1.0));

    bSize[idx] = Math.max(
      7.0,
      Math.min(22.0, 11.0 + (1.5 - star.mag) * 3.5)
    );

    bBrightness[idx] = Math.min(
      1.0,
      0.35 + 0.65 * Math.sqrt(flux)
    );

    bSeed[idx] = idx * 1.371;
  });

  const brightGeo = new THREE.BufferGeometry();

  brightGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(bPos, 3)
  );

  brightGeo.setAttribute(
    'aColor',
    new THREE.BufferAttribute(bCol, 3)
  );

  brightGeo.setAttribute(
    'aSize',
    new THREE.BufferAttribute(bSize, 1)
  );

  brightGeo.setAttribute(
    'aBrightness',
    new THREE.BufferAttribute(bBrightness, 1)
  );

  brightGeo.setAttribute(
    'aSeed',
    new THREE.BufferAttribute(bSeed, 1)
  );

  const brightMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,

    uniforms: {
      uTime: { value: 0 }
    },

    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aBrightness;
      attribute float aSeed;

      varying vec3 vColor;
      varying float vBrightness;
      varying float vTwinkle;

      uniform float uTime;

      void main() {
        vColor = aColor;
        vBrightness = aBrightness;

        vTwinkle = 0.94 + 0.06 * sin(uTime * 2.8 + aSeed * 9.2);

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mvPos;
      }
    `,

    fragmentShader: `
      varying vec3 vColor;
      varying float vBrightness;
      varying float vTwinkle;

      void main() {
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        float r = length(p);

        if (r > 1.0) discard;

        float core = exp(-r * r * 14.0);
        float halo = exp(-r * r * 3.2) * 0.25;

        float intensity = (core + halo) * vBrightness * vTwinkle;

        gl_FragColor = vec4(vColor * intensity * 1.6, intensity);
      }
    `
  });

  const brightStarsPoints = new THREE.Points(brightGeo, brightMat);
  cosmosGroup.add(brightStarsPoints);

  // ------------------------------------------------------------
  // 6. ЛИНИИ СОЗВЕЗДИЙ ПО ДУГАМ БОЛЬШОГО КРУГА (SLERP)
  // ------------------------------------------------------------
  const linePoints = [];

  function pointOnGreatCircle(a, b, t) {
    const an = a.clone().normalize();
    const bn = b.clone().normalize();

    const dot = THREE.MathUtils.clamp(an.dot(bn), -1.0, 1.0);
    const omega = Math.acos(dot);

    if (omega < 1e-6) {
      return an.multiplyScalar(CELESTIAL_RADIUS);
    }

    const sinOmega = Math.sin(omega);

    return an.multiplyScalar(
      Math.sin((1.0 - t) * omega) / sinOmega
    )
      .add(
        bn.multiplyScalar(Math.sin(t * omega) / sinOmega)
      )
      .multiplyScalar(CELESTIAL_RADIUS);
  }

  CONSTELLATION_LINES.forEach(([idA, idB]) => {
    const starA = starMap.get(idA);
    const starB = starMap.get(idB);

    if (!starA || !starB) return;

    const segments = 16;

    for (let i = 0; i < segments; i++) {
      linePoints.push(
        pointOnGreatCircle(starA.position, starB.position, i / segments),
        pointOnGreatCircle(starA.position, starB.position, (i + 1) / segments)
      );
    }
  });

  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x8ebbd9,
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const constellationLinesMesh = new THREE.LineSegments(lineGeo, lineMat);
  cosmosGroup.add(constellationLinesMesh);

  // ------------------------------------------------------------
  // 7. ФОНОВЫЙ КАТАЛОГ ЗВЁЗД ИЗ CSV С СОХРАНЕНИЕМ МЕТАДАННЫХ
  // ------------------------------------------------------------
  const STAR_CATALOG_URL = (
    typeof window.COSMOS_STAR_CATALOG_URL === 'string' &&
    window.COSMOS_STAR_CATALOG_URL
  ) || '/assets/data/stars.csv';

  const bgGeo = new THREE.BufferGeometry();

  bgGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(0), 3)
  );

  bgGeo.setAttribute(
    'aColor',
    new THREE.BufferAttribute(new Float32Array(0), 3)
  );

  bgGeo.setAttribute(
    'aSize',
    new THREE.BufferAttribute(new Float32Array(0), 1)
  );

  bgGeo.setAttribute(
    'aBrightness',
    new THREE.BufferAttribute(new Float32Array(0), 1)
  );

  const bgMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,

    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aBrightness;

      varying vec3 vColor;
      varying float vBrightness;

      void main() {
        vColor = aColor;
        vBrightness = aBrightness;

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mvPos;
      }
    `,

    fragmentShader: `
      varying vec3 vColor;
      varying float vBrightness;

      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;

        if (r > 1.0) discard;

        float core = exp(-r * r * 8.0);

        gl_FragColor = vec4(vColor * core * vBrightness * 1.2, 1.0);
      }
    `
  });

  const bgPoints = new THREE.Points(bgGeo, bgMat);
  cosmosGroup.add(bgPoints);

  const backgroundStarsMeta = [];

  const knownDirections = STARS.map(
    star => star.position.clone().normalize()
  );

  const duplicateDotThreshold = Math.cos(0.15 * DEG2RAD);

  function isAlreadyInMainCatalog(direction) {
    for (let i = 0; i < knownDirections.length; i++) {
      if (knownDirections[i].dot(direction) >= duplicateDotThreshold) {
        return true;
      }
    }

    return false;
  }

  function loadRealStarCatalog() {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('fetch() unavailable'));
    }

    const fetchOptions = {
      cache: 'force-cache'
    };

    if (catalogAbortController) {
      fetchOptions.signal = catalogAbortController.signal;
    }

    return fetch(STAR_CATALOG_URL, fetchOptions)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        return res.text();
      })
      .then((csv) => {
        if (disposed) return 0;

        const positions = [];
        const colors = [];
        const sizes = [];
        const brightnesses = [];

        const lines = csv.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (!line || line.startsWith('#')) continue;

          const fields = parseCSVRow(line);

          if (fields.length < 4) continue;

          const ra = Number(fields[0]);
          const dec = Number(fields[1]);
          const mag = Number(fields[2]);

          const bvRaw = (fields[3] || '').trim();
          const bv = bvRaw === '' ? Number.NaN : Number(bvRaw);

          const spectral = (fields[4] || '').trim();
          const hd = (fields[5] || '').trim();
          const hip = (fields[6] || '').trim();

          const distPcRaw = (fields[7] || '').trim();
          const distPc = distPcRaw === '' ? Number.NaN : Number(distPcRaw);

          const name = (fields[8] || '').trim();

          // Защищаем геометрию от некорректных координат и числовых значений.
          if (!Number.isFinite(ra) || ra < 0 || ra > 360) continue;
          if (!Number.isFinite(dec) || dec < -90 || dec > 90) continue;
          if (!Number.isFinite(mag) || mag > 6.8 || mag < -2.0) continue;

          const direction = celestialToCartesian(ra, dec, 1).normalize();

          if (isAlreadyInMainCatalog(direction)) continue;

          const pos = direction.clone().multiplyScalar(CELESTIAL_RADIUS);

          positions.push(pos.x, pos.y, pos.z);

          const rgb = bvToRgb(bv);
          colors.push(rgb[0], rgb[1], rgb[2]);

          const sizeT = THREE.MathUtils.clamp((6.5 - mag) / 4.5, 0, 1);
          sizes.push(2.2 + sizeT * 2.8);

          const relativeFlux = Math.pow(10, -0.4 * (mag - 1.5));

          const brightness = THREE.MathUtils.clamp(
            0.12 + 0.88 * Math.sqrt(relativeFlux),
            0.15,
            0.95
          );

          brightnesses.push(brightness);

          const distanceValid = Number.isFinite(distPc) && distPc > 0;
          const bvForClass = Number.isFinite(bv) ? bv : 0.65;

          backgroundStarsMeta.push({
            name: name || (
              hip
                ? `HIP ${hip}`
                : (hd ? `HD ${hd}` : 'Звезда фонового поля')
            ),

            constName: hip
              ? `Каталог Hipparcos (HIP ${hip})`
              : (
                hd
                  ? `Каталог Генри Дрейпера (HD ${hd})`
                  : 'Фоновый каталог звёзд'
              ),

            ra: ra.toFixed(2),
            dec: dec.toFixed(2),
            mag: mag.toFixed(2),

            spectral: spectral || (
              bvForClass < 0.2
                ? 'A / B'
                : (bvForClass < 0.8 ? 'F / G' : 'K / M')
            ),

            distLy: distanceValid
              ? (distPc * 3.26156).toFixed(1)
              : 'не определено',

            position: pos
          });
        }

        // Все четыре атрибута собираются в одинаковом порядке с metadata.
        bgGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(Float32Array.from(positions), 3)
        );

        bgGeo.setAttribute(
          'aColor',
          new THREE.BufferAttribute(Float32Array.from(colors), 3)
        );

        bgGeo.setAttribute(
          'aSize',
          new THREE.BufferAttribute(Float32Array.from(sizes), 1)
        );

        bgGeo.setAttribute(
          'aBrightness',
          new THREE.BufferAttribute(Float32Array.from(brightnesses), 1)
        );

        bgGeo.computeBoundingSphere();

        console.info(
          `[Cosmos] Загружено звёзд из каталога: ${backgroundStarsMeta.length}`
        );

        return backgroundStarsMeta.length;
      });
  }

  const backgroundCatalogReady = loadRealStarCatalog().catch((err) => {
    if (!disposed && (!err || err.name !== 'AbortError')) {
      console.warn(
        '[Cosmos] Фоновый CSV-каталог не загружен; активны главные звёзды созвездий.',
        err
      );
    }

    return 0;
  });
  
// ------------------------------------------------------------
  // 8. ИНТЕРАКТИВНОЕ НАВЕДЕНИЕ: ПРИЦЕЛ И АСТРОФИЗИЧЕСКИЙ HUD
  // ------------------------------------------------------------
  const styleEl = document.createElement('style');

  styleEl.textContent = `
    .star-hud-reticle {
      position: fixed;
      width: 28px;
      height: 28px;
      pointer-events: none;
      z-index: 120;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 0.18s ease, transform 0.1s ease-out;
    }

    .star-hud-reticle.active {
      opacity: 1;
    }

    .star-hud-reticle::before,
    .star-hud-reticle::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 1px solid rgba(226, 195, 102, 0.7);
      border-radius: 50%;
      animation: hudRotate 12s linear infinite;
    }

    .star-hud-reticle::after {
      inset: -4px;
      border: 1px dashed rgba(126, 200, 227, 0.45);
      animation: hudRotate 18s linear infinite reverse;
    }

    @keyframes hudRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .star-hud-card {
      position: fixed;
      z-index: 125;
      pointer-events: none;
      box-sizing: border-box;
      background: rgba(9, 11, 16, 0.90);
      border: 1px solid rgba(226, 195, 102, 0.35);
      border-radius: 4px;
      padding: 9px 13px;
      font-family: ui-monospace, "SF Mono", "Menlo", monospace;
      color: #fafafc;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.8), 0 0 12px rgba(226, 195, 102, 0.15);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transform: translate(-50%, calc(-100% - 12px));
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.18s ease, transform 0.18s ease;
      min-width: min(220px, calc(100vw - 16px));
      max-width: min(320px, calc(100vw - 16px));
      font-size: 11px;
      line-height: 1.45;
    }

    .star-hud-card.active {
      opacity: 1;
      visibility: visible;
    }

    .star-hud-card.below {
      transform: translate(-50%, 18px);
    }

    .star-hud-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 5px;
      margin-bottom: 5px;
    }

    .star-hud-dot {
      flex: 0 0 auto;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #e2c366;
      box-shadow: 0 0 6px #e2c366;
    }

    .star-hud-title {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 700;
      color: #fff;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .star-hud-sub {
      color: #7ec8e3;
      font-size: 10px;
      margin-bottom: 6px;
    }

    .star-hud-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #9aa1b2;
    }

    .star-hud-val {
      color: #e2c366;
      font-weight: 500;
      text-align: right;
    }
  `;

  document.head.appendChild(styleEl);

  const reticleEl = document.createElement('div');
  reticleEl.className = 'star-hud-reticle';
  document.body.appendChild(reticleEl);

  const hudCardEl = document.createElement('div');
  hudCardEl.className = 'star-hud-card';

  hudCardEl.innerHTML = `
    <div class="star-hud-title-row">
      <span class="star-hud-dot"></span>
      <span class="star-hud-title star-hud-name">—</span>
    </div>

    <div class="star-hud-sub star-hud-const">—</div>

    <div class="star-hud-row">
      <span>Блеск:</span>
      <span class="star-hud-val star-hud-mag">—</span>
    </div>

    <div class="star-hud-row">
      <span>Спектр:</span>
      <span class="star-hud-val star-hud-spec">—</span>
    </div>

    <div class="star-hud-row">
      <span>Дистанция:</span>
      <span class="star-hud-val star-hud-dist">—</span>
    </div>
  `;

  document.body.appendChild(hudCardEl);

  // Ссылки на собственные элементы экземпляра — без getElementById и конфликтов ID.
  const nameEl = hudCardEl.querySelector('.star-hud-name');
  const constEl = hudCardEl.querySelector('.star-hud-const');
  const magEl = hudCardEl.querySelector('.star-hud-mag');
  const specEl = hudCardEl.querySelector('.star-hud-spec');
  const distEl = hudCardEl.querySelector('.star-hud-dist');

  function getViewportRect() {
    if (
      activeCanvas &&
      typeof activeCanvas.getBoundingClientRect === 'function'
    ) {
      const rect = activeCanvas.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        return rect;
      }
    }

    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function starWorldPosition(star) {
    cosmosGroup.updateMatrixWorld(true);
    return cosmosGroup.localToWorld(star.position.clone());
  }

  function projectStarToScreen(star) {
    if (!activeCamera || !star || !star.position) {
      return null;
    }

    const rect = getViewportRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const projected = starWorldPosition(star).project(activeCamera);

    if (
      !Number.isFinite(projected.x) ||
      !Number.isFinite(projected.y) ||
      !Number.isFinite(projected.z) ||
      projected.x < -1 ||
      projected.x > 1 ||
      projected.y < -1 ||
      projected.y > 1 ||
      projected.z < -1 ||
      projected.z > 1
    ) {
      return null;
    }

    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height
    };
  }

  function placeHUD(screenX, screenY) {
    reticleEl.style.left = `${screenX}px`;
    reticleEl.style.top = `${screenY}px`;

    // Положение карточки выбирается так, чтобы она не выходила за экран.
    const cardWidth = hudCardEl.offsetWidth || 240;
    const cardHeight = hudCardEl.offsetHeight || 130;

    const halfWidth = Math.min(
      cardWidth / 2,
      Math.max(0, window.innerWidth / 2 - 8)
    );

    const clampedX = THREE.MathUtils.clamp(
      screenX,
      halfWidth + 8,
      Math.max(halfWidth + 8, window.innerWidth - halfWidth - 8)
    );

    const canGoAbove = screenY - cardHeight - 12 >= 8;
    const canGoBelow = screenY + cardHeight + 18 <= window.innerHeight - 8;
    const placeBelow = !canGoAbove && canGoBelow;

    hudCardEl.classList.toggle('below', placeBelow);

    hudCardEl.style.left = `${clampedX}px`;

    hudCardEl.style.top = `${
      THREE.MathUtils.clamp(
        screenY,
        8,
        Math.max(8, window.innerHeight - 8)
      )
    }px`;
  }

  function hideHoverHUD() {
    hoveredStar = null;

    reticleEl.classList.remove('active');
    hudCardEl.classList.remove('active', 'below');

    document.body.style.cursor = '';
  }

  function showStarHUD(star, screenX, screenY) {
    hoveredStar = star;

    nameEl.textContent = star.name || 'Звезда';

    constEl.textContent = star.constName ||
      `Координаты: RA ${star.ra}° / Dec ${star.dec}°`;

    magEl.textContent = `${star.mag} mag`;

    specEl.textContent = star.spectral ||
      `Звезда класса ${Number(star.bv) < 0.2 ? 'A' : 'K'}`;

    const distance = String(
      star.distLy == null ? '' : star.distLy
    ).trim();

    const distanceUnknown =
      !distance ||
      /^(unknown|не определено|неизвестно|н\/д|—|-)$/i.test(distance);

    distEl.textContent = distanceUnknown
      ? '—'
      : `${distance} св. лет`;

    reticleEl.classList.add('active');
    hudCardEl.classList.add('active');

    placeHUD(screenX, screenY);

    document.body.style.cursor = 'crosshair';
  }

  function updateRaycastThreshold() {
    if (!activeCamera) return;

    const rect = getViewportRect();

    if (!rect.height) return;

    if (activeCamera.isOrthographicCamera) {
      const viewHeight = Math.abs(
        activeCamera.top - activeCamera.bottom
      );

      raycaster.params.Points.threshold = Math.max(
        0.01,
        viewHeight * PICK_RADIUS_PX / rect.height
      );

      return;
    }

    // Оценка пересечения текущего луча со сферой позволяет сохранять примерно
    // одинаковый радиус захвата в экранных пикселях при изменении FOV/масштаба.
    const cameraPosition = activeCamera.getWorldPosition(
      new THREE.Vector3()
    );

    cosmosGroup.updateMatrixWorld(true);

    const sphereCenter = cosmosGroup.getWorldPosition(
      new THREE.Vector3()
    );

    const offset = cameraPosition.sub(sphereCenter);
    const direction = raycaster.ray.direction.clone().normalize();

    const b = offset.dot(direction);
    const c = offset.lengthSq() -
      CELESTIAL_RADIUS * CELESTIAL_RADIUS;

    const discriminant = b * b - c;

    let depth = CELESTIAL_RADIUS;

    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);

      const nearT = -b - root;
      const farT = -b + root;
      const hitT = nearT > 0 ? nearT : farT;

      if (hitT > 0 && Number.isFinite(hitT)) {
        depth = hitT;
      }
    }

    const fov = activeCamera.getEffectiveFOV
      ? activeCamera.getEffectiveFOV()
      : activeCamera.fov;

    const fovRadians = THREE.MathUtils.degToRad(fov || 60);

    const worldUnitsPerPixel =
      (2 * depth * Math.tan(fovRadians / 2)) / rect.height;

    raycaster.params.Points.threshold = THREE.MathUtils.clamp(
      worldUnitsPerPixel * PICK_RADIUS_PX,
      0.05,
      CELESTIAL_RADIUS * 0.1
    );
  }

  function testStarRaycast() {
    if (
      disposed ||
      !activeCamera ||
      isPointerDown ||
      !pointerInside
    ) {
      hideHoverHUD();
      return;
    }

    raycaster.setFromCamera(mouseCoords, activeCamera);

    updateRaycastThreshold();

    // Главные звёзды проверяются первыми, чтобы сохранить приоритет каталога.
    const hitsBright = raycaster.intersectObject(
      brightStarsPoints,
      false
    );

    if (hitsBright.length > 0) {
      const star = STARS[hitsBright[0].index];
      const screen = star ? projectStarToScreen(star) : null;

      if (star && screen) {
        showStarHUD(star, screen.x, screen.y);
        return;
      }
    }

    // Затем проверяем звёзды фонового каталога.
    if (backgroundStarsMeta.length > 0) {
      const hitsBg = raycaster.intersectObject(
        bgPoints,
        false
      );

      if (hitsBg.length > 0) {
        const star = backgroundStarsMeta[hitsBg[0].index];
        const screen = star ? projectStarToScreen(star) : null;

        if (star && screen) {
          showStarHUD(star, screen.x, screen.y);
          return;
        }
      }
    }

    hideHoverHUD();
  }

  // Проверка: находится ли курсор над модальными окнами, карточками или диалогами
  function isPointerOverModal(event) {
    let target = event && event.target;

    if (!target || target === window || target === document || target === document.documentElement) {
      if (
        typeof document.elementFromPoint === 'function' &&
        event &&
        Number.isFinite(event.clientX) &&
        Number.isFinite(event.clientY)
      ) {
        target = document.elementFromPoint(event.clientX, event.clientY);
      }
    }

    if (!target || typeof target.closest !== 'function') return false;

    return Boolean(
      target.closest(
        '.workshop-card, .redirect-modal-wrap, .redirect-card, [role="dialog"], .btn-restore, .star-hud-card'
      )
    );
  }

  function onPointerMove(event) {
    if (disposed || isPointerDown) return;

    // При наведении на модалку отключаем распознавание и прячем прицел
    if (isPointerOverModal(event)) {
      pointerInside = false;
      hideHoverHUD();
      return;
    }

    const rect = getViewportRect();

    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!inside || rect.width <= 0 || rect.height <= 0) {
      pointerInside = false;
      hideHoverHUD();
      return;
    }

    pointerInside = true;

    mouseCoords.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    mouseCoords.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    testStarRaycast();
  }

  function onPointerDown() {
    isPointerDown = true;
    hideHoverHUD();
  }

  function onPointerUp(event) {
    isPointerDown = false;

    if (
      event &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY)
    ) {
      onPointerMove(event);
    }
  }

  function onPointerCancel() {
    isPointerDown = false;
    hideHoverHUD();
  }

  window.addEventListener(
    'pointerdown',
    onPointerDown,
    { capture: true, passive: true }
  );

  window.addEventListener(
    'pointerup',
    onPointerUp,
    { capture: true, passive: true }
  );

  window.addEventListener(
    'pointercancel',
    onPointerCancel,
    { capture: true, passive: true }
  );

  window.addEventListener(
    'pointermove',
    onPointerMove,
    { capture: true, passive: true }
  );

  // ------------------------------------------------------------
  // 9. ЖИЗНЕННЫЙ ЦИКЛ И ПУБЛИЧНЫЙ API
  // ------------------------------------------------------------
  skySphere.onBeforeRender = function (renderer, sc, cam) {
    if (disposed) return;

    activeRenderer = renderer || activeRenderer;

    activeCanvas = (
      activeRenderer && activeRenderer.domElement
    )
      ? activeRenderer.domElement
      : activeCanvas;

    activeCamera = cam || activeCamera;

    brightMat.uniforms.uTime.value = performance.now() * 0.001;

    // При движении камеры обновляем HUD в мировых координатах экземпляра.
    if (
      hoveredStar &&
      activeCamera &&
      !isPointerDown &&
      pointerInside
    ) {
      const screen = projectStarToScreen(hoveredStar);

      if (screen) {
        placeHUD(screen.x, screen.y);
      } else {
        hideHoverHUD();
      }
    }
  };

  let cosmosAPI;

  cosmosAPI = {
    group: cosmosGroup,

    catalog: STARS,

    catalogReady: backgroundCatalogReady,

    getStarByName: function (name) {
      const query = String(
        name == null ? '' : name
      ).trim().toLocaleLowerCase();

      if (!query) return null;

      return STARS.find(
        star => star.name.toLocaleLowerCase().includes(query)
      ) || backgroundStarsMeta.find(
        star => star.name.toLocaleLowerCase().includes(query)
      ) || null;
    },

    setConstellationLinesVisible: function (visible) {
      constellationLinesMesh.visible = Boolean(visible);
    },

    setConstellationOpacity: function (opacity) {
      const value = Number(opacity);

      lineMat.opacity = THREE.MathUtils.clamp(
        Number.isFinite(value) ? value : 0.20,
        0,
        1
      );
    },

    update: function (time) {
      if (!disposed && Number.isFinite(time)) {
        brightMat.uniforms.uTime.value = time;
      }
    },

    dispose: function () {
      if (disposed) return;

      disposed = true;
      hoveredStar = null;
      pointerInside = false;

      if (catalogAbortController) {
        catalogAbortController.abort();
      }

      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerCancel, { capture: true });
      window.removeEventListener('pointermove', onPointerMove, { capture: true });

      if (cosmosGroup.parent) {
        cosmosGroup.parent.remove(cosmosGroup);
      }

      skySphere.onBeforeRender = null;

      skyGeo.dispose();
      skyMat.dispose();

      brightGeo.dispose();
      brightMat.dispose();

      lineGeo.dispose();
      lineMat.dispose();

      bgGeo.dispose();
      bgMat.dispose();

      reticleEl.remove();
      hudCardEl.remove();
      styleEl.remove();

      if (document.body.style.cursor === 'crosshair') {
        document.body.style.cursor = '';
      }

      if (window.cosmos === cosmosAPI) {
        window.cosmos = null;
      }
    }
  };

  window.cosmos = cosmosAPI;

  return cosmosAPI;
};  