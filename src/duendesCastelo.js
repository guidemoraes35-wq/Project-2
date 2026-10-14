// Os duendes do castelo: fracos (clava), arqueiros (flechas) e mágicos (veneno).
// Ficam parados pelo pátio até o herói chegar perto; aí atacam até alguém cair.
import * as THREE from 'three';
import {
  DUENDE_FRACO, ARQUEIRO_CASTELO, DUENDE_MAGICO, CASTELO, REGRAS, calcularDano, pontosDeAtaque,
} from './config.js';
import { criarDuende, animarRig, descartarRig } from './models.js';
import { texturaBrilho } from './world.js';

const aleatorio = (a, b) => a + Math.random() * (b - a);
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function difAngulo(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const girarPara = (a, b, k) => a + difAngulo(a, b) * Math.min(1, k);

const geoBarra = new THREE.PlaneGeometry(0.7, 0.08);
const geoBarraFill = new THREE.PlaneGeometry(0.66, 0.05).translate(0.33, 0, 0);
const matBarraFundo = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
const matBarraVida = new THREE.MeshBasicMaterial({ color: 0xd63a2a, depthWrite: false });

// flecha
const geoHaste = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 5).rotateX(Math.PI / 2);
const geoPonta = new THREE.ConeGeometry(0.04, 0.12, 5).rotateX(Math.PI / 2).translate(0, 0, 0.42);
const matHaste = new THREE.MeshBasicMaterial({ color: 0x8a6038 });
const matPonta = new THREE.MeshBasicMaterial({ color: 0xd8e0ea });
// bola de veneno
const geoVeneno = new THREE.SphereGeometry(0.15, 10, 8);
const matVeneno = new THREE.MeshBasicMaterial({ color: 0xa8ff6a });
const matBrilhoVeneno = new THREE.SpriteMaterial({ map: texturaBrilho('rgba(120,255,60,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

/**
 * ctx: { scene, mapa, particulas, numeros, camera, tremor(v),
 *        heroi(), heroiVisivel(), danoHeroi(dano, origem), envenenar(dano, duracao) }
 */
export function criarDuendesCastelo(ctx) {
  const { scene, mapa, particulas, numeros, camera } = ctx;
  const duendes = [];
  const tiros = [];
  const tmp = new THREE.Vector3();
  let derrotados = 0;
  let total = 0;

  function criar(cfg, variante) {
    const p = mapa.pontoLivre(0.7, cfg === DUENDE_FRACO ? -8 : -14);
    const rig = criarDuende(variante);
    rig.root.scale.setScalar(cfg.escala);
    rig.root.position.set(p.x, 0, p.z);
    scene.add(rig.root);
    const barra = new THREE.Group();
    barra.add(new THREE.Mesh(geoBarra, matBarraFundo));
    const fill = new THREE.Mesh(geoBarraFill, matBarraVida);
    fill.position.set(-0.33, 0, 0.001);
    barra.add(fill);
    barra.visible = false;
    scene.add(barra);
    duendes.push({
      cfg, rig, pos: rig.root.position, dir: Math.random() * Math.PI * 2,
      hp: cfg.vida, hpMax: cfg.vida, alerta: false,
      recarga: aleatorio(0.5, 1.5), ataqueT: -1, acertou: false, andar: 0, flash: 0,
      empurrao: new THREE.Vector3(), desvio: aleatorio(-1, 1), morto: false, mortoT: 0,
      barra, fill,
    });
  }

  function remover(d) {
    scene.remove(d.rig.root, d.barra);
    d.rig.pele.dispose();
    descartarRig(d.rig);
  }

  function reiniciar() {
    for (const d of duendes) remover(d);
    duendes.length = 0;
    for (const t of tiros) scene.remove(t.malha);
    tiros.length = 0;
    for (let i = 0; i < DUENDE_FRACO.quantidade; i++) criar(DUENDE_FRACO, 'normal');
    for (let i = 0; i < ARQUEIRO_CASTELO.quantidade; i++) criar(ARQUEIRO_CASTELO, 'arqueiro');
    for (let i = 0; i < DUENDE_MAGICO.quantidade; i++) criar(DUENDE_MAGICO, 'magico');
    total = duendes.length;
    derrotados = 0;
  }

  /** Quando o herói cai, os duendes voltam aos seus lugares e esquecem dele. */
  function acalmar() {
    for (const d of duendes) {
      d.alerta = false;
      d.ataqueT = -1;
    }
  }

  function ferir(d, dano, origem) {
    d.hp -= dano;
    d.flash = 0.15;
    tmp.subVectors(d.pos, origem).setY(0).normalize().multiplyScalar(6);
    d.empurrao.copy(tmp);
    d.ataqueT = -1;
    d.recarga = Math.max(d.recarga, 0.4);
    tmp.copy(d.pos).setY(d.cfg.alturaAcerto + 0.6);
    numeros.mostrar(tmp, dano, 'inimigo');
    particulas.emitir(tmp, 0xff4433, 12, { vel: 3.5, vida: 0.5, gravidade: 9 });
    d.barra.visible = true;
    d.alerta = true;
    if (d.hp <= 0) {
      d.morto = true;
      d.barra.visible = false;
      derrotados++;
      particulas.emitir(tmp, 0x8cff6a, 25, { vel: 3, vida: 0.9, subir: 1 });
    }
  }

  function atacar(origem, dir, alcance, arco, ataque) {
    let acertos = 0;
    for (const d of duendes) {
      if (d.morto) continue;
      const dist = distXZ(d.pos, origem);
      if (dist > alcance + d.cfg.raio) continue;
      const ang = Math.atan2(d.pos.x - origem.x, d.pos.z - origem.z);
      if (dist > 0.6 && Math.abs(difAngulo(dir, ang)) > arco / 2) continue;
      ferir(d, calcularDano(ataque, d.cfg.defesa), origem);
      acertos++;
    }
    return acertos;
  }

  // ---------- Tiros: flechas e veneno ----------
  function atirar(d, heroi) {
    const cfg = d.cfg;
    const veneno = cfg === DUENDE_MAGICO;
    const malha = new THREE.Group();
    if (veneno) {
      malha.add(new THREE.Mesh(geoVeneno, matVeneno));
      const b = new THREE.Sprite(matBrilhoVeneno);
      b.scale.setScalar(0.9);
      malha.add(b);
      if (d.rig.orbe) d.rig.orbe.getWorldPosition(malha.position);
      else malha.position.set(d.pos.x, 1, d.pos.z);
    } else {
      malha.add(new THREE.Mesh(geoHaste, matHaste), new THREE.Mesh(geoPonta, matPonta));
      malha.position.set(d.pos.x + Math.sin(d.dir) * 0.5, 0.85, d.pos.z + Math.cos(d.dir) * 0.5);
    }
    // mira onde o herói está agora: andando, dá para desviar
    tmp.set(heroi.pos.x, 1.0, heroi.pos.z).sub(malha.position).normalize();
    const vel = tmp.clone().multiplyScalar(veneno ? cfg.velocidadeVeneno : cfg.velocidadeFlecha);
    malha.lookAt(tmp.add(malha.position));
    scene.add(malha);
    tiros.push({ malha, vel, cfg, veneno, vida: (cfg.alcance + 6) / vel.length() });
  }

  function atualizarTiros(dt) {
    const heroi = ctx.heroi();
    for (let i = tiros.length - 1; i >= 0; i--) {
      const t = tiros[i];
      t.vida -= dt;
      t.malha.position.addScaledVector(t.vel, dt);
      const pos = t.malha.position;
      if (t.veneno) particulas.emitir(pos, 0x6aff3a, 2, { vel: 0.5, vida: 0.4 });
      let fim = t.vida <= 0;
      if (!fim && heroi && ctx.heroiVisivel()) {
        tmp.set(heroi.pos.x, 1.0, heroi.pos.z);
        if (tmp.distanceTo(pos) < 0.6) {
          if (t.veneno) {
            // o veneno não machuca no contato: tira vida aos poucos depois
            ctx.envenenar(t.cfg.veneno.dano, t.cfg.veneno.duracao);
            particulas.emitir(pos, 0x8aff4a, 30, { vel: 3, vida: 0.7 });
          } else {
            ctx.danoHeroi(calcularDano(pontosDeAtaque(t.cfg, t.cfg.atributoAtaque), heroi.atributos.defesa), pos);
          }
          fim = true;
        }
      }
      if (!fim && mapa.colide(pos.x, pos.z, 0.05)) {
        particulas.emitir(pos, t.veneno ? 0x6aff3a : 0xa07040, 8, { vel: 2, vida: 0.4, gravidade: 6 });
        fim = true;
      }
      if (fim) {
        scene.remove(t.malha);
        tiros.splice(i, 1);
      }
    }
  }

  // ---------- Comportamento ----------
  function atualizarDuende(d, dt, t, heroi) {
    const rig = d.rig;
    if (d.morto) {
      d.mortoT += dt;
      rig.root.rotation.x = Math.max(-Math.PI / 2, rig.root.rotation.x - dt * 6);
      if (d.mortoT > 1.2) rig.root.position.y -= dt * 0.6;
      return d.mortoT > 2.5;
    }
    const cfg = d.cfg;
    const visivel = ctx.heroiVisivel();
    const dist = heroi ? distXZ(d.pos, heroi.pos) : Infinity;
    if (visivel && dist < CASTELO.alerta) d.alerta = true;
    const vel = cfg.velocidade * REGRAS.escalaVelocidade * (0.9 + (d.desvio + 1) * 0.08);
    const alvoAng = heroi ? Math.atan2(heroi.pos.x - d.pos.x, heroi.pos.z - d.pos.z) : d.dir;
    let movendo = 0;
    d.recarga -= dt;

    if (d.ataqueT >= 0) {
      d.ataqueT += dt;
      if (!d.acertou && d.ataqueT >= cfg.preparo) {
        d.acertou = true;
        if (visivel) {
          if (cfg.distancia) atirar(d, heroi);
          else if (dist < cfg.alcance + 0.35) ctx.danoHeroi(calcularDano(pontosDeAtaque(cfg, cfg.atributoAtaque), heroi.atributos.defesa), d.pos);
        }
      }
      if (d.ataqueT >= cfg.duracaoAtaque) d.ataqueT = -1;
      if (visivel) d.dir = girarPara(d.dir, alvoAng, dt * 8);
    } else if (d.alerta && visivel) {
      d.dir = girarPara(d.dir, alvoAng, dt * 10);
      if (cfg.distancia) {
        if (dist < cfg.alcance && d.recarga <= 0) {
          d.ataqueT = 0;
          d.acertou = false;
          d.recarga = cfg.recarga + aleatorio(0, 0.8);
        } else {
          // mantém distância: aproxima, recua ou anda de lado
          let ang = alvoAng, v = vel;
          if (dist < cfg.distanciaIdeal - 3) ang = alvoAng + Math.PI;
          else if (dist < cfg.distanciaIdeal + 2) {
            ang = alvoAng + (d.desvio >= 0 ? 1 : -1) * Math.PI / 2;
            v *= 0.45;
          }
          d.pos.x += Math.sin(ang) * v * dt;
          d.pos.z += Math.cos(ang) * v * dt;
          movendo = v / vel;
        }
      } else if (dist < cfg.alcance && d.recarga <= 0) {
        d.ataqueT = 0;
        d.acertou = false;
        d.recarga = cfg.recarga + aleatorio(0, 0.5);
      } else if (dist > cfg.alcance * 0.8) {
        const ang = alvoAng + d.desvio * 0.5 * Math.min(1, dist / 10);
        d.pos.x += Math.sin(ang) * vel * dt;
        d.pos.z += Math.cos(ang) * vel * dt;
        movendo = 1;
      }
    } else {
      // de guarda: olha em volta
      d.dir += Math.sin(t * 0.5 + d.desvio * 5) * dt * 0.4;
    }

    d.pos.addScaledVector(d.empurrao, dt);
    d.empurrao.multiplyScalar(Math.exp(-9 * dt));
    for (const o of duendes) {
      if (o === d || o.morto) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const min = cfg.raio + o.cfg.raio + 0.1;
      if (d2 < min * min && d2 > 1e-6) {
        const k = ((min - Math.sqrt(d2)) * 0.5) / Math.sqrt(d2);
        d.pos.x += dx * k;
        d.pos.z += dz * k;
      }
    }
    if (heroi) {
      const dd = distXZ(d.pos, heroi.pos);
      const min = cfg.raio + heroi.raio;
      if (dd < min && dd > 1e-4) {
        d.pos.x += ((d.pos.x - heroi.pos.x) * (min - dd)) / dd;
        d.pos.z += ((d.pos.z - heroi.pos.z) * (min - dd)) / dd;
      }
    }
    mapa.resolverColisao(d.pos, cfg.raio);

    d.andar += (movendo - d.andar) * Math.min(1, dt * 10);
    rig.root.rotation.y = d.dir;
    animarRig(rig, dt, t, d.andar, d.ataqueT >= 0 ? d.ataqueT / cfg.duracaoAtaque : -1);
    if (rig.orbe) rig.orbe.material.emissiveIntensity = 1.6 + Math.sin(t * 6 + d.desvio * 4) * 0.6;
    d.flash = Math.max(0, d.flash - dt);
    rig.pele.emissive.setRGB(d.flash > 0 ? 1 : 0, d.flash > 0 ? 0.25 : 0, d.flash > 0 ? 0.2 : 0);
    d.barra.position.set(d.pos.x, 1.35, d.pos.z);
    d.barra.quaternion.copy(camera.quaternion);
    d.fill.scale.x = Math.max(0.001, d.hp / d.hpMax);
    return false;
  }

  function atualizar(dt, t) {
    const heroi = ctx.heroi();
    for (let i = duendes.length - 1; i >= 0; i--) {
      if (atualizarDuende(duendes[i], dt, t, heroi)) {
        remover(duendes[i]);
        duendes.splice(i, 1);
      }
    }
    atualizarTiros(dt);
  }

  return {
    reiniciar,
    atualizar,
    atacar,
    acalmar,
    alvos: () => duendes.filter((d) => !d.morto),
    restantes: () => total - derrotados,
    total: () => total,
  };
}
