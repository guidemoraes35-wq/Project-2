// Cenário da criação do personagem: um pedestal de pedra num lugar mágico,
// iluminado pela luz verde do portal que trouxe o jogador até aqui.
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

export function criarEstudio() {
  const scene = new THREE.Scene();
  const fundo = 0x07140f;
  scene.background = new THREE.Color(fundo);
  scene.fog = new THREE.Fog(fundo, 9, 26);

  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a2a18, 0.6));
  const principal = new THREE.DirectionalLight(0xfff0d8, 1.5);
  principal.position.set(3, 6, 5);
  principal.castShadow = true;
  principal.shadow.mapSize.set(1024, 1024);
  const sc = principal.shadow.camera;
  sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3;
  sc.near = 1; sc.far = 20;
  principal.shadow.bias = -0.0008;
  scene.add(principal);
  // contraluz verde, como se o portal ainda brilhasse atrás do personagem
  const contraluz = new THREE.PointLight(0x5dff6a, 22, 12, 1.4);
  contraluz.position.set(-1.5, 2.6, -2.5);
  scene.add(contraluz);

  // chão escuro com um círculo de luz
  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x15241a, roughness: 1 })
  );
  chao.receiveShadow = true;
  scene.add(chao);
  const luzChao = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texturaBrilho('rgba(120,255,140,1)'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  luzChao.position.y = 0.01;
  scene.add(luzChao);

  // pedestal de pedra com um anel de runas
  const pedra = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.9, flatShading: true });
  const base = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [1.25, 0], [1.25, 0.12], [1.1, 0.18], [1.05, 0.32], [1.15, 0.36], [1.15, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 12),
    pedra
  );
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);
  const runas = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.025, 6, 48).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7dff6a })
  );
  runas.position.y = 0.43;
  scene.add(runas);

  // pilares quebrados ao fundo
  const geoPilar = new THREE.CylinderGeometry(0.32, 0.36, 1, 8);
  for (const [x, z, h] of [[-3.4, -3.2, 3.2], [3.6, -3.6, 2.2], [-5.5, -1, 1.4], [5.8, -0.6, 2.8], [0.6, -6, 3.6]]) {
    const p = new THREE.Mesh(geoPilar, pedra);
    p.scale.y = h;
    p.position.set(x, h / 2, z);
    p.rotation.y = x;
    p.castShadow = true;
    scene.add(p);
  }

  // luzinhas verdes flutuando
  const n = 140;
  const base3 = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.6 + Math.random() * 7;
    base3[i * 3] = Math.cos(a) * r;
    base3[i * 3 + 1] = Math.random() * 5;
    base3[i * 3 + 2] = Math.sin(a) * r - 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const luzes = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x9dff8a, size: 0.14, map: texturaBrilho('rgba(160,255,150,1)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  luzes.frustumCulled = false;
  scene.add(luzes);

  return {
    scene,
    /** Altura do topo do pedestal, onde o personagem fica. */
    alturaPedestal: 0.42,
    atualizar(dt, t) {
      runas.material.color.setHSL(0.31, 1, 0.55 + Math.sin(t * 2) * 0.1);
      contraluz.intensity = 20 + Math.sin(t * 1.7) * 4;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        pos[k] = base3[k] + Math.sin(t * 0.4 + i) * 0.3;
        pos[k + 1] = (base3[k + 1] + t * 0.25 * (0.5 + (i % 5) * 0.2)) % 5;
        pos[k + 2] = base3[k + 2] + Math.cos(t * 0.3 + i * 1.3) * 0.3;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
