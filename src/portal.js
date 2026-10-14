// Portal verde que se abre onde o Chefão Duende morre. Atravessá-lo leva à criação
// do personagem definitivo.
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
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float espiral = sin(a * 4.0 + r * 14.0 - uTempo * 5.0) * 0.5 + 0.5;
  float espiral2 = sin(a * 7.0 - r * 9.0 - uTempo * 3.2) * 0.5 + 0.5;
  float brilho = mix(espiral, espiral2, 0.35);
  vec3 escuro = vec3(0.02, 0.18, 0.06);
  vec3 claro = vec3(0.45, 1.0, 0.4);
  vec3 cor = mix(escuro, claro, brilho * (1.0 - r * 0.55));
  cor += vec3(0.75, 1.0, 0.7) * pow(1.0 - r, 3.0) * 1.2;
  float alfa = smoothstep(1.0, 0.86, r) * uAbertura;
  gl_FragColor = vec4(cor * alfa, alfa);
}`;

export function criarPortal(scene, x, z, direcao) {
  const grupo = new THREE.Group();
  grupo.position.set(x, 0, z);
  grupo.rotation.y = direcao;
  scene.add(grupo);

  const centro = new THREE.Group();
  centro.position.y = ALTURA;
  grupo.add(centro);

  const uniforms = { uTempo: { value: 0 }, uAbertura: { value: 0 } };
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
  const matAnel = new THREE.MeshBasicMaterial({ color: 0x7dff6a });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(RAIO, 0.07, 10, 64), matAnel);
  anel.scale.y = 1.15;
  centro.add(anel);
  const runas = new THREE.Group();
  const geoRuna = new THREE.OctahedronGeometry(0.09, 0);
  const matRuna = new THREE.MeshBasicMaterial({ color: 0xd8ffb0 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const runa = new THREE.Mesh(geoRuna, matRuna);
    runa.position.set(Math.cos(a) * (RAIO + 0.2), Math.sin(a) * (RAIO + 0.2) * 1.15, 0);
    runas.add(runa);
  }
  centro.add(runas);

  // brilho em volta e no chão
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaBrilho('rgba(110,255,110,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75,
  }));
  halo.scale.setScalar(5.5);
  centro.add(halo);
  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texturaBrilho('rgba(90,255,100,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  chao.position.y = 0.04;
  grupo.add(chao);

  const luz = new THREE.PointLight(0x5dff6a, 0, 16, 1.4);
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
        particulas.emitir(pos, Math.random() < 0.5 ? 0x7dff6a : 0xd8ffb0, 1, { vel: 0.8, vida: 0.9, subir: 0.8 });
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
