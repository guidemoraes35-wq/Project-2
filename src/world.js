// A dungeon: uma floresta escura iluminada apenas pela lua e por algumas lamparinas.
import * as THREE from 'three';
import { REGRAS } from './config.js';

function criarAleatorio(semente) {
  let s = semente % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

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
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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

export function criarMundo(scene) {
  const R = REGRAS.raioMapa;
  const rnd = criarAleatorio(1337);
  const obstaculos = []; // { x, z, r }
  const corNevoa = 0x05070e;

  scene.background = new THREE.Color(corNevoa);
  scene.fog = new THREE.FogExp2(corNevoa, 0.042);

  // ---------- Luzes ----------
  const ambiente = new THREE.HemisphereLight(0x36456e, 0x0b0905, 0.55);
  scene.add(ambiente);

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
  const lua = new THREE.Mesh(
    new THREE.SphereGeometry(7, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false })
  );
  lua.position.copy(posLua);
  ceu.add(lua);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(170,190,255,1)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    transparent: true,
    opacity: 0.55,
  }));
  halo.scale.setScalar(60);
  halo.position.copy(posLua);
  ceu.add(halo);

  const nEstrelas = 700;
  const posEstrelas = new Float32Array(nEstrelas * 3);
  for (let i = 0; i < nEstrelas; i++) {
    const th = rnd() * Math.PI * 2;
    const ph = 0.15 + rnd() * 1.3;
    const r = 200;
    posEstrelas[i * 3] = Math.cos(th) * Math.cos(ph) * r;
    posEstrelas[i * 3 + 1] = Math.sin(ph) * r;
    posEstrelas[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
  }
  const geoEstrelas = new THREE.BufferGeometry();
  geoEstrelas.setAttribute('position', new THREE.BufferAttribute(posEstrelas, 3));
  ceu.add(new THREE.Points(geoEstrelas, new THREE.PointsMaterial({
    color: 0xc8d4ff, size: 1.6, sizeAttenuation: false, fog: false,
  })));
  scene.add(ceu);

  // ---------- Chão ----------
  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(R + 40, 64),
    new THREE.MeshStandardMaterial({ map: texturaChao(), roughness: 1, metalness: 0 })
  );
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  scene.add(chao);

  // ---------- Lamparinas (fontes de luz escassas) ----------
  const posLamparinas = [
    [-5, -4.5], [-14, -12], [16, -18], [-22, 14], [24, 12],
    [2, -32], [-34, -6], [30, -38], [-10, 36], [36, 30],
  ];
  const lamparinas = [];
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 0.6, metalness: 0.7 });
  const matVidro = new THREE.MeshStandardMaterial({
    color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2.5,
  });
  const geoPoste = new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6);
  const geoBraco = new THREE.BoxGeometry(0.06, 0.06, 0.7);
  const geoLanterna = new THREE.BoxGeometry(0.3, 0.42, 0.3);
  const geoTampa = new THREE.ConeGeometry(0.28, 0.22, 4);
  const texBrilhoLamp = texturaBrilho('rgba(255,170,80,1)');
  for (const [x, z] of posLamparinas) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rnd() * Math.PI * 2;
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
    const luz = new THREE.PointLight(0xff9a45, 22, 18, 1.6);
    luz.position.set(0, 2.6, 0.6);
    g.add(poste, braco, lanterna, tampa, brilho, luz);
    scene.add(g);
    lamparinas.push({ luz, brilho, fase: rnd() * 100, base: 22 });
    obstaculos.push({ x, z, r: 0.35 });
  }

  function livre(x, z, r) {
    for (const o of obstaculos) {
      const dx = o.x - x, dz = o.z - z;
      const m = o.r + r;
      if (dx * dx + dz * dz < m * m) return false;
    }
    return true;
  }

  // ---------- Árvores ----------
  const arvores = [];
  // parede densa de árvores na borda
  for (let i = 0; i < 230; i++) {
    const a = rnd() * Math.PI * 2;
    const r = R + 1 + rnd() * 14;
    arvores.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1 + rnd() * 0.8 });
  }
  // árvores espalhadas pela floresta
  let tentativas = 0;
  while (arvores.length < 230 + 170 && tentativas++ < 6000) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (R - 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 9) continue; // clareira inicial
    const s = 0.75 + rnd() * 0.75;
    if (!livre(x, z, 2.6 * s)) continue;
    arvores.push({ x, z, s });
    obstaculos.push({ x, z, r: 0.42 * s });
  }

  const geoTronco = new THREE.CylinderGeometry(0.22, 0.38, 3, 7);
  geoTronco.translate(0, 1.5, 0);
  const geoCopa = [
    new THREE.ConeGeometry(2.0, 3.0, 8).translate(0, 3.6, 0),
    new THREE.ConeGeometry(1.6, 2.6, 8).translate(0, 5.0, 0),
    new THREE.ConeGeometry(1.1, 2.2, 8).translate(0, 6.3, 0),
  ];
  const matTronco = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 1, flatShading: true });
  const matCopa = new THREE.MeshStandardMaterial({ color: 0x14301f, roughness: 0.95, flatShading: true });
  const troncos = new THREE.InstancedMesh(geoTronco, matTronco, arvores.length);
  const copas = geoCopa.map((g) => new THREE.InstancedMesh(g, matCopa, arvores.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const cor = new THREE.Color();
  arvores.forEach((t, i) => {
    q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
    m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + rnd() * 0.4), t.s));
    troncos.setMatrixAt(i, m);
    cor.setHSL(0.36 + rnd() * 0.08, 0.35 + rnd() * 0.2, 0.55 + rnd() * 0.5);
    for (const c of copas) {
      c.setMatrixAt(i, m);
      c.setColorAt(i, cor);
    }
  });
  troncos.castShadow = true;
  troncos.receiveShadow = true;
  scene.add(troncos);
  for (const c of copas) {
    c.castShadow = true;
    c.receiveShadow = true;
    scene.add(c);
  }

  // ---------- Pedras ----------
  const geoPedra = new THREE.DodecahedronGeometry(0.6, 0);
  const pedrasLista = [];
  for (let i = 0; i < 70 && pedrasLista.length < 45; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 6 + rnd() * (R - 8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.5 + rnd() * 1.1;
    if (!livre(x, z, 0.7 * s + 0.4)) continue;
    pedrasLista.push({ x, z, s });
    obstaculos.push({ x, z, r: 0.5 * s });
  }
  const pedras = new THREE.InstancedMesh(
    geoPedra,
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

  // ---------- Cogumelos brilhantes (decoração) ----------
  const geoChapeu = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const geoCaule = new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5);
  const matChapeu = new THREE.MeshStandardMaterial({ color: 0x3fb6ff, emissive: 0x1f8fff, emissiveIntensity: 1.6 });
  const matCaule = new THREE.MeshStandardMaterial({ color: 0xbfc8d8, emissive: 0x334455 });
  const nCog = 90;
  const chapeus = new THREE.InstancedMesh(geoChapeu, matChapeu, nCog);
  const caules = new THREE.InstancedMesh(geoCaule, matCaule, nCog);
  for (let i = 0; i < nCog; i++) {
    // agrupa os cogumelos perto das árvores
    const t = arvores[230 + Math.floor(rnd() * (arvores.length - 230))] || { x: 0, z: 0 };
    const a = rnd() * Math.PI * 2;
    const r = 0.6 + rnd() * 0.8;
    const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
    const s = 0.6 + rnd() * 1.0;
    m.compose(new THREE.Vector3(x, 0.16 * s, z), q.identity(), new THREE.Vector3(s, s, s));
    chapeus.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 0.08 * s, z), q, new THREE.Vector3(s, s, s));
    caules.setMatrixAt(i, m);
  }
  scene.add(chapeus, caules);

  // ---------- Vaga-lumes ----------
  const nVaga = 260;
  const vagaBase = new Float32Array(nVaga * 3);
  const vagaPos = new Float32Array(nVaga * 3);
  for (let i = 0; i < nVaga; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * R;
    vagaBase[i * 3] = Math.cos(a) * r;
    vagaBase[i * 3 + 1] = 0.5 + rnd() * 2.5;
    vagaBase[i * 3 + 2] = Math.sin(a) * r;
  }
  const geoVaga = new THREE.BufferGeometry();
  geoVaga.setAttribute('position', new THREE.BufferAttribute(vagaPos, 3));
  const vagalumes = new THREE.Points(geoVaga, new THREE.PointsMaterial({
    color: 0xd8ff7a,
    size: 0.22,
    map: texturaBrilho('rgba(220,255,140,1)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }));
  vagalumes.frustumCulled = false;
  scene.add(vagalumes);

  function atualizar(dt, t, foco, camera) {
    // a luz da lua acompanha o jogador para que as sombras fiquem sempre por perto
    luzLua.position.copy(foco).add(offsetLua);
    luzLua.target.position.copy(foco);
    ceu.position.copy(camera.position);

    for (const l of lamparinas) {
      const f = Math.sin(t * 9 + l.fase) * 0.5 + Math.sin(t * 23 + l.fase * 2) * 0.3 + Math.sin(t * 2.1 + l.fase) * 0.2;
      l.luz.intensity = l.base * (0.85 + f * 0.12);
      l.brilho.material.opacity = 0.7 + f * 0.1;
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

  /** Empurra um círculo (x, z, raio) para fora de árvores, pedras e do limite do mapa. */
  function resolverColisao(pos, raio) {
    for (const o of obstaculos) {
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const min = o.r + raio;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const empurra = (min - d) / d;
        pos.x += dx * empurra;
        pos.z += dz * empurra;
      }
    }
    const d = Math.hypot(pos.x, pos.z);
    const limite = R - raio;
    if (d > limite) {
      pos.x *= limite / d;
      pos.z *= limite / d;
    }
  }

  return { raio: R, atualizar, resolverColisao, livre };
}
