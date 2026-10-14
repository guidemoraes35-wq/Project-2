// Portais: o verde (depois do Chefão Duende e no fundo da vila) e o azul-claro
// (que aparece quando a Princesa Duendete é derrotada).
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

const ALTURA = 1.55; // centro do portal acima do chão
const RAIO = 1.25;

const vertice = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// redemoinho verde: espirais girando em direção ao centro, mais claras no meio
const fragmento = `
uniform float uTempo;
uniform float uAbertura;
uniform vec3 uEscuro;
uniform vec3 uClaro;
uniform vec3 uCentro;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float espiral = sin(a * 4.0 + r * 14.0 - uTempo * 5.0) * 0.5 + 0.5;
  float espiral2 = sin(a * 7.0 - r * 9.0 - uTempo * 3.2) * 0.5 + 0.5;
  float brilho = mix(espiral, espiral2, 0.35);
  vec3 cor = mix(uEscuro, uClaro, brilho * (1.0 - r * 0.55));
  cor += uCentro * pow(1.0 - r, 3.0) * 1.2;
  float alfa = smoothstep(1.0, 0.86, r) * uAbertura;
  gl_FragColor = vec4(cor * alfa, alfa);
}`;

const CORES = {
  verde: { escuro: [0.02, 0.18, 0.06], claro: [0.45, 1.0, 0.4], centro: [0.75, 1.0, 0.7], anel: 0x7dff6a, runa: 0xd8ffb0, brilho: 'rgba(110,255,110,1)', luz: 0x5dff6a, faisca: [0x7dff6a, 0xd8ffb0] },
  azul: { escuro: [0.02, 0.12, 0.22], claro: [0.45, 0.85, 1.0], centro: [0.8, 0.95, 1.0], anel: 0x8ad8ff, runa: 0xe0f6ff, brilho: 'rgba(120,210,255,1)', luz: 0x7ac8ff, faisca: [0x8ad8ff, 0xe0f6ff] },
};

export function criarPortal(scene, x, z, direcao, { cor = 'verde' } = {}) {
  const P = CORES[cor];
  const grupo = new THREE.Group();
  grupo.position.set(x, 0, z);
  grupo.rotation.y = direcao;
  scene.add(grupo);

  const centro = new THREE.Group();
  centro.position.y = ALTURA;
  grupo.add(centro);

  const uniforms = {
    uTempo: { value: 0 }, uAbertura: { value: 0 },
    uEscuro: { value: new THREE.Vector3(...P.escuro) }, uClaro: { value: new THREE.Vector3(...P.claro) }, uCentro: { value: new THREE.Vector3(...P.centro) },
  };
  const disco = new THREE.Mesh(
    new THREE.CircleGeometry(RAIO, 48),
    new THREE.ShaderMaterial({
      uniforms, vertexShader: vertice, fragmentShader: fragmento,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
  );
  disco.scale.y = 1.15;
  centro.add(disco);

  // anel de energia ao redor, com runas girando
  const matAnel = new THREE.MeshBasicMaterial({ color: P.anel });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(RAIO, 0.07, 10, 64), matAnel);
  anel.scale.y = 1.15;
  centro.add(anel);
  const runas = new THREE.Group();
  const geoRuna = new THREE.OctahedronGeometry(0.09, 0);
  const matRuna = new THREE.MeshBasicMaterial({ color: P.runa });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const runa = new THREE.Mesh(geoRuna, matRuna);
    runa.position.set(Math.cos(a) * (RAIO + 0.2), Math.sin(a) * (RAIO + 0.2) * 1.15, 0);
    runas.add(runa);
  }
  centro.add(runas);

  // brilho em volta e no chão
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho(P.brilho), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75,
  }));
  halo.scale.setScalar(5.5);
  centro.add(halo);
  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texturaBrilho(P.brilho), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  chao.position.y = 0.04;
  grupo.add(chao);

  const luz = new THREE.PointLight(P.luz, 0, 16, 1.4);
  luz.position.y = ALTURA;
  grupo.add(luz);

  let tempo = 0;
  const pos = new THREE.Vector3();
  return {
    grupo,
    x,
    z,
    /** 0 a 1: o portal cresce ao abrir. */
    abertura: 0,
    atualizar(dt, particulas) {
      tempo += dt;
      this.abertura = Math.min(1, this.abertura + dt / 1.2);
      const a = 1 - (1 - this.abertura) ** 3;
      centro.scale.setScalar(Math.max(0.001, a));
      uniforms.uTempo.value = tempo;
      uniforms.uAbertura.value = a;
      runas.rotation.z = tempo * 0.8;
      for (const r of runas.children) r.rotation.set(tempo * 2, tempo * 3, 0);
      const pulso = Math.sin(tempo * 4) * 0.5 + 0.5;
      halo.material.opacity = (0.55 + pulso * 0.25) * a;
      chao.material.opacity = (0.6 + pulso * 0.3) * a;
      luz.intensity = a * (26 + pulso * 10);
      // faíscas verdes saindo do anel
      if (particulas && Math.random() < 0.7) {
        const ang = Math.random() * Math.PI * 2;
        pos.set(Math.cos(ang) * RAIO * a, Math.sin(ang) * RAIO * 1.15 * a, 0);
        centro.localToWorld(pos);
        particulas.emitir(pos, P.faisca[Math.random() < 0.5 ? 0 : 1], 1, { vel: 0.8, vida: 0.9, subir: 0.8 });
      }
    },
    remover() {
      scene.remove(grupo);
      grupo.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}
