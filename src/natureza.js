// Geometrias do cenário: pinheiros, carvalhos, pedras, arbustos, grama, seixos,
// troncos caídos, lamparinas e braseiros. Formas irregulares e mais naturais,
// mas com proporções e cores de cartoon.
import * as THREE from 'three';

// ------------------------------------------------------------------ Utilidades
/** Ruído suave e determinístico (soma de senos) usado para deformar as formas. */
export function ruido3(x, y, z, semente = 0) {
  return (
    Math.sin(x * 1.7 + semente) * Math.cos(z * 1.3 - semente * 0.7) * 0.5 +
    Math.sin(y * 2.3 + z * 0.9 + semente * 1.3) * 0.3 +
    Math.cos(x * 3.1 - y * 1.9 + semente * 2.1) * 0.2
  );
}

/** Junta várias geometrias em uma só (posição, normal, cor). */
export function mesclar(geos) {
  const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of partes) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const cor = new Float32Array(total * 3);
  let o = 0;
  for (const g of partes) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) cor.set(g.attributes.color.array, o * 3);
    else cor.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  return r;
}

/** Pinta os vértices de uma geometria com uma cor (multiplicada pela do material). */
function pintar(geo, fn) {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  const cor = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), cor);
    c[i * 3] = cor.r;
    c[i * 3 + 1] = cor.g;
    c[i * 3 + 2] = cor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function deformar(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ Pinheiro
/** Copa do pinheiro: camadas de "saias" com bordas serrilhadas e caídas. */
export function geoCopaPinheiro(semente = 1) {
  const camadas = [];
  const niveis = [
    { y: 2.0, r: 2.3, h: 2.4 },
    { y: 3.3, r: 1.9, h: 2.2 },
    { y: 4.5, r: 1.45, h: 2.0 },
    { y: 5.6, r: 1.0, h: 1.8 },
    { y: 6.5, r: 0.55, h: 1.4 },
  ];
  niveis.forEach((n, k) => {
    const seg = 14;
    const g = new THREE.ConeGeometry(n.r, n.h, seg, 3, true);
    g.translate(0, n.y + n.h / 2, 0);
    deformar(g, (v) => {
      const raio = Math.hypot(v.x, v.z);
      if (raio < 1e-4) return;
      const ang = Math.atan2(v.z, v.x);
      const base = v.y < n.y + 0.05;
      // borda serrilhada: pontas alternadas que caem
      const ponta = base ? (Math.round((ang / (Math.PI * 2)) * seg) % 2 === 0 ? 1 : 0) : 0;
      const ond = 1 + ruido3(v.x, v.y, v.z, semente + k) * 0.12;
      v.x *= ond * (1 + ponta * 0.12);
      v.z *= ond * (1 + ponta * 0.12);
      v.y -= ponta * 0.35 + (base ? 0.15 : 0);
    });
    // base de cada camada mais escura (sombra interna), pontas mais claras
    pintar(g, (x, y, z, c) => {
      const t = THREE.MathUtils.clamp((y - n.y + 0.3) / n.h, 0, 1);
      c.setRGB(0.55 + t * 0.55, 0.6 + t * 0.5, 0.55 + t * 0.45);
    });
    camadas.push(g);
    // fundo da camada (para não ver por dentro)
    const fundo = new THREE.CircleGeometry(n.r * 0.92, seg).rotateX(Math.PI / 2).translate(0, n.y - 0.05, 0);
    pintar(fundo, (x, y, z, c) => c.setRGB(0.4, 0.45, 0.42));
    camadas.push(fundo);
  });
  return mesclar(camadas);
}

/** Tronco com raízes que se abrem no chão. */
export function geoTronco(altura = 3.2, raio = 0.3, semente = 1) {
  const perfil = [
    [raio * 2.0, 0], [raio * 1.45, 0.12], [raio * 1.1, 0.4], [raio, 0.9],
    [raio * 0.85, altura * 0.6], [raio * 0.6, altura], [0, altura + 0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(perfil, 10);
  deformar(g, (v) => {
    const a = Math.atan2(v.z, v.x);
    const raizes = v.y < 0.6 ? Math.max(0, Math.cos(a * 4 + semente)) * (0.6 - v.y) * 0.5 : 0;
    const k = 1 + raizes + ruido3(v.x * 3, v.y * 2, v.z * 3, semente) * 0.06;
    v.x *= k;
    v.z *= k;
  });
  // casca: listras verticais mais escuras
  return pintar(g, (x, y, z, c) => {
    const l = 0.8 + Math.sin(Math.atan2(z, x) * 9 + y * 0.8) * 0.12;
    c.setRGB(l, l * 0.95, l * 0.9);
  });
}

// ------------------------------------------------------------------ Carvalho retorcido
/** Tronco torto com galhos. */
export function geoTroncoCarvalho(semente = 3) {
  const partes = [geoTronco(2.6, 0.32, semente)];
  const galhos = [
    { y: 2.0, a: 0.3, inc: 0.9, c: 1.6 },
    { y: 2.3, a: 2.4, inc: 0.8, c: 1.4 },
    { y: 2.5, a: 4.3, inc: 0.7, c: 1.3 },
    { y: 1.6, a: 5.5, inc: 1.1, c: 1.1 },
  ];
  for (const b of galhos) {
    const g = new THREE.CylinderGeometry(0.07, 0.17, b.c, 6).translate(0, b.c / 2, 0);
    g.rotateZ(-b.inc);
    g.rotateY(b.a + semente);
    g.translate(0, b.y, 0);
    partes.push(pintar(g, (x, y, z, c) => c.setRGB(0.85, 0.8, 0.75)));
  }
  return mesclar(partes);
}

/** Copa do carvalho: bolhas arredondadas e irregulares. */
export function geoCopaCarvalho(semente = 3) {
  const bolhas = [
    [0, 3.7, 0, 1.6], [1.2, 3.3, 0.4, 1.15], [-1.1, 3.4, -0.3, 1.2],
    [0.3, 3.4, 1.1, 1.05], [-0.2, 3.3, -1.1, 1.1], [0.2, 4.6, 0.1, 1.05],
  ];
  const partes = bolhas.map(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 2);
    deformar(g, (v) => {
      const k = 1 + ruido3(v.x * 1.4, v.y * 1.4, v.z * 1.4, semente + i) * 0.16;
      v.multiplyScalar(k);
      if (v.y < -r * 0.3) v.y *= 0.7; // base mais achatada
    });
    g.translate(x, y, z);
    return pintar(g, (px, py, pz, c) => {
      const t = THREE.MathUtils.clamp((py - 2.4) / 3, 0, 1);
      c.setRGB(0.55 + t * 0.6, 0.6 + t * 0.55, 0.5 + t * 0.4);
    });
  });
  return mesclar(partes);
}

// ------------------------------------------------------------------ Pedras e arbustos
/** Pedra facetada com musgo no topo. */
export function geoPedra(semente = 1) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  deformar(g, (v) => {
    const k = 1 + ruido3(v.x * 1.8, v.y * 1.8, v.z * 1.8, semente) * 0.28;
    v.multiplyScalar(k);
    v.y *= 0.62;
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3; // base assentada no chão
  });
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return pintar(ng, (x, y, z, c) => {
    const musgo = THREE.MathUtils.clamp((y - 0.15) * 2.2 + ruido3(x * 3, 0, z * 3, semente) * 0.5, 0, 1);
    c.setRGB(1 - musgo * 0.55, 1 - musgo * 0.2, 1 - musgo * 0.6);
  });
}

export function geoArbusto(semente = 5) {
  const bolhas = [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.15, 0.45], [-0.45, 0.35, -0.1, 0.48], [0.1, 0.4, -0.45, 0.42], [-0.1, 0.75, 0.15, 0.4]];
  return mesclar(bolhas.map(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    deformar(g, (v) => v.multiplyScalar(1 + ruido3(v.x * 4, v.y * 4, v.z * 4, semente + i) * 0.18));
    g.translate(x, y, z);
    return pintar(g, (px, py, pz, c) => {
      const t = THREE.MathUtils.clamp(py / 1.1, 0, 1);
      c.setRGB(0.55 + t * 0.6, 0.6 + t * 0.55, 0.5 + t * 0.4);
    });
  }));
}

/** Tronco caído coberto de musgo. */
export function geoTroncoCaido(semente = 2) {
  const g = new THREE.CylinderGeometry(0.32, 0.38, 3.4, 10, 4);
  deformar(g, (v) => {
    const k = 1 + ruido3(v.x * 3, v.y, v.z * 3, semente) * 0.08;
    v.x *= k;
    v.z *= k;
  });
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.3, 0);
  return pintar(g, (x, y, z, c) => {
    const musgo = THREE.MathUtils.clamp((y - 0.45) * 4, 0, 1);
    c.setRGB(1 - musgo * 0.6, 1 - musgo * 0.15, 1 - musgo * 0.65);
  });
}

// ------------------------------------------------------------------ Grama
/** Tufo de grama: lâminas finas e curvas, escuras na base e claras na ponta. */
export function geoTufoGrama() {
  const laminas = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.7;
    const h = 0.32 + ((i * 37) % 10) / 30;
    const g = new THREE.PlaneGeometry(0.06, h, 1, 3);
    deformar(g, (v) => {
      const t = (v.y + h / 2) / h;
      v.x *= 1 - t * 0.9; // afina na ponta
      v.z += t * t * 0.12; // curva
    });
    g.translate(0, h / 2, 0);
    g.rotateX(-0.25);
    g.rotateY(a);
    g.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    laminas.push(pintar(g, (x, y, z, c) => {
      const t = THREE.MathUtils.clamp(y / 0.6, 0, 1);
      c.setRGB(0.35 + t * 0.9, 0.45 + t * 0.9, 0.3 + t * 0.6);
    }));
  }
  return mesclar(laminas);
}

/** Material da grama: balança com o vento (mais na ponta das lâminas). */
export function materialGrama() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3f6a2a, vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  m.userData.tempo = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = m.userData.tempo;
    shader.vertexShader = 'uniform float uTempo;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 basePos = instanceMatrix[3].xyz;
      #else
        vec3 basePos = vec3(0.0);
      #endif
      float balanco = sin(uTempo * 1.8 + basePos.x * 0.35 + basePos.z * 0.25) * 0.5 + sin(uTempo * 3.1 + basePos.z * 0.6) * 0.2;
      transformed.x += balanco * position.y * 0.35;
      transformed.z += balanco * position.y * 0.15;`
    );
  };
  return m;
}

// ------------------------------------------------------------------ Lamparina
/** Lamparina de ferro: poste torneado, braço curvo e lanterna com grade e vidro. */
export function criarLamparina(matFerro, matVidro) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sombra = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = sombra;
    g.add(m);
    return m;
  };
  // poste com base e anéis
  const perfil = [[0.2, 0], [0.2, 0.08], [0.13, 0.14], [0.09, 0.3], [0.07, 0.35], [0.06, 3.0], [0.09, 3.05], [0.09, 3.12], [0, 3.14]];
  add(new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 12), matFerro, 0, 0, 0);
  add(new THREE.TorusGeometry(0.085, 0.025, 6, 14).rotateX(Math.PI / 2), matFerro, 0, 1.2, 0, false);
  // braço curvo: sai do poste, sobe e segue reto até o gancho da lanterna
  const braco = add(new THREE.TorusGeometry(0.38, 0.03, 6, 14, Math.PI / 2), matFerro, 0, 3.05, 0);
  braco.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)
  ));
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6).rotateX(Math.PI / 2), matFerro, 0, 3.05, 0.57);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), matFerro, 0, 3.0, 0.76, false);
  // lanterna: teto, base, grade e vidro
  const lx = 0, ly = 2.52, lz = 0.76;
  add(new THREE.ConeGeometry(0.24, 0.2, 6), matFerro, lx, ly + 0.3, lz);
  add(new THREE.SphereGeometry(0.04, 8, 6), matFerro, lx, ly + 0.43, lz, false);
  add(new THREE.CylinderGeometry(0.16, 0.12, 0.06, 6), matFerro, lx, ly - 0.22, lz);
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 6, 1, true), matVidro, lx, ly, lz, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 4), matFerro, lx + Math.cos(a) * 0.16, ly, lz + Math.sin(a) * 0.16, false);
  }
  return { grupo: g, luz: new THREE.Vector3(lx, ly, lz) };
}

/** Braseiro: tigela de ferro sobre três pernas. */
export function criarBraseiro(matFerro) {
  const g = new THREE.Group();
  const bacia = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.3, 0.02], [0.55, 0.2], [0.62, 0.38], [0.56, 0.4], [0.5, 0.25], [0, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), 14),
    matFerro
  );
  bacia.position.y = 1.0;
  bacia.castShadow = true;
  g.add(bacia);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const perna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 6), matFerro);
    perna.position.set(Math.cos(a) * 0.32, 0.55, Math.sin(a) * 0.32);
    perna.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    perna.castShadow = true;
    g.add(perna);
  }
  // brasas
  const brasas = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1).scale(1, 0.35, 1),
    new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff5a10, emissiveIntensity: 1.6, flatShading: true })
  );
  brasas.position.y = 1.32;
  g.add(brasas);
  return g;
}

/** Menir: pedra alta, irregular e facetada. */
export function geoMenir(semente = 1) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  deformar(g, (v) => {
    v.multiplyScalar(1 + ruido3(v.x * 2, v.y * 2, v.z * 2, semente) * 0.18);
    v.x *= 0.55;
    v.z *= 0.36;
    v.y *= 1.7;
  });
  g.translate(0, 1.4, 0);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return pintar(ng, (x, y, z, c) => {
    const musgo = THREE.MathUtils.clamp((0.6 - y) * 1.5 + ruido3(x * 4, y * 2, z * 4, semente) * 0.4, 0, 1);
    c.setRGB(1 - musgo * 0.55, 1 - musgo * 0.2, 1 - musgo * 0.6);
  });
}
