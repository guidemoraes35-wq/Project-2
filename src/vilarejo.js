// O vilarejo: o primeiro lugar seguro depois do tutorial. É dia e não há inimigos.
// Casas de enxaimel ao redor de uma praça com um poço, estradas de terra,
// uma barraca de feira, uma horta, um moinho e a floresta em volta.
import * as THREE from 'three';
import { texturaBrilho, criarAleatorio } from './world.js';
import {
  geoCopaPinheiro, geoTronco, geoTroncoCarvalho, geoCopaCarvalho, geoArbusto, geoPedra,
  geoTufoGrama, materialGrama, criarLamparina,
} from './natureza.js';

const RAIO_ANDAVEL = 33;   // o herói não sai deste círculo
const RAIO_PRACA = 7.5;
const MEIA_ESTRADA = 1.7;

const suave = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Altura do terreno: plano no vilarejo, morros suaves em volta. */
function altura(x, z) {
  const r = Math.hypot(x, z);
  const t = suave((r - 38) / 40);
  return t * 9 + Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.6 * t;
}

// Estradas (x, z): saem da praça para os quatro lados; a do norte vai até o moinho.
const ESTRADAS = [
  [[0, 5], [0, 20], [-1.5, 34], [-3, 52], [-2, 80]],
  [[5, 1], [17, 3], [30, 0], [48, -6], [80, -10]],
  [[-5, -1], [-17, -4], [-30, -2], [-50, 4], [-80, 6]],
  [[1, -5], [3, -15], [6, -22]],
];

// Casas: posição, tamanho (largura, profundidade, altura das paredes) e cores.
const CASAS = [
  { x: -11, z: 11, larg: 6, prof: 4.6, alt: 2.8, parede: 0xf1e6cc, telhado: 0xb0472f, janela: 0x2f6a8a },
  { x: 12, z: 12, larg: 5.4, prof: 4.4, alt: 2.6, parede: 0xf3ecdc, telhado: 0x4e6080, janela: 0x8a2f3a },
  { x: -14, z: -12, larg: 6.4, prof: 5, alt: 3.1, parede: 0xeedcb4, telhado: 0x7a4a2a, janela: 0x3f7a35 },
  { x: 16, z: -9, larg: 5.6, prof: 4.6, alt: 2.7, parede: 0xf1e6cc, telhado: 0x9a3a32, janela: 0x2f6a8a },
  { x: -7, z: -18, larg: 5, prof: 4.2, alt: 2.6, parede: 0xf4efe3, telhado: 0xb0472f, janela: 0x8a6a2f },
  { x: -22, z: 7, larg: 5.2, prof: 4.4, alt: 2.6, parede: 0xf0deb0, telhado: 0x4e6080, janela: 0x8a2f3a },
  { x: 25, z: 12, larg: 6, prof: 4.6, alt: 2.9, parede: 0xeedcb4, telhado: 0x7a4a2a, janela: 0x2f6a8a },
  { x: -19, z: 23, larg: 5.4, prof: 4.4, alt: 2.7, parede: 0xf3ecdc, telhado: 0x9a3a32, janela: 0x3f7a35 },
];
const MOINHO = { x: 8, z: -28 };

// ------------------------------------------------------------------ Texturas
function canvas(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function texturaGrama(rnd) {
  const tex = canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#69a23e';
    ctx.fillRect(0, 0, w, h);
    const cores = ['#5e9638', '#77b048', '#5a8f35', '#82b852', '#6aa841'];
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = cores[Math.floor(rnd() * cores.length)];
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 1600; i++) {
      const x = rnd() * w, y = rnd() * h;
      ctx.strokeStyle = ['#4f8a2e', '#8cc65a', '#5d9a36'][Math.floor(rnd() * 3)];
      ctx.lineWidth = 0.8 + rnd() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Terra batida: o eixo u atravessa a estrada (bordas transparentes), o v segue por ela. */
function texturaTerra(rnd) {
  const tex = canvas(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b48d5c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = ['#a07a4a', '#c29c6a', '#9a7444', '#bc9662'][Math.floor(rnd() * 4)];
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // marcas das rodas das carroças
    ctx.fillStyle = 'rgba(120, 88, 52, 0.45)';
    ctx.fillRect(w * 0.3, 0, w * 0.06, h);
    ctx.fillRect(w * 0.64, 0, w * 0.06, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#8c8a84' : '#a7a49c';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 1.5 + rnd() * 2, 1 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // bordas que se misturam com a grama
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.16, 'rgba(0,0,0,1)');
    g.addColorStop(0.84, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Calçamento de pedras em anéis para a praça (borda transparente). */
function texturaPraca(rnd) {
  return canvas(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#857c6c';
    ctx.fillRect(0, 0, w, w);
    for (let r = 10; r < c; r += 19) {
      const n = Math.max(6, Math.floor((Math.PI * 2 * r) / 22));
      const desvio = rnd() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = desvio + (i / n) * Math.PI * 2;
        const l = 150 + Math.floor(rnd() * 50);
        ctx.fillStyle = `rgb(${l}, ${l - 8 + Math.floor(rnd() * 10)}, ${l - 22})`;
        ctx.save();
        ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 10.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const g = ctx.createRadialGradient(c, c, c * 0.86, c, c, c);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

/** Telhas em fileiras (em tons de cinza: a cor vem do material). */
function texturaTelhas() {
  const tex = canvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, w, h);
    const linhas = 8, colunas = 6;
    for (let j = 0; j < linhas; j++) {
      const y = (j / linhas) * h;
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(0, y, w, 3);
      for (let i = 0; i < colunas; i++) {
        const x = ((i + (j % 2) * 0.5) / colunas) * w;
        ctx.fillRect(x, y, 2, h / linhas);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// ------------------------------------------------------------------ Construções
const caixa = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function adicionar(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Casa de enxaimel: alicerce de pedra, paredes claras com vigas, telhado e chaminé. */
function criarCasa(c, M) {
  const g = new THREE.Group();
  const { larg, prof, alt } = c;
  const parede = new THREE.MeshStandardMaterial({ color: c.parede, roughness: 0.95 });
  const telhado = new THREE.MeshStandardMaterial({ color: c.telhado, roughness: 0.85, map: M.texTelhas });
  const janela = new THREE.MeshStandardMaterial({ color: c.janela, roughness: 0.8 });
  const y0 = 0.45;
  const yTopo = y0 + alt;
  const v = 0.16;

  adicionar(g, caixa(larg + 0.3, 0.45, prof + 0.3), M.pedra, 0, 0.225, 0);
  adicionar(g, caixa(larg, alt, prof), parede, 0, y0 + alt / 2, 0);

  // vigas: cantos, topo, meio e diagonais na frente e atrás
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) adicionar(g, caixa(v, alt, v), M.viga, (sx * larg) / 2, y0 + alt / 2, (sz * prof) / 2);
  for (const sz of [-1, 1]) {
    adicionar(g, caixa(larg + v, v, v), M.viga, 0, yTopo - v / 2, (sz * prof) / 2);
    adicionar(g, caixa(larg, v * 0.8, v * 0.6), M.viga, 0, y0 + alt * 0.48, (sz * prof) / 2 + sz * 0.02);
    const yMeio = y0 + alt * 0.48;
    const dy = yTopo - v - yMeio;
    const dx = alt * 0.42;
    const comp = Math.hypot(dx, dy);
    for (const sx of [-1, 1]) {
      const x0 = sx * (larg / 2 - 0.1);
      const x1 = x0 - sx * dx;
      adicionar(g, caixa(comp, v * 0.7, v * 0.5), M.viga, (x0 + x1) / 2, yMeio + dy / 2, (sz * prof) / 2 + sz * 0.025, 0, 0, Math.atan2(dy, x1 - x0));
    }
  }
  for (const sx of [-1, 1]) adicionar(g, caixa(v, v, prof), M.viga, (sx * larg) / 2, yTopo - v / 2, 0);

  // porta com batente, maçaneta e degrau
  const zf = prof / 2 + 0.03;
  const xPorta = -larg * 0.18;
  adicionar(g, caixa(0.95, 1.75, 0.08), M.porta, xPorta, y0 + 0.875, zf);
  adicionar(g, caixa(1.15, 0.12, 0.12), M.viga, xPorta, y0 + 1.8, zf);
  for (const s of [-1, 1]) adicionar(g, caixa(0.1, 1.8, 0.12), M.viga, xPorta + s * 0.53, y0 + 0.9, zf);
  adicionar(g, new THREE.SphereGeometry(0.05, 8, 6), M.ferro, xPorta + 0.3, y0 + 0.85, zf + 0.06);
  adicionar(g, caixa(1.3, 0.2, 0.6), M.pedra, xPorta, 0.1, prof / 2 + 0.45);

  // janelas com venezianas e floreira
  const janelaEm = (x, y, z, ry) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    j.rotation.y = ry;
    adicionar(j, caixa(0.8, 0.7, 0.05), M.vidro, 0, 0, 0);
    adicionar(j, caixa(0.9, 0.08, 0.1), M.viga, 0, 0.38, 0.02);
    adicionar(j, caixa(0.9, 0.08, 0.12), M.viga, 0, -0.38, 0.03);
    adicionar(j, caixa(0.05, 0.7, 0.07), M.viga, 0, 0, 0.02);
    adicionar(j, caixa(0.8, 0.05, 0.07), M.viga, 0, 0, 0.02);
    for (const s of [-1, 1]) adicionar(j, caixa(0.38, 0.72, 0.05), janela, s * 0.62, 0, 0.04, 0, s * -0.35, 0);
    adicionar(j, caixa(0.85, 0.2, 0.22), M.porta, 0, -0.5, 0.12);
    for (let i = 0; i < 5; i++) {
      const flor = new THREE.Mesh(M.geoFlor, M.flores[(i + Math.floor(x * 3)) % M.flores.length]);
      flor.position.set(-0.32 + i * 0.16, -0.36, 0.12 + (i % 2) * 0.05);
      j.add(flor);
    }
    g.add(j);
  };
  janelaEm(larg * 0.22, y0 + alt * 0.55, zf, 0);
  for (const sx of [-1, 1]) janelaEm(sx * (larg / 2 + 0.03), y0 + alt * 0.55, 0, sx * Math.PI / 2);
  janelaEm(0, y0 + alt * 0.55, -zf, Math.PI);

  // telhado: sótão em prisma, duas águas e cumeeira
  const hTelhado = prof * 0.48;
  const tri = new THREE.Shape();
  tri.moveTo(-prof / 2, 0);
  tri.lineTo(prof / 2, 0);
  tri.lineTo(0, hTelhado);
  tri.lineTo(-prof / 2, 0);
  const sotao = new THREE.ExtrudeGeometry(tri, { depth: larg, bevelEnabled: false });
  sotao.translate(0, 0, -larg / 2);
  sotao.rotateY(Math.PI / 2);
  adicionar(g, sotao, parede, 0, yTopo, 0);
  const ang = Math.atan2(hTelhado, prof / 2);
  const comp = Math.hypot(prof / 2, hTelhado) + 0.55;
  const cume = new THREE.Vector3(0, yTopo + hTelhado, 0);
  for (const sz of [-1, 1]) {
    const desce = new THREE.Vector3(0, -Math.sin(ang), sz * Math.cos(ang));
    const normal = new THREE.Vector3(0, Math.cos(ang), sz * Math.sin(ang));
    const p = cume.clone().addScaledVector(desce, comp / 2 - 0.05).addScaledVector(normal, 0.1);
    adicionar(g, caixa(larg + 0.8, 0.16, comp), telhado, p.x, p.y, p.z, sz * ang, 0, 0);
  }
  adicionar(g, new THREE.CylinderGeometry(0.13, 0.13, larg + 0.9, 8).rotateZ(Math.PI / 2), M.viga, 0, yTopo + hTelhado + 0.12, 0);

  // chaminé atravessando a água de trás
  const cx = larg * 0.28, cz = -prof * 0.2;
  const topoChamine = yTopo + hTelhado + 0.6;
  adicionar(g, caixa(0.6, topoChamine - yTopo, 0.6), M.pedra, cx, (yTopo + topoChamine) / 2, cz);
  adicionar(g, caixa(0.75, 0.15, 0.75), M.pedra, cx, topoChamine, cz);

  return { grupo: g, chamine: new THREE.Vector3(cx, topoChamine + 0.15, cz) };
}

/** Poço de pedra com telhadinho, manivela e balde. */
function criarPoco(M) {
  const g = new THREE.Group();
  const paredeGeo = new THREE.CylinderGeometry(1.0, 1.05, 0.9, 16, 1, true);
  const parede = new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  adicionar(g, paredeGeo, parede, 0, 0.45, 0);
  adicionar(g, new THREE.TorusGeometry(0.98, 0.13, 8, 20).rotateX(Math.PI / 2), M.pedra, 0, 0.92, 0);
  const agua = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a6a9a, roughness: 0.1 }));
  agua.position.y = 0.55;
  g.add(agua);
  for (const s of [-1, 1]) adicionar(g, caixa(0.16, 2.3, 0.16), M.viga, s * 0.95, 1.15, 0);
  adicionar(g, new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8).rotateZ(Math.PI / 2), M.porta, 0, 1.75, 0);
  adicionar(g, caixa(0.06, 0.4, 0.06), M.viga, 1.15, 1.6, 0.15);
  const telha = new THREE.MeshStandardMaterial({ color: 0xa8432e, roughness: 0.85, map: M.texTelhas });
  for (const s of [-1, 1]) adicionar(g, caixa(2.5, 0.1, 1.1), telha, 0, 2.5, s * 0.42, s * 0.6, 0, 0);
  adicionar(g, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), M.corda, 0, 1.4, 0);
  adicionar(g, new THREE.CylinderGeometry(0.17, 0.13, 0.26, 10), M.porta, 0, 0.98, 0);
  return g;
}

/** Barraca de feira com toldo listrado e frutas no balcão. */
function criarBarraca(M) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    adicionar(g, caixa(0.12, 2.5, 0.12), M.viga, sx * 1.4, 1.25, 0.7);
    adicionar(g, caixa(0.12, 2.1, 0.12), M.viga, sx * 1.4, 1.05, -0.7);
  }
  adicionar(g, caixa(3.0, 0.9, 1.0), M.porta, 0, 0.45, 0.2);
  const listras = [new THREE.MeshStandardMaterial({ color: 0xc8352e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.9 })];
  for (let i = 0; i < 7; i++) adicionar(g, caixa(0.45, 0.05, 1.9), listras[i % 2], -1.35 + i * 0.45, 2.35, 0.05, -0.22, 0, 0);
  const frutas = [0xd8342a, 0xf0962a, 0x6aa83a, 0xe8c83a];
  for (let k = 0; k < 4; k++) {
    const x = -1.05 + k * 0.7;
    adicionar(g, caixa(0.6, 0.18, 0.6), M.caixote, x, 0.99, 0.25);
    const mat = new THREE.MeshStandardMaterial({ color: frutas[k], roughness: 0.6 });
    for (let i = 0; i < 6; i++) adicionar(g, new THREE.SphereGeometry(k === 2 ? 0.12 : 0.09, 10, 8), mat, x - 0.15 + (i % 3) * 0.15, 1.13 + Math.floor(i / 3) * 0.06, 0.12 + Math.floor(i / 3) * 0.22);
  }
  return g;
}

/** Moinho de vento: torre de pedra, telhado cônico e pás que giram. */
function criarMoinho(M) {
  const g = new THREE.Group();
  const torre = new THREE.LatheGeometry([[2.2, 0], [2.1, 0.5], [1.85, 4], [1.6, 7], [0, 7]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  adicionar(g, torre, new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.95 }), 0, 0, 0);
  adicionar(g, new THREE.ConeGeometry(1.95, 2.4, 14), new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.85, map: M.texTelhas }), 0, 8.2, 0);
  adicionar(g, caixa(1.0, 1.8, 0.2), M.porta, 0, 0.9, 2.12, -0.04, 0, 0);
  for (const y of [3.2, 5.4]) adicionar(g, caixa(0.6, 0.7, 0.2), M.vidro, 0, y, 1.92 - (y - 3.2) * 0.08, -0.04, 0, 0);
  const pas = new THREE.Group();
  pas.position.set(0, 6.6, 1.9);
  adicionar(pas, new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10).rotateX(Math.PI / 2), M.viga, 0, 0, 0);
  const lona = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const braco = new THREE.Group();
    braco.rotation.z = (i / 4) * Math.PI * 2;
    adicionar(braco, caixa(0.14, 5.2, 0.12), M.viga, 0, 2.6, 0.1);
    adicionar(braco, caixa(0.9, 4.0, 0.04), lona, 0.5, 3.0, 0.14);
    for (let k = 0; k < 5; k++) adicionar(braco, caixa(0.95, 0.05, 0.06), M.viga, 0.5, 1.1 + k * 0.95, 0.17);
    pas.add(braco);
  }
  g.add(pas);
  return { grupo: g, pas };
}

function criarBarril(M) {
  const g = new THREE.Group();
  const perfil = [[0, 0], [0.32, 0], [0.37, 0.22], [0.39, 0.45], [0.37, 0.68], [0.32, 0.9], [0, 0.9]];
  adicionar(g, new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 14), M.porta, 0, 0, 0);
  for (const y of [0.16, 0.74]) adicionar(g, new THREE.TorusGeometry(0.37, 0.025, 6, 16).rotateX(Math.PI / 2), M.ferro, 0, y, 0);
  return g;
}

/** Cerca de estacas ao longo do eixo x, de 0 até `comp`. */
function criarCerca(comp, M) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(comp / 0.32));
  const estacas = new THREE.InstancedMesh(M.geoEstaca, M.cerca, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation((i / (n - 1)) * comp, 0.45, 0);
    estacas.setMatrixAt(i, m);
  }
  estacas.castShadow = true;
  g.add(estacas);
  for (const y of [0.3, 0.65]) adicionar(g, caixa(comp, 0.07, 0.04), M.cerca, comp / 2, y, -0.04);
  return g;
}

// ------------------------------------------------------------------ Vilarejo
export function criarVilarejo() {
  const scene = new THREE.Scene();
  const rnd = criarAleatorio(4242);
  const corCeu = 0xbfe2f6;
  scene.background = new THREE.Color(corCeu);
  scene.fog = new THREE.Fog(corCeu, 55, 170);

  // ---------- Luz do dia ----------
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b8a4a, 1.25));
  const sol = new THREE.DirectionalLight(0xfff0d6, 2.6);
  sol.position.set(30, 48, 22);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42;
  sc.near = 5; sc.far = 130;
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.04;
  scene.add(sol, sol.target);

  // ---------- Céu: cúpula em degradê, sol e nuvens (acompanham a câmera) ----------
  const ceu = new THREE.Group();
  const geoCupula = new THREE.SphereGeometry(300, 24, 12);
  {
    const p = geoCupula.attributes.position;
    const cores = new Float32Array(p.count * 3);
    const topo = new THREE.Color(0x4f9be0), horizonte = new THREE.Color(corCeu), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      c.copy(horizonte).lerp(topo, suave(p.getY(i) / 160));
      cores.set([c.r, c.g, c.b], i * 3);
    }
    geoCupula.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  }
  ceu.add(new THREE.Mesh(geoCupula, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  const brilhoSol = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(255,250,220,1)'), fog: false, depthWrite: false, transparent: true,
  }));
  brilhoSol.scale.setScalar(70);
  brilhoSol.position.copy(sol.position).normalize().multiplyScalar(250);
  ceu.add(brilhoSol);
  scene.add(ceu);

  const nuvens = [];
  const matNuvem = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8a9cb0, roughness: 1, fog: false, flatShading: true });
  const geoNuvem = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 14; i++) {
    const n = new THREE.Group();
    const partes = 4 + Math.floor(rnd() * 4);
    for (let k = 0; k < partes; k++) {
      const s = 4 + rnd() * 5;
      const m = new THREE.Mesh(geoNuvem, matNuvem);
      m.scale.set(s * 1.3, s * 0.7, s);
      m.position.set((k - partes / 2) * 5 + rnd() * 3, rnd() * 2, rnd() * 4);
      n.add(m);
    }
    const a = rnd() * Math.PI * 2;
    const r = 90 + rnd() * 120;
    n.position.set(Math.cos(a) * r, 55 + rnd() * 30, Math.sin(a) * r);
    n.userData.vel = 1 + rnd() * 1.5;
    scene.add(n);
    nuvens.push(n);
  }

  // ---------- Materiais compartilhados ----------
  const M = {
    pedra: new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.95, flatShading: true }),
    viga: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 }),
    porta: new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.85 }),
    caixote: new THREE.MeshStandardMaterial({ color: 0xa8784a, roughness: 0.9 }),
    ferro: new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.5, metalness: 0.6 }),
    vidro: new THREE.MeshStandardMaterial({ color: 0x9fc8e8, emissive: 0x1a3048, roughness: 0.15, metalness: 0.2 }),
    corda: new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1 }),
    cerca: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }),
    texTelhas: texturaTelhas(),
    geoFlor: new THREE.IcosahedronGeometry(0.07, 0),
    geoEstaca: new THREE.BoxGeometry(0.1, 0.9, 0.05),
    flores: [0xe84a5a, 0xf2c83a, 0xffffff, 0xb05ae0, 0xff8ac0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  };

  // ---------- Colisões: círculos e caixas giradas ----------
  const circulos = [];
  const caixas = [];
  const addCirculo = (x, z, r) => circulos.push({ x, z, r });
  const addCaixa = (x, z, mx, mz, rot) => caixas.push({ x, z, mx, mz, cos: Math.cos(rot), sin: Math.sin(rot) });

  /** Distância até a estrada mais próxima. */
  function distEstrada(x, z) {
    let melhor = Infinity;
    for (const e of ESTRADAS) {
      for (let i = 0; i < e.length - 1; i++) {
        const [ax, az] = e[i], [bx, bz] = e[i + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        melhor = Math.min(melhor, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
    }
    return melhor;
  }
  function dentroDeCaixa(x, z, folga) {
    for (const c of caixas) {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.mx + folga && Math.abs(lz) < c.mz + folga) return true;
    }
    return false;
  }
  const livre = (x, z, r) =>
    !dentroDeCaixa(x, z, r) && circulos.every((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > (c.r + r) ** 2);

  // ---------- Chão: grama, morros em volta, estradas e praça ----------
  const TAM = 260;
  const geoChao = new THREE.PlaneGeometry(TAM, TAM, 130, 130).rotateX(-Math.PI / 2);
  {
    const p = geoChao.attributes.position;
    const uv = geoChao.attributes.uv;
    const cores = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, altura(x, z));
      uv.setXY(i, x / 8, z / 8);
      const v = 0.92 + Math.sin(x * 0.13 + 1) * Math.cos(z * 0.17) * 0.1 + Math.sin(x * 0.05 - z * 0.07) * 0.06;
      cores.set([v, v, v * 0.95], i * 3);
    }
    geoChao.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    geoChao.computeVertexNormals();
  }
  const chao = new THREE.Mesh(geoChao, new THREE.MeshStandardMaterial({ map: texturaGrama(rnd), vertexColors: true, roughness: 1 }));
  chao.receiveShadow = true;
  scene.add(chao);

  const matTerra = new THREE.MeshStandardMaterial({
    map: texturaTerra(rnd), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2,
  });
  for (const e of ESTRADAS) {
    const curva = new THREE.CatmullRomCurve3(e.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.ceil(curva.getLength());
    const pts = curva.getSpacedPoints(n);
    const pos = [], uvs = [], idx = [];
    let v = 0;
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl, nz = tx / tl;
      if (i > 0) v += pts[i].distanceTo(pts[i - 1]) / 5;
      for (const s of [-1, 1]) {
        const x = pts[i].x + nx * MEIA_ESTRADA * s, z = pts[i].z + nz * MEIA_ESTRADA * s;
        pos.push(x, altura(x, z) + 0.03, z);
        uvs.push(s < 0 ? 0 : 1, v);
      }
      if (i < n) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const estrada = new THREE.Mesh(geo, matTerra);
    estrada.receiveShadow = true;
    estrada.renderOrder = 1;
    scene.add(estrada);
  }
  const praca = new THREE.Mesh(
    new THREE.CircleGeometry(RAIO_PRACA, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: texturaPraca(rnd), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4 })
  );
  praca.position.y = 0.04;
  praca.receiveShadow = true;
  praca.renderOrder = 2;
  scene.add(praca);

  // ---------- Construções ----------
  const chamines = [];
  for (const c of CASAS) {
    const { grupo, chamine } = criarCasa(c, M);
    const rot = Math.atan2(-c.x, -c.z); // a frente olha para a praça
    grupo.position.set(c.x, 0, c.z);
    grupo.rotation.y = rot;
    scene.add(grupo);
    grupo.updateMatrixWorld(true);
    chamines.push(chamine.applyMatrix4(grupo.matrixWorld));
    addCaixa(c.x, c.z, c.larg / 2 + 0.2, c.prof / 2 + 0.2, rot);
    // barris e caixotes encostados na casa
    const lado = rnd() < 0.5 ? -1 : 1;
    const local = new THREE.Vector3(lado * (c.larg / 2 + 0.6), 0, c.prof / 2 - 0.6).applyMatrix4(grupo.matrixWorld);
    const barril = criarBarril(M);
    barril.position.copy(local);
    scene.add(barril);
    addCirculo(local.x, local.z, 0.45);
    const local2 = new THREE.Vector3(lado * (c.larg / 2 + 0.65), 0, c.prof / 2 - 1.55).applyMatrix4(grupo.matrixWorld);
    const caixote = new THREE.Mesh(caixa(0.75, 0.7, 0.75), M.caixote);
    caixote.position.set(local2.x, 0.35, local2.z);
    caixote.rotation.y = rot + rnd();
    caixote.castShadow = caixote.receiveShadow = true;
    scene.add(caixote);
    addCirculo(local2.x, local2.z, 0.5);
  }

  const poco = criarPoco(M);
  scene.add(poco);
  addCirculo(0, 0, 1.25);

  const barraca = criarBarraca(M);
  barraca.position.set(4.6, 0, -4.4);
  barraca.rotation.y = Math.atan2(-4.6, 4.4);
  scene.add(barraca);
  addCaixa(4.6, -4.4, 1.6, 0.9, barraca.rotation.y);

  const moinho = criarMoinho(M);
  moinho.grupo.position.set(MOINHO.x, 0, MOINHO.z);
  moinho.grupo.rotation.y = Math.atan2(-MOINHO.x, -MOINHO.z);
  scene.add(moinho.grupo);
  addCirculo(MOINHO.x, MOINHO.z, 2.4);

  // horta cercada ao lado de uma casa
  {
    const horta = new THREE.Group();
    horta.position.set(-27, 0, 13);
    horta.rotation.y = 0.5;
    adicionar(horta, caixa(4, 0.16, 3), new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 1 }), 0, 0.08, 0);
    const repolho = new THREE.MeshStandardMaterial({ color: 0x7ac04a, roughness: 0.8, flatShading: true });
    const cenoura = new THREE.MeshStandardMaterial({ color: 0x3e8a2a, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 4; k++) {
        const x = -1.6 + i * 0.64, z = -1.05 + k * 0.7;
        if (k % 2) adicionar(horta, new THREE.ConeGeometry(0.1, 0.35, 5), cenoura, x, 0.32, z);
        else adicionar(horta, new THREE.IcosahedronGeometry(0.22, 1), repolho, x, 0.3, z);
      }
    }
    for (const [x, z, comp, ry] of [[-2.2, 1.7, 4.4, 0], [-2.2, -1.7, 4.4, 0], [-2.2, -1.7, 3.4, -Math.PI / 2], [2.2, -1.7, 3.4, -Math.PI / 2]]) {
      const cerca = criarCerca(comp, M);
      cerca.position.set(x, 0, z);
      cerca.rotation.y = ry;
      horta.add(cerca);
    }
    scene.add(horta);
    addCaixa(-27, 13, 2.4, 1.9, 0.5);
  }

  // fardos de feno
  const matFeno = new THREE.MeshStandardMaterial({ color: 0xdcbc52, roughness: 1 });
  for (const [x, z, r] of [[21, -3.5, 0.3], [22.3, -4.8, 1.2], [21.5, -4.2, 0.7]]) {
    adicionar(scene, new THREE.CylinderGeometry(0.55, 0.55, 1.1, 14), matFeno, x, 0.55, z, 0, r, Math.PI / 2);
    addCirculo(x, z, 0.65);
  }

  // lamparinas em volta da praça (apagadas de dia)
  const matFerroLamp = new THREE.MeshStandardMaterial({ color: 0x24211f, roughness: 0.55, metalness: 0.75 });
  const matVidroLamp = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0x6a4a10, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  for (const a of [0.8, 2.35, 3.95, 5.5]) {
    const x = Math.sin(a) * (RAIO_PRACA + 0.6), z = Math.cos(a) * (RAIO_PRACA + 0.6);
    const { grupo } = criarLamparina(matFerroLamp, matVidroLamp);
    grupo.position.set(x, 0, z);
    grupo.rotation.y = a + Math.PI;
    scene.add(grupo);
    addCirculo(x, z, 0.3);
  }

  // ---------- Árvores: algumas no vilarejo e a floresta em volta ----------
  const arvores = [];
  for (const [x, z] of [[-27, -14], [28, -3], [-9, 27], [11, 27], [27, 24], [-29, -1]]) {
    arvores.push({ x, z, s: 0.9 + rnd() * 0.3, carvalho: true });
    addCirculo(x, z, 0.55);
  }
  for (let k = 0; k < 6000 && arvores.length < 330; k++) {
    const a = rnd() * Math.PI * 2;
    const r = 36 + rnd() * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (distEstrada(x, z) < 4.5 || Math.hypot(x - MOINHO.x, z - MOINHO.z) < 6) continue;
    if (arvores.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue;
    arvores.push({ x, z, s: 0.8 + rnd() * 0.6, carvalho: rnd() < 0.45 });
  }
  const matCasca = new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 1, vertexColors: true });
  const matPinheiro = new THREE.MeshStandardMaterial({ color: 0x2f7a3c, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide });
  const matCarvalho = new THREE.MeshStandardMaterial({ color: 0x4a8a34, roughness: 0.9, vertexColors: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), esc = new THREE.Vector3();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const cor = new THREE.Color();
  const instanciar = (itens, pares, preencher, sombra = true) => {
    if (!itens.length) return;
    const malhas = pares.map(([geo, mat]) => new THREE.InstancedMesh(geo, mat, itens.length));
    itens.forEach((t, i) => preencher(t, i, malhas));
    for (const im of malhas) {
      im.castShadow = sombra;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      scene.add(im);
    }
  };
  instanciar(arvores.filter((t) => !t.carvalho), [[geoTronco(3.2, 0.26, 2), matCasca], [geoCopaPinheiro(1), matPinheiro]], (t, i, [tronco, copa]) => {
    q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
    m4.compose(v3.set(t.x, altura(t.x, t.z), t.z), q, esc.set(t.s, t.s * (0.85 + rnd() * 0.4), t.s));
    tronco.setMatrixAt(i, m4);
    copa.setMatrixAt(i, m4);
    copa.setColorAt(i, cor.setHSL(0.33 + rnd() * 0.06, 0.45 + rnd() * 0.2, 0.55 + rnd() * 0.2));
  });
  instanciar(arvores.filter((t) => t.carvalho), [[geoTroncoCarvalho(3), matCasca], [geoCopaCarvalho(3), matCarvalho]], (t, i, [tronco, copa]) => {
    q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
    m4.compose(v3.set(t.x, altura(t.x, t.z), t.z), q, esc.set(t.s, t.s * (0.9 + rnd() * 0.25), t.s));
    tronco.setMatrixAt(i, m4);
    copa.setMatrixAt(i, m4);
    copa.setColorAt(i, cor.setHSL(0.24 + rnd() * 0.08, 0.5 + rnd() * 0.2, 0.5 + rnd() * 0.18));
  });

  // ---------- Arbustos, pedras, flores e grama ----------
  const sorteio = (qtd, tentativas, rMin, rMax, aceita) => {
    const lista = [];
    for (let k = 0; k < tentativas && lista.length < qtd; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rMin * rMin + rnd() * (rMax * rMax - rMin * rMin));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (aceita(x, z)) lista.push({ x, z, y: altura(x, z), s: 0.6 + rnd() * 0.7 });
    }
    return lista;
  };
  const longeDeTudo = (folgaEstrada, folga) => (x, z) => distEstrada(x, z) > folgaEstrada && Math.hypot(x, z) > RAIO_PRACA + 1 && livre(x, z, folga);

  const arbustos = sorteio(70, 3000, 10, RAIO_ANDAVEL + 6, longeDeTudo(2.8, 0.8));
  for (const b of arbustos) if (Math.hypot(b.x, b.z) < RAIO_ANDAVEL) addCirculo(b.x, b.z, 0.55 * b.s);
  instanciar(arbustos, [[geoArbusto(5), new THREE.MeshStandardMaterial({ color: 0x3f7a30, roughness: 0.9, vertexColors: true })]], (b, i, [im]) => {
    q.setFromAxisAngle(eixoY, rnd() * 6);
    m4.compose(v3.set(b.x, b.y, b.z), q, esc.set(b.s, b.s * (0.8 + rnd() * 0.3), b.s));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, cor.setHSL(0.28 + rnd() * 0.06, 0.45, 0.55 + rnd() * 0.15));
  });

  const pedras = sorteio(30, 2000, 12, 45, longeDeTudo(2.5, 0.6));
  instanciar(pedras, [[geoPedra(3), new THREE.MeshStandardMaterial({ color: 0x8e8f8a, roughness: 0.95, flatShading: true, vertexColors: true })]], (p, i, [im]) => {
    q.setFromAxisAngle(eixoY, rnd() * 6);
    const s = p.s * 0.45;
    m4.compose(v3.set(p.x, p.y, p.z), q, esc.set(s, s, s));
    im.setMatrixAt(i, m4);
  });

  // flores em pequenos canteiros
  const flores = [];
  for (const centro of sorteio(55, 2000, 9, RAIO_ANDAVEL + 4, longeDeTudo(2.4, 0.4))) {
    const c = Math.floor(rnd() * M.flores.length);
    for (let i = 0; i < 9; i++) {
      const x = centro.x + (rnd() - 0.5) * 1.6, z = centro.z + (rnd() - 0.5) * 1.6;
      flores.push({ x, z, y: altura(x, z) + 0.18 + rnd() * 0.1, c });
    }
  }
  const coresFlores = M.flores.map((m) => m.color);
  instanciar(flores, [[new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 })], [new THREE.CylinderGeometry(0.012, 0.012, 0.25, 3).translate(0, -0.12, 0), new THREE.MeshStandardMaterial({ color: 0x3e7a2a })]], (f, i, [petala, caule]) => {
    m4.makeTranslation(f.x, f.y, f.z);
    petala.setMatrixAt(i, m4);
    caule.setMatrixAt(i, m4);
    petala.setColorAt(i, coresFlores[f.c]);
  }, false);

  const matGrama = materialGrama();
  matGrama.color.setHex(0x5f9a3a);
  const tufos = sorteio(3200, 20000, 2, 60, (x, z) => distEstrada(x, z) > MEIA_ESTRADA + 0.2 && Math.hypot(x, z) > RAIO_PRACA && !dentroDeCaixa(x, z, 0.2));
  instanciar(tufos, [[geoTufoGrama(), matGrama]], (t, i, [im]) => {
    q.setFromAxisAngle(eixoY, rnd() * 6);
    m4.compose(v3.set(t.x, t.y, t.z), q, esc.set(t.s, t.s * (0.8 + rnd() * 0.5), t.s));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, cor.setHSL(0.25 + rnd() * 0.06, 0.45, 0.6 + rnd() * 0.2));
  }, false);

  // ---------- Fumaça das chaminés ----------
  const texFumaca = texturaBrilho('rgba(235,235,235,1)');
  const fumacas = [];
  for (const c of chamines) {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFumaca, transparent: true, depthWrite: false, opacity: 0 }));
      scene.add(s);
      fumacas.push({ s, base: c, fase: i / 6, deriva: rnd() * 6 });
    }
  }

  // ---------- Atualização por quadro ----------
  function atualizar(dt, t, foco, camera) {
    ceu.position.copy(camera.position);
    matGrama.userData.tempo.value = t;
    moinho.pas.rotation.z -= dt * 0.6;
    for (const n of nuvens) {
      n.position.x += n.userData.vel * dt;
      if (n.position.x > 220) n.position.x = -220;
    }
    for (const f of fumacas) {
      const p = (t * 0.18 + f.fase) % 1;
      f.s.position.set(
        f.base.x + Math.sin(t * 0.6 + f.deriva) * 0.3 + p * 1.4,
        f.base.y + p * 4.5,
        f.base.z + Math.cos(t * 0.5 + f.deriva) * 0.3 + p * 0.6
      );
      f.s.scale.setScalar(0.6 + p * 2.2);
      f.s.material.opacity = Math.sin(p * Math.PI) * 0.55;
    }
  }

  /** Empurra um círculo para fora das construções e o mantém dentro do vilarejo. */
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
      // no espaço da caixa: ponto mais próximo dentro dela e empurrão para fora
      const dx = pos.x - c.x, dz = pos.z - c.z;
      let lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const px = Math.max(-c.mx, Math.min(c.mx, lx)), pz = Math.max(-c.mz, Math.min(c.mz, lz));
      let ex = lx - px, ez = lz - pz;
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
    const r = Math.hypot(pos.x, pos.z);
    const limite = RAIO_ANDAVEL - raio;
    if (r > limite) {
      pos.x *= limite / r;
      pos.z *= limite / r;
    }
  }

  return {
    scene,
    /** Onde o herói aparece: na estrada do sul, olhando para a praça. */
    inicio: { x: 0, z: 24, dir: Math.PI },
    atualizar,
    resolverColisao,
    addCirculo,
    /** Um ponto livre aleatório dentro do vilarejo (para os gnomos passearem). */
    pontoLivre(folga = 0.6, longeDe = null, distMin = 0) {
      for (let k = 0; k < 60; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (RAIO_ANDAVEL - 2);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (longeDe && Math.hypot(x - longeDe.x, z - longeDe.z) < distMin) continue;
        if (livre(x, z, folga)) return { x, z };
      }
      return { x: 0, z: 12 };
    },
    /** Altura do chão (o vilarejo é plano onde se anda). */
    altura,
  };
}
