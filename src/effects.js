// Efeitos visuais: partículas, rastro de golpe e números de dano.
import * as THREE from 'three';
import { texturaBrilho } from './world.js';

export class Particulas {
  constructor(scene, max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.cor = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vida = new Float32Array(max);
    this.vidaMax = new Float32Array(max);
    this.gravidade = new Float32Array(max);
    this.prox = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.cor, 3));
    this.geo = geo;
    this.pontos = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.3,
      map: texturaBrilho(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }));
    this.pontos.frustumCulled = false;
    scene.add(this.pontos);
  }

  emitir(origem, cor, qtd, { vel = 3, vida = 0.6, gravidade = 0, subir = 0 } = {}) {
    const c = new THREE.Color(cor);
    for (let n = 0; n < qtd; n++) {
      const i = this.prox;
      this.prox = (this.prox + 1) % this.max;
      const k = i * 3;
      this.pos[k] = origem.x;
      this.pos[k + 1] = origem.y;
      this.pos[k + 2] = origem.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const v = vel * (0.3 + Math.random() * 0.7);
      this.vel[k] = Math.sin(ph) * Math.cos(th) * v;
      this.vel[k + 1] = Math.cos(ph) * v + subir;
      this.vel[k + 2] = Math.sin(ph) * Math.sin(th) * v;
      this.base[k] = c.r;
      this.base[k + 1] = c.g;
      this.base[k + 2] = c.b;
      this.vida[i] = this.vidaMax[i] = vida * (0.6 + Math.random() * 0.4);
      this.gravidade[i] = gravidade;
    }
  }

  atualizar(dt) {
    for (let i = 0; i < this.max; i++) {
      const k = i * 3;
      if (this.vida[i] <= 0) {
        this.cor[k] = this.cor[k + 1] = this.cor[k + 2] = 0;
        continue;
      }
      this.vida[i] -= dt;
      this.vel[k + 1] -= this.gravidade[i] * dt;
      const atrito = Math.exp(-2.5 * dt);
      this.vel[k] *= atrito;
      this.vel[k + 2] *= atrito;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const f = Math.max(0, this.vida[i] / this.vidaMax[i]);
      this.cor[k] = this.base[k] * f;
      this.cor[k + 1] = this.base[k + 1] * f;
      this.cor[k + 2] = this.base[k + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  limpar() {
    this.vida.fill(0);
  }
}

/** Arco branco que aparece quando o assassino golpeia. */
export class RastroGolpe {
  constructor(scene, arco) {
    const geo = new THREE.RingGeometry(0.9, 2.3, 24, 1, -arco / 2, arco);
    geo.rotateX(-Math.PI / 2);
    this.malha = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xdfe8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    this.malha.visible = false;
    this.t = 1;
    scene.add(this.malha);
  }

  disparar(pos, direcao) {
    this.malha.position.set(pos.x, 1.1, pos.z);
    this.malha.rotation.set(0, direcao - Math.PI / 2, 0);
    this.t = 0;
    this.malha.visible = true;
  }

  atualizar(dt) {
    if (!this.malha.visible) return;
    this.t += dt;
    const p = this.t / 0.22;
    this.malha.material.opacity = Math.max(0, 0.7 * (1 - p));
    this.malha.scale.setScalar(0.85 + p * 0.2);
    if (p >= 1) this.malha.visible = false;
  }

  remover(scene) {
    scene.remove(this.malha);
    this.malha.geometry.dispose();
    this.malha.material.dispose();
  }
}

/** Números de dano flutuantes (elementos HTML projetados na tela). */
export class NumerosDano {
  constructor(camada, camera) {
    this.camada = camada;
    this.camera = camera;
    this.lista = [];
    this.v = new THREE.Vector3();
  }

  mostrar(pos, texto, classe) {
    const el = document.createElement('div');
    el.className = `dano ${classe}`;
    el.textContent = texto;
    this.camada.appendChild(el);
    this.lista.push({
      el,
      pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.4, pos.y, pos.z),
      t: 0,
    });
  }

  atualizar(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const d = this.lista[i];
      d.t += dt;
      if (d.t > 0.9) {
        d.el.remove();
        this.lista.splice(i, 1);
        continue;
      }
      this.v.copy(d.pos);
      this.v.y += d.t * 1.2;
      this.v.project(this.camera);
      if (this.v.z > 1) {
        d.el.style.opacity = 0;
        continue;
      }
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      d.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - d.t) * 2})`;
      d.el.style.opacity = String(Math.min(1, (0.9 - d.t) * 4));
    }
  }

  limpar() {
    for (const d of this.lista) d.el.remove();
    this.lista.length = 0;
  }
}
