// Modelos dos personagens em estilo cartoon: formas arredondadas, sombreado em
// faixas (toon) e contorno escuro. Todos olham para +Z e têm os pés em y = 0.
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

// ------------------------------------------------------------------ Materiais
const gradiente = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 140, 205, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

const cacheMat = new Map();
/** Material toon compartilhado por cor (use `unico` para um material exclusivo). */
function toon(cor, extra = {}, unico = false) {
  const chave = cor + JSON.stringify(extra);
  if (!unico && cacheMat.has(chave)) return cacheMat.get(chave);
  const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradiente, ...extra });
  if (!unico) cacheMat.set(chave, m);
  return m;
}

// Contorno: a malha é desenhada de novo, por dentro, empurrada ao longo das normais.
const matContorno = new THREE.MeshBasicMaterial({ color: 0x0a0a12, side: THREE.BackSide });
matContorno.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  transformed += normalize(normal) * 0.018;'
  );
};

/**
 * Cria uma parte do corpo.
 * op: { p: [x,y,z], r: [x,y,z], s: [x,y,z] | número, contorno, sombra }
 */
function parte(geo, mat, op = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (op.p) m.position.set(...op.p);
  if (op.r) m.rotation.set(...op.r);
  if (op.s !== undefined) {
    if (typeof op.s === 'number') m.scale.setScalar(op.s);
    else m.scale.set(...op.s);
  }
  m.castShadow = op.sombra !== false;
  if (op.contorno !== false) {
    const c = new THREE.Mesh(geo, matContorno);
    c.raycast = () => {};
    m.add(c);
  }
  return m;
}

function grupo(x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// ------------------------------------------------------------------ Geometrias
const G = {
  esfera: new THREE.SphereGeometry(1, 20, 16),
  esferaB: new THREE.SphereGeometry(1, 10, 8),
  capsula: (r, c) => new THREE.CapsuleGeometry(r, c, 6, 12),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s),
  cil: (rt, rb, h, s = 14, aberto = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, aberto),
  toro: (r, t) => new THREE.TorusGeometry(r, t, 8, 20),
  torno: (pontos, s = 20) => new THREE.LatheGeometry(pontos.map(([x, y]) => new THREE.Vector2(x, y)), s),
};

// ------------------------------------------------------------------ Rosto
const matBrancoOlho = toon(0xffffff);
const matPreto = new THREE.MeshBasicMaterial({ color: 0x111111 });
const matBrilhoOlho = new THREE.MeshBasicMaterial({ color: 0xffffff });

/** Olho cartoon (esclera, íris, pupila e brilho) posicionado na superfície da cabeça. */
function olho(cabecaR, x, y, tam, corIris, { raiva = 0, emissivo = false } = {}) {
  const g = new THREE.Group();
  const z = Math.sqrt(Math.max(0.0001, cabecaR * cabecaR - x * x - y * y)) - tam * 0.35;
  g.position.set(x, y, z);
  g.rotation.y = Math.asin(x / cabecaR) * 0.9;
  g.rotation.x = -Math.asin(y / cabecaR) * 0.9;
  g.add(parte(G.esfera, matBrancoOlho, { s: [tam, tam * 1.2, tam * 0.55], contorno: false, sombra: false }));
  const matIris = emissivo
    ? new THREE.MeshBasicMaterial({ color: corIris })
    : toon(corIris, { emissive: corIris, emissiveIntensity: 0.25 });
  g.add(parte(G.esferaB, matIris, { p: [0, -tam * 0.05, tam * 0.4], s: [tam * 0.62, tam * 0.75, tam * 0.3], contorno: false, sombra: false }));
  g.add(parte(G.esferaB, matPreto, { p: [0, -tam * 0.05, tam * 0.52], s: [tam * 0.32, tam * 0.4, tam * 0.2], contorno: false, sombra: false }));
  g.add(parte(G.esferaB, matBrilhoOlho, { p: [tam * 0.2, tam * 0.22, tam * 0.6], s: tam * 0.16, contorno: false, sombra: false }));
  if (raiva) {
    // pálpebra superior inclinada para um olhar bravo
    const palpebra = parte(G.esferaB, toon(raiva), {
      p: [0, tam * 0.55, tam * 0.08], s: [tam * 1.15, tam * 0.55, tam * 0.65], contorno: false, sombra: false,
    });
    palpebra.rotation.z = x > 0 ? 0.35 : -0.35;
    g.add(palpebra);
  }
  return g;
}

function sobrancelha(x, y, z, larg, inclinacao, mat) {
  return parte(G.capsula(0.018, larg), mat, { p: [x, y, z], r: [0, 0, Math.PI / 2 + inclinacao], contorno: false, sombra: false });
}

// ------------------------------------------------------------------ Rig base
function baseRig(tipo) {
  const root = new THREE.Group();
  const corpo = new THREE.Group();
  root.add(corpo);
  return { tipo, root, corpo, fase: 0 };
}

/** Perna com pivô no quadril: coxa/canela em cápsula e bota arredondada. */
function perna(x, quadril, comp, raio, matPerna, matBota, tamBota = 1) {
  const p = grupo(x, quadril, 0);
  p.add(parte(G.capsula(raio, comp - raio * 2), matPerna, { p: [0, -comp / 2 + 0.02, 0] }));
  p.add(parte(G.esfera, matBota, {
    p: [0, -quadril + 0.07 * tamBota, 0.05 * tamBota],
    s: [0.1 * tamBota, 0.08 * tamBota, 0.17 * tamBota],
  }));
  p.add(parte(G.cil(raio * 1.25, raio * 1.35, 0.16), matBota, { p: [0, -quadril + 0.16 * tamBota, 0] }));
  return p;
}

/** Braço com pivô no ombro. Retorna { pivo, mao } (a mão é um grupo para segurar armas). */
function braco(x, ombro, comp, raio, matBraco, matMao, raioMao) {
  const pivo = grupo(x, ombro, 0);
  pivo.add(parte(G.capsula(raio, comp - raio * 2), matBraco, { p: [0, -comp / 2, 0] }));
  const mao = grupo(0, -comp - raioMao * 0.6, 0);
  mao.add(parte(G.esfera, matMao, { s: [raioMao, raioMao * 1.05, raioMao * 0.9] }));
  pivo.add(mao);
  return { pivo, mao };
}

// ------------------------------------------------------------------ Assassino
export function criarAssassino() {
  const rig = baseRig('assassino');
  const { corpo } = rig;
  const couro = toon(0x3d4a63);
  const couroEscuro = toon(0x252b3b);
  const tecido = toon(0x2c3247);
  const pele = toon(0xf0b98d);
  const vermelho = toon(0xc0262b);
  const metal = toon(0xb8c4d6, { emissive: 0x2a3550, emissiveIntensity: 0.6 });
  const ouro = toon(0xd9a93e);

  // pernas
  rig.pernaE = perna(0.12, 0.88, 0.84, 0.085, tecido, couroEscuro);
  rig.pernaD = perna(-0.12, 0.88, 0.84, 0.085, tecido, couroEscuro);
  corpo.add(rig.pernaE, rig.pernaD);

  // tronco: colete justo, cinto com fivela e alças cruzadas
  corpo.add(parte(G.torno([[0, 0], [0.2, 0.02], [0.23, 0.15], [0.21, 0.32], [0.26, 0.5], [0.25, 0.62], [0.12, 0.7], [0, 0.71]]), couro, { p: [0, 0.84, 0], s: [1, 1, 0.78] }));
  corpo.add(parte(G.toro(0.215, 0.035), couroEscuro, { p: [0, 0.94, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.78, 1] }));
  corpo.add(parte(G.cil(0.05, 0.05, 0.03, 4), ouro, { p: [0, 0.94, 0.17], r: [Math.PI / 2, Math.PI / 4, 0], contorno: false }));
  const alca = parte(G.cil(0.025, 0.025, 0.7, 6), couroEscuro, { p: [0, 1.22, 0.165], r: [0, 0, 0.75], contorno: false });
  corpo.add(alca);
  // ombreiras
  corpo.add(parte(G.esfera, couroEscuro, { p: [0.25, 1.46, 0], s: [0.11, 0.08, 0.12] }));
  corpo.add(parte(G.esfera, couroEscuro, { p: [-0.25, 1.46, 0], s: [0.11, 0.08, 0.12] }));
  // cachecol vermelho com ponta esvoaçante
  corpo.add(parte(G.toro(0.13, 0.055), vermelho, { p: [0, 1.53, 0.01], r: [Math.PI / 2, 0, 0] }));
  rig.cachecol = grupo(0.08, 1.52, -0.12);
  rig.cachecol.add(parte(G.capsula(0.045, 0.32), vermelho, { p: [0, -0.18, -0.02], s: [1.3, 1, 0.5] }));
  corpo.add(rig.cachecol);

  // cabeça com capuz e máscara
  const R = 0.23;
  const cabeca = grupo(0, 1.8, 0);
  cabeca.add(parte(G.esfera, pele, { s: [R, R * 1.02, R * 0.95] }));
  // capuz: calota sobre a cabeça e a nuca
  cabeca.add(parte(new THREE.SphereGeometry(R * 1.13, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), tecido, { p: [0, 0.01, -0.015], r: [-0.42, 0, 0] }));
  cabeca.add(parte(G.esfera, tecido, { p: [0, -0.01, -0.045], s: [R * 1.06, R * 1.04, R * 1.0] }));
  const ponta = parte(G.cone(0.12, 0.32), tecido, { p: [0, 0.06, -0.27], r: [-2.0, 0, 0] });
  cabeca.add(ponta);
  // máscara cobrindo nariz e boca
  cabeca.add(parte(new THREE.SphereGeometry(R * 1.04, 20, 10, -Math.PI * 0.05, Math.PI * 1.1, Math.PI * 0.55, Math.PI * 0.45), tecido, { r: [0, Math.PI * 1.5 + Math.PI * 0.5, 0] }));
  cabeca.add(olho(R, 0.085, 0.03, 0.055, 0xd9a233, { raiva: 0xf0b98d }));
  cabeca.add(olho(R, -0.085, 0.03, 0.055, 0xd9a233, { raiva: 0xf0b98d }));
  const sob = toon(0x3a2416);
  cabeca.add(sobrancelha(0.085, 0.115, R * 0.9, 0.06, 0.35, sob));
  cabeca.add(sobrancelha(-0.085, 0.115, R * 0.9, 0.06, -0.35, sob));
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  // capa curta presa nos ombros
  rig.capa = grupo(0, 1.5, -0.1);
  const capa = parte(G.cil(0.2, 0.36, 1.0, 16, true), toon(0x2a1622, { side: THREE.DoubleSide }), { p: [0, -0.5, 0], contorno: false });
  capa.geometry = new THREE.CylinderGeometry(0.2, 0.36, 1.0, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8);
  rig.capa.add(capa);
  corpo.add(rig.capa);

  // braços com braçadeiras e adagas
  const criarAdaga = () => {
    const g = new THREE.Group();
    g.add(parte(G.cil(0.022, 0.022, 0.13, 8), toon(0x3b2414), { contorno: false }));
    g.add(parte(G.esferaB, ouro, { p: [0, -0.075, 0], s: 0.03, contorno: false }));
    g.add(parte(G.capsula(0.02, 0.12), ouro, { p: [0, 0.075, 0], r: [0, 0, Math.PI / 2] }));
    const forma = new THREE.Shape();
    forma.moveTo(-0.035, 0);
    forma.quadraticCurveTo(-0.045, 0.2, 0, 0.4);
    forma.quadraticCurveTo(0.045, 0.2, 0.035, 0);
    forma.lineTo(-0.035, 0);
    const lamina = new THREE.ExtrudeGeometry(forma, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 });
    lamina.translate(0, 0.08, -0.006);
    g.add(parte(lamina, metal));
    g.rotation.x = Math.PI / 2.2;
    g.position.z = 0.03;
    return g;
  };
  const be = braco(0.31, 1.44, 0.5, 0.065, couro, couroEscuro, 0.07);
  const bd = braco(-0.31, 1.44, 0.5, 0.065, couro, couroEscuro, 0.07);
  for (const b of [be, bd]) {
    b.pivo.add(parte(G.cil(0.078, 0.07, 0.16, 12), couroEscuro, { p: [0, -0.38, 0] }));
    b.mao.add(criarAdaga());
  }
  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);
  return rig;
}

// ----------------------------------------------------------------------- Maga
export function criarMaga() {
  const rig = baseRig('maga');
  const { corpo } = rig;
  const roxo = toon(0x6a3bb5);
  const roxoEscuro = toon(0x3b2177);
  const ouro = toon(0xf0c24f, { emissive: 0x5a4010, emissiveIntensity: 0.3 });
  const pele = toon(0xffd2b3);
  const cabelo = toon(0xe9e4ff);
  const botas = toon(0x2b1d3d);

  rig.pernaE = perna(0.09, 0.62, 0.6, 0.06, toon(0xf3e9ff), botas, 0.85);
  rig.pernaD = perna(-0.09, 0.62, 0.6, 0.06, toon(0xf3e9ff), botas, 0.85);
  corpo.add(rig.pernaE, rig.pernaD);

  // vestido em sino com barra dourada
  rig.saia = grupo(0, 1.12, 0);
  rig.saia.add(parte(G.torno([[0, -0.9], [0.52, -0.9], [0.47, -0.82], [0.33, -0.55], [0.24, -0.25], [0.19, 0], [0, 0]], 24), roxo));
  rig.saia.add(parte(G.toro(0.505, 0.03), ouro, { p: [0, -0.88, 0], r: [Math.PI / 2, 0, 0], contorno: false }));
  corpo.add(rig.saia);
  // corpete
  corpo.add(parte(G.torno([[0, 0], [0.19, 0], [0.17, 0.15], [0.21, 0.32], [0.2, 0.42], [0.1, 0.48], [0, 0.49]]), roxo, { p: [0, 1.08, 0], s: [1, 1, 0.8] }));
  corpo.add(parte(G.toro(0.18, 0.03), ouro, { p: [0, 1.13, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1], contorno: false }));
  corpo.add(parte(G.esferaB, toon(0x5fd6ff, { emissive: 0x2a9fd6, emissiveIntensity: 0.8 }), { p: [0, 1.13, 0.15], s: 0.04, contorno: false }));
  // gola
  corpo.add(parte(G.cil(0.2, 0.13, 0.08, 16), roxoEscuro, { p: [0, 1.52, 0] }));

  // cabeça
  const R = 0.24;
  const cabeca = grupo(0, 1.79, 0);
  cabeca.add(parte(G.esfera, pele, { s: [R, R * 0.98, R * 0.95] }));
  cabeca.add(olho(R, 0.09, -0.01, 0.062, 0x3fb3ff));
  cabeca.add(olho(R, -0.09, -0.01, 0.062, 0x3fb3ff));
  const cilio = toon(0x2a1d3d);
  for (const x of [0.09, -0.09]) {
    cabeca.add(parte(G.capsula(0.012, 0.06), cilio, { p: [x * 1.12, 0.055, R * 0.86], r: [0, 0, Math.PI / 2 + (x > 0 ? -0.2 : 0.2)], contorno: false, sombra: false }));
  }
  cabeca.add(sobrancelha(0.09, 0.1, R * 0.9, 0.05, -0.12, toon(0xb8b0e0)));
  cabeca.add(sobrancelha(-0.09, 0.1, R * 0.9, 0.05, 0.12, toon(0xb8b0e0)));
  const rubor = toon(0xff9a9a);
  cabeca.add(parte(G.esferaB, rubor, { p: [0.14, -0.07, R * 0.78], s: [0.04, 0.022, 0.01], r: [0, 0.5, 0], contorno: false, sombra: false }));
  cabeca.add(parte(G.esferaB, rubor, { p: [-0.14, -0.07, R * 0.78], s: [0.04, 0.022, 0.01], r: [0, -0.5, 0], contorno: false, sombra: false }));
  cabeca.add(parte(G.esferaB, toon(0xf0a080), { p: [0, -0.04, R * 0.97], s: 0.022, contorno: false, sombra: false }));
  const sorriso = parte(new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI), toon(0x7a2e3a), { p: [0, -0.1, R * 0.9], r: [0, 0, Math.PI], contorno: false, sombra: false });
  cabeca.add(sorriso);
  // cabelo longo: volume de trás, franja e mechas laterais
  cabeca.add(parte(G.esfera, cabelo, { p: [0, 0.03, -0.04], s: [R * 1.1, R * 1.08, R * 1.05] }));
  cabeca.add(parte(G.capsula(0.17, 0.4), cabelo, { p: [0, -0.3, -0.12], s: [1.25, 1, 0.6] }));
  for (const [x, rz] of [[0.1, -0.35], [0, 0], [-0.1, 0.35]]) {
    cabeca.add(parte(G.esfera, cabelo, { p: [x, 0.13, R * 0.72], s: [0.09, 0.06, 0.06], r: [0, 0, rz] }));
  }
  cabeca.add(parte(G.capsula(0.055, 0.3), cabelo, { p: [0.21, -0.2, 0.03] }));
  cabeca.add(parte(G.capsula(0.055, 0.3), cabelo, { p: [-0.21, -0.2, 0.03] }));
  // chapéu de bruxa com a ponta dobrada
  const chapeu = grupo(0, 0.17, -0.02);
  chapeu.add(parte(G.cil(0.5, 0.5, 0.03, 28), roxoEscuro));
  chapeu.add(parte(G.cil(0.27, 0.29, 0.08, 20), ouro, { p: [0, 0.055, 0] }));
  const s1 = grupo(0, 0.02, 0);
  s1.add(parte(G.cil(0.2, 0.28, 0.32, 20), roxoEscuro, { p: [0, 0.16, 0] }));
  const s2 = grupo(0, 0.31, 0);
  s2.rotation.x = -0.35;
  s2.add(parte(G.cil(0.11, 0.2, 0.26, 16), roxoEscuro, { p: [0, 0.13, 0] }));
  const s3 = grupo(0, 0.25, 0);
  s3.rotation.x = -0.6;
  s3.add(parte(G.cone(0.11, 0.3, 14), roxoEscuro, { p: [0, 0.14, 0] }));
  s2.add(s3);
  s1.add(s2);
  chapeu.add(s1);
  const estrela = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.025 : 0.06;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) estrela.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else estrela.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  chapeu.add(parte(new THREE.ExtrudeGeometry(estrela, { depth: 0.015, bevelEnabled: false }), ouro, { p: [0, 0.06, 0.28], contorno: false }));
  cabeca.add(chapeu);
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  // braços com mangas em sino
  const be = braco(0.25, 1.46, 0.46, 0.055, roxo, pele, 0.06);
  const bd = braco(-0.25, 1.46, 0.46, 0.055, roxo, pele, 0.06);
  for (const b of [be, bd]) {
    b.pivo.add(parte(G.cil(0.07, 0.12, 0.2, 14, true), toon(0x6a3bb5, { side: THREE.DoubleSide }), { p: [0, -0.38, 0] }));
    b.pivo.add(parte(G.toro(0.115, 0.018), ouro, { p: [0, -0.48, 0], r: [Math.PI / 2, 0, 0], contorno: false }));
  }

  // cajado com lua crescente segurando o orbe
  const cajado = grupo(0, 0, 0.03);
  const madeira = toon(0x6b4226);
  cajado.add(parte(G.cil(0.028, 0.036, 1.7, 8), madeira, { p: [0, 0.15, 0] }));
  cajado.add(parte(G.toro(0.035, 0.012), ouro, { p: [0, 0.75, 0], r: [Math.PI / 2, 0, 0], contorno: false }));
  const crescente = parte(new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI * 1.4), ouro, { p: [0, 1.12, 0], r: [0, 0, -Math.PI * 0.2] });
  cajado.add(crescente);
  const orbe = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: 0x3ab8ff, emissiveIntensity: 3 })
  );
  orbe.position.y = 1.12;
  cajado.add(orbe);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(90,190,255,1)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
  }));
  brilho.scale.setScalar(0.8);
  orbe.add(brilho);
  const luz = new THREE.PointLight(0x58b8ff, 4, 7, 1.6);
  orbe.add(luz);
  bd.mao.add(cajado);
  rig.orbe = orbe;
  rig.luzOrbe = luz;

  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);
  return rig;
}

// ---------------------------------------------------------------------- Duende
const D = {};
function recursosDuende() {
  if (D.ok) return D;
  D.ok = true;
  D.tunica = toon(0x7a4f2a);
  D.cinto = toon(0x3d2614);
  D.pe = toon(0x4a6e2a);
  D.clava = toon(0x5a3a1e);
  D.espinho = toon(0xc9c2b0);
  D.dente = toon(0xfff6d8);
  D.boca = toon(0x3a0f12);
  D.sob = toon(0x2c3d17);
  D.tunicaArqueiro = toon(0x2e4a24);
  D.capuz = toon(0x3b5530);
  D.couroArqueiro = toon(0x6b4423);
  D.madeiraArco = toon(0x7a5230);
  D.pena = toon(0xc23a2a);
  D.corda = new THREE.MeshBasicMaterial({ color: 0xd8d0b8 });
  D.ponta = toon(0xb8c4d6, { emissive: 0x2a3550, emissiveIntensity: 0.5 });
  D.geoClava = G.torno([[0, 0], [0.035, 0], [0.04, 0.2], [0.075, 0.38], [0.1, 0.5], [0.085, 0.6], [0, 0.63]], 10);
  D.geoEspinho = G.cone(0.025, 0.08, 6);
  D.geoBarriga = G.esfera;
  D.geoOrelha = (() => {
    const g = new THREE.ConeGeometry(0.09, 0.42, 8);
    g.translate(0, 0.21, 0);
    return g;
  })();
  D.geoNariz = (() => {
    const g = new THREE.ConeGeometry(0.06, 0.22, 10);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.1);
    return g;
  })();
  return D;
}

/** Duende comum (clava) ou arqueiro (`variante = 'arqueiro'`: capuz, aljava e arco). */
/**
 * Arco na mão do arqueiro. O arco fica de pé e com a curva para frente quando o
 * braço está erguido à frente do corpo. Inclui uma flecha que só aparece ao mirar.
 */
function montarArco(rig, mao, d) {
  const arco = new THREE.Group();
  const base = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)
  );
  arco.quaternion.setFromRotationMatrix(base);
  const raio = 0.36;
  const curva = parte(new THREE.TorusGeometry(raio, 0.022, 6, 18, Math.PI * 0.8), d.madeiraArco, { p: [-raio, 0, 0], r: [0, 0, -Math.PI * 0.4] });
  arco.add(curva);
  const xCorda = Math.cos(Math.PI * 0.4) * raio - raio;
  const altCorda = Math.sin(Math.PI * 0.4) * raio * 2;
  arco.add(parte(G.cil(0.006, 0.006, altCorda, 4), d.corda, { p: [xCorda, 0, 0], contorno: false, sombra: false }));
  arco.add(parte(G.cil(0.035, 0.035, 0.12, 8), d.couroArqueiro, { contorno: false }));
  // flecha encaixada
  const flecha = new THREE.Group();
  flecha.add(parte(G.cil(0.01, 0.01, 0.62, 5), d.madeiraArco, { p: [0.05, 0, 0], r: [0, 0, Math.PI / 2], contorno: false, sombra: false }));
  flecha.add(parte(G.cone(0.025, 0.08, 5), d.ponta, { p: [0.39, 0, 0], r: [0, 0, -Math.PI / 2], contorno: false, sombra: false }));
  flecha.add(parte(G.cone(0.03, 0.08, 4), d.pena, { p: [-0.22, 0, 0], r: [0, 0, -Math.PI / 2], contorno: false, sombra: false }));
  flecha.visible = false;
  arco.add(flecha);
  mao.add(arco);
  rig.flechaArco = flecha;
}

export function criarDuende(variante = 'normal') {
  const d = recursosDuende();
  const arqueiro = variante === 'arqueiro';
  const rig = baseRig(arqueiro ? 'arqueiro' : 'duende');
  const { corpo } = rig;
  // material de pele próprio para piscar ao ser atingido
  const pele = toon(arqueiro ? 0x9bb53e : 0x6fae3c, { emissive: 0x000000 }, true);
  rig.pele = pele;

  // pernas curtas e pés grandes
  for (const x of [0.11, -0.11]) {
    const p = grupo(x, 0.4, 0);
    p.add(parte(G.capsula(0.055, 0.2), pele, { p: [0, -0.17, 0] }));
    p.add(parte(G.esfera, d.pe, { p: [0, -0.34, 0.06], s: [0.09, 0.06, 0.16] }));
    corpo.add(p);
    if (x > 0) rig.pernaE = p;
    else rig.pernaD = p;
  }

  // barriga redonda, túnica rasgada e cinto de corda
  corpo.add(parte(G.esfera, pele, { p: [0, 0.62, 0.02], s: [0.25, 0.27, 0.23] }));
  corpo.add(parte(G.cil(0.24, 0.29, 0.3, 9), arqueiro ? d.tunicaArqueiro : d.tunica, { p: [0, 0.48, 0.01] }));
  corpo.add(parte(G.toro(0.245, 0.025), d.cinto, { p: [0, 0.6, 0.01], r: [Math.PI / 2, 0, 0], contorno: false }));

  // cabeça grande: orelhas pontudas, nariz comprido, olhos amarelos e sorriso dentuço
  const R = 0.29;
  const cabeca = grupo(0, 1.02, 0.02);
  cabeca.add(parte(G.esfera, pele, { s: [R * 1.05, R * 0.92, R * 0.95] }));
  const orelhaE = parte(d.geoOrelha, pele, { p: [0.26, 0.04, -0.03], r: [0.25, 0, -1.25], s: [1, 1, 0.45] });
  const orelhaD = parte(d.geoOrelha, pele, { p: [-0.26, 0.04, -0.03], r: [0.25, 0, 1.25], s: [1, 1, 0.45] });
  cabeca.add(orelhaE, orelhaD);
  rig.orelhas = [orelhaE, orelhaD];
  const nariz = parte(d.geoNariz, pele, { p: [0, -0.02, R * 0.8], r: [0.35, 0, 0] });
  cabeca.add(nariz);
  cabeca.add(parte(G.esferaB, pele, { p: [0, -0.1, R * 0.8 + 0.2], s: 0.045 }));
  const corOlho = arqueiro ? 0xffb020 : 0xff3418;
  const corPalpebra = arqueiro ? 0x8aa236 : 0x5f9a33;
  cabeca.add(olho(R * 0.95, 0.1, 0.06, 0.065, corOlho, { raiva: corPalpebra, emissivo: true }));
  cabeca.add(olho(R * 0.95, -0.1, 0.06, 0.065, corOlho, { raiva: corPalpebra, emissivo: true }));
  if (arqueiro) {
    // capuz de caçador com ponta caída para trás
    cabeca.add(parte(new THREE.SphereGeometry(R * 1.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.47), d.capuz, { p: [0, 0.02, -0.02], r: [-0.35, 0, 0] }));
    cabeca.add(parte(G.cone(0.13, 0.4, 10), d.capuz, { p: [0, 0.1, -0.32], r: [-2.1, 0, 0] }));
  }
  cabeca.add(sobrancelha(0.1, 0.15, R * 0.82, 0.08, 0.5, d.sob));
  cabeca.add(sobrancelha(-0.1, 0.15, R * 0.82, 0.08, -0.5, d.sob));
  const boca = parte(G.esferaB, d.boca, { p: [0, -0.13, R * 0.78], s: [0.12, 0.04, 0.05], contorno: false, sombra: false });
  cabeca.add(boca);
  for (const x of [-0.07, -0.025, 0.025, 0.07]) {
    cabeca.add(parte(D.geoEspinho, d.dente, { p: [x, -0.11, R * 0.83], r: [Math.PI, 0, 0], s: [0.8, 0.7, 0.8], contorno: false, sombra: false }));
  }
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  // braços finos, mãos grandes e clava com espinhos (ou arco)
  const be = braco(0.27, 0.78, 0.36, 0.045, pele, pele, 0.07);
  const bd = braco(-0.27, 0.78, 0.36, 0.045, pele, pele, 0.07);
  if (arqueiro) {
    montarArco(rig, be.mao, d);
    // aljava nas costas com flechas
    const aljava = grupo(0.05, 0.78, -0.24);
    aljava.rotation.set(-0.2, 0, -0.45);
    aljava.add(parte(G.cil(0.07, 0.06, 0.5, 10), d.couroArqueiro));
    for (const [x, z] of [[0.025, 0], [-0.025, 0.02], [0, -0.03]]) {
      aljava.add(parte(G.cil(0.008, 0.008, 0.2, 4), d.madeiraArco, { p: [x, 0.32, z], contorno: false, sombra: false }));
      aljava.add(parte(G.cone(0.028, 0.08, 4), d.pena, { p: [x, 0.43, z], contorno: false, sombra: false }));
    }
    corpo.add(aljava);
    rig.bracoE = be.pivo;
    rig.bracoD = bd.pivo;
    corpo.add(rig.bracoE, rig.bracoD);
    return rig;
  }
  const clava = grupo(0, 0, 0.02);
  clava.rotation.x = Math.PI / 2.3;
  clava.add(parte(d.geoClava, d.clava, { p: [0, -0.08, 0] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    clava.add(parte(d.geoEspinho, d.espinho, {
      p: [Math.cos(a) * 0.09, 0.38 + (i % 2) * 0.1, Math.sin(a) * 0.09],
      r: [Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2],
      contorno: false, sombra: false,
    }));
  }
  bd.mao.add(clava);
  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);

  rig.root.scale.setScalar(1.0);
  return rig;
}

// ---------------------------------------------------------------- Chefão Duende
export function criarChefao() {
  const d = recursosDuende();
  const rig = baseRig('chefao');
  const { corpo } = rig;
  const pele = toon(0x3f8f24, { emissive: 0x000000 }, true);
  rig.pele = pele;
  const peleEscura = toon(0x2c6618);
  const couro = toon(0x5b3a1f);
  const pelo = toon(0x6e6255);
  const osso = toon(0xeee4c4);
  const ferro = toon(0x6d7480, { emissive: 0x1a1d24, emissiveIntensity: 0.5 });
  const boca = toon(0x2a0a0c);

  // pernas grossas e pés enormes
  for (const x of [0.26, -0.26]) {
    const p = grupo(x, 0.78, 0);
    p.add(parte(G.capsula(0.17, 0.42), pele, { p: [0, -0.34, 0] }));
    p.add(parte(G.esfera, peleEscura, { p: [0, -0.7, 0.08], s: [0.2, 0.12, 0.3] }));
    p.add(parte(G.cil(0.2, 0.22, 0.14, 12), couro, { p: [0, -0.52, 0] }));
    corpo.add(p);
    if (x > 0) rig.pernaE = p;
    else rig.pernaD = p;
  }

  // barrigão, peito largo, tanga de couro e cinto com caveira
  corpo.add(parte(G.esfera, pele, { p: [0, 1.25, 0.06], s: [0.66, 0.62, 0.6] }));
  corpo.add(parte(G.esfera, pele, { p: [0, 1.78, -0.02], s: [0.6, 0.42, 0.46] }));
  corpo.add(parte(G.esferaB, peleEscura, { p: [0, 1.2, 0.655], s: [0.035, 0.05, 0.02], contorno: false, sombra: false }));
  corpo.add(parte(G.cil(0.58, 0.64, 0.42, 14), couro, { p: [0, 0.86, 0.02] }));
  corpo.add(parte(G.toro(0.6, 0.06), toon(0x3a2412), { p: [0, 1.02, 0.03], r: [Math.PI / 2, 0, 0], s: [1, 0.92, 1] }));
  const caveira = grupo(0, 1.02, 0.64);
  caveira.add(parte(G.esfera, osso, { s: [0.11, 0.1, 0.08] }));
  caveira.add(parte(G.esferaB, matPreto, { p: [0.04, 0.01, 0.065], s: 0.025, contorno: false, sombra: false }));
  caveira.add(parte(G.esferaB, matPreto, { p: [-0.04, 0.01, 0.065], s: 0.025, contorno: false, sombra: false }));
  corpo.add(caveira);
  // ombreiras de pele com espinhos de ferro
  for (const x of [0.55, -0.55]) {
    corpo.add(parte(G.esfera, pelo, { p: [x, 2.0, -0.02], s: [0.3, 0.2, 0.3] }));
    for (let i = 0; i < 3; i++) {
      corpo.add(parte(G.cone(0.05, 0.2, 8), ferro, { p: [x + (i - 1) * 0.12 * Math.sign(x), 2.17, -0.02], r: [0, 0, -Math.sign(x) * 0.3] }));
    }
  }

  // cabeça: mandíbula saliente com presas, sobrancelhas grossas franzidas, boca virada para baixo
  const R = 0.36;
  const cabeca = grupo(0, 2.3, 0.12);
  cabeca.add(parte(G.esfera, pele, { s: [R * 1.05, R * 0.95, R * 0.95] }));
  cabeca.add(parte(G.esfera, pele, { p: [0, -0.17, 0.08], s: [0.33, 0.18, 0.28] }));
  for (const x of [0.13, -0.13]) {
    cabeca.add(parte(G.cone(0.04, 0.16, 8), osso, { p: [x, -0.07, 0.33], r: [-0.15, 0, -Math.sign(x) * 0.15] }));
  }
  cabeca.add(parte(new THREE.TorusGeometry(0.09, 0.016, 6, 14, Math.PI), boca, {
    p: [0, -0.15, 0.365], s: [1.3, 1, 1], contorno: false, sombra: false,
  }));
  cabeca.add(parte(G.esfera, peleEscura, { p: [0, 0.0, R * 0.95], s: [0.085, 0.06, 0.07] }));
  cabeca.add(olho(R, 0.12, 0.08, 0.05, 0xff2a10, { raiva: 0x3f8f24, emissivo: true }));
  cabeca.add(olho(R, -0.12, 0.08, 0.05, 0xff2a10, { raiva: 0x3f8f24, emissivo: true }));
  // sobrancelhas pesadas em "V"
  cabeca.add(parte(G.capsula(0.035, 0.13), peleEscura, { p: [0.11, 0.15, R * 0.86], r: [0, 0, Math.PI / 2 + 0.55] }));
  cabeca.add(parte(G.capsula(0.035, 0.13), peleEscura, { p: [-0.11, 0.15, R * 0.86], r: [0, 0, Math.PI / 2 - 0.55] }));
  // cicatriz no olho esquerdo
  cabeca.add(parte(G.capsula(0.008, 0.16), toon(0xc98a7a), { p: [0.13, 0.08, R * 0.93], r: [0, 0, 0.35], contorno: false, sombra: false }));
  // orelhas caídas
  const orelhaE = parte(d.geoOrelha, pele, { p: [0.3, 0.03, -0.04], r: [0.5, 0, -1.7], s: [1.1, 0.75, 0.5] });
  const orelhaD = parte(d.geoOrelha, pele, { p: [-0.3, 0.03, -0.04], r: [0.5, 0, 1.7], s: [1.1, 0.75, 0.5] });
  cabeca.add(orelhaE, orelhaD);
  // capacete de ferro amassado
  cabeca.add(parte(new THREE.SphereGeometry(R * 1.04, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.38), ferro, { p: [0, 0.03, -0.02], r: [-0.2, 0, 0] }));
  cabeca.add(parte(G.cone(0.05, 0.22, 8), ferro, { p: [0, 0.36, -0.06] }));
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  // braços enormes, braçadeiras e um tronco de árvore como clava
  const be = braco(0.68, 1.98, 0.8, 0.14, pele, pele, 0.17);
  const bd = braco(-0.68, 1.98, 0.8, 0.14, pele, pele, 0.17);
  for (const b of [be, bd]) b.pivo.add(parte(G.cil(0.165, 0.155, 0.22, 12), couro, { p: [0, -0.6, 0] }));
  const clava = grupo(0, 0, 0.04);
  clava.rotation.x = Math.PI / 2.3;
  clava.add(parte(d.geoClava, toon(0x4a3018), { p: [0, -0.2, 0], s: [2.4, 2.3, 2.4] }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 5) * Math.PI * 2;
    clava.add(parte(G.cone(0.04, 0.16, 6), ferro, {
      p: [Math.cos(a) * 0.21, 0.75 + (i % 2) * 0.25, Math.sin(a) * 0.21],
      r: [Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2],
      contorno: false,
    }));
  }
  bd.mao.add(clava);
  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);
  rig.root.scale.setScalar(1.12);
  return rig;
}

// ------------------------------------------------------------------ Animação
const suave = (x) => x * x * (3 - 2 * x);

/**
 * @param rig       rig do personagem
 * @param dt        delta de tempo
 * @param t         tempo total
 * @param andar     0..1 intensidade da caminhada
 * @param ataque    progresso do ataque 0..1, ou -1 se não estiver atacando
 */
export function animarRig(rig, dt, t, andar, ataque = -1) {
  const freq = { duende: 14, arqueiro: 14, assassino: 12, maga: 9, chefao: 6 }[rig.tipo];
  rig.fase += dt * freq * (0.4 + andar * 0.6);
  const s = Math.sin(rig.fase);
  const amp = rig.tipo === 'maga' ? 0.5 : 0.8;

  rig.pernaE.rotation.x = s * amp * andar;
  rig.pernaD.rotation.x = -s * amp * andar;
  rig.bracoE.rotation.set(-s * 0.6 * andar, 0, 0.08);
  rig.bracoD.rotation.set(s * 0.6 * andar, 0, -0.08);
  rig.corpo.position.y = Math.abs(Math.cos(rig.fase)) * 0.06 * andar + Math.sin(t * 2.2) * 0.012;
  rig.corpo.rotation.set(andar * 0.08, 0, 0);
  if (rig.cabeca) rig.cabeca.rotation.set(Math.sin(t * 1.7) * 0.03, Math.sin(t * 0.9) * 0.06, 0);

  if (rig.capa) rig.capa.rotation.x = 0.1 + andar * 0.5 + Math.sin(t * 3) * 0.04;
  if (rig.cachecol) rig.cachecol.rotation.x = 0.2 + andar * 0.9 + Math.sin(t * 6) * 0.1;
  if (rig.saia) rig.saia.rotation.z = Math.sin(rig.fase) * 0.05 * andar;
  if (rig.orelhas) {
    const o = Math.sin(t * 8 + rig.fase) * 0.08;
    rig.orelhas[0].rotation.z = -1.25 + o;
    rig.orelhas[1].rotation.z = 1.25 - o;
  }
  if (rig.tipo === 'arqueiro') {
    // segura o arco um pouco à frente
    rig.bracoE.rotation.x = -0.55 + s * 0.15 * andar;
    rig.flechaArco.visible = false;
  }
  if (rig.tipo === 'chefao') {
    // braços afastados da barriga
    rig.bracoE.rotation.z = 0.3;
    rig.bracoD.rotation.z = -0.3;
  }
  if (rig.tipo === 'maga') {
    // mantém o cajado à frente
    rig.bracoD.rotation.x = -0.35 + s * 0.15 * andar;
    rig.bracoD.rotation.z = -0.15;
  }

  if (ataque < 0) return;
  const p = Math.min(1, ataque);
  if (rig.tipo === 'assassino') {
    // golpe cruzado com as duas adagas
    const a = suave(Math.min(1, p * 2.2));
    rig.bracoD.rotation.x = -2.3 + a * 2.6;
    rig.bracoD.rotation.z = -0.9 + a * 1.4;
    const b = suave(Math.max(0, Math.min(1, p * 2.2 - 0.5)));
    rig.bracoE.rotation.x = -2.0 + b * 2.4;
    rig.bracoE.rotation.z = 0.9 - b * 1.4;
    rig.corpo.rotation.y = Math.sin(p * Math.PI) * 0.45;
    rig.corpo.rotation.x = 0.2 * Math.sin(p * Math.PI);
  } else if (rig.tipo === 'maga') {
    // ergue o cajado e aponta para frente
    const a = Math.sin(p * Math.PI);
    rig.bracoD.rotation.x = -0.35 - a * 1.25;
    rig.bracoE.rotation.x = -a * 0.9;
    rig.bracoE.rotation.z = a * 0.4;
    rig.corpo.rotation.x = -a * 0.08;
  } else if (rig.tipo === 'arqueiro') {
    // estica o braço do arco, puxa a corda e solta
    const soltar = 0.73;
    const a = p < soltar ? suave(p / soltar) : 1 - suave((p - soltar) / (1 - soltar)) * 0.6;
    rig.bracoE.rotation.x = -0.55 - a * 1.0;
    rig.bracoE.rotation.z = 0;
    rig.bracoD.rotation.x = -1.45 * a;
    rig.bracoD.rotation.z = 0.55 * a;
    rig.corpo.rotation.y = -0.2 * a;
    rig.flechaArco.visible = p < soltar && p > 0.1;
  } else if (rig.tipo === 'chefao') {
    // chefão: ergue a clava com as duas mãos e esmaga o chão
    const sobe = Math.min(1, p / 0.68);
    const desce = Math.min(1, Math.max(0, (p - 0.68) / 0.08));
    const volta = Math.max(0, (p - 0.85) / 0.15);
    const braco = -2.9 * suave(sobe) + desce * 3.4 - volta * 0.5;
    rig.bracoD.rotation.x = braco;
    rig.bracoE.rotation.x = braco;
    rig.bracoE.rotation.z = -0.35 * sobe * (1 - desce);
    rig.corpo.rotation.x = -0.2 * sobe + desce * 0.45 - volta * 0.45;
  } else {
    // duende: ergue a clava e bate
    const sobe = Math.min(1, p / 0.55);
    const desce = Math.max(0, (p - 0.55) / 0.2);
    rig.bracoD.rotation.x = -2.7 * suave(sobe) + Math.min(1, desce) * 3.1;
    rig.corpo.rotation.x = -0.15 * sobe + Math.min(1, desce) * 0.35;
  }
}
