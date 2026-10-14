// Orbes de experiência: moléculas vermelhas brilhantes que os duendes deixam cair.
// Perto do herói elas voam até ele e são coletadas.
import * as THREE from 'three';
import { XP } from './config.js';
import { texturaBrilho } from './world.js';

const geoNucleo = new THREE.SphereGeometry(0.11, 14, 10);
const geoAtomo = new THREE.SphereGeometry(0.055, 10, 8);
const matNucleo = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
const matAtomo = new THREE.MeshBasicMaterial({ color: 0xff9a8a });
const matLigacao = new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.8 });
const geoLigacao = new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, 0.5, 0);
let matBrilho = null;

/** Molécula: núcleo vermelho com três átomos girando em volta, ligados por hastes. */
function criarMolecula() {
  matBrilho ??= new THREE.SpriteMaterial({ map: texturaBrilho('rgba(255,50,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoNucleo, matNucleo));
  const giro = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * 0.22, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.22);
    const atomo = new THREE.Mesh(geoAtomo, matAtomo);
    atomo.position.copy(p);
    const lig = new THREE.Mesh(geoLigacao, matLigacao);
    lig.scale.y = p.length();
    lig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    giro.add(atomo, lig);
  }
  g.add(giro);
  const brilho = new THREE.Sprite(matBrilho);
  brilho.scale.setScalar(1.1);
  g.add(brilho);
  g.userData.giro = giro;
  g.userData.brilho = brilho;
  return g;
}

/** ctx: { scene, particulas, coletar(valor, pos) } */
export function criarOrbes(ctx) {
  const orbes = [];
  const tmp = new THREE.Vector3();

  function soltar(x, z, valor) {
    const malha = criarMolecula();
    malha.position.set(x, 0.6, z);
    ctx.scene.add(malha);
    // pula um pouco para fora ao cair
    const a = Math.random() * Math.PI * 2;
    orbes.push({ malha, valor, vel: new THREE.Vector3(Math.cos(a) * 1.5, 3.5, Math.sin(a) * 1.5), t: Math.random() * 6, voando: false });
  }

  function atualizar(dt, heroi) {
    for (let i = orbes.length - 1; i >= 0; i--) {
      const o = orbes[i];
      const m = o.malha;
      o.t += dt;
      if (heroi && heroi.vivo) {
        tmp.set(heroi.pos.x, 1.0, heroi.pos.z);
        const d = tmp.distanceTo(m.position);
        if (d < XP.raioColeta) {
          ctx.coletar(o.valor, m.position);
          ctx.particulas.emitir(m.position, 0xff5a4a, 20, { vel: 2.5, vida: 0.5 });
          ctx.scene.remove(m);
          orbes.splice(i, 1);
          continue;
        }
        if (d < XP.raioIma) o.voando = true;
        if (o.voando) {
          // atraído pelo herói, cada vez mais rápido
          tmp.sub(m.position).normalize().multiplyScalar(4 + (XP.raioIma - Math.min(d, XP.raioIma)) * 4);
          o.vel.lerp(tmp, Math.min(1, dt * 8));
        }
      }
      if (!o.voando) {
        // cai, quica e fica flutuando
        o.vel.y -= 12 * dt;
        o.vel.x *= Math.exp(-3 * dt);
        o.vel.z *= Math.exp(-3 * dt);
        const alvoY = 0.55 + Math.sin(o.t * 2.5) * 0.1;
        if (m.position.y < alvoY && o.vel.y < 0) {
          m.position.y = alvoY;
          o.vel.y = Math.abs(o.vel.y) > 2 ? -o.vel.y * 0.3 : 0;
        }
      }
      m.position.addScaledVector(o.vel, dt);
      m.userData.giro.rotation.set(o.t * 1.3, o.t * 2.2, 0);
      m.userData.brilho.scale.setScalar(1.0 + Math.sin(o.t * 6) * 0.15);
    }
  }

  function limpar() {
    for (const o of orbes) ctx.scene.remove(o.malha);
    orbes.length = 0;
  }

  return { soltar, atualizar, limpar };
}
