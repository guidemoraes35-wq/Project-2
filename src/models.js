// Modelos low-poly dos personagens, montados com formas simples.
// Todos olham para +Z e têm os pés em y = 0.
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

function malha(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Cria um membro com pivô na articulação (ombro/quadril). */
function membro(geo, material, x, y, z, comprimento) {
  const pivo = new THREE.Group();
  pivo.position.set(x, y, z);
  const m = malha(geo, material, 0, -comprimento / 2, 0);
  pivo.add(m);
  return pivo;
}

function baseRig(tipo) {
  const root = new THREE.Group();
  const corpo = new THREE.Group();
  root.add(corpo);
  return { tipo, root, corpo, fase: 0 };
}

// ------------------------------------------------------------------ Assassino
export function criarAssassino() {
  const rig = baseRig('assassino');
  const { corpo } = rig;
  const couro = mat(0x3c4150);
  const escuro = mat(0x262833);
  const pele = mat(0xd4a079);
  const vermelho = mat(0x8e1b1b);
  const lamina = new THREE.MeshStandardMaterial({
    color: 0xd8e2ef, metalness: 0.9, roughness: 0.25, emissive: 0x334455, emissiveIntensity: 0.6,
  });

  const geoPerna = new THREE.BoxGeometry(0.17, 0.82, 0.2);
  rig.pernaE = membro(geoPerna, escuro, 0.13, 0.84, 0, 0.82);
  rig.pernaD = membro(geoPerna, escuro, -0.13, 0.84, 0, 0.82);
  corpo.add(rig.pernaE, rig.pernaD);

  corpo.add(malha(new THREE.BoxGeometry(0.48, 0.62, 0.28), couro, 0, 1.15, 0));
  corpo.add(malha(new THREE.BoxGeometry(0.5, 0.08, 0.3), mat(0x3b2616), 0, 0.88, 0));
  const lenco = malha(new THREE.TorusGeometry(0.15, 0.06, 6, 12), vermelho, 0, 1.47, 0);
  lenco.rotation.x = Math.PI / 2;
  corpo.add(lenco);

  // cabeça com capuz e máscara
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.68;
  cabeca.add(malha(new THREE.SphereGeometry(0.19, 12, 10), pele));
  const capuz = malha(new THREE.SphereGeometry(0.235, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), escuro, 0, 0.02, -0.02);
  cabeca.add(capuz);
  const pontaCapuz = malha(new THREE.ConeGeometry(0.16, 0.3, 8), escuro, 0, 0.02, -0.24);
  pontaCapuz.rotation.x = -Math.PI / 2.4;
  cabeca.add(pontaCapuz);
  cabeca.add(malha(new THREE.BoxGeometry(0.3, 0.13, 0.12), escuro, 0, -0.08, 0.13));
  const olho = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  cabeca.add(malha(new THREE.BoxGeometry(0.05, 0.025, 0.02), olho, 0.065, 0.02, 0.18));
  cabeca.add(malha(new THREE.BoxGeometry(0.05, 0.025, 0.02), olho, -0.065, 0.02, 0.18));
  corpo.add(cabeca);

  // capa
  rig.capa = new THREE.Group();
  rig.capa.position.set(0, 1.45, -0.15);
  const capaMalha = malha(new THREE.BoxGeometry(0.52, 1.05, 0.03), mat(0x1a1015), 0, -0.52, 0);
  rig.capa.add(capaMalha);
  corpo.add(rig.capa);

  // braços com adagas
  const geoBraco = new THREE.BoxGeometry(0.13, 0.6, 0.14);
  rig.bracoE = membro(geoBraco, couro, 0.31, 1.42, 0, 0.6);
  rig.bracoD = membro(geoBraco, couro, -0.31, 1.42, 0, 0.6);
  const criarAdaga = () => {
    const g = new THREE.Group();
    g.add(malha(new THREE.BoxGeometry(0.05, 0.14, 0.05), mat(0x2b1a10), 0, 0, 0));
    g.add(malha(new THREE.BoxGeometry(0.14, 0.03, 0.05), mat(0x8c7a3a, { metalness: 0.7 }), 0, 0.08, 0));
    const l = malha(new THREE.ConeGeometry(0.045, 0.42, 4), lamina, 0, 0.3, 0);
    g.add(l);
    g.position.set(0, -0.62, 0.05);
    g.rotation.x = Math.PI / 2.2;
    return g;
  };
  rig.bracoE.add(criarAdaga());
  rig.bracoD.add(criarAdaga());
  corpo.add(rig.bracoE, rig.bracoD);
  return rig;
}

// ----------------------------------------------------------------------- Maga
export function criarMaga() {
  const rig = baseRig('maga');
  const { corpo } = rig;
  const roxo = mat(0x4f2c86);
  const roxoEscuro = mat(0x2c1850);
  const ouro = mat(0xd4af37, { metalness: 0.8, roughness: 0.35 });
  const pele = mat(0xf0c6a4);
  const cabelo = mat(0xe6e3f5);

  const geoPerna = new THREE.BoxGeometry(0.14, 0.6, 0.16);
  rig.pernaE = membro(geoPerna, mat(0x221a2e), 0.1, 0.62, 0, 0.6);
  rig.pernaD = membro(geoPerna, mat(0x221a2e), -0.1, 0.62, 0, 0.6);
  corpo.add(rig.pernaE, rig.pernaD);

  // vestido (com saia que balança)
  rig.saia = malha(new THREE.CylinderGeometry(0.21, 0.5, 1.0, 10), roxo, 0, 0.62, 0);
  corpo.add(rig.saia);
  corpo.add(malha(new THREE.CylinderGeometry(0.19, 0.23, 0.48, 10), roxo, 0, 1.33, 0));
  const cinto = malha(new THREE.TorusGeometry(0.22, 0.03, 6, 14), ouro, 0, 1.11, 0);
  cinto.rotation.x = Math.PI / 2;
  corpo.add(cinto);

  // cabeça, cabelo e chapéu pontudo
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.72;
  cabeca.add(malha(new THREE.SphereGeometry(0.18, 12, 10), pele));
  cabeca.add(malha(new THREE.SphereGeometry(0.2, 12, 10), cabelo, 0, 0.03, -0.04));
  cabeca.add(malha(new THREE.BoxGeometry(0.34, 0.55, 0.12), cabelo, 0, -0.25, -0.12));
  const olho = new THREE.MeshBasicMaterial({ color: 0x5fd0ff });
  cabeca.add(malha(new THREE.SphereGeometry(0.025, 6, 6), olho, 0.065, 0.0, 0.165));
  cabeca.add(malha(new THREE.SphereGeometry(0.025, 6, 6), olho, -0.065, 0.0, 0.165));
  const aba = malha(new THREE.CylinderGeometry(0.43, 0.43, 0.03, 18), roxoEscuro, 0, 0.13, 0);
  cabeca.add(aba);
  const chapeu = malha(new THREE.ConeGeometry(0.27, 0.72, 12), roxoEscuro, 0, 0.5, -0.04);
  chapeu.rotation.x = -0.18;
  cabeca.add(chapeu);
  const faixa = malha(new THREE.CylinderGeometry(0.255, 0.27, 0.06, 12), ouro, 0, 0.18, 0);
  cabeca.add(faixa);
  corpo.add(cabeca);

  // braços
  const geoBraco = new THREE.CylinderGeometry(0.07, 0.1, 0.58, 7);
  rig.bracoE = membro(geoBraco, roxo, 0.27, 1.52, 0, 0.58);
  rig.bracoD = membro(geoBraco, roxo, -0.27, 1.52, 0, 0.58);
  rig.bracoE.add(malha(new THREE.SphereGeometry(0.06, 6, 6), pele, 0, -0.6, 0));
  rig.bracoD.add(malha(new THREE.SphereGeometry(0.06, 6, 6), pele, 0, -0.6, 0));

  // cajado com orbe brilhante
  const cajado = new THREE.Group();
  cajado.position.set(0, -0.6, 0.04);
  cajado.add(malha(new THREE.CylinderGeometry(0.025, 0.035, 1.75, 6), mat(0x4a2e1a), 0, 0.15, 0));
  cajado.add(malha(new THREE.TorusGeometry(0.1, 0.02, 6, 12), ouro, 0, 1.08, 0));
  const orbe = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: 0x3ab8ff, emissiveIntensity: 3 })
  );
  orbe.position.y = 1.1;
  cajado.add(orbe);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(90,190,255,1)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
  }));
  brilho.scale.setScalar(0.8);
  orbe.add(brilho);
  const luz = new THREE.PointLight(0x58b8ff, 4, 7, 1.6);
  orbe.add(luz);
  rig.bracoD.add(cajado);
  rig.orbe = orbe;
  rig.luzOrbe = luz;
  corpo.add(rig.bracoE, rig.bracoD);
  return rig;
}

// ---------------------------------------------------------------------- Duende
const cacheDuende = {};
function geoDuende() {
  if (cacheDuende.ok) return cacheDuende;
  Object.assign(cacheDuende, {
    ok: true,
    perna: new THREE.BoxGeometry(0.13, 0.4, 0.14),
    tronco: new THREE.BoxGeometry(0.42, 0.42, 0.3),
    cabeca: new THREE.SphereGeometry(0.26, 10, 8),
    orelha: new THREE.ConeGeometry(0.08, 0.36, 5),
    nariz: new THREE.ConeGeometry(0.05, 0.18, 5),
    olho: new THREE.SphereGeometry(0.04, 6, 6),
    braco: new THREE.BoxGeometry(0.1, 0.38, 0.11),
    clava: new THREE.CylinderGeometry(0.09, 0.04, 0.6, 6),
    cabo: new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5),
    matTunica: mat(0x5a3b1f),
    matCalca: mat(0x3a2a18),
    matOlho: new THREE.MeshBasicMaterial({ color: 0xff3a1a }),
    matClava: mat(0x4a3220),
  });
  return cacheDuende;
}

export function criarDuende() {
  const g = geoDuende();
  const rig = baseRig('duende');
  const { corpo } = rig;
  // material de pele próprio para piscar ao ser atingido
  const pele = mat(0x5e8c37, { emissive: 0x000000 });
  rig.pele = pele;

  rig.pernaE = membro(g.perna, g.matCalca, 0.1, 0.42, 0, 0.4);
  rig.pernaD = membro(g.perna, g.matCalca, -0.1, 0.42, 0, 0.4);
  corpo.add(rig.pernaE, rig.pernaD);
  corpo.add(malha(g.tronco, g.matTunica, 0, 0.62, 0));

  const cabeca = new THREE.Group();
  cabeca.position.y = 1.05;
  cabeca.add(malha(g.cabeca, pele));
  const orelhaE = malha(g.orelha, pele, 0.28, 0.05, -0.02);
  orelhaE.rotation.z = -Math.PI / 2 - 0.35;
  const orelhaD = malha(g.orelha, pele, -0.28, 0.05, -0.02);
  orelhaD.rotation.z = Math.PI / 2 + 0.35;
  cabeca.add(orelhaE, orelhaD);
  const nariz = malha(g.nariz, pele, 0, -0.03, 0.27);
  nariz.rotation.x = Math.PI / 2;
  cabeca.add(nariz);
  cabeca.add(malha(g.olho, g.matOlho, 0.09, 0.06, 0.22));
  cabeca.add(malha(g.olho, g.matOlho, -0.09, 0.06, 0.22));
  corpo.add(cabeca);
  rig.cabeca = cabeca;

  rig.bracoE = membro(g.braco, pele, 0.27, 0.8, 0, 0.38);
  rig.bracoD = membro(g.braco, pele, -0.27, 0.8, 0, 0.38);
  const clava = new THREE.Group();
  clava.position.set(0, -0.4, 0.05);
  clava.rotation.x = Math.PI / 2.3;
  clava.add(malha(g.cabo, g.matClava, 0, 0, 0));
  clava.add(malha(g.clava, g.matClava, 0, 0.38, 0));
  rig.bracoD.add(clava);
  corpo.add(rig.bracoE, rig.bracoD);

  rig.root.scale.setScalar(0.95);
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
  const freq = rig.tipo === 'duende' ? 14 : rig.tipo === 'assassino' ? 12 : 9;
  rig.fase += dt * freq * (0.4 + andar * 0.6);
  const s = Math.sin(rig.fase);
  const amp = rig.tipo === 'maga' ? 0.5 : 0.8;

  rig.pernaE.rotation.x = s * amp * andar;
  rig.pernaD.rotation.x = -s * amp * andar;
  rig.bracoE.rotation.set(-s * 0.6 * andar, 0, 0);
  rig.bracoD.rotation.set(s * 0.6 * andar, 0, 0);
  rig.corpo.position.y = Math.abs(Math.cos(rig.fase)) * 0.06 * andar + Math.sin(t * 2.2) * 0.012;
  rig.corpo.rotation.set(andar * 0.08, 0, 0);

  if (rig.capa) rig.capa.rotation.x = 0.1 + andar * 0.5 + Math.sin(t * 3) * 0.04;
  if (rig.saia) rig.saia.rotation.z = Math.sin(rig.fase) * 0.06 * andar;
  if (rig.tipo === 'maga') {
    // mantém o cajado à frente
    rig.bracoD.rotation.x = -0.35 + s * 0.15 * andar;
    rig.bracoD.rotation.z = -0.12;
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
  } else {
    // duende: ergue a clava e bate
    const sobe = Math.min(1, p / 0.55);
    const desce = Math.max(0, (p - 0.55) / 0.2);
    rig.bracoD.rotation.x = -2.7 * suave(sobe) + Math.min(1, desce) * 3.1;
    rig.corpo.rotation.x = -0.15 * sobe + Math.min(1, desce) * 0.35;
  }
}
