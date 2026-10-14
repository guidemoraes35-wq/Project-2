// O castelo dos duendes: um pátio murado ao entardecer, com torres nos cantos,
// a fortaleza no fundo, uma fogueira no meio, tendas, barricadas e braseiros.
// O herói entra pelo portão do sul.
import * as THREE from 'three';
import { texturaBrilho, criarAleatorio } from './world.js';
import { geoCopaPinheiro, geoTronco, criarBraseiro } from './natureza.js';

const X0 = -22, X1 = 22;  // limites do pátio onde se anda
const Z0 = -54, Z1 = 4;
const suave = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function canvas(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Terra batida com pedrinhas e palha. */
function texturaPatio(rnd) {
  return canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a553c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = ['#5e4a33', '#76604a', '#584530', '#7e6a50'][Math.floor(rnd() * 4)];
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = rnd() > 0.5 ? '#9a8450' : '#7a6838';
      ctx.lineWidth = 1;
      const x = rnd() * w, y = rnd() * h, a = rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.stroke();
    }
  });
}

/** Blocos de pedra (em tons de cinza: a cor vem do material). */
function texturaPedra() {
  const tex = canvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, w, h);
    const linhas = 6;
    for (let j = 0; j < linhas; j++) {
      const y = (j / linhas) * h;
      for (let i = 0; i < 4; i++) {
        const x = ((i + (j % 2) * 0.5) / 4) * w;
        const l = 140 + Math.floor(Math.random() * 50);
        ctx.fillStyle = `rgb(${l},${l},${l})`;
        ctx.fillRect(x + 2, y + 2, w / 4 - 4, h / linhas - 4);
      }
    }
  });
  return tex;
}

export function criarCastelo() {
  const scene = new THREE.Scene();
  const rnd = criarAleatorio(777);
  const corCeu = 0x3a2a48;
  scene.background = new THREE.Color(corCeu);
  scene.fog = new THREE.Fog(corCeu, 35, 120);

  // ---------- Luz de fim de tarde ----------
  scene.add(new THREE.HemisphereLight(0x9a88c0, 0x2a1a10, 1.0));
  const sol = new THREE.DirectionalLight(0xffa868, 1.8);
  sol.position.set(-40, 30, 20);
  sol.target.position.set(0, 0, -25);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45;
  sc.near = 5; sc.far = 140;
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.04;
  scene.add(sol, sol.target);

  // céu em degradê: laranja no horizonte, roxo no alto
  const ceu = new THREE.Group();
  const geoCupula = new THREE.SphereGeometry(300, 24, 12);
  {
    const p = geoCupula.attributes.position;
    const cores = new Float32Array(p.count * 3);
    const topo = new THREE.Color(0x241a3a), horizonte = new THREE.Color(0xd8784a), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      c.copy(horizonte).lerp(topo, suave(p.getY(i) / 120));
      cores.set([c.r, c.g, c.b], i * 3);
    }
    geoCupula.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  }
  ceu.add(new THREE.Mesh(geoCupula, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  const brilhoSol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,170,100,1)'), fog: false, depthWrite: false, transparent: true }));
  brilhoSol.scale.setScalar(80);
  brilhoSol.position.copy(sol.position).normalize().multiplyScalar(250);
  ceu.add(brilhoSol);
  scene.add(ceu);

  // ---------- Colisões ----------
  const circulos = [];
  const caixas = [];
  const addCirculo = (x, z, r) => circulos.push({ x, z, r });
  const addCaixa = (x, z, mx, mz, rot = 0) => caixas.push({ x, z, mx, mz, cos: Math.cos(rot), sin: Math.sin(rot) });
  function dentroDeCaixa(x, z, folga) {
    for (const c of caixas) {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.mx + folga && Math.abs(lz) < c.mz + folga) return true;
    }
    return false;
  }
  const livre = (x, z, r) =>
    x > X0 + r && x < X1 - r && z > Z0 + r && z < Z1 - r &&
    !dentroDeCaixa(x, z, r) && circulos.every((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > (c.r + r) ** 2);

  const M = {
    pedra: new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.95, map: texturaPedra() }),
    pedraEscura: new THREE.MeshStandardMaterial({ color: 0x5a554e, roughness: 0.95, map: texturaPedra() }),
    madeira: new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.9 }),
    madeiraEscura: new THREE.MeshStandardMaterial({ color: 0x3e2816, roughness: 0.9 }),
    telhado: new THREE.MeshStandardMaterial({ color: 0x3e5a2a, roughness: 0.8, flatShading: true }),
    bandeira: new THREE.MeshStandardMaterial({ color: 0x4f8a2a, roughness: 0.9, side: THREE.DoubleSide }),
    lona: new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1, flatShading: true }),
    ferro: new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.7 }),
  };
  const adicionar = (geo, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // ---------- Chão ----------
  const texChao = texturaPatio(rnd);
  texChao.repeat.set(40, 40);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texChao, roughness: 1 }));
  chao.receiveShadow = true;
  scene.add(chao);
  // caminho de lajes do portão até a fortaleza
  const lajes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.95 }), 160);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), e = new THREE.Vector3(1, 1, 1);
  let n = 0;
  for (let z = 3; z > -44 && n < 160; z -= 1.1) {
    for (const x of [-1.4, 0, 1.4]) {
      if (n >= 160) break;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.15);
      m4.compose(v.set(x + (rnd() - 0.5) * 0.15, 0.02, z), q, e.set(0.9 + rnd() * 0.2, 1, 1));
      lajes.setMatrixAt(n++, m4);
    }
  }
  lajes.count = n;
  lajes.receiveShadow = true;
  scene.add(lajes);

  // ---------- Muralhas com ameias ----------
  const alturaMuro = 6, espessura = 2;
  const ameias = [];
  function muro(x0, z0, x1, z1) {
    const comp = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    adicionar(new THREE.BoxGeometry(espessura, alturaMuro, comp), M.pedra, cx, alturaMuro / 2, cz, ang);
    for (let d = 0.6; d < comp - 0.3; d += 1.4) {
      ameias.push({ x: x0 + Math.sin(ang) * d, z: z0 + Math.cos(ang) * d, ang });
    }
  }
  const W = 24, N = -58, S = 7;
  muro(-W, S, -W, N);
  muro(W, S, W, N);
  muro(-W, N, W, N);
  muro(-W, S, -3.5, S);
  muro(3.5, S, W, S);
  const imAmeias = new THREE.InstancedMesh(new THREE.BoxGeometry(espessura + 0.1, 1, 0.8), M.pedra, ameias.length);
  ameias.forEach((a, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.ang);
    m4.compose(v.set(a.x, alturaMuro + 0.5, a.z), q, e.set(1, 1, 1));
    imAmeias.setMatrixAt(i, m4);
  });
  imAmeias.castShadow = true;
  scene.add(imAmeias);

  // portão: arco de pedra e grade de ferro levantada
  for (const s of [-1, 1]) adicionar(new THREE.CylinderGeometry(2.2, 2.4, 9, 10), M.pedraEscura, s * 4.6, 4.5, S);
  for (const s of [-1, 1]) adicionar(new THREE.ConeGeometry(2.8, 3.2, 10), M.telhado, s * 4.6, 10.6, S);
  adicionar(new THREE.BoxGeometry(7, 1.6, espessura), M.pedraEscura, 0, 6.6, S);
  for (let i = 0; i < 6; i++) adicionar(new THREE.BoxGeometry(0.12, 2.0, 0.12), M.ferro, -2.5 + i, 5.4, S);

  // torres nos cantos
  for (const [x, z] of [[-W, N], [W, N], [-W, S], [W, S]]) {
    if (z === S) continue; // o portão já tem as torres dele
    adicionar(new THREE.CylinderGeometry(3.2, 3.6, 11, 12), M.pedraEscura, x, 5.5, z);
    adicionar(new THREE.ConeGeometry(4, 4.5, 12), M.telhado, x, 13.2, z);
    adicionar(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), M.madeiraEscura, x, 16.4, z);
    const b = adicionar(new THREE.PlaneGeometry(1.4, 0.9), M.bandeira, x + 0.7, 17, z);
    b.userData.bandeira = true;
  }

  // ---------- Fortaleza no fundo ----------
  const fz = -51;
  adicionar(new THREE.BoxGeometry(20, 12, 10), M.pedraEscura, 0, 6, fz - 1);
  adicionar(new THREE.BoxGeometry(21, 1, 11), M.pedra, 0, 12.3, fz - 1);
  for (const s of [-1, 1]) {
    adicionar(new THREE.CylinderGeometry(2.6, 2.8, 17, 12), M.pedraEscura, s * 10, 8.5, fz + 3);
    adicionar(new THREE.ConeGeometry(3.3, 5, 12), M.telhado, s * 10, 19.5, fz + 3);
  }
  adicionar(new THREE.CylinderGeometry(3.2, 3.4, 20, 12), M.pedra, 0, 10, fz - 3);
  adicionar(new THREE.ConeGeometry(4, 6, 12), M.telhado, 0, 23, fz - 3);
  adicionar(new THREE.BoxGeometry(3.4, 4.6, 0.4), M.madeiraEscura, 0, 2.3, fz + 4.1);
  for (const s of [-1, 1]) {
    // estandartes verdes com uma caveira de duende pintada
    const est = adicionar(new THREE.PlaneGeometry(2, 5), M.bandeira, s * 5, 7, fz + 4.05);
    est.userData.bandeira = true;
    adicionar(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 }), s * 5, 7.6, fz + 4.12).scale.z = 0.2;
  }
  addCaixa(0, fz - 1, 10.5, 5.5);
  for (const s of [-1, 1]) addCirculo(s * 10, fz + 3, 3);

  // ---------- Pátio: fogueira, tendas, barricadas, caixotes e braseiros ----------
  const fontes = [];
  // fogueira com troncos
  const fx = 0, fzf = -24;
  for (let i = 0; i < 5; i++) {
    const t = adicionar(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 7), M.madeiraEscura, fx, 0.25, fzf, (i / 5) * Math.PI);
    t.rotation.z = Math.PI / 2 - 0.35;
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    adicionar(new THREE.DodecahedronGeometry(0.28, 0), M.pedraEscura, fx + Math.cos(a) * 1.3, 0.15, fzf + Math.sin(a) * 1.3);
  }
  const fogo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,140,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fogo.scale.set(2.4, 3.2, 1);
  fogo.position.set(fx, 1.4, fzf);
  scene.add(fogo);
  fontes.push({ x: fx, y: 1.6, z: fzf, base: 45, fogo });
  addCirculo(fx, fzf, 1.6);

  // tendas de lona dos duendes
  for (const [x, z, s] of [[-15, -12, 1], [-16, -30, 1.2], [15, -18, 1.1], [16, -38, 1], [-12, -42, 0.9]]) {
    adicionar(new THREE.ConeGeometry(2.4 * s, 3 * s, 6), M.lona, x, 1.5 * s, z, rnd() * 3);
    adicionar(new THREE.CylinderGeometry(0.06, 0.06, 3.6 * s, 5), M.madeiraEscura, x, 1.8 * s, z);
    addCirculo(x, z, 2.1 * s);
  }

  // barricadas de estacas pontudas
  const geoEstaca = new THREE.ConeGeometry(0.14, 1.6, 6);
  for (const [x, z, ang, comp] of [[-7, -8, 0.3, 4], [8, -10, -0.4, 5], [-9, -34, -0.2, 5], [9, -30, 0.5, 4], [0, -38, 0, 6]]) {
    for (let d = -comp / 2; d <= comp / 2; d += 0.35) {
      const px = x + Math.cos(ang) * d, pz = z - Math.sin(ang) * d;
      const est = adicionar(geoEstaca, M.madeira, px, 0.7, pz);
      est.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    }
    adicionar(new THREE.BoxGeometry(comp, 0.15, 0.12), M.madeiraEscura, x, 0.5, z, ang);
    addCaixa(x, z, comp / 2 + 0.2, 0.35, ang);
  }

  // caixotes e barris
  const geoCaixote = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const geoBarril = new THREE.CylinderGeometry(0.38, 0.38, 0.95, 12);
  for (const [x, z] of [[-19, -4], [-18.6, -5.1], [19, -6], [18, -46], [-19, -48], [-18, -47], [12, -2], [20, -26]]) {
    if (rnd() < 0.5) adicionar(geoCaixote, M.madeira, x, 0.4, z, rnd());
    else adicionar(geoBarril, M.madeiraEscura, x, 0.48, z);
    addCirculo(x, z, 0.55);
  }

  // braseiros ao longo do caminho
  const matFerro = new THREE.MeshStandardMaterial({ color: 0x24211f, roughness: 0.55, metalness: 0.75 });
  for (const [x, z] of [[-4, -4], [4, -4], [-4, -40], [4, -40]]) {
    const g = criarBraseiro(matFerro);
    g.position.set(x, 0, z);
    scene.add(g);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,140,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.scale.set(1.4, 1.9, 1);
    f.position.set(x, 1.85, z);
    scene.add(f);
    fontes.push({ x, y: 2.2, z, base: 28, fogo: f });
    addCirculo(x, z, 0.6);
  }
  const luzes = fontes.map((f) => {
    const l = new THREE.PointLight(0xff8a3a, f.base, 18, 1.6);
    l.position.set(f.x, f.y, f.z);
    scene.add(l);
    return l;
  });

  // torre de vigia de madeira
  {
    const x = 14, z = -30;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) adicionar(new THREE.BoxGeometry(0.25, 5, 0.25), M.madeiraEscura, x + dx * 1.1, 2.5, z + dz * 1.1);
    adicionar(new THREE.BoxGeometry(3, 0.25, 3), M.madeira, x, 5, z);
    adicionar(new THREE.ConeGeometry(2.3, 1.6, 4), M.lona, x, 6.6, z, Math.PI / 4);
    addCaixa(x, z, 1.5, 1.5);
  }

  // ---------- Floresta escura do lado de fora ----------
  const arvores = [];
  for (let k = 0; k < 4000 && arvores.length < 160; k++) {
    const x = (rnd() - 0.5) * 200, z = 10 - rnd() * 150;
    if (x > -30 && x < 30 && z > -64 && z < 12) continue;
    arvores.push({ x, z, s: 0.9 + rnd() * 0.8 });
  }
  const matCasca = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1, vertexColors: true });
  const matPinho = new THREE.MeshStandardMaterial({ color: 0x1f3a28, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide });
  const troncos = new THREE.InstancedMesh(geoTronco(3.2, 0.26, 2), matCasca, arvores.length);
  const copas = new THREE.InstancedMesh(geoCopaPinheiro(2), matPinho, arvores.length);
  arvores.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
    m4.compose(v.set(t.x, 0, t.z), q, e.set(t.s, t.s, t.s));
    troncos.setMatrixAt(i, m4);
    copas.setMatrixAt(i, m4);
  });
  troncos.castShadow = copas.castShadow = true;
  scene.add(troncos, copas);

  const bandeiras = [];
  scene.traverse((o) => { if (o.userData.bandeira) bandeiras.push(o); });

  // ---------- Atualização ----------
  function atualizar(dt, t, foco, camera) {
    ceu.position.copy(camera.position);
    fontes.forEach((f, i) => {
      const osc = Math.sin(t * 9 + i) * 0.5 + Math.sin(t * 17 + i * 2) * 0.5;
      luzes[i].intensity = f.base * (0.85 + osc * 0.2);
      const grande = f.base > 30;
      f.fogo.scale.set((grande ? 2.4 : 1.4) * (1 + osc * 0.08), (grande ? 3.2 : 1.9) * (1 + osc * 0.15), 1);
    });
    bandeiras.forEach((b, i) => { b.rotation.y = Math.sin(t * 2 + i) * 0.25; });
  }

  /** Empurra um círculo para fora dos obstáculos e o mantém dentro do pátio. */
  function resolverColisao(pos, raio) {
    for (const c of circulos) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const min = c.r + raio;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x += (dx * (min - d)) / d;
        pos.z += (dz * (min - d)) / d;
      }
    }
    for (const c of caixas) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      let lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const px = Math.max(-c.mx, Math.min(c.mx, lx)), pz = Math.max(-c.mz, Math.min(c.mz, lz));
      const ex = lx - px, ez = lz - pz;
      const d = Math.hypot(ex, ez);
      if (d >= raio) continue;
      if (d > 1e-6) {
        lx = px + (ex / d) * raio;
        lz = pz + (ez / d) * raio;
      } else if (c.mx - Math.abs(lx) < c.mz - Math.abs(lz)) {
        lx = Math.sign(lx || 1) * (c.mx + raio);
      } else {
        lz = Math.sign(lz || 1) * (c.mz + raio);
      }
      pos.x = c.x + lx * c.cos + lz * c.sin;
      pos.z = c.z - lx * c.sin + lz * c.cos;
    }
    pos.x = Math.max(X0 + raio, Math.min(X1 - raio, pos.x));
    pos.z = Math.max(Z0 + raio, Math.min(Z1 - raio, pos.z));
  }

  return {
    scene,
    /** O herói entra pelo portão do sul, olhando para a fortaleza. */
    inicio: { x: 0, z: 1.5, dir: Math.PI },
    /** Onde aparece o portal de volta quando o castelo é libertado. */
    centro: { x: 0, z: -18 },
    atualizar,
    resolverColisao,
    /** true se o ponto bate num obstáculo (para as flechas). */
    colide: (x, z, r) => dentroDeCaixa(x, z, r) || circulos.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2),
    /** Ponto livre aleatório do pátio, a partir de `zMax` para dentro. */
    pontoLivre(folga = 0.6, zMax = -6) {
      for (let k = 0; k < 80; k++) {
        const x = X0 + 1 + Math.random() * (X1 - X0 - 2);
        const z = Z0 + 1 + Math.random() * (zMax - Z0 - 1);
        if (livre(x, z, folga)) return { x, z };
      }
      return { x: 0, z: -20 };
    },
  };
}
