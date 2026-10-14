// A dungeon: uma trilha sinuosa por uma floresta escura, cercada por um rio.
// Iluminada apenas pela lua, por lamparinas ao longo da trilha e pelos braseiros
// da clareira final, onde espera o Chefão.
import * as THREE from 'three';

function criarAleatorio(semente) {
  let s = semente % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const suave = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function texturaChao() {
  const tam = 256;
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b2414';
  ctx.fillRect(0, 0, tam, tam);
  const rnd = criarAleatorio(7);
  const cores = ['#232f19', '#151d10', '#2a2a1a', '#1e2a16', '#2c3320', '#11170c'];
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = cores[Math.floor(rnd() * cores.length)];
    const r = 1 + rnd() * 6;
    ctx.beginPath();
    ctx.arc(rnd() * tam, rnd() * tam, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // folhas secas
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#3a2c17' : '#2e2412';
    ctx.save();
    ctx.translate(rnd() * tam, rnd() * tam);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillRect(-3, -1, 6, 2);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Mapa de normais com ondinhas (repete sem emendas) para a água do rio. */
function texturaOndas() {
  const n = 128;
  const h = new Float32Array(n * n);
  const ondas = [[3, 1, 0.5], [1, 4, 0.4], [5, 3, 0.25], [2, 7, 0.2], [7, 2, 0.15]];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      for (const [fx, fy, a] of ondas) v += a * Math.sin(((x * fx + y * fy) / n) * Math.PI * 2 + fx);
      h[y * n + x] = v;
    }
  }
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)];
      const dy = h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x];
      const v = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
      const k = (y * n + x) * 4;
      dados[k] = (v.x * 0.5 + 0.5) * 255;
      dados[k + 1] = (v.y * 0.5 + 0.5) * 255;
      dados[k + 2] = (v.z * 0.5 + 0.5) * 255;
      dados[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(dados, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function texturaBrilho(cor = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, cor);
  g.addColorStop(0.25, cor.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------ Caminho
// Pontos de controle da trilha (x, z). O jogador começa perto de (0, 0) e segue para -z.
const CONTROLE = [
  [0, 9], [0, -12], [12, -32], [22, -56], [9, -79], [-15, -93], [-29, -116],
  [-16, -141], [10, -153], [29, -174], [24, -200], [3, -215], [-7, -238],
];
const LARGURA = 10;        // meia-largura da área andável ao longo da trilha
const LARGURA_ARENA = 17;  // meia-largura da clareira final
const LARGURA_RIO = 6;
const NIVEL_AGUA = -0.4;
const LARGURA_TRILHA = 2.3; // meia-largura da trilha de terra

export function criarMundo(scene) {
  const rnd = criarAleatorio(1337);
  const corNevoa = 0x05070e;
  scene.background = new THREE.Color(corNevoa);
  scene.fog = new THREE.FogExp2(corNevoa, 0.042);

  // ---------- Curva central da trilha ----------
  const curva = new THREE.CatmullRomCurve3(CONTROLE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const nSeg = Math.round(curva.getLength() / 2);
  const amostras = curva.getSpacedPoints(nSeg);
  const N = amostras.length;
  const PX = new Float32Array(N), PZ = new Float32Array(N), PS = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    PX[i] = amostras[i].x;
    PZ[i] = amostras[i].z;
    PS[i] = i === 0 ? 0 : PS[i - 1] + Math.hypot(PX[i] - PX[i - 1], PZ[i] - PZ[i - 1]);
  }
  const L = PS[N - 1];

  /** Meia-largura da área andável na posição s da trilha (alarga na clareira final). */
  const larguraEm = (s) => LARGURA + (LARGURA_ARENA - LARGURA) * suave((s - (L - 38)) / 22);

  /** Ponto mais próximo da trilha: distância d, posição s ao longo dela e o ponto (x, z). */
  const consulta = { d: 0, s: 0, x: 0, z: 0, e: 0 };
  function consultar(x, z) {
    let melhor = Infinity, ms = 0, mx = 0, mz = 0;
    for (let i = 0; i < N - 1; i++) {
      const ax = PX[i], az = PZ[i];
      const bx = PX[i + 1] - ax, bz = PZ[i + 1] - az;
      const len2 = bx * bx + bz * bz;
      let t = ((x - ax) * bx + (z - az) * bz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + bx * t, qz = az + bz * t;
      const d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
      if (d2 < melhor) {
        melhor = d2;
        ms = PS[i] + (PS[i + 1] - PS[i]) * t;
        mx = qx;
        mz = qz;
      }
    }
    consulta.d = Math.sqrt(melhor);
    consulta.s = ms;
    consulta.x = mx;
    consulta.z = mz;
    consulta.e = consulta.d - larguraEm(ms); // > 0: fora da área andável
    return consulta;
  }

  /** Ponto na trilha a s metros do início, deslocado lateralmente. */
  function pontoNoCaminho(s, lateral = 0) {
    s = Math.min(L, Math.max(0, s));
    let i = 0;
    while (i < N - 2 && PS[i + 1] < s) i++;
    const t = (s - PS[i]) / (PS[i + 1] - PS[i] || 1);
    const tx = PX[i + 1] - PX[i], tz = PZ[i + 1] - PZ[i];
    const tl = Math.hypot(tx, tz) || 1;
    return {
      x: PX[i] + tx * t + (-tz / tl) * lateral,
      z: PZ[i] + tz * t + (tx / tl) * lateral,
      dir: Math.atan2(tx, tz),
    };
  }

  // ---------- Luzes ----------
  scene.add(new THREE.HemisphereLight(0x36456e, 0x0b0905, 0.55));
  const luzLua = new THREE.DirectionalLight(0xa9bcff, 1.1);
  const offsetLua = new THREE.Vector3(-25, 45, -30);
  luzLua.castShadow = true;
  luzLua.shadow.mapSize.set(1024, 1024);
  const sc = luzLua.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22;
  sc.near = 1; sc.far = 120;
  luzLua.shadow.bias = -0.0008;
  luzLua.shadow.normalBias = 0.03;
  scene.add(luzLua, luzLua.target);

  // ---------- Céu (lua e estrelas acompanham a câmera) ----------
  const ceu = new THREE.Group();
  const posLua = new THREE.Vector3(-90, 120, -110);
  const lua = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }));
  lua.position.copy(posLua);
  ceu.add(lua);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(170,190,255,1)'), blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, transparent: true, opacity: 0.55,
  }));
  halo.scale.setScalar(60);
  halo.position.copy(posLua);
  ceu.add(halo);
  const nEstrelas = 700;
  const posEstrelas = new Float32Array(nEstrelas * 3);
  for (let i = 0; i < nEstrelas; i++) {
    const th = rnd() * Math.PI * 2;
    const ph = 0.15 + rnd() * 1.3;
    posEstrelas[i * 3] = Math.cos(th) * Math.cos(ph) * 200;
    posEstrelas[i * 3 + 1] = Math.sin(ph) * 200;
    posEstrelas[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 200;
  }
  const geoEstrelas = new THREE.BufferGeometry();
  geoEstrelas.setAttribute('position', new THREE.BufferAttribute(posEstrelas, 3));
  ceu.add(new THREE.Points(geoEstrelas, new THREE.PointsMaterial({ color: 0xc8d4ff, size: 1.6, sizeAttenuation: false, fog: false })));
  scene.add(ceu);

  // ---------- Terreno: trilha, floresta, leito do rio e margem de fora ----------
  const margem = LARGURA_ARENA + LARGURA_RIO + 30;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]);
    minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]);
  }
  minX -= margem; maxX += margem; minZ -= margem; maxZ += margem;
  const largX = maxX - minX, largZ = maxZ - minZ;
  const res = 1.25;
  const segX = Math.ceil(largX / res), segZ = Math.ceil(largZ / res);
  const geoChao = new THREE.PlaneGeometry(largX, largZ, segX, segZ);
  geoChao.rotateX(-Math.PI / 2);
  geoChao.translate(minX + largX / 2, 0, minZ + largZ / 2);
  const posChao = geoChao.attributes.position;
  const cores = new Float32Array(posChao.count * 3);
  const uvs = geoChao.attributes.uv;
  for (let i = 0; i < posChao.count; i++) {
    const x = posChao.getX(i), z = posChao.getZ(i);
    const q = consultar(x, z);
    const e = q.e;
    const ruido = Math.sin(x * 0.37) * Math.cos(z * 0.29) * 0.08;
    // altura: plano onde se anda, desce até o leito do rio e sobe na margem de fora
    let y;
    if (e <= -0.4) y = 0;
    else if (e < 1.2) y = -1.15 * suave((e + 0.4) / 1.6);
    else if (e < LARGURA_RIO - 1.2) y = -1.15 + ruido;
    else if (e < LARGURA_RIO + 0.6) y = -1.15 + 1.5 * suave((e - (LARGURA_RIO - 1.2)) / 1.8);
    else y = 0.35 + ruido * 2;
    posChao.setY(i, y);
    uvs.setXY(i, x / 9, z / 9);
    // cor: terra batida na trilha, lama no rio, floresta no resto
    const larguraTrilha = LARGURA_TRILHA + Math.sin(q.s * 0.21) * 0.35;
    const trilha = 1 - suave((q.d - larguraTrilha) / 1.1);
    let r = 1, g = 1, b = 1;
    if (e < 0) {
      const t = q.s > L - 38 ? Math.min(trilha, 1 - suave((q.s - (L - 38)) / 14)) : trilha;
      r = 1 + t * 1.1; g = 1 + t * 0.45; b = 1 + t * 0.05;
    } else if (e < LARGURA_RIO + 0.4) {
      r = 0.55; g = 0.6; b = 0.7;
    }
    cores[i * 3] = r; cores[i * 3 + 1] = g; cores[i * 3 + 2] = b;
  }
  geoChao.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geoChao.computeVertexNormals();
  const chao = new THREE.Mesh(geoChao, new THREE.MeshStandardMaterial({ map: texturaChao(), vertexColors: true, roughness: 1, metalness: 0 }));
  chao.receiveShadow = true;
  scene.add(chao);

  // ---------- Rio ----------
  const ondas = texturaOndas();
  ondas.repeat.set(largX / 14, largZ / 14);
  const agua = new THREE.Mesh(
    new THREE.PlaneGeometry(largX, largZ).rotateX(-Math.PI / 2).translate(minX + largX / 2, NIVEL_AGUA, minZ + largZ / 2),
    new THREE.MeshStandardMaterial({
      color: 0x123a58, emissive: 0x06182a, roughness: 0.08, metalness: 0.2,
      normalMap: ondas, normalScale: new THREE.Vector2(0.45, 0.45),
    })
  );
  agua.receiveShadow = true;
  scene.add(agua);

  // ---------- Obstáculos (grade espacial para colisões rápidas) ----------
  const CELULA = 4;
  const grade = new Map();
  const obstaculos = [];
  const chaveCel = (cx, cz) => cx * 73856093 + cz * 19349663;
  function addObstaculo(x, z, r) {
    const o = { x, z, r };
    obstaculos.push(o);
    const c0x = Math.floor((x - r) / CELULA), c1x = Math.floor((x + r) / CELULA);
    const c0z = Math.floor((z - r) / CELULA), c1z = Math.floor((z + r) / CELULA);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const k = chaveCel(cx, cz);
        if (!grade.has(k)) grade.set(k, []);
        grade.get(k).push(o);
      }
    }
  }
  function vizinhos(x, z, fn) {
    const cx = Math.floor(x / CELULA), cz = Math.floor(z / CELULA);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const lista = grade.get(chaveCel(cx + i, cz + j));
        if (lista) for (const o of lista) if (fn(o)) return true;
      }
    }
    return false;
  }
  const livreDeObstaculos = (x, z, r) =>
    !vizinhos(x, z, (o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2);

  // ---------- Lamparinas ao longo da trilha e braseiros na clareira final ----------
  const fontesDeLuz = []; // { x, y, z, cor, base, fase, brilho }
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 0.6, metalness: 0.7 });
  const matVidro = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2.5 });
  const geoPoste = new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6);
  const geoBraco = new THREE.BoxGeometry(0.06, 0.06, 0.7);
  const geoLanterna = new THREE.BoxGeometry(0.3, 0.42, 0.3);
  const geoTampa = new THREE.ConeGeometry(0.28, 0.22, 4);
  const texBrilhoLamp = texturaBrilho('rgba(255,170,80,1)');
  const posLamparinas = [{ s: 7, lado: -1 }];
  for (let s = 26, lado = 1; s < L - 40; s += 25, lado = -lado) posLamparinas.push({ s, lado });
  for (const { s, lado } of posLamparinas) {
    const p = pontoNoCaminho(s, lado * 3.4);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    // o braço da lamparina aponta para a trilha
    g.rotation.y = p.dir + (lado > 0 ? Math.PI / 2 : -Math.PI / 2);
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.y = 1.6;
    poste.castShadow = true;
    const braco = new THREE.Mesh(geoBraco, matPoste);
    braco.position.set(0, 3.05, 0.3);
    const lanterna = new THREE.Mesh(geoLanterna, matVidro);
    lanterna.position.set(0, 2.75, 0.6);
    const tampa = new THREE.Mesh(geoTampa, matPoste);
    tampa.position.set(0, 3.07, 0.6);
    tampa.rotation.y = Math.PI / 4;
    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texBrilhoLamp, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8,
    }));
    brilho.scale.setScalar(2.2);
    brilho.position.copy(lanterna.position);
    g.add(poste, braco, lanterna, tampa, brilho);
    scene.add(g);
    g.updateMatrixWorld();
    const pl = new THREE.Vector3(0, 2.6, 0.6).applyMatrix4(g.matrixWorld);
    fontesDeLuz.push({ x: pl.x, y: pl.y, z: pl.z, cor: 0xff9a45, base: 22, dist: 18, fase: rnd() * 100, brilho });
    addObstaculo(p.x, p.z, 0.35);
  }

  // clareira final: círculo de pedras antigas e dois braseiros
  const fimTrilha = pontoNoCaminho(L - 9);
  const matPedra = new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 0.95, flatShading: true });
  const matRuna = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x3cff6a, emissiveIntensity: 1.2 });
  const geoMenir = new THREE.BoxGeometry(1.1, 3.2, 0.7, 1, 2, 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + fimTrilha.dir;
    // deixa a entrada (de onde vem a trilha) livre
    if (Math.abs(Math.sin((a - fimTrilha.dir - Math.PI) / 2)) < 0.25) continue;
    const x = fimTrilha.x + Math.sin(a) * 12.5, z = fimTrilha.z + Math.cos(a) * 12.5;
    const menir = new THREE.Mesh(geoMenir, matPedra);
    menir.position.set(x, 1.4, z);
    menir.rotation.set((rnd() - 0.5) * 0.15, a, (rnd() - 0.5) * 0.2);
    menir.scale.y = 0.8 + rnd() * 0.5;
    menir.castShadow = true;
    menir.receiveShadow = true;
    const runa = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.6), matRuna);
    runa.position.set(0, 0.3, -0.36);
    runa.rotation.y = Math.PI;
    menir.add(runa);
    scene.add(menir);
    addObstaculo(x, z, 0.75);
  }
  const matFogo = new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(255,140,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  for (const lado of [-1, 1]) {
    const p = pontoNoCaminho(L - 9, lado * 6.5);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.1, 8), matPoste);
    pe.position.y = 0.55;
    const bacia = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 10), matPoste);
    bacia.position.y = 1.25;
    const fogo = new THREE.Sprite(matFogo.clone());
    fogo.scale.set(1.4, 1.9, 1);
    fogo.position.y = 1.85;
    pe.castShadow = bacia.castShadow = true;
    g.add(pe, bacia, fogo);
    scene.add(g);
    fontesDeLuz.push({ x: p.x, y: 2.2, z: p.z, cor: 0xff7a2a, base: 40, dist: 22, fase: rnd() * 100, brilho: fogo, fogo: true });
    addObstaculo(p.x, p.z, 0.6);
  }

  // conjunto fixo de luzes, movidas para as fontes mais próximas do jogador
  const luzes = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xff9a45, 0, 18, 1.6);
    scene.add(l);
    luzes.push(l);
  }

  // ---------- Árvores ----------
  const arvores = [];
  function tentarArvores(qtd, aceita, espaco) {
    let n = 0;
    for (let k = 0; k < qtd * 12 && n < qtd; k++) {
      const x = minX + rnd() * largX, z = minZ + rnd() * largZ;
      const q = consultar(x, z);
      if (!aceita(q)) continue;
      const s = 0.75 + rnd() * 0.75;
      if (!livreDeObstaculos(x, z, espaco * s)) continue;
      arvores.push({ x, z, s });
      addObstaculo(x, z, 0.42 * s);
      n++;
    }
  }
  // dentro da área andável, fora da trilha (a clareira final fica mais aberta)
  tentarArvores(150, (q) => q.e < -1.6 && q.d > 4 && !(q.s > L - 34 && q.d < 15), 2.6);
  // floresta fechada do outro lado do rio
  tentarArvores(1000, (q) => q.e > LARGURA_RIO + 1.2 && q.e < LARGURA_RIO + 26, 1.6);

  const geoTronco = new THREE.CylinderGeometry(0.22, 0.38, 3, 7).translate(0, 1.5, 0);
  const geoCopa = [
    new THREE.ConeGeometry(2.0, 3.0, 8).translate(0, 3.6, 0),
    new THREE.ConeGeometry(1.6, 2.6, 8).translate(0, 5.0, 0),
    new THREE.ConeGeometry(1.1, 2.2, 8).translate(0, 6.3, 0),
  ];
  const matTronco = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 1, flatShading: true });
  const matCopa = new THREE.MeshStandardMaterial({ color: 0x14301f, roughness: 0.95, flatShading: true });
  // agrupa em blocos para que os fora da tela não sejam desenhados
  const blocos = new Map();
  for (const t of arvores) {
    const k = `${Math.floor(t.x / 45)},${Math.floor(t.z / 45)}`;
    if (!blocos.has(k)) blocos.set(k, []);
    blocos.get(k).push(t);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const cor = new THREE.Color();
  for (const lista of blocos.values()) {
    const troncos = new THREE.InstancedMesh(geoTronco, matTronco, lista.length);
    const copas = geoCopa.map((g) => new THREE.InstancedMesh(g, matCopa, lista.length));
    lista.forEach((t, i) => {
      const y = consultar(t.x, t.z).e > 0 ? 0.3 : 0;
      q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
      m.compose(new THREE.Vector3(t.x, y, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + rnd() * 0.4), t.s));
      troncos.setMatrixAt(i, m);
      cor.setHSL(0.36 + rnd() * 0.08, 0.35 + rnd() * 0.2, 0.55 + rnd() * 0.5);
      for (const c of copas) {
        c.setMatrixAt(i, m);
        c.setColorAt(i, cor);
      }
    });
    for (const im of [troncos, ...copas]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
    }
  }

  // ---------- Pedras ----------
  const pedrasLista = [];
  for (let k = 0; k < 400 && pedrasLista.length < 50; k++) {
    const p = pontoNoCaminho(rnd() * L, (rnd() * 2 - 1) * (LARGURA - 1.5));
    const qq = consultar(p.x, p.z);
    if (qq.d < 3.5 || qq.e > -1) continue;
    const s = 0.5 + rnd() * 1.1;
    if (!livreDeObstaculos(p.x, p.z, 0.7 * s + 0.4)) continue;
    pedrasLista.push({ x: p.x, z: p.z, s });
    addObstaculo(p.x, p.z, 0.5 * s);
  }
  const pedras = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9, flatShading: true }),
    pedrasLista.length
  );
  pedrasLista.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
    m.compose(new THREE.Vector3(p.x, 0.15 * p.s, p.z), q, new THREE.Vector3(p.s, p.s * 0.7, p.s));
    pedras.setMatrixAt(i, m);
  });
  pedras.castShadow = true;
  pedras.receiveShadow = true;
  scene.add(pedras);

  // ---------- Juncos nas margens do rio ----------
  const juncos = [];
  for (let k = 0; k < 4000 && juncos.length < 700; k++) {
    const lado = rnd() < 0.5 ? -1 : 1;
    const s = rnd() * L;
    const dentro = rnd() < 0.6;
    const lat = larguraEm(s) + (dentro ? -0.6 + rnd() * 0.9 : LARGURA_RIO - 0.2 + rnd() * 0.9);
    const p = pontoNoCaminho(s, lado * lat);
    if (Math.abs(consultar(p.x, p.z).e - (lat - larguraEm(s))) > 0.8) continue; // curva fechada
    juncos.push(p);
  }
  const geoJunco = new THREE.ConeGeometry(0.05, 1, 4).translate(0, 0.5, 0);
  const matJunco = new THREE.MeshStandardMaterial({ color: 0x2f4a22, roughness: 1, flatShading: true });
  const imJuncos = new THREE.InstancedMesh(geoJunco, matJunco, juncos.length * 3);
  let ij = 0;
  for (const p of juncos) {
    for (let k = 0; k < 3; k++) {
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4));
      const h = 0.6 + rnd() * 0.9;
      m.compose(new THREE.Vector3(p.x + (rnd() - 0.5) * 0.4, -0.3, p.z + (rnd() - 0.5) * 0.4), q, new THREE.Vector3(1, h, 1));
      imJuncos.setMatrixAt(ij++, m);
    }
  }
  imJuncos.computeBoundingSphere();
  scene.add(imJuncos);

  // ---------- Cogumelos brilhantes ----------
  const geoChapeu = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const geoCaule = new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5);
  const matChapeu = new THREE.MeshStandardMaterial({ color: 0x3fb6ff, emissive: 0x1f8fff, emissiveIntensity: 1.6 });
  const matCaule = new THREE.MeshStandardMaterial({ color: 0xbfc8d8, emissive: 0x334455 });
  const internas = arvores.filter((t) => consultar(t.x, t.z).e < 0);
  const nCog = 110;
  const chapeus = new THREE.InstancedMesh(geoChapeu, matChapeu, nCog);
  const caules = new THREE.InstancedMesh(geoCaule, matCaule, nCog);
  for (let i = 0; i < nCog; i++) {
    const t = internas[Math.floor(rnd() * internas.length)];
    const a = rnd() * Math.PI * 2;
    const r = 0.6 + rnd() * 0.8;
    const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
    const s = 0.6 + rnd() * 1.0;
    m.compose(new THREE.Vector3(x, 0.16 * s, z), q.identity(), new THREE.Vector3(s, s, s));
    chapeus.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 0.08 * s, z), q, new THREE.Vector3(s, s, s));
    caules.setMatrixAt(i, m);
  }
  chapeus.computeBoundingSphere();
  caules.computeBoundingSphere();
  scene.add(chapeus, caules);

  // ---------- Vaga-lumes (ao longo da trilha e sobre o rio) ----------
  const nVaga = 360;
  const vagaBase = new Float32Array(nVaga * 3);
  const vagaPos = new Float32Array(nVaga * 3);
  for (let i = 0; i < nVaga; i++) {
    const p = pontoNoCaminho(rnd() * L, (rnd() * 2 - 1) * (LARGURA + LARGURA_RIO));
    vagaBase[i * 3] = p.x;
    vagaBase[i * 3 + 1] = 0.5 + rnd() * 2.5;
    vagaBase[i * 3 + 2] = p.z;
  }
  const geoVaga = new THREE.BufferGeometry();
  geoVaga.setAttribute('position', new THREE.BufferAttribute(vagaPos, 3));
  const vagalumes = new THREE.Points(geoVaga, new THREE.PointsMaterial({
    color: 0xd8ff7a, size: 0.22, map: texturaBrilho('rgba(220,255,140,1)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  vagalumes.frustumCulled = false;
  scene.add(vagalumes);

  // ---------- Atualização por quadro ----------
  let timerLuzes = 0;
  const ativas = [];
  function atualizar(dt, t, foco, camera) {
    luzLua.position.copy(foco).add(offsetLua);
    luzLua.target.position.copy(foco);
    ceu.position.copy(camera.position);
    ondas.offset.x += dt * 0.012;
    ondas.offset.y += dt * 0.02;

    // escolhe as fontes de luz mais próximas a cada 0,25 s
    timerLuzes -= dt;
    if (timerLuzes <= 0) {
      timerLuzes = 0.25;
      ativas.length = 0;
      ativas.push(...fontesDeLuz
        .map((f) => ({ f, d: (f.x - foco.x) ** 2 + (f.z - foco.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, luzes.length)
        .map((x) => x.f));
    }
    luzes.forEach((l, i) => {
      const f = ativas[i];
      if (!f) {
        l.intensity = 0;
        return;
      }
      const osc = Math.sin(t * 9 + f.fase) * 0.5 + Math.sin(t * 23 + f.fase * 2) * 0.3 + Math.sin(t * 2.1 + f.fase) * 0.2;
      l.position.set(f.x, f.y, f.z);
      l.color.setHex(f.cor);
      l.distance = f.dist;
      l.intensity = f.base * (0.85 + osc * (f.fogo ? 0.25 : 0.12));
    });
    for (const f of fontesDeLuz) {
      const osc = Math.sin(t * 9 + f.fase) * 0.5 + Math.sin(t * 17 + f.fase) * 0.5;
      if (f.fogo) f.brilho.scale.set(1.4 + osc * 0.15, 1.9 + osc * 0.3, 1);
      else f.brilho.material.opacity = 0.7 + osc * 0.08;
    }

    for (let i = 0; i < nVaga; i++) {
      const k = i * 3;
      const fi = i * 1.731;
      vagaPos[k] = vagaBase[k] + Math.sin(t * 0.5 + fi) * 1.5;
      vagaPos[k + 1] = vagaBase[k + 1] + Math.sin(t * 0.8 + fi * 2) * 0.5;
      vagaPos[k + 2] = vagaBase[k + 2] + Math.cos(t * 0.4 + fi) * 1.5;
    }
    geoVaga.attributes.position.needsUpdate = true;
  }

  /** Empurra um círculo para fora das árvores/pedras e o mantém deste lado do rio. */
  function resolverColisao(pos, raio) {
    vizinhos(pos.x, pos.z, (o) => {
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const min = o.r + raio;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const k = (min - d) / d;
        pos.x += dx * k;
        pos.z += dz * k;
      }
      return false;
    });
    const qq = consultar(pos.x, pos.z);
    const limite = larguraEm(qq.s) - 0.4 - raio;
    if (qq.d > limite) {
      const k = limite / qq.d;
      pos.x = qq.x + (pos.x - qq.x) * k;
      pos.z = qq.z + (pos.z - qq.z) * k;
    }
  }

  /** true se um ponto bate numa árvore, pedra ou poste (usado por projéteis). */
  const colideObstaculo = (x, z, r) => !livreDeObstaculos(x, z, r);

  /** true se o ponto está do lado de cá do rio e longe de obstáculos. */
  const livre = (x, z, r) => consultar(x, z).e < -0.4 - r && livreDeObstaculos(x, z, r);

  return {
    comprimento: L,
    atualizar,
    resolverColisao,
    colideObstaculo,
    livre,
    consultar,
    pontoNoCaminho,
    larguraEm,
  };
}
