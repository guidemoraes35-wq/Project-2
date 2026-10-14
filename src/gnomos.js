// Os gnomos do vilarejo. Felizes, passeiam devagar e não atacam ninguém. Se o herói
// bater em um deles, ele (e os vizinhos) ficam bravos, mais rápidos, e revidam com
// uma espadinha ou com a magia de terra. O Rei Gnomo fica parado na praça; se apanhar,
// revida com uma magia de terra poderosa.
import * as THREE from 'three';
import { GNOMO, GNOMO_CHEFE, calcularDano, pontosDeAtaque, vidaPorSegundo, REGRAS } from './config.js';
import { criarGnomo, animarRig, descartarRig } from './models.js';

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
const geoEspinho = new THREE.ConeGeometry(0.16, 1.0, 6).translate(0, 0.5, 0);
const matEspinho = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1, flatShading: true });

/**
 * ctx: { scene, vilarejo, particulas, numeros, camera,
 *        heroi(): herói atual, danoHeroi(dano, origem), heroiVisivel(): boolean }
 */
export function criarPovoGnomo(ctx) {
  const { scene, vilarejo, particulas, numeros, camera } = ctx;
  const gnomos = [];
  const magias = [];
  let renascer = [];
  const tmp = new THREE.Vector3();

  // Gnomo Chefe: parado na praça, olhando para quem chega pela estrada do sul
  const chefeRig = criarGnomo({ chefe: true });
  chefeRig.root.position.set(GNOMO_CHEFE.x, 0, GNOMO_CHEFE.z);
  scene.add(chefeRig.root);
  vilarejo.addCirculo(GNOMO_CHEFE.x, GNOMO_CHEFE.z, 0.45);
  const chefe = {
    rig: chefeRig, pos: chefeRig.root.position, dir: 0, expressao: null, exprT: 0, olharPara: null,
    rei: true, hp: GNOMO_CHEFE.vida, hpMax: GNOMO_CHEFE.vida, bravo: false, raiva: 0, recarga: 0,
    morto: false, mortoT: 0, renascerT: 0, flash: 0,
  };

  /** Muda a expressão do chefe (null = parado normal). */
  function expressar(nome) {
    if (chefe.expressao === nome) return;
    chefe.expressao = nome;
    chefe.exprT = 0;
    tmp.copy(chefe.pos).setY(2.0);
    if (nome === 'surpreso') {
      numeros.mostrar(tmp, '!!', 'alerta');
      particulas.emitir(tmp.setY(1.6), 0xffffff, 18, { vel: 3, vida: 0.5 });
    } else if (nome === 'lembrando' || nome === 'pensando') {
      numeros.mostrar(tmp, '…', 'pensamento');
    } else if (nome === 'bravo') {
      numeros.mostrar(tmp, '💢', 'alerta');
    }
  }

  /** Gestos e caretas por cima da animação parada. */
  function aplicarExpressao(dt, t) {
    const r = chefe.rig;
    const e = chefe.expressao;
    chefe.exprT += dt;
    const k = Math.min(1, chefe.exprT * 5); // entra suave
    const [oE, oD] = r.olhos;
    const [sE, sD] = r.sobrancelhas;
    let olho = 1, sob = 0;
    const cotE = r.bracoE.userData.cotovelo, cotD = r.bracoD.userData.cotovelo;
    if (e === 'desconfiado') {
      // aperta os olhos e se inclina para olhar melhor
      olho = 0.45;
      sob = -0.012;
      r.corpo.rotation.x += 0.18 * k;
      r.cabeca.rotation.x += 0.12 * k;
      r.cabeca.rotation.z = Math.sin(t * 1.3) * 0.12 * k;
    } else if (e === 'surpreso') {
      // pulinho para trás, olhos arregalados e braços para cima
      olho = 1.45;
      sob = 0.03;
      const pulo = Math.max(0, Math.sin(Math.min(1, chefe.exprT / 0.35) * Math.PI));
      r.corpo.position.y += pulo * 0.18;
      r.corpo.rotation.x -= 0.18 * k;
      r.bracoE.rotation.set(-2.5 * k, 0, 0.5 * k);
      r.bracoD.rotation.set(-2.5 * k, 0, -0.5 * k);
      r.cabeca.rotation.x -= 0.15 * k;
    } else if (e === 'lembrando') {
      // olha para cima de lado, mão no queixo
      olho = 0.9;
      sob = 0.015;
      r.cabeca.rotation.x -= 0.32 * k;
      r.cabeca.rotation.z = 0.22 * k;
      r.cabeca.rotation.y = 0.25 * k;
      r.bracoE.rotation.set(-1.15 * k, 0, -0.75 * k);
      if (cotE) cotE.rotation.x = -2.1 * k;
    } else if (e === 'pensando') {
      // mão no queixo batucando, cabeça balançando de um lado para o outro
      olho = 0.8;
      r.cabeca.rotation.z = Math.sin(t * 2.2) * 0.2 * k;
      r.cabeca.rotation.x -= 0.1 * k;
      r.corpo.rotation.y = Math.sin(t * 1.1) * 0.25 * k;
      r.bracoE.rotation.set(-1.15 * k, 0, -0.75 * k);
      if (cotE) cotE.rotation.x = (-2.1 + Math.abs(Math.sin(t * 7)) * 0.3) * k;
    } else if (e === 'perguntando') {
      // braços abertos, cabeça inclinada
      sob = 0.02;
      r.bracoE.rotation.set(-0.6 * k, 0, 0.75 * k);
      r.bracoD.rotation.set(-0.6 * k, 0, -0.75 * k);
      r.cabeca.rotation.z = 0.2 * k;
    } else if (e === 'rindo') {
      // cabeça para trás, mãos na barriga, corpo sacudindo
      olho = 0.25;
      r.cabeca.rotation.x -= 0.4 * k;
      r.corpo.position.y += Math.abs(Math.sin(t * 18)) * 0.05;
      r.corpo.rotation.x -= 0.12 * k;
      r.bracoE.rotation.set(-0.5 * k, 0, -0.35 * k);
      r.bracoD.rotation.set(-0.5 * k, 0, 0.35 * k);
      if (Math.floor(chefe.exprT * 3) !== Math.floor((chefe.exprT - dt) * 3)) {
        tmp.copy(chefe.pos).setY(2.0 + Math.random() * 0.3);
        tmp.x += (Math.random() - 0.5) * 0.8;
        numeros.mostrar(tmp, 'HA', 'risada');
      }
    } else if (e === 'bravo') {
      // punho erguido sacudindo e pezinho batendo
      olho = 0.75;
      sob = -0.015;
      r.bracoE.rotation.set(-2.6 * k + Math.sin(t * 22) * 0.15, 0, 0.2 * k);
      if (cotE) cotE.rotation.x = -0.9 * k;
      r.corpo.position.y += Math.max(0, Math.sin(t * 12)) * 0.03;
    } else if (e === 'misterioso') {
      // sorriso de canto, olhos semicerrados, alisando a barba
      olho = 0.55;
      sob = -0.008;
      r.cabeca.rotation.z = -0.15 * k;
      r.bracoE.rotation.set(-0.95 * k, 0, -0.6 * k);
      if (cotE) cotE.rotation.x = (-1.6 + Math.sin(t * 3) * 0.25) * k;
    }
    oE.scale.y = oD.scale.y = olho;
    oE.scale.x = oD.scale.x = e === 'surpreso' ? 1.3 : 1;
    sE.position.y = sD.position.y = 0.085 + sob;
  }

  /** O chefe solta um raio de energia verde do cajado no herói. */
  function raioMortal(alvo) {
    const origem = new THREE.Vector3();
    chefe.rig.cristal.getWorldPosition(origem);
    const destino = new THREE.Vector3(alvo.x, 1, alvo.z);
    for (let i = 0; i <= 12; i++) {
      tmp.lerpVectors(origem, destino, i / 12);
      tmp.x += (Math.random() - 0.5) * 0.3;
      tmp.y += (Math.random() - 0.5) * 0.3;
      particulas.emitir(tmp, i % 2 ? 0x7dff6a : 0xeaffd8, 6, { vel: 1.5, vida: 0.7 });
    }
    particulas.emitir(destino, 0x7dff6a, 70, { vel: 6, vida: 1, subir: 1 });
    ctx.tremor?.(0.6);
  }

  function criar(perto = null) {
    const p = vilarejo.pontoLivre(0.6, perto, perto ? 12 : 0);
    const rig = criarGnomo({ roupa: Math.random() < 0.5 ? 'azul' : 'verde', arma: Math.random() < 0.5 ? 'espada' : 'magia' });
    rig.root.position.set(p.x, 0, p.z);
    scene.add(rig.root);
    const barra = new THREE.Group();
    barra.add(new THREE.Mesh(geoBarra, matBarraFundo));
    const fill = new THREE.Mesh(geoBarraFill, matBarraVida);
    fill.position.set(-0.33, 0, 0.001);
    barra.add(fill);
    barra.visible = false;
    scene.add(barra);
    const g = {
      rig,
      pos: rig.root.position,
      dir: Math.random() * Math.PI * 2,
      arma: rig.arma,
      hp: GNOMO.vida,
      hpMax: GNOMO.vida,
      bravo: false,
      raiva: 0,
      alvo: null,
      espera: aleatorio(0, 3),
      andar: 0,
      recarga: 0,
      ataqueT: -1,
      acertou: false,
      flash: 0,
      semDano: 0,
      regenT: 0,
      empurrao: new THREE.Vector3(),
      desvio: aleatorio(-1, 1),
      morto: false,
      mortoT: 0,
      barra,
      fill,
    };
    gnomos.push(g);
    return g;
  }

  function remover(g) {
    scene.remove(g.rig.root, g.barra);
    g.rig.pele.dispose();
    descartarRig(g.rig);
  }

  function reiniciar() {
    for (const g of gnomos) remover(g);
    gnomos.length = 0;
    for (const m of magias) scene.remove(m.aviso, m.espinhos);
    magias.length = 0;
    renascer = [];
    const n = Math.floor(aleatorio(GNOMO.quantidadeMin, GNOMO.quantidadeMax + 1));
    for (let i = 0; i < n; i++) criar();
  }

  function ficarBravo(g) {
    if (g.morto) return;
    if (!g.bravo) {
      tmp.copy(g.pos).setY(1.3);
      numeros.mostrar(tmp, '!', 'alerta');
    }
    g.bravo = true;
    g.raiva = GNOMO.raiva;
    g.espera = 0;
  }

  /** Todos se acalmam (por exemplo, quando o herói cai). */
  function acalmar() {
    if (chefe.bravo) expressar(null);
    chefe.bravo = false;
    for (const g of gnomos) {
      g.bravo = false;
      g.ataqueT = -1;
    }
  }

  /**
   * Golpe do herói: acerta gnomos dentro do alcance e do arco à frente.
   * Retorna quantos foram atingidos.
   */
  /** Golpe no Rei Gnomo: ele fica bravo e revida. */
  function ferirRei(ataque, origem, extra = 0, danoFixo = null) {
    if (chefe.morto) return;
    const dano = danoFixo ?? calcularDano(ataque, GNOMO_CHEFE.defesa) + extra;
    chefe.hp -= dano;
    chefe.flash = 0.15;
    tmp.copy(chefe.pos).setY(2.1);
    numeros.mostrar(tmp, dano, 'inimigo');
    particulas.emitir(tmp.setY(1.0), 0xff4433, 14, { vel: 3.5, vida: 0.5, gravidade: 9 });
    if (!chefe.bravo) expressar('bravo');
    chefe.bravo = true;
    chefe.raiva = GNOMO.raiva;
    if (chefe.hp <= 0) {
      chefe.morto = true;
      chefe.mortoT = 0;
      chefe.renascerT = GNOMO_CHEFE.renascer;
      chefe.bravo = false;
      expressar(null);
      particulas.emitir(tmp.setY(1.0), 0xffe08a, 50, { vel: 4, vida: 1.2, subir: 1 });
      ctx.aoMorrer?.(chefe);
    }
  }

  /** Golpe que já escolheu o alvo (o jato de água da vara). */
  function atingir(alvo, ataque, origem) {
    if (alvo === chefe) ferirRei(ataque, origem);
    else if (!alvo.morto) {
      ferir(alvo, calcularDano(ataque, GNOMO.defesa), origem);
      alertarVizinhos(alvo.pos);
    }
  }

  /** Veneno do herói: `total` de dano dividido em `duracao` s. */
  function envenenar(alvo, ataque, duracao, multiplicador) {
    if (alvo.morto) return;
    const def = alvo === chefe ? GNOMO_CHEFE.defesa : GNOMO.defesa;
    alvo.veneno = { porSegundo: Math.max(1, Math.round((calcularDano(ataque, def) * multiplicador) / duracao)), restante: duracao, t: 0 };
    if (alvo === chefe) {
      if (!chefe.bravo) expressar('bravo');
      chefe.bravo = true;
      chefe.raiva = GNOMO.raiva;
    } else {
      ficarBravo(alvo);
      alertarVizinhos(alvo.pos);
    }
    tmp.copy(alvo.pos).setY(0.9);
    particulas.emitir(tmp, 0x8aff4a, 30, { vel: 3, vida: 0.7 });
  }

  function atualizarVenenoGnomo(g, dt) {
    if (!g.veneno || g.morto) return;
    g.veneno.t += dt;
    while (g.veneno && g.veneno.t >= 1) {
      g.veneno.t -= 1;
      g.veneno.restante -= 1;
      const dano = g.veneno.porSegundo;
      if (g === chefe) ferirRei(0, g.pos, 0, dano);
      else {
        g.hp -= dano;
        g.flash = 0.15;
        g.barra.visible = true;
        tmp.copy(g.pos).setY(1.25);
        numeros.mostrar(tmp, dano, 'veneno');
        if (g.hp <= 0) {
          g.morto = true;
          g.barra.visible = false;
          renascer.push(GNOMO.renascer);
          ctx.aoMorrer?.(g);
        }
      }
      if (g.morto || g.veneno.restante <= 0) g.veneno = null;
    }
  }

  function alertarVizinhos(origem) {
    for (const g of gnomos) {
      if (!g.morto && !g.bravo && distXZ(g.pos, origem) < GNOMO.raioAlerta) ficarBravo(g);
    }
  }

  /** Golpe em área à frente do herói; `extra` é somado ao dano (Espada Duendeira). */
  function atacar(origem, dir, alcance, arco, ataque, extra = 0) {
    let acertos = 0;
    if (!chefe.morto) {
      const d = distXZ(chefe.pos, origem);
      const ang = Math.atan2(chefe.pos.x - origem.x, chefe.pos.z - origem.z);
      if (d < alcance + 0.45 && (d < 0.6 || Math.abs(difAngulo(dir, ang)) <= arco / 2)) {
        ferirRei(ataque, origem, extra);
        acertos++;
      }
    }
    for (const g of gnomos) {
      if (g.morto) continue;
      const d = distXZ(g.pos, origem);
      if (d > alcance + GNOMO.raio) continue;
      const ang = Math.atan2(g.pos.x - origem.x, g.pos.z - origem.z);
      if (d > 0.6 && Math.abs(difAngulo(dir, ang)) > arco / 2) continue;
      ferir(g, calcularDano(ataque, GNOMO.defesa) + extra, origem);
      acertos++;
    }
    // os vizinhos viram a briga e também ficam bravos
    if (acertos) alertarVizinhos(origem);
    return acertos;
  }

  function ferir(g, dano, origem) {
    g.hp -= dano;
    g.flash = 0.15;
    g.semDano = 0;
    g.regenT = 0;
    tmp.subVectors(g.pos, origem).setY(0).normalize().multiplyScalar(5);
    g.empurrao.copy(tmp);
    tmp.copy(g.pos).setY(1.25);
    numeros.mostrar(tmp, dano, 'inimigo');
    particulas.emitir(tmp.setY(0.7), 0xff4433, 12, { vel: 3.5, vida: 0.5, gravidade: 9 });
    g.barra.visible = true;
    ficarBravo(g);
    if (g.ataqueT >= 0 && g.ataqueT < 0.2) g.ataqueT = -1; // o golpe no começo interrompe
    if (g.hp <= 0) {
      g.morto = true;
      g.barra.visible = false;
      particulas.emitir(tmp.setY(0.6), 0xffe08a, 30, { vel: 3, vida: 1, subir: 1 });
      renascer.push(GNOMO.renascer);
      ctx.aoMorrer?.(g);
    }
  }

  // ---------- Magia de terra: aviso no chão e espinhos de pedra saindo da terra ----------
  function lancarMagia(g, heroi, forca = GNOMO.inteligencia, escala = 1) {
    const cfg = { ...GNOMO.magia, raio: GNOMO.magia.raio * escala };
    const x = heroi.pos.x, z = heroi.pos.z;
    const aviso = new THREE.Mesh(
      new THREE.RingGeometry(cfg.raio - 0.22, cfg.raio, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xc8862a, transparent: true, opacity: 0.6, depthWrite: false })
    );
    aviso.position.set(x, 0.05, z);
    const espinhos = new THREE.Group();
    espinhos.position.set(x, 0, z);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(geoEspinho, matEspinho);
      const a = (i / 7) * Math.PI * 2 + Math.random();
      const r = i === 0 ? 0 : aleatorio(0.35, cfg.raio * 0.85);
      m.position.set(Math.cos(a) * r, -0.05, Math.sin(a) * r);
      m.rotation.set(aleatorio(-0.3, 0.3), Math.random() * 6, aleatorio(-0.3, 0.3));
      m.scale.set(1, i === 0 ? 1.5 : aleatorio(0.8, 1.2), 1);
      m.castShadow = true;
      espinhos.add(m);
    }
    espinhos.scale.y = 0.001;
    espinhos.visible = false;
    scene.add(aviso, espinhos);
    magias.push({ x, z, t: 0, aviso, espinhos, acertou: false, dono: g, forca, raio: cfg.raio });
    tmp.copy(g.rig.pedraMagia ? g.rig.pedraMagia.getWorldPosition(tmp) : g.pos);
    particulas.emitir(tmp, 0xc8a050, 20, { vel: 2, vida: 0.6, subir: 1 });
  }

  function atualizarMagias(dt) {
    const cfg = GNOMO.magia;
    const heroi = ctx.heroi();
    for (let i = magias.length - 1; i >= 0; i--) {
      const m = magias[i];
      m.t += dt;
      if (m.t < cfg.atraso) {
        m.aviso.material.opacity = 0.35 + 0.35 * Math.sin(m.t * 22);
        continue;
      }
      if (!m.espinhos.visible) {
        m.espinhos.visible = true;
        tmp.set(m.x, 0.3, m.z);
        particulas.emitir(tmp, 0x9a7a4a, 45, { vel: 6, vida: 0.8, gravidade: 10, subir: 3 });
        ctx.tremor?.(0.3);
      }
      const t = m.t - cfg.atraso;
      // sobem rápido, ficam um pouco e afundam
      m.espinhos.scale.y = t < 0.12 ? Math.max(0.001, t / 0.12) : t < 0.8 ? 1 : Math.max(0.001, 1 - (t - 0.8) / 0.4);
      m.aviso.material.opacity = Math.max(0, 0.5 - t);
      if (!m.acertou && t < 0.3 && heroi && ctx.heroiVisivel() && Math.hypot(heroi.pos.x - m.x, heroi.pos.z - m.z) < m.raio + heroi.raio) {
        m.acertou = true;
        ctx.danoHeroi(calcularDano(m.forca, heroi.atributos.defesa), tmp.set(m.x, 0, m.z));
      }
      if (t > 1.25) {
        scene.remove(m.aviso, m.espinhos);
        m.aviso.geometry.dispose();
        m.aviso.material.dispose();
        magias.splice(i, 1);
      }
    }
  }

  // ---------- Comportamento ----------
  function atualizarGnomo(g, dt, t, heroi) {
    const rig = g.rig;
    atualizarVenenoGnomo(g, dt);
    if (g.morto) {
      g.mortoT += dt;
      rig.root.rotation.x = Math.max(-Math.PI / 2, rig.root.rotation.x - dt * 6);
      if (g.mortoT > 1.4) rig.root.position.y -= dt * 0.5;
      return g.mortoT > 2.6;
    }
    const visivel = ctx.heroiVisivel();
    let movendo = 0;
    g.recarga -= dt;
    const vel = (g.bravo ? GNOMO.velocidadeBrava : GNOMO.velocidade) * REGRAS.escalaVelocidade;

    if (g.bravo) {
      g.raiva -= dt;
      if (g.raiva <= 0 || !visivel) {
        g.bravo = false;
        g.ataqueT = -1;
      }
    }

    if (g.ataqueT >= 0) {
      const cfg = GNOMO[g.arma];
      g.ataqueT += dt;
      if (!g.acertou && g.ataqueT >= cfg.preparo) {
        g.acertou = true;
        if (g.arma === 'espada') {
          if (visivel && distXZ(g.pos, heroi.pos) < cfg.alcance + 0.35) {
            ctx.danoHeroi(calcularDano(pontosDeAtaque(GNOMO, cfg.atributo), heroi.atributos.defesa), g.pos);
          }
        } else if (visivel) {
          lancarMagia(g, heroi);
        }
      }
      if (g.ataqueT >= cfg.duracao) g.ataqueT = -1;
      if (visivel) g.dir = girarPara(g.dir, Math.atan2(heroi.pos.x - g.pos.x, heroi.pos.z - g.pos.z), dt * 8);
    } else if (g.bravo && heroi) {
      const dist = distXZ(g.pos, heroi.pos);
      const alvoAng = Math.atan2(heroi.pos.x - g.pos.x, heroi.pos.z - g.pos.z);
      g.dir = girarPara(g.dir, alvoAng, dt * 10);
      if (g.arma === 'espada') {
        const cfg = GNOMO.espada;
        if (dist < cfg.alcance && g.recarga <= 0) {
          g.ataqueT = 0;
          g.acertou = false;
          g.recarga = cfg.recarga + aleatorio(0, 0.4);
        } else if (dist > cfg.alcance * 0.8) {
          const ang = alvoAng + g.desvio * 0.5 * Math.min(1, dist / 8);
          g.pos.x += Math.sin(ang) * vel * dt;
          g.pos.z += Math.cos(ang) * vel * dt;
          movendo = 1;
        }
      } else {
        const cfg = GNOMO.magia;
        if (dist < cfg.alcance && g.recarga <= 0) {
          g.ataqueT = 0;
          g.acertou = false;
          g.recarga = cfg.recarga + aleatorio(0, 0.8);
        } else {
          // mantém distância: aproxima, recua ou anda de lado
          let ang = alvoAng, v = vel;
          if (dist < cfg.distanciaIdeal - 2) ang = alvoAng + Math.PI;
          else if (dist < cfg.distanciaIdeal + 2) {
            ang = alvoAng + (g.desvio >= 0 ? 1 : -1) * Math.PI / 2;
            v *= 0.4;
          }
          g.pos.x += Math.sin(ang) * v * dt;
          g.pos.z += Math.cos(ang) * v * dt;
          movendo = v / vel;
        }
      }
    } else {
      // feliz: passeia pelo vilarejo e para de vez em quando
      if (g.espera > 0) {
        g.espera -= dt;
      } else {
        if (!g.alvo) g.alvo = vilarejo.pontoLivre(0.6);
        const dist = distXZ(g.pos, g.alvo);
        if (dist < 0.4) {
          g.alvo = null;
          g.espera = aleatorio(1.5, 5);
        } else {
          const ang = Math.atan2(g.alvo.x - g.pos.x, g.alvo.z - g.pos.z);
          g.dir = girarPara(g.dir, ang, dt * 6);
          // anda na direção em que está virado: curvas suaves
          g.pos.x += Math.sin(g.dir) * vel * dt;
          g.pos.z += Math.cos(g.dir) * vel * dt;
          movendo = 1;
          g.passeio = (g.passeio || 0) + dt;
          if (g.passeio > 14) { // preso numa parede: escolhe outro destino
            g.alvo = null;
            g.passeio = 0;
          }
        }
      }
    }

    // empurrão, separação, colisão com o herói e com o cenário
    g.pos.addScaledVector(g.empurrao, dt);
    g.empurrao.multiplyScalar(Math.exp(-9 * dt));
    for (const o of gnomos) {
      if (o === g || o.morto) continue;
      const dx = g.pos.x - o.pos.x, dz = g.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const min = GNOMO.raio * 2 + 0.1;
      if (d2 < min * min && d2 > 1e-6) {
        const k = ((min - Math.sqrt(d2)) * 0.5) / Math.sqrt(d2);
        g.pos.x += dx * k;
        g.pos.z += dz * k;
      }
    }
    if (heroi) {
      const d = distXZ(g.pos, heroi.pos);
      const min = GNOMO.raio + heroi.raio;
      if (d < min && d > 1e-4) {
        g.pos.x += ((g.pos.x - heroi.pos.x) * (min - d)) / d;
        g.pos.z += ((g.pos.z - heroi.pos.z) * (min - d)) / d;
      }
    }
    vilarejo.resolverColisao(g.pos, GNOMO.raio);

    g.andar += (movendo - g.andar) * Math.min(1, dt * 10);
    rig.root.rotation.y = g.dir;
    const prog = g.ataqueT >= 0 ? g.ataqueT / GNOMO[g.arma].duracao : -1;
    animarRig(rig, dt, t, g.andar, prog);
    if (rig.pedraMagia) rig.pedraMagia.material.emissiveIntensity = g.bravo ? 2 + Math.sin(t * 10) : 1.2;

    // regeneração igual à dos outros personagens
    g.semDano += dt;
    if (g.semDano >= REGRAS.regeneracaoEspera && g.hp < g.hpMax) {
      g.regenT += dt;
      while (g.regenT >= 1) {
        g.regenT -= 1;
        g.hp = Math.min(g.hpMax, g.hp + vidaPorSegundo(g.hpMax));
      }
    }
    if (g.hp >= g.hpMax && !g.bravo) g.barra.visible = false;

    g.flash = Math.max(0, g.flash - dt);
    rig.pele.emissive.setRGB(g.flash > 0 ? 1 : 0, g.flash > 0 ? 0.25 : 0, g.flash > 0 ? 0.2 : 0);
    g.barra.position.set(g.pos.x, 1.45, g.pos.z);
    g.barra.quaternion.copy(camera.quaternion);
    g.fill.scale.x = Math.max(0.001, g.hp / g.hpMax);
    return false;
  }

  function atualizar(dt, t) {
    const heroi = ctx.heroi();
    for (let i = gnomos.length - 1; i >= 0; i--) {
      if (atualizarGnomo(gnomos[i], dt, t, heroi)) {
        remover(gnomos[i]);
        gnomos.splice(i, 1);
      }
    }
    atualizarMagias(dt);
    // um gnomo novo chega no lugar de cada um derrotado (sempre entre 10 e 15)
    for (let i = renascer.length - 1; i >= 0; i--) {
      renascer[i] -= dt;
      if (renascer[i] <= 0) {
        renascer.splice(i, 1);
        if (gnomos.filter((g) => !g.morto).length < GNOMO.quantidadeMax) {
          const g = criar(heroi ? heroi.pos : null);
          tmp.copy(g.pos).setY(0.6);
          particulas.emitir(tmp, 0xffe08a, 20, { vel: 2, vida: 0.7, subir: 1 });
        }
      }
    }
    atualizarRei(dt, t, heroi);
  }

  function atualizarRei(dt, t, heroi) {
    const r = chefe.rig;
    atualizarVenenoGnomo(chefe, dt);
    if (chefe.morto) {
      // cai, some e, depois de um tempo, volta para a praça
      chefe.mortoT += dt;
      r.root.rotation.x = Math.max(-Math.PI / 2, r.root.rotation.x - dt * 4);
      if (chefe.mortoT > 2.5) r.root.visible = false;
      chefe.renascerT -= dt;
      if (chefe.renascerT <= 0) {
        chefe.morto = false;
        chefe.hp = chefe.hpMax;
        r.root.rotation.x = 0;
        r.root.visible = true;
        tmp.copy(chefe.pos).setY(1);
        particulas.emitir(tmp, 0x8fffc8, 60, { vel: 4, vida: 1, subir: 1 });
      }
      return;
    }
    const visivel = ctx.heroiVisivel();
    if (chefe.bravo) {
      chefe.raiva -= dt;
      chefe.recarga -= dt;
      if (chefe.raiva <= 0 || !visivel) {
        chefe.bravo = false;
        expressar(null);
      } else if (chefe.recarga <= 0) {
        // magia de terra do rei: maior e muito mais forte
        chefe.recarga = GNOMO_CHEFE.recargaMagia;
        lancarMagia(chefe, heroi, GNOMO_CHEFE.inteligencia, 1.5);
      }
    }
    // olha para o herói quando ele chega perto (ou quando está bravo)
    if (heroi) {
      const perto = chefe.bravo || distXZ(heroi.pos, chefe.pos) < 7;
      const alvo = perto ? Math.atan2(heroi.pos.x - chefe.pos.x, heroi.pos.z - chefe.pos.z) : 0;
      chefe.dir = girarPara(chefe.dir, alvo, dt * 3);
    }
    r.root.rotation.y = chefe.dir;
    animarRig(r, dt, t, 0);
    aplicarExpressao(dt, t);
    if (r.cristal) r.cristal.rotation.y = t * 1.5;
    chefe.flash = Math.max(0, chefe.flash - dt);
    r.pele.emissive.setRGB(chefe.flash > 0 ? 1 : 0, chefe.flash > 0 ? 0.25 : 0, chefe.flash > 0 ? 0.2 : 0);
  }

  return {
    gnomos,
    chefe,
    reiniciar,
    atualizar,
    atacar,
    acalmar,
    expressar,
    raioMortal,
    atingir,
    envenenar,
    /** Gnomos vivos e o rei (para a mira automática e o jato de água). */
    alvos: () => [...gnomos.filter((g) => !g.morto), ...(chefe.morto ? [] : [chefe])],
  };
}
