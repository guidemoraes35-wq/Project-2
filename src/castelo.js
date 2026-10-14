// O castelo dos duendes: um pátio murado ao entardecer, com torres nos cantos,
// a fortaleza no fundo, uma fogueira no meio, tendas, barricadas e braseiros.
// O herói entra pelo portão do sul; uma passagem pela fortaleza leva a um labirinto
// de corredores e, no fim dele, à sala do tesouro da Princesa Duendete.
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
  scene.add(new THREE.HemisphereLight(0xb8a8d8, 0x4a3a28, 1.6));
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
  // regiões onde se anda: pátio, passagem pela fortaleza, labirinto, saída e sala do tesouro
  const ZONAS = [
    { x0: X0, x1: X1, z0: Z0, z1: Z1 },
    { x0: -3.4, x1: 3.4, z0: -61, z1: -46 },
    { x0: -24.1, x1: 24.1, z0: -101.6, z1: -60.4 },
    { x0: -3.4, x1: 3.4, z0: -103.2, z1: -101 },
    { x0: -15, x1: 15, z0: -130.5, z1: -102.6 },
  ];
  const naZona = (x, z, r) => ZONAS.some((zn) => x > zn.x0 + r && x < zn.x1 - r && z > zn.z0 + r && z < zn.z1 - r);
  const livre = (x, z, r) =>
    naZona(x, z, r) && !dentroDeCaixa(x, z, r) && circulos.every((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > (c.r + r) ** 2);

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
  muro(-W, N, -3.5, N);
  muro(3.5, N, W, N);
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
  // a fortaleza é dividida por uma passagem aberta (sem teto), da largura de um corredor
  // do labirinto, que leva direto à entrada dele
  for (const s of [-1, 1]) {
    adicionar(new THREE.BoxGeometry(6.5, 12, 10), M.pedraEscura, s * 6.75, 6, fz - 1);
    adicionar(new THREE.BoxGeometry(7, 1, 11), M.pedra, s * 6.75, 12.3, fz - 1);
  }
  const lajePassagem = adicionar(new THREE.BoxGeometry(7, 0.05, 15), M.pedraEscura, 0, 0.03, fz - 3.5);
  lajePassagem.receiveShadow = true;
  for (const s of [-1, 1]) {
    adicionar(new THREE.CylinderGeometry(2.6, 2.8, 17, 12), M.pedraEscura, s * 10, 8.5, fz + 3);
    adicionar(new THREE.ConeGeometry(3.3, 5, 12), M.telhado, s * 10, 19.5, fz + 3);
  }
  // arcos na frente e atrás da passagem, com tochas
  for (const z of [fz + 4.1, fz - 6.1]) adicionar(new THREE.TorusGeometry(3.5, 0.4, 8, 18, Math.PI), M.pedra, 0, 5.6, z);
  for (const s of [-1, 1]) {
    // estandartes verdes com uma caveira de duende pintada
    const est = adicionar(new THREE.PlaneGeometry(2, 5), M.bandeira, s * 5, 7, fz + 4.05);
    est.userData.bandeira = true;
    adicionar(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 }), s * 5, 7.6, fz + 4.12).scale.z = 0.2;
  }
  for (const s of [-1, 1]) addCaixa(s * 6.75, fz - 1, 3.25, 5.2);
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
  for (const [x, z, ang, comp] of [[-7, -8, 0.3, 4], [8, -10, -0.4, 5], [-9, -34, -0.2, 5], [9, -30, 0.5, 4]]) {
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
  const luzes = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xff8a3a, 0, 18, 1.6);
    scene.add(l);
    luzes.push(l);
  }

  // torre de vigia de madeira
  {
    const x = 14, z = -30;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) adicionar(new THREE.BoxGeometry(0.25, 5, 0.25), M.madeiraEscura, x + dx * 1.1, 2.5, z + dz * 1.1);
    adicionar(new THREE.BoxGeometry(3, 0.25, 3), M.madeira, x, 5, z);
    adicionar(new THREE.ConeGeometry(2.3, 1.6, 4), M.lona, x, 6.6, z, Math.PI / 4);
    addCaixa(x, z, 1.5, 1.5);
  }

  // ---------- Labirinto de corredores ----------
  // Grade de 7 × 6 salas de 7 m. Um labirinto gerado com caminhos extras (vários caminhos
  // possíveis). A entrada fica no meio do lado de cima e a saída no meio do lado de baixo.
  const COLS = 7, LINHAS = 6, C = 7, MX0 = -24.5, MZ0 = -60;
  const ENTRADA = { i: 3, j: 0 }, SAIDA = { i: 3, j: LINHAS - 1 };
  const celulas = [];
  for (let j = 0; j < LINHAS; j++) {
    for (let i = 0; i < COLS; i++) {
      celulas.push({ i, j, x: MX0 + C * (i + 0.5), z: MZ0 - C * (j + 0.5), vizinhas: [], p: 0 });
    }
  }
  const cel = (i, j) => (i >= 0 && j >= 0 && i < COLS && j < LINHAS ? celulas[j * COLS + i] : null);
  const ligar = (a, b) => { a.vizinhas.push(b); b.vizinhas.push(a); };
  const ligadas = (a, b) => a.vizinhas.includes(b);
  {
    // caminho principal escavado com backtracking
    const visit = new Set();
    const pilha = [cel(ENTRADA.i, ENTRADA.j)];
    visit.add(pilha[0]);
    while (pilha.length) {
      const atual = pilha[pilha.length - 1];
      const opcoes = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([di, dj]) => cel(atual.i + di, atual.j + dj))
        .filter((c) => c && !visit.has(c));
      if (!opcoes.length) { pilha.pop(); continue; }
      const prox = opcoes[Math.floor(rnd() * opcoes.length)];
      ligar(atual, prox);
      visit.add(prox);
      pilha.push(prox);
    }
    // abre algumas paredes a mais: mais de um caminho e menos becos
    let extras = 0;
    for (let k = 0; k < 200 && extras < 9; k++) {
      const a = celulas[Math.floor(rnd() * celulas.length)];
      const [di, dj] = [[1, 0], [0, 1]][Math.floor(rnd() * 2)];
      const b = cel(a.i + di, a.j + dj);
      if (b && !ligadas(a, b)) { ligar(a, b); extras++; }
    }
  }
  // distância (em salas) desde a entrada: 0 no começo, 1 no ponto mais fundo
  {
    const dist = new Map([[cel(ENTRADA.i, ENTRADA.j), 0]]);
    const fila = [cel(ENTRADA.i, ENTRADA.j)];
    while (fila.length) {
      const c = fila.shift();
      for (const v of c.vizinhas) if (!dist.has(v)) { dist.set(v, dist.get(c) + 1); fila.push(v); }
    }
    const max = Math.max(...dist.values());
    for (const c of celulas) c.p = dist.get(c) / max;
  }

  const matParedeLab = new THREE.MeshStandardMaterial({ color: 0xa89e8c, roughness: 0.95, map: texturaPedra() });
  matParedeLab.map.repeat.set(2, 1);
  const altParede = 3.4, esp = 0.8;
  function parede(x, z, comprimento, aoLongoDeX) {
    const g = aoLongoDeX ? new THREE.BoxGeometry(comprimento + esp, altParede, esp) : new THREE.BoxGeometry(esp, altParede, comprimento + esp);
    adicionar(g, matParedeLab, x, altParede / 2, z);
    if (aoLongoDeX) addCaixa(x, z, (comprimento + esp) / 2, esp / 2);
    else addCaixa(x, z, esp / 2, (comprimento + esp) / 2);
  }
  for (const c of celulas) {
    const x0 = c.x - C / 2, z0 = c.z + C / 2; // canto de cima à esquerda
    // parede de cima (só para a primeira linha) e da esquerda (só para a primeira coluna)
    if (c.j === 0 && !(c.i === ENTRADA.i)) parede(c.x, z0, C, true);
    if (c.i === 0) parede(x0, c.z, C, false);
    // parede de baixo e da direita, a não ser que haja passagem
    const baixo = cel(c.i, c.j + 1), dir = cel(c.i + 1, c.j);
    const saida = c.i === SAIDA.i && c.j === SAIDA.j;
    if (!(baixo ? ligadas(c, baixo) : saida)) parede(c.x, c.z - C / 2, C, true);
    if (!(dir && ligadas(c, dir))) parede(c.x + C / 2, c.z, C, false);
  }
  // chão de pedra do labirinto
  const texLab = texturaPedra();
  texLab.repeat.set(12, 10);
  const chaoLab = new THREE.Mesh(new THREE.PlaneGeometry(COLS * C, LINHAS * C).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a8c78, map: texLab, roughness: 1 }));
  chaoLab.position.set(0, 0.02, MZ0 - (LINHAS * C) / 2);
  chaoLab.receiveShadow = true;
  scene.add(chaoLab);
  // tochas nas paredes, uma em cada sala par
  const texChama = texturaBrilho('rgba(255,140,40,1)');
  for (const c of celulas) {
    if ((c.i + c.j) % 2) continue;
    const tx = c.x + (rnd() < 0.5 ? -1 : 1) * (C / 2 - 0.6);
    adicionar(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 6), M.madeiraEscura, tx, 2.2, c.z);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: texChama, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.position.set(tx, 2.65, c.z);
    scene.add(f);
    fontes.push({ x: tx, y: 2.7, z: c.z, base: 22, fogo: f, tocha: true });
  }

  // ---------- Baú no meio do labirinto ----------
  const candidatos = celulas
    .filter((c) => c.p > 0.3 && c.p < 0.7)
    .sort((a, b) => (a.vizinhas.length - b.vizinhas.length) || (Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)));
  const salaBau = candidatos[0] || celulas[Math.floor(celulas.length / 2)];
  const bau = (() => {
    const g = new THREE.Group();
    g.position.set(salaBau.x, 0, salaBau.z);
    const aberta = salaBau.vizinhas[0];
    g.rotation.y = aberta ? Math.atan2(aberta.x - salaBau.x, aberta.z - salaBau.z) : 0;
    const madeiraBau = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 });
    const ouroBau = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.35, metalness: 0.8, emissive: 0x3a2a08 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), madeiraBau);
    base.position.y = 0.3;
    base.castShadow = true;
    g.add(base);
    for (const x of [-0.45, 0.45]) {
      const faixa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.82), ouroBau);
      faixa.position.set(x, 0.3, 0);
      g.add(faixa);
    }
    const tampa = new THREE.Group();
    tampa.position.set(0, 0.6, -0.4);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), madeiraBau);
    t.position.z = 0.4;
    t.castShadow = true;
    tampa.add(t);
    const fecho = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), ouroBau);
    fecho.position.set(0, 0.0, 0.82);
    tampa.add(fecho);
    g.add(tampa);
    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,220,120,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    brilho.position.y = 0.9;
    brilho.scale.setScalar(2.2);
    g.add(brilho);
    scene.add(g);
    addCirculo(salaBau.x, salaBau.z, 0.8);
    return { x: salaBau.x, z: salaBau.z, grupo: g, tampa, brilho, aberto: false, abertura: 0 };
  })();

  // ---------- Sala do tesouro ----------
  const RZ0 = -102, RZ1 = -131, RX = 15.5;
  const matSala = new THREE.MeshStandardMaterial({ color: 0x5a4a5a, roughness: 0.9, map: texturaPedra() });
  adicionar(new THREE.BoxGeometry(esp, 6, RZ0 - RZ1), matSala, -RX, 3, (RZ0 + RZ1) / 2);
  adicionar(new THREE.BoxGeometry(esp, 6, RZ0 - RZ1), matSala, RX, 3, (RZ0 + RZ1) / 2);
  adicionar(new THREE.BoxGeometry(RX * 2 + esp, 6, esp), matSala, 0, 3, RZ1);
  // entrada da sala: colunas douradas, arco e tochas, logo na saída do labirinto
  const ouroPortal = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.35, metalness: 0.8, emissive: 0x3a2a08 });
  for (const s of [-1, 1]) {
    adicionar(new THREE.CylinderGeometry(0.45, 0.5, 4.4, 12), ouroPortal, s * 4.1, 2.2, RZ0);
    adicionar(new THREE.SphereGeometry(0.5, 12, 8), ouroPortal, s * 4.1, 4.6, RZ0);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,140,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.position.set(s * 4.1, 5.3, RZ0);
    scene.add(f);
    fontes.push({ x: s * 4.1, y: 5.3, z: RZ0, base: 24, fogo: f, tocha: true });
  }
  adicionar(new THREE.TorusGeometry(4.1, 0.3, 8, 20, Math.PI), ouroPortal, 0, 4.4, RZ0);
  const texSala = texturaPedra();
  texSala.repeat.set(8, 8);
  const chaoSala = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ0 - RZ1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, map: texSala, roughness: 0.7 }));
  chaoSala.position.set(0, 0.03, (RZ0 + RZ1) / 2);
  chaoSala.receiveShadow = true;
  scene.add(chaoSala);
  // tapete vermelho até o trono
  adicionar(new THREE.BoxGeometry(3, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 1 }), 0, 0.05, -117).receiveShadow = true;
  // trono dourado no fundo
  const ouro = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.3, metalness: 0.85, emissive: 0x3a2a08 });
  adicionar(new THREE.BoxGeometry(2.2, 1, 1.6), ouro, 0, 0.5, -128.6);
  adicionar(new THREE.BoxGeometry(2.2, 3.4, 0.4), ouro, 0, 1.7, -129.6);
  adicionar(new THREE.BoxGeometry(1.8, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xc02a5a }), 0, 1.1, -128.5);
  addCaixa(0, -128.9, 1.2, 1.1);
  // colunas
  for (const [x, z] of [[-9, -109], [9, -109], [-9, -122], [9, -122]]) {
    adicionar(new THREE.CylinderGeometry(0.7, 0.8, 6, 12), M.pedra, x, 3, z);
    addCirculo(x, z, 0.85);
  }
  // montes de moedas de ouro, joias e baús abertos pelos cantos
  const moedas = [];
  const montes = [[-12.5, -105], [12.5, -106], [-12, -128], [12, -127], [-5, -129.5], [5, -129.5], [-13, -116], [13, -118]];
  for (const [mx, mz] of montes) {
    const raio = 1.4 + rnd() * 0.8;
    for (let k = 0; k < 140; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * raio;
      const y = (1 - r / raio) * 1.0 * (0.7 + rnd() * 0.3);
      moedas.push({ x: mx + Math.cos(a) * r, y, z: mz + Math.sin(a) * r, rx: rnd() * 1.2, rz: rnd() * 1.2 });
    }
    addCirculo(mx, mz, raio * 0.7);
  }
  const imMoedas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), ouro, moedas.length);
  moedas.forEach((m, i) => {
    q.setFromEuler(new THREE.Euler(m.rx, 0, m.rz));
    m4.compose(v.set(m.x, m.y, m.z), q, e.set(1, 1, 1));
    imMoedas.setMatrixAt(i, m4);
  });
  scene.add(imMoedas);
  const coresJoias = [0xff3a6a, 0x3ac8ff, 0x6aff6a, 0xc06aff];
  for (let k = 0; k < 40; k++) {
    const [mx, mz] = montes[k % montes.length];
    const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: coresJoias[k % 4], emissive: coresJoias[k % 4], emissiveIntensity: 0.6, roughness: 0.2 }));
    j.position.set(mx + (rnd() - 0.5) * 2, 0.3 + rnd() * 0.6, mz + (rnd() - 0.5) * 2);
    j.rotation.set(rnd() * 3, rnd() * 3, 0);
    scene.add(j);
  }
  // braseiros dourados da sala
  for (const [x, z] of [[-6, -106], [6, -106], [-6, -126], [6, -126]]) {
    const g = criarBraseiro(matFerro);
    g.position.set(x, 0, z);
    scene.add(g);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: texChama, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.scale.set(1.4, 1.9, 1);
    f.position.set(x, 1.85, z);
    scene.add(f);
    fontes.push({ x, y: 2.2, z, base: 30, fogo: f });
    addCirculo(x, z, 0.6);
  }

  // ---------- Floresta escura do lado de fora ----------
  const arvores = [];
  for (let k = 0; k < 4000 && arvores.length < 160; k++) {
    const x = (rnd() - 0.5) * 200, z = 10 - rnd() * 220;
    if (x > -32 && x < 32 && z > -138 && z < 12) continue;
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
  let timerLuzes = 0;
  let ativas = [];
  function atualizar(dt, t, foco, camera) {
    ceu.position.copy(camera.position);
    // as luzes vão para as chamas mais perto do herói
    timerLuzes -= dt;
    if (timerLuzes <= 0) {
      timerLuzes = 0.3;
      ativas = fontes
        .map((f, i) => ({ f, i, d: (f.x - foco.x) ** 2 + (f.z - foco.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, luzes.length);
    }
    fontes.forEach((f, i) => {
      const osc = Math.sin(t * 9 + i) * 0.5 + Math.sin(t * 17 + i * 2) * 0.5;
      const grande = f.base > 40;
      if (f.tocha) f.fogo.scale.set(0.9 * (1 + osc * 0.08), 1.2 * (1 + osc * 0.15), 1);
      else f.fogo.scale.set((grande ? 2.4 : 1.4) * (1 + osc * 0.08), (grande ? 3.2 : 1.9) * (1 + osc * 0.15), 1);
    });
    luzes.forEach((l, k) => {
      const a = ativas[k];
      if (!a) { l.intensity = 0; return; }
      const osc = Math.sin(t * 9 + a.i) * 0.5 + Math.sin(t * 17 + a.i * 2) * 0.5;
      l.position.set(a.f.x, a.f.y, a.f.z);
      l.intensity = a.f.base * (0.85 + osc * 0.2);
    });
    // tampa do baú abrindo
    if (bau.aberto && bau.abertura < 1) {
      bau.abertura = Math.min(1, bau.abertura + dt * 1.5);
      bau.tampa.rotation.x = -1.9 * (1 - (1 - bau.abertura) ** 3);
      bau.brilho.material.opacity = Math.sin(bau.abertura * Math.PI) * 0.9;
    }
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
    // mantém dentro das regiões onde se anda (projeta na mais próxima)
    if (!naZona(pos.x, pos.z, raio - 1e-6)) {
      let melhor = null, md = Infinity;
      for (const zn of ZONAS) {
        const x = Math.max(zn.x0 + raio, Math.min(zn.x1 - raio, pos.x));
        const z = Math.max(zn.z0 + raio, Math.min(zn.z1 - raio, pos.z));
        const d = (x - pos.x) ** 2 + (z - pos.z) ** 2;
        if (d < md) { md = d; melhor = [x, z]; }
      }
      pos.x = melhor[0];
      pos.z = melhor[1];
    }
  }

  return {
    scene,
    /** O herói entra pelo portão do sul, olhando para a fortaleza. */
    inicio: { x: 0, z: 1.5, dir: Math.PI },
    /** Centro da sala do tesouro: a Princesa Duendete e, depois, o portal de volta. */
    centroSala: { x: 0, z: -117 },
    /**
     * Inclinação mínima da câmera: livre no pátio, sobe aos poucos na passagem para olhar por
     * cima das paredes do labirinto e baixa um pouco ao entrar na sala do tesouro.
     */
    pitchMinimo(z) {
      const labirinto = suave((-z - 44) / 14);   // de z = -44 a -58
      const sala = suave((-z - 100) / 6);        // de z = -100 a -106
      return 0.08 + (0.85 - 0.08) * labirinto + (0.55 - 0.85) * sala;
    },
    /** true se o ponto está dentro da sala do tesouro. */
    naSala: (x, z) => z < -102.6 && Math.abs(x) < 15,
    bau,
    abrirBau() {
      bau.aberto = true;
    },
    atualizar,
    resolverColisao,
    /** true se o ponto bate num obstáculo (para as flechas). */
    colide: (x, z, r) => dentroDeCaixa(x, z, r) || circulos.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2),
    /** Ponto livre aleatório do pátio, entre o portão e a fortaleza. */
    pontoPatio(folga = 0.6) {
      for (let k = 0; k < 80; k++) {
        const x = X0 + 1 + Math.random() * (X1 - X0 - 2);
        const z = -10 - Math.random() * 34;
        if (livre(x, z, folga)) return { x, z };
      }
      return { x: 0, z: -20 };
    },
    /**
     * Ponto livre numa sala do labirinto cuja distância da entrada (0 a 1) esteja entre
     * pMin e pMax. Cada sala recebe poucos duendes, para não juntar todos num lugar só.
     */
    pontoLabirinto(pMin, pMax, folga = 0.6) {
      const salas = celulas.filter((c) => c.p >= pMin && c.p <= pMax && c !== salaBau);
      salas.sort((a, b) => (a.ocupacao || 0) - (b.ocupacao || 0) || Math.random() - 0.5);
      for (const c of salas.slice(0, 4)) {
        for (let k = 0; k < 20; k++) {
          const x = c.x + (Math.random() - 0.5) * (C - 2.5), z = c.z + (Math.random() - 0.5) * (C - 2.5);
          if (livre(x, z, folga)) {
            c.ocupacao = (c.ocupacao || 0) + 1;
            return { x, z };
          }
        }
      }
      return { x: 0, z: -63 };
    },
    /** Ponto livre da sala do tesouro perto de (x, z). */
    pontoSala(x, z, folga = 0.5) {
      for (let k = 0; k < 30; k++) {
        const px = x + (Math.random() - 0.5) * 5, pz = z + (Math.random() - 0.5) * 5;
        if (livre(px, pz, folga)) return { x: px, z: pz };
      }
      return { x, z };
    },
  };
}
