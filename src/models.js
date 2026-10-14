// Modelos dos personagens em estilo cartoon: formas arredondadas, sombreado em
// faixas (toon) e contorno escuro. Todos olham para +Z e têm os pés em y = 0.
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

// ------------------------------------------------------------------ Materiais
const gradiente = (() => {
  const t = new THREE.DataTexture(new Uint8Array([62, 112, 160, 210, 255]), 5, 1, THREE.RedFormat);
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
const empurrarContorno = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  transformed += normalize(normal) * 0.018;'
  );
};
matContorno.onBeforeCompile = empurrarContorno;

/** Cópia do material de contorno que pode ficar translúcida (usada na invisibilidade). */
export function criarContornoTranslucido() {
  const m = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, side: THREE.BackSide, transparent: true, depthWrite: false });
  m.onBeforeCompile = empurrarContorno;
  return m;
}

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
    c.userData.contorno = true;
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
  esfera: new THREE.SphereGeometry(1, 28, 20),
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

const matSola = toon(0x16110c);

/**
 * Perna com pivô no quadril e joelho articulado: coxa e canela em cápsulas, joelheira
 * arredondada e bota com sola (ou pé descalço com `descalco`). O joelho fica em
 * `perna.userData.joelho` para a animação dobrá-lo ao andar.
 */
function perna(x, quadril, comp, raio, matPerna, matBota, tamBota = 1, { descalco = false } = {}) {
  const p = grupo(x, quadril, 0);
  const meio = quadril * 0.5;
  p.add(parte(G.capsula(raio, Math.max(0.01, meio - raio)), matPerna, { p: [0, -meio / 2, 0] }));
  const joelho = grupo(0, -meio, 0);
  joelho.add(parte(G.esfera, matPerna, { s: raio * 1.02, contorno: false }));
  joelho.add(parte(G.capsula(raio * 0.88, Math.max(0.01, meio - raio * 1.4)), matPerna, { p: [0, -meio / 2 + 0.01, 0] }));
  const yPe = -(quadril - meio) + 0.07 * tamBota;
  joelho.add(parte(G.esfera, matBota, { p: [0, yPe, 0.05 * tamBota], s: [0.1 * tamBota, 0.08 * tamBota, 0.17 * tamBota] }));
  if (!descalco) {
    // cano da bota e sola
    joelho.add(parte(G.cil(raio * 1.18, raio * 1.32, 0.2 * tamBota, 16), matBota, { p: [0, yPe + 0.11 * tamBota, 0] }));
    joelho.add(parte(G.cil(raio * 1.35, raio * 1.35, 0.03, 16), matBota, { p: [0, yPe + 0.21 * tamBota, 0], contorno: false }));
    joelho.add(parte(G.esfera, matSola, { p: [0, yPe - 0.05 * tamBota, 0.05 * tamBota], s: [0.105 * tamBota, 0.03 * tamBota, 0.18 * tamBota], contorno: false }));
  }
  p.add(joelho);
  p.userData.joelho = joelho;
  return p;
}

/**
 * Braço com pivô no ombro e cotovelo articulado. A mão é uma luva arredondada com
 * polegar. Retorna { pivo, mao } (a mão é um grupo para segurar armas); o cotovelo
 * fica em `pivo.userData.cotovelo`.
 */
function braco(x, ombro, comp, raio, matBraco, matMao, raioMao) {
  const pivo = grupo(x, ombro, 0);
  const meio = comp * 0.5;
  pivo.add(parte(G.capsula(raio, Math.max(0.01, meio - raio)), matBraco, { p: [0, -meio / 2, 0] }));
  const cotovelo = grupo(0, -meio, 0);
  cotovelo.add(parte(G.esfera, matBraco, { s: raio * 0.98, contorno: false }));
  cotovelo.add(parte(G.capsula(raio * 0.9, Math.max(0.01, meio - raio)), matBraco, { p: [0, -meio / 2, 0] }));
  const mao = grupo(0, -meio - raioMao * 0.6, 0);
  mao.add(parte(G.esfera, matMao, { s: [raioMao, raioMao * 1.1, raioMao * 0.85] }));
  const lado = x > 0 ? -1 : 1; // polegar do lado de dentro, apontando para frente
  mao.add(parte(G.capsula(raioMao * 0.32, raioMao * 0.5), matMao, {
    p: [lado * raioMao * 0.55, raioMao * 0.15, raioMao * 0.55], r: [-0.9, 0, lado * 0.5], contorno: false,
  }));
  cotovelo.add(mao);
  pivo.add(cotovelo);
  pivo.userData.cotovelo = cotovelo;
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

  // bolsinhas no cinto, bainha de faca nas costas e tira de couro na coxa
  for (const x of [0.17, -0.17]) corpo.add(parte(G.capsula(0.045, 0.05), couroEscuro, { p: [x, 0.9, 0.13], s: [1.25, 1, 0.75] }));
  corpo.add(parte(G.capsula(0.038, 0.3), couroEscuro, { p: [0.07, 1.2, -0.2], r: [0, 0, 0.6] }));
  corpo.add(parte(G.capsula(0.022, 0.08), toon(0x3b2414), { p: [0.2, 1.39, -0.2], r: [0, 0, 0.6], contorno: false }));
  rig.pernaE.add(parte(G.toro(0.092, 0.016), couroEscuro, { p: [0, -0.22, 0], r: [Math.PI / 2, 0, 0], contorno: false }));

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
  // anágua mais escura aparecendo na barra, com bordas onduladas
  const anagua = G.torno([[0, -0.95], [0.56, -0.95], [0.52, -0.86], [0.32, -0.45], [0, -0.45]], 30);
  {
    const pos = anagua.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -0.9) pos.setY(i, pos.getY(i) + Math.max(0, Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 9)) * 0.04);
    }
    anagua.computeVertexNormals();
  }
  rig.saia.add(parte(anagua, roxoEscuro));
  // estrelinhas douradas bordadas na saia
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const y = -0.45 - (i % 3) * 0.14;
    const r = 0.24 + (-y - 0.25) * 0.37 + 0.012;
    rig.saia.add(parte(G.esferaB, ouro, { p: [Math.sin(a) * r, y, Math.cos(a) * r], s: 0.022, contorno: false, sombra: false }));
  }
  corpo.add(rig.saia);
  // corpete
  corpo.add(parte(G.torno([[0, 0], [0.19, 0], [0.17, 0.15], [0.21, 0.32], [0.2, 0.42], [0.1, 0.48], [0, 0.49]]), roxo, { p: [0, 1.08, 0], s: [1, 1, 0.8] }));
  corpo.add(parte(G.toro(0.18, 0.03), ouro, { p: [0, 1.13, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1], contorno: false }));
  corpo.add(parte(G.esferaB, toon(0x5fd6ff, { emissive: 0x2a9fd6, emissiveIntensity: 0.8 }), { p: [0, 1.13, 0.15], s: 0.04, contorno: false }));
  // gola e capinha sobre os ombros
  corpo.add(parte(G.cil(0.2, 0.13, 0.08, 16), roxoEscuro, { p: [0, 1.52, 0] }));
  corpo.add(parte(G.cil(0.17, 0.35, 0.2, 24, true), toon(0x3b2177, { side: THREE.DoubleSide }), { p: [0, 1.42, 0], s: [1, 1, 0.85] }));

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
  // mechas soltas nas costas
  for (const [x, rz] of [[0.12, 0.08], [-0.12, -0.08], [0, 0]]) {
    cabeca.add(parte(G.capsula(0.06, 0.34), cabelo, { p: [x, -0.45, -0.17], r: [0.15, 0, rz] }));
  }
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
  // túnica com a barra rasgada em pontas
  D.geoTunica = (() => {
    const g = new THREE.CylinderGeometry(0.24, 0.3, 0.32, 14, 2, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -0.15) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        pos.setY(i, pos.getY(i) - Math.max(0, Math.sin(a * 7)) * 0.07);
      }
    }
    g.computeVertexNormals();
    return g;
  })();
  D.orelhaInterna = toon(0xc98a6a);
  D.geoOrelhaInterna = (() => {
    const g = new THREE.ConeGeometry(0.055, 0.3, 8);
    g.translate(0, 0.17, 0.02);
    return g;
  })();
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
    const p = perna(x, 0.4, 0.4, 0.055, pele, d.pe, 0.85, { descalco: true });
    corpo.add(p);
    if (x > 0) rig.pernaE = p;
    else rig.pernaD = p;
  }

  // barriga redonda, túnica rasgada e cinto de corda
  corpo.add(parte(G.esfera, pele, { p: [0, 0.62, 0.02], s: [0.25, 0.27, 0.23] }));
  corpo.add(parte(d.geoTunica, toon(arqueiro ? 0x2e4a24 : 0x7a4f2a, { side: THREE.DoubleSide }), { p: [0, 0.48, 0.01] }));
  corpo.add(parte(G.toro(0.245, 0.025), d.cinto, { p: [0, 0.6, 0.01], r: [Math.PI / 2, 0, 0], contorno: false }));

  // cabeça grande: orelhas pontudas, nariz comprido, olhos amarelos e sorriso dentuço
  const R = 0.29;
  const cabeca = grupo(0, 1.02, 0.02);
  cabeca.add(parte(G.esfera, pele, { s: [R * 1.05, R * 0.92, R * 0.95] }));
  const orelhaE = parte(d.geoOrelha, pele, { p: [0.26, 0.04, -0.03], r: [0.25, 0, -1.25], s: [1, 1, 0.45] });
  const orelhaD = parte(d.geoOrelha, pele, { p: [-0.26, 0.04, -0.03], r: [0.25, 0, 1.25], s: [1, 1, 0.45] });
  for (const o of [orelhaE, orelhaD]) o.add(parte(d.geoOrelhaInterna, d.orelhaInterna, { contorno: false, sombra: false }));
  cabeca.add(orelhaE, orelhaD);
  rig.orelhas = [orelhaE, orelhaD];
  cabeca.add(parte(G.esferaB, toon(0x4f7f2c), { p: [0.05, 0.02, R * 0.95], s: 0.02, contorno: false, sombra: false }));
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
  be.pivo.add(parte(G.toro(0.05, 0.014), d.cinto, { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0], contorno: false }));
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
    const p = perna(x, 0.78, 0.78, 0.17, pele, peleEscura, 1.8, { descalco: true });
    // joelheira de ferro e faixa de couro na canela
    p.userData.joelho.add(parte(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), ferro, { p: [0, 0, 0.1], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.6] }));
    p.userData.joelho.add(parte(G.cil(0.17, 0.18, 0.14, 14), couro, { p: [0, -0.2, 0] }));
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
  // peitoral de ferro com rebites
  const peitoral = new THREE.SphereGeometry(0.5, 24, 12, -Math.PI * 0.27 + Math.PI / 2, Math.PI * 0.54, Math.PI * 0.3, Math.PI * 0.32);
  corpo.add(parte(peitoral, toon(0x5d636e, { emissive: 0x1a1d24, emissiveIntensity: 0.5, side: THREE.DoubleSide }), { p: [0, 1.72, 0.02], s: [1.1, 0.95, 0.98] }));
  for (const a of [-0.6, -0.2, 0.2, 0.6]) {
    corpo.add(parte(G.esferaB, osso, { p: [Math.sin(a) * 0.52, 1.88, Math.cos(a) * 0.43 + 0.02], s: 0.024, contorno: false, sombra: false }));
  }

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
  // pedra que ele arranca do chão no SUPER (escondida até ser usada)
  rig.pedra = parte(new THREE.DodecahedronGeometry(0.42, 0), toon(0x6b6f78), { p: [0, -0.25, 0.1] });
  rig.pedra.visible = false;
  be.mao.add(rig.pedra);
  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);
  rig.root.scale.setScalar(1.12);
  return rig;
}

// ------------------------------------------------------------------------ Herói
/** Pontos espalhados sobre uma esfera (espiral de Fibonacci), para cachos de cabelo. */
function pontosNaEsfera(n) {
  const pts = [];
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    pts.push(new THREE.Vector3(Math.cos(i * ouro) * r, y, Math.sin(i * ouro) * r));
  }
  return pts;
}

/** Cabelo cacheado: uma calota e vários cachos redondos, deixando o rosto livre. */
function cabeloCacheado(cabeca, R, mat, { volume, tamCacho, centro }) {
  cabeca.add(parte(G.esfera, mat, { p: centro, s: [R * volume, R * volume * 0.96, R * volume * 0.95] }));
  for (const d of pontosNaEsfera(volume > 1.2 ? 70 : 46)) {
    if (d.y < (volume > 1.2 ? -0.55 : -0.05)) continue;   // nuca
    if (d.z > 0.3 && d.y < 0.5) continue;                 // rosto
    if (volume <= 1.2 && Math.abs(d.x) > 0.75 && d.y < 0.2) continue; // orelhas
    const r = R * volume;
    cabeca.add(parte(G.esferaB, mat, {
      p: [centro[0] + d.x * r, centro[1] + d.y * r * 0.96, centro[2] + d.z * r * 0.95], s: tamCacho, sombra: false,
    }));
  }
}

function criarEspada(metal, ouro, couro) {
  const g = new THREE.Group();
  g.add(parte(G.cil(0.024, 0.026, 0.17, 8), couro, { contorno: false }));
  g.add(parte(G.esferaB, ouro, { p: [0, -0.1, 0], s: 0.038 }));
  g.add(parte(G.capsula(0.025, 0.22), ouro, { p: [0, 0.095, 0], r: [0, 0, Math.PI / 2] }));
  const forma = new THREE.Shape();
  forma.moveTo(-0.042, 0);
  forma.lineTo(-0.036, 0.6);
  forma.lineTo(0, 0.72);
  forma.lineTo(0.036, 0.6);
  forma.lineTo(0.042, 0);
  forma.lineTo(-0.042, 0);
  const lamina = new THREE.ExtrudeGeometry(forma, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 });
  lamina.translate(0, 0.11, -0.006);
  g.add(parte(lamina, metal));
  // sulco no meio da lâmina
  g.add(parte(G.cil(0.007, 0.007, 0.5, 4), toon(0x8a96a8), { p: [0, 0.38, 0.016], contorno: false, sombra: false }));
  g.rotation.x = Math.PI / 2.6;
  g.position.z = 0.03;
  return g;
}

function criarVara(couro, metal) {
  const g = new THREE.Group();
  const madeira = toon(0x7a5230);
  g.add(parte(G.cil(0.026, 0.032, 1.6, 8), madeira, { p: [0, 0.2, 0] }));
  // nós da madeira, pegada de couro e ponteiras de ferro
  for (const y of [-0.25, 0.45, 0.72]) g.add(parte(G.esferaB, madeira, { p: [0.022, y, 0.006], s: [0.022, 0.035, 0.022], contorno: false }));
  g.add(parte(G.cil(0.036, 0.036, 0.22, 10), couro, { p: [0, 0.02, 0], contorno: false }));
  g.add(parte(G.cil(0.03, 0.026, 0.07, 8), metal, { p: [0, 1.0, 0], contorno: false }));
  g.add(parte(G.cil(0.034, 0.024, 0.06, 8), metal, { p: [0, -0.6, 0], contorno: false }));
  g.position.z = 0.03;
  return g;
}

function criarEscudo(corFrente, corFaixa, metal, madeira) {
  const g = new THREE.Group();
  const frente = grupo();
  // disco de tábuas pintadas com uma faixa, aro e umbo de ferro
  frente.add(parte(G.cil(0.3, 0.3, 0.05, 28), toon(corFrente), { r: [Math.PI / 2, 0, 0] }));
  frente.add(parte(G.cil(0.3, 0.3, 0.035, 28), madeira, { p: [0, 0, -0.03], r: [Math.PI / 2, 0, 0], contorno: false }));
  frente.add(parte(new THREE.BoxGeometry(0.1, 0.58, 0.012), toon(corFaixa), { p: [0, 0, 0.027], contorno: false, sombra: false }));
  frente.add(parte(G.toro(0.3, 0.022), metal, { contorno: false }));
  frente.add(parte(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal, { p: [0, 0, 0.026], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    frente.add(parte(G.esferaB, metal, { p: [Math.cos(a) * 0.255, Math.sin(a) * 0.255, 0.03], s: 0.014, contorno: false, sombra: false }));
  }
  // de frente para fora do braço esquerdo, um pouco virado para frente
  frente.rotation.y = 0.45;
  g.add(frente);
  g.position.set(0.09, -0.14, 0.06);
  return g;
}

/**
 * Personagem definitivo do jogador, montado na tela de criação.
 * op: { genero: 'menino' | 'menina', aparencia, roupa (de config.js), item: 'espada' | 'vara' | 'escudo' | null }
 */
export function criarHeroi({ genero, aparencia, roupa, item = null }) {
  const rig = baseRig('heroi');
  const { corpo } = rig;
  const menina = genero === 'menina';
  rig.item = item;
  const pele = toon(aparencia.pele);
  const cabelo = toon(aparencia.cabelo);
  const principal = toon(roupa.principal);
  const principalDupla = toon(roupa.principal, { side: THREE.DoubleSide });
  const detalhe = toon(roupa.detalhe);
  const calca = toon(roupa.calca);
  const bota = toon(roupa.bota);
  const couro = toon(0x5a3a20);
  const metal = toon(0xc8d2e0, { emissive: 0x2a3550, emissiveIntensity: 0.4 });
  const ouro = toon(0xd9a93e);

  // pernas
  const quadril = menina ? 0.82 : 0.86;
  const raioPerna = menina ? 0.065 : 0.078;
  rig.pernaE = perna(0.1, quadril, quadril, raioPerna, calca, bota);
  rig.pernaD = perna(-0.1, quadril, quadril, raioPerna, calca, bota);
  corpo.add(rig.pernaE, rig.pernaD);

  if (menina) {
    // vestido: corpete justo e saia rodada até o joelho, com barra na cor dos detalhes
    corpo.add(parte(G.torno([[0, 0], [0.19, 0], [0.17, 0.14], [0.2, 0.32], [0.21, 0.42], [0.11, 0.5], [0, 0.51]]), principal, { p: [0, 1.04, 0], s: [1, 1, 0.8] }));
    rig.saia = grupo(0, 1.08, 0);
    rig.saia.add(parte(G.torno([[0, -0.58], [0.43, -0.58], [0.4, -0.5], [0.3, -0.28], [0.22, -0.08], [0.19, 0], [0, 0]], 24), principal));
    rig.saia.add(parte(G.toro(0.42, 0.028), detalhe, { p: [0, -0.56, 0], r: [Math.PI / 2, 0, 0], contorno: false }));
    corpo.add(rig.saia);
    corpo.add(parte(G.toro(0.19, 0.035), detalhe, { p: [0, 1.09, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1] }));
    // laço do cinto nas costas
    for (const lado of [1, -1]) {
      corpo.add(parte(G.esfera, detalhe, { p: [lado * 0.07, 1.1, -0.17], s: [0.07, 0.045, 0.03], r: [0, 0, lado * 0.4] }));
    }
    corpo.add(parte(G.toro(0.14, 0.03), detalhe, { p: [0, 1.52, 0.005], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] }));
  } else {
    // túnica até o meio da coxa, cinto com fivela e barra na cor dos detalhes
    corpo.add(parte(G.torno([[0, 0], [0.27, 0], [0.25, 0.1], [0.22, 0.3], [0.21, 0.46], [0.25, 0.68], [0.25, 0.8], [0.12, 0.88], [0, 0.89]]), principal, { p: [0, 0.66, 0], s: [1, 1, 0.78] }));
    corpo.add(parte(G.toro(0.262, 0.025), detalhe, { p: [0, 0.68, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.78, 1], contorno: false }));
    corpo.add(parte(G.toro(0.215, 0.035), detalhe, { p: [0, 0.98, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.78, 1] }));
    corpo.add(parte(G.cil(0.05, 0.05, 0.03, 4), ouro, { p: [0, 0.98, 0.17], r: [Math.PI / 2, Math.PI / 4, 0], contorno: false }));
    corpo.add(parte(G.toro(0.14, 0.035), detalhe, { p: [0, 1.53, 0.005], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] }));
    // cordão da gola
    corpo.add(parte(G.capsula(0.012, 0.1), detalhe, { p: [0.025, 1.42, 0.17], r: [0.2, 0, 0.3], contorno: false, sombra: false }));
    corpo.add(parte(G.capsula(0.012, 0.1), detalhe, { p: [-0.025, 1.42, 0.17], r: [0.2, 0, -0.3], contorno: false, sombra: false }));
  }
  // bolsinha de couro no cinto
  corpo.add(parte(G.capsula(0.045, 0.05), couro, { p: [0.19, menina ? 1.02 : 0.92, 0.07], s: [1.2, 1, 0.75] }));
  // ombros
  const ombro = menina ? 0.22 : 0.25;
  corpo.add(parte(G.esfera, principal, { p: [ombro, 1.46, 0], s: [0.1, 0.075, 0.1] }));
  corpo.add(parte(G.esfera, principal, { p: [-ombro, 1.46, 0], s: [0.1, 0.075, 0.1] }));

  // cabeça
  const R = 0.24;
  const cabeca = grupo(0, 1.8, 0);
  cabeca.add(parte(G.esfera, pele, { s: [R, R * 1.02, R * 0.95] }));
  for (const x of [R * 0.98, -R * 0.98]) cabeca.add(parte(G.esfera, pele, { p: [x, -0.01, -0.01], s: [0.04, 0.06, 0.035] }));
  for (const x of [0.088, -0.088]) {
    const o = olho(R, x, 0.0, 0.058, aparencia.olhos);
    if (aparencia.olhosPuxados) o.scale.y = 0.72;
    cabeca.add(o);
  }
  if (menina) {
    const cilio = toon(0x1d1414);
    for (const x of [0.088, -0.088]) {
      cabeca.add(parte(G.capsula(0.011, 0.055), cilio, { p: [x * 1.12, aparencia.olhosPuxados ? 0.04 : 0.055, R * 0.86], r: [0, 0, Math.PI / 2 + (x > 0 ? -0.2 : 0.2)], contorno: false, sombra: false }));
    }
    const rubor = toon(0xff9a9a);
    cabeca.add(parte(G.esferaB, rubor, { p: [0.14, -0.07, R * 0.78], s: [0.04, 0.022, 0.01], r: [0, 0.5, 0], contorno: false, sombra: false }));
    cabeca.add(parte(G.esferaB, rubor, { p: [-0.14, -0.07, R * 0.78], s: [0.04, 0.022, 0.01], r: [0, -0.5, 0], contorno: false, sombra: false }));
  }
  const corSob = new THREE.Color(aparencia.cabelo).multiplyScalar(0.8).getHex();
  cabeca.add(sobrancelha(0.088, 0.1, R * 0.9, 0.055, menina ? -0.1 : -0.05, toon(corSob)));
  cabeca.add(sobrancelha(-0.088, 0.1, R * 0.9, 0.055, menina ? 0.1 : 0.05, toon(corSob)));
  const corNariz = new THREE.Color(aparencia.pele).multiplyScalar(0.88).getHex();
  cabeca.add(parte(G.esferaB, toon(corNariz), { p: [0, -0.04, R * 0.97], s: 0.024, contorno: false, sombra: false }));
  cabeca.add(parte(new THREE.TorusGeometry(0.036, 0.009, 6, 12, Math.PI), toon(0x7a2e3a), { p: [0, -0.1, R * 0.9], r: [0, 0, Math.PI], contorno: false, sombra: false }));

  // cabelo
  if (aparencia.cacheado) {
    if (menina) cabeloCacheado(cabeca, R, cabelo, { volume: 1.38, tamCacho: 0.085, centro: [0, 0.06, -0.06] });
    else cabeloCacheado(cabeca, R, cabelo, { volume: 1.04, tamCacho: 0.05, centro: [0, 0.03, -0.03] });
  } else {
    cabeca.add(parte(new THREE.SphereGeometry(R * 1.08, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), cabelo, { p: [0, 0.015, -0.01], r: [-0.4, 0, 0] }));
    cabeca.add(parte(G.esfera, cabelo, { p: [0, 0.01, -0.06], s: [R * 1.06, R * 1.04, R * 0.98] }));
    // franja
    const franja = menina ? [[0.11, -0.4], [0.04, -0.12], [-0.04, 0.12], [-0.11, 0.4]] : [[0.1, -0.35], [0, 0], [-0.1, 0.35]];
    for (const [x, rz] of franja) {
      cabeca.add(parte(G.esfera, cabelo, { p: [x, 0.14, R * 0.7], s: [menina ? 0.075 : 0.09, 0.06, 0.06], r: [0, 0, rz] }));
    }
    if (menina) {
      // cabelo comprido: volume nas costas e mechas dos lados
      cabeca.add(parte(G.capsula(0.17, 0.42), cabelo, { p: [0, -0.32, -0.12], s: [1.25, 1, 0.6] }));
      cabeca.add(parte(G.capsula(0.055, 0.32), cabelo, { p: [0.21, -0.2, 0.03] }));
      cabeca.add(parte(G.capsula(0.055, 0.32), cabelo, { p: [-0.21, -0.2, 0.03] }));
      for (const [x, rz] of [[0.12, 0.08], [-0.12, -0.08], [0, 0]]) {
        cabeca.add(parte(G.capsula(0.06, 0.36), cabelo, { p: [x, -0.46, -0.17], r: [0.15, 0, rz] }));
      }
      // tiara na cor dos detalhes da roupa
      cabeca.add(parte(new THREE.TorusGeometry(R * 1.1, 0.016, 6, 24, Math.PI), detalhe, { p: [0, 0.04, 0.0], r: [-0.45, 0, 0], contorno: false }));
    } else {
      // costeletas
      cabeca.add(parte(G.capsula(0.03, 0.06), cabelo, { p: [0.205, -0.04, 0.06], contorno: false }));
      cabeca.add(parte(G.capsula(0.03, 0.06), cabelo, { p: [-0.205, -0.04, 0.06], contorno: false }));
    }
  }
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  // braços com punhos na cor dos detalhes
  const be = braco(ombro + 0.06, 1.44, 0.5, menina ? 0.052 : 0.06, principal, pele, 0.062);
  const bd = braco(-ombro - 0.06, 1.44, 0.5, menina ? 0.052 : 0.06, principal, pele, 0.062);
  for (const b of [be, bd]) {
    b.pivo.userData.cotovelo.add(parte(G.cil(0.075, 0.068, 0.06, 12), detalhe, { p: [0, -0.2, 0], contorno: false }));
    if (menina) b.pivo.add(parte(G.cil(0.06, 0.1, 0.16, 14, true), principalDupla, { p: [0, -0.06, 0] }));
  }

  // item de presente
  if (item === 'espada') bd.mao.add(criarEspada(metal, ouro, couro));
  else if (item === 'vara') bd.mao.add(criarVara(couro, metal));
  else if (item === 'escudo') be.pivo.userData.cotovelo.add(criarEscudo(roupa.principal, roupa.detalhe, metal, toon(0x7a5230)));

  rig.bracoE = be.pivo;
  rig.bracoD = bd.pivo;
  corpo.add(rig.bracoE, rig.bracoD);
  return rig;
}

/** Libera as geometrias exclusivas de um rig que não será mais usado. */
export function descartarRig(rig) {
  const compartilhadas = new Set([G.esfera, G.esferaB]);
  rig.root.traverse((o) => {
    if (o.isMesh && !compartilhadas.has(o.geometry)) o.geometry.dispose();
  });
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
  const freq = { duende: 14, arqueiro: 14, assassino: 12, maga: 9, chefao: 6, heroi: 11 }[rig.tipo];
  rig.fase += dt * freq * (0.4 + andar * 0.6);
  const s = Math.sin(rig.fase);
  const amp = rig.tipo === 'maga' ? 0.5 : 0.8;

  rig.pernaE.rotation.x = s * amp * andar;
  rig.pernaD.rotation.x = -s * amp * andar;
  rig.bracoE.rotation.set(-s * 0.6 * andar, 0, 0.08);
  rig.bracoD.rotation.set(s * 0.6 * andar, 0, -0.08);
  rig.corpo.position.y = Math.abs(Math.cos(rig.fase)) * 0.06 * andar + Math.sin(t * 2.2) * 0.012;
  // joelhos dobram quando a perna vai para trás; cotovelos levemente flexionados
  const joelhoE = rig.pernaE.userData.joelho, joelhoD = rig.pernaD.userData.joelho;
  if (joelhoE) joelhoE.rotation.x = 0.04 + Math.max(0, Math.sin(rig.fase + 0.7)) * 1.1 * andar;
  if (joelhoD) joelhoD.rotation.x = 0.04 + Math.max(0, -Math.sin(rig.fase + 0.7)) * 1.1 * andar;
  const cotE = rig.bracoE.userData.cotovelo, cotD = rig.bracoD.userData.cotovelo;
  if (cotE) cotE.rotation.x = -0.18 - 0.35 * andar;
  if (cotD) cotD.rotation.x = -0.18 - 0.35 * andar;
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
  if (rig.tipo === 'heroi') {
    // segura o item de presente: a vara em pé à frente, o escudo erguido no braço esquerdo
    if (rig.item === 'vara') {
      rig.bracoD.rotation.x = -0.3 + s * 0.12 * andar;
      rig.bracoD.rotation.z = -0.12;
    } else if (rig.item === 'escudo') {
      rig.bracoE.rotation.x = -0.3 - s * 0.1 * andar;
      rig.bracoE.rotation.z = 0.12;
      if (cotE) cotE.rotation.x = -0.75;
    } else if (rig.item === 'espada') {
      rig.bracoD.rotation.x = -0.15 + s * 0.35 * andar;
    }
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
    if (cotE) cotE.rotation.x = -0.5 + a * 0.4;
    if (cotD) cotD.rotation.x = -0.5 + b * 0.4;
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
    if (cotE) cotE.rotation.x = -0.18 * (1 - a);   // braço do arco esticado
    if (cotD) cotD.rotation.x = -0.18 - 1.3 * a;   // mão da corda puxada até o rosto
    rig.flechaArco.visible = p < soltar && p > 0.1;
  } else if (rig.tipo === 'chefao' && rig.modo === 'pedra') {
    // SUPER do chefão: agacha, arranca uma pedra do chão, ergue e arremessa
    const ag = suave(Math.min(1, p / 0.25));               // agachar
    const ergue = suave((p - 0.3) / 0.35);                  // erguer acima da cabeça
    const joga = suave((p - 0.66) / 0.06);                  // arremessar
    const volta = suave((p - 0.8) / 0.2);                   // voltar à postura
    rig.corpo.rotation.x = (0.6 * ag - 0.8 * ergue + 0.55 * joga) * (1 - volta);
    rig.corpo.position.y -= 0.25 * ag * (1 - ergue);
    rig.bracoE.rotation.x = (-0.7 * ag - 2.4 * ergue + 2.2 * joga) * (1 - volta);
    rig.bracoE.rotation.z = 0.3 - 0.25 * ergue;
    rig.bracoD.rotation.x = 0.3 * ag * (1 - ergue);
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
