import * as THREE from 'three';
import { CLASSES, DUENDE, ATRIBUTOS, REGRAS, calcularDano } from './config.js';
import { Input } from './input.js';
import { criarMundo, texturaBrilho } from './world.js';
import { criarAssassino, criarMaga, criarDuende, animarRig } from './models.js';
import { Particulas, RastroGolpe, NumerosDano } from './effects.js';

// ------------------------------------------------------------------ Elementos
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const telaSelecao = $('select-screen');
const telaFim = $('end-screen');
const hud = $('hud');
const controles = $('controls');

// ------------------------------------------------------------------ Three.js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 420);
const mundo = criarMundo(scene);
const particulas = new Particulas(scene);
// luz fraca que acompanha o jogador para que o avatar seja visível no escuro
const luzJogador = new THREE.PointLight(0x8fa6ff, 5, 9, 1.4);
scene.add(luzJogador);
const numeros = new NumerosDano($('damage-layer'), camera);
const input = new Input({
  superficie: canvas,
  joystick: $('joystick'),
  knob: $('joystick-knob'),
  botaoAtaque: $('attack-btn'),
});

function redimensionar() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 72 : 60; // celular em pé: campo de visão maior
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', redimensionar);
redimensionar();

// ------------------------------------------------------------------ Estado
let estado = 'selecao'; // selecao | jogando | fim
let classeSelecionada = 'assassino';
let jogador = null;
let duendes = [];
let projeteis = [];
let rastro = null;
let total = 0, criados = 0, mortos = 0, timerSurgir = 0;
let timerFim = -1;
let tremor = 0;
const cam = { yaw: Math.PI * 0.25, pitch: 0.42, dist: 6.5 };

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const alvoCam = new THREE.Vector3();

const aleatorio = (a, b) => a + Math.random() * (b - a);
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function difAngulo(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const girarPara = (a, b, k) => a + difAngulo(a, b) * Math.min(1, k);

// ------------------------------------------------------------------ Tela de seleção
const preview = { assassino: null, maga: null };

function montarPreview() {
  removerPreview();
  preview.assassino = criarAssassino();
  preview.maga = criarMaga();
  preview.assassino.root.position.set(-1.0, 0, 0);
  preview.maga.root.position.set(1.0, 0, 0);
  preview.assassino.root.rotation.y = 0.25;
  preview.maga.root.rotation.y = -0.25;
  scene.add(preview.assassino.root, preview.maga.root);
}

function removerPreview() {
  for (const k of Object.keys(preview)) {
    if (preview[k]) scene.remove(preview[k].root);
    preview[k] = null;
  }
}

function montarCartas() {
  const cont = $('class-cards');
  cont.innerHTML = '';
  for (const cls of Object.values(CLASSES)) {
    const carta = document.createElement('button');
    carta.className = 'card';
    carta.dataset.classe = cls.id;
    const barras = ATRIBUTOS.map((a) => `
      <div class="stat">
        <span class="stat-nome">${a.nome}</span>
        <span class="stat-barra"><span style="width:${(cls[a.chave] / a.max) * 100}%"></span></span>
        <span class="stat-valor">${cls[a.chave]}</span>
      </div>`).join('');
    carta.innerHTML = `
      <div class="card-topo"><span class="card-icone">${cls.icone}</span><h2>${cls.nome}</h2></div>
      <p class="card-desc">${cls.descricao}</p>
      <div class="stats">${barras}</div>`;
    carta.addEventListener('click', () => selecionarClasse(cls.id));
    cont.appendChild(carta);
  }
  selecionarClasse(classeSelecionada);
}

function selecionarClasse(id) {
  classeSelecionada = id;
  for (const c of document.querySelectorAll('.card')) {
    c.classList.toggle('selecionada', c.dataset.classe === id);
  }
  $('start-btn').textContent = `Entrar na Dungeon como ${CLASSES[id].nome}`;
}

function mostrarSelecao() {
  estado = 'selecao';
  limparPartida();
  montarPreview();
  telaFim.classList.add('hidden');
  hud.classList.add('hidden');
  controles.classList.add('hidden');
  telaSelecao.classList.remove('hidden');
}

$('start-btn').addEventListener('click', () => iniciarJogo(classeSelecionada));
$('restart-btn').addEventListener('click', () => iniciarJogo(jogador ? jogador.cls.id : classeSelecionada));
$('change-btn').addEventListener('click', mostrarSelecao);

// ------------------------------------------------------------------ Partida
function limparPartida() {
  if (jogador) scene.remove(jogador.rig.root);
  for (const d of duendes) removerDuende(d);
  for (const p of projeteis) scene.remove(p.malha);
  if (rastro) rastro.remover(scene);
  jogador = null;
  duendes = [];
  projeteis = [];
  rastro = null;
  particulas.limpar();
  numeros.limpar();
  input.reiniciar();
}

function iniciarJogo(id) {
  limparPartida();
  removerPreview();
  const cls = CLASSES[id];
  const rig = id === 'assassino' ? criarAssassino() : criarMaga();
  scene.add(rig.root);
  jogador = {
    cls,
    rig,
    pos: rig.root.position,
    hp: cls.vida,
    hpMax: cls.vida,
    velocidade: cls.velocidade * REGRAS.escalaVelocidade,
    dir: Math.PI,
    andar: 0,
    recarga: 0,
    ataqueT: -1,
    acertou: false,
    invul: 0,
    vivo: true,
    mortoT: 0,
    raio: 0.4,
  };
  rig.root.rotation.y = jogador.dir;
  if (cls.ataque.tipo === 'fisico') rastro = new RastroGolpe(scene, cls.ataque.arco);

  total = Math.floor(aleatorio(REGRAS.duendesMin, REGRAS.duendesMax + 1));
  criados = 0;
  mortos = 0;
  timerSurgir = 1.5;
  timerFim = -1;
  tremor = 0;
  cam.yaw = 0;
  cam.pitch = 0.42;

  $('hud-name').textContent = `${cls.icone} ${cls.nome}`;
  $('hud-stats').innerHTML = ATRIBUTOS.slice(1)
    .map((a) => `<span title="${a.nome}">${a.nome.slice(0, 3).toUpperCase()} <b>${cls[a.chave]}</b></span>`)
    .join('');
  atualizarHUD();
  telaSelecao.classList.add('hidden');
  telaFim.classList.add('hidden');
  hud.classList.remove('hidden');
  controles.classList.remove('hidden');
  const dica = $('hint');
  dica.classList.remove('hidden', 'some');
  setTimeout(() => dica.classList.add('some'), 4500);
  estado = 'jogando';
}

function atualizarHUD() {
  if (!jogador) return;
  const f = Math.max(0, jogador.hp / jogador.hpMax);
  $('hp-fill').style.width = `${f * 100}%`;
  $('hp-fill').classList.toggle('baixa', f <= 0.3);
  $('hp-text').textContent = `${Math.max(0, Math.ceil(jogador.hp))} / ${jogador.hpMax}`;
  $('kills').textContent = `${mortos} / ${total}`;
}

function terminar(vitoria) {
  estado = 'fim';
  controles.classList.add('hidden');
  input.reiniciar();
  $('end-title').textContent = vitoria ? 'Vitória!' : 'Você morreu';
  $('end-title').className = vitoria ? 'vitoria' : 'derrota';
  $('end-text').textContent = vitoria
    ? `Os ${total} duendes da floresta sombria foram derrotados.`
    : `Você derrotou ${mortos} de ${total} duendes antes de cair.`;
  telaFim.classList.remove('hidden');
}

// ------------------------------------------------------------------ Duendes
const geoBarra = new THREE.PlaneGeometry(0.8, 0.09);
const geoBarraFill = new THREE.PlaneGeometry(0.76, 0.06).translate(0.38, 0, 0);
const matBarraFundo = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
const matBarraVida = new THREE.MeshBasicMaterial({ color: 0xd63a2a, depthWrite: false });

function surgirDuende() {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = aleatorio(16, 28);
    const x = jogador.pos.x + Math.cos(a) * r;
    const z = jogador.pos.z + Math.sin(a) * r;
    if (Math.hypot(x, z) > mundo.raio - 3 || !mundo.livre(x, z, 0.8)) continue;
    const rig = criarDuende();
    rig.root.position.set(x, 0, z);
    scene.add(rig.root);
    const barra = new THREE.Group();
    barra.add(new THREE.Mesh(geoBarra, matBarraFundo));
    const fill = new THREE.Mesh(geoBarraFill, matBarraVida);
    fill.position.set(-0.38, 0, 0.001);
    barra.add(fill);
    barra.renderOrder = 10;
    scene.add(barra);
    duendes.push({
      rig,
      pos: rig.root.position,
      hp: DUENDE.vida,
      hpMax: DUENDE.vida,
      velocidade: DUENDE.velocidade * REGRAS.escalaVelocidade * aleatorio(0.9, 1.05),
      dir: 0,
      andar: 0,
      recarga: aleatorio(0.4, 1.0),
      ataqueT: -1,
      acertou: false,
      flash: 0,
      empurrao: new THREE.Vector3(),
      desvio: aleatorio(-0.6, 0.6),
      morto: false,
      mortoT: 0,
      raio: 0.4,
      barra,
      fill,
    });
    criados++;
    tmp.set(x, 0.5, z);
    particulas.emitir(tmp, 0x5dff6a, 24, { vel: 3, vida: 0.8, subir: 1.5 });
    return;
  }
}

function removerDuende(d) {
  scene.remove(d.rig.root);
  scene.remove(d.barra);
  d.rig.pele.dispose();
}

function danoDuende(d, dano, origem) {
  if (d.morto) return;
  d.hp -= dano;
  d.flash = 0.15;
  tmp.subVectors(d.pos, origem).setY(0).normalize().multiplyScalar(7);
  d.empurrao.copy(tmp);
  d.ataqueT = -1; // interrompe o ataque
  d.recarga = Math.max(d.recarga, 0.5);
  tmp.copy(d.pos).setY(1.2);
  numeros.mostrar(tmp, dano, 'inimigo');
  particulas.emitir(tmp, 0xff4433, 14, { vel: 4, vida: 0.5, gravidade: 9 });
  if (d.hp <= 0) {
    d.morto = true;
    d.barra.visible = false;
    mortos++;
    particulas.emitir(tmp, 0x8cff6a, 30, { vel: 3.5, vida: 1, subir: 1 });
    atualizarHUD();
    if (mortos >= total) timerFim = 1.4;
  }
}

function atualizarDuendes(dt, t) {
  const vivos = duendes.filter((d) => !d.morto).length;
  const maxVivos = Math.min(REGRAS.duendesSimultaneosMax, REGRAS.duendesSimultaneosInicio + Math.floor(mortos / 5));
  timerSurgir -= dt;
  if (estado === 'jogando' && jogador.vivo && criados < total && vivos < maxVivos && timerSurgir <= 0) {
    surgirDuende();
    timerSurgir = REGRAS.intervaloSurgimento;
  }

  for (let i = duendes.length - 1; i >= 0; i--) {
    const d = duendes[i];
    const rig = d.rig;

    if (d.morto) {
      d.mortoT += dt;
      rig.root.rotation.x = Math.max(-Math.PI / 2, rig.root.rotation.x - dt * 6);
      if (d.mortoT > 1.2) rig.root.position.y -= dt * 0.6;
      if (d.mortoT > 2.5) {
        removerDuende(d);
        duendes.splice(i, 1);
      }
      continue;
    }

    const dist = distXZ(d.pos, jogador.pos);
    const alvoAng = Math.atan2(jogador.pos.x - d.pos.x, jogador.pos.z - d.pos.z);
    let movendo = 0;
    d.recarga -= dt;

    if (d.ataqueT >= 0) {
      d.ataqueT += dt;
      if (!d.acertou && d.ataqueT >= 0.55) {
        d.acertou = true;
        if (jogador.vivo && dist < DUENDE.alcance + 0.35) {
          danoJogador(calcularDano(DUENDE.poder, jogador.cls.defesa), d.pos);
        }
      }
      if (d.ataqueT >= 0.85) d.ataqueT = -1;
    } else if (jogador.vivo && dist < DUENDE.alcance && d.recarga <= 0) {
      d.ataqueT = 0;
      d.acertou = false;
      d.recarga = DUENDE.recarga + aleatorio(0, 0.5);
    } else if (jogador.vivo && dist > DUENDE.alcance * 0.8) {
      // persegue o jogador, com um pequeno desvio para cercá-lo
      const ang = alvoAng + d.desvio * Math.min(1, dist / 10);
      d.pos.x += Math.sin(ang) * d.velocidade * dt;
      d.pos.z += Math.cos(ang) * d.velocidade * dt;
      movendo = 1;
    }
    d.dir = girarPara(d.dir, alvoAng, dt * 10);

    // empurrão ao ser atingido
    d.pos.addScaledVector(d.empurrao, dt);
    d.empurrao.multiplyScalar(Math.exp(-9 * dt));

    // separação entre duendes
    for (const o of duendes) {
      if (o === d || o.morto) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-6) {
        const k = (0.9 - Math.sqrt(d2)) * 0.5 / Math.sqrt(d2);
        d.pos.x += dx * k;
        d.pos.z += dz * k;
      }
    }
    // não atravessa o jogador
    if (dist < d.raio + jogador.raio && dist > 1e-4) {
      const k = (d.raio + jogador.raio - dist) / dist;
      d.pos.x += (d.pos.x - jogador.pos.x) * k;
      d.pos.z += (d.pos.z - jogador.pos.z) * k;
    }
    mundo.resolverColisao(d.pos, d.raio);

    d.andar += (movendo - d.andar) * Math.min(1, dt * 10);
    rig.root.rotation.y = d.dir;
    const prog = d.ataqueT >= 0 ? d.ataqueT / 0.85 : -1;
    animarRig(rig, dt, t, d.andar, prog);

    // pisca ao ser atingido
    d.flash = Math.max(0, d.flash - dt);
    rig.pele.emissive.setRGB(d.flash > 0 ? 1 : 0, d.flash > 0 ? 0.25 : 0, d.flash > 0 ? 0.2 : 0);

    d.barra.position.set(d.pos.x, 1.65, d.pos.z);
    d.barra.quaternion.copy(camera.quaternion);
    d.fill.scale.x = Math.max(0.001, d.hp / d.hpMax);
  }
}

// ------------------------------------------------------------------ Jogador
function duendeMaisProximo(maxDist, cone = Math.PI) {
  let melhor = null, melhorD = maxDist;
  for (const d of duendes) {
    if (d.morto) continue;
    const dist = distXZ(d.pos, jogador.pos);
    if (dist > melhorD) continue;
    const ang = Math.atan2(d.pos.x - jogador.pos.x, d.pos.z - jogador.pos.z);
    if (Math.abs(difAngulo(jogador.dir, ang)) > cone) continue;
    melhor = d;
    melhorD = dist;
  }
  return melhor;
}

function iniciarAtaque() {
  const atk = jogador.cls.ataque;
  // mira automática: vira para o duende mais próximo
  const alvo = duendeMaisProximo(atk.mira);
  if (alvo) jogador.dir = Math.atan2(alvo.pos.x - jogador.pos.x, alvo.pos.z - jogador.pos.z);
  jogador.alvo = alvo;
  jogador.recarga = atk.recarga;
  jogador.ataqueT = 0;
  jogador.acertou = false;
}

function golpeCorpoACorpo() {
  const atk = jogador.cls.ataque;
  rastro.disparar(jogador.pos, jogador.dir);
  for (const d of duendes) {
    if (d.morto) continue;
    const dist = distXZ(d.pos, jogador.pos);
    if (dist > atk.alcance + d.raio) continue;
    const ang = Math.atan2(d.pos.x - jogador.pos.x, d.pos.z - jogador.pos.z);
    if (dist > 0.8 && Math.abs(difAngulo(jogador.dir, ang)) > atk.arco / 2) continue;
    danoDuende(d, calcularDano(jogador.cls.poder, DUENDE.defesa), jogador.pos);
  }
}

const geoProjetil = new THREE.SphereGeometry(0.16, 12, 10);
const matProjetil = new THREE.MeshBasicMaterial({ color: 0xbff0ff });
const matBrilhoProjetil = new THREE.SpriteMaterial({
  map: texturaBrilho('rgba(80,180,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});

function lancarMagia() {
  const atk = jogador.cls.ataque;
  const malha = new THREE.Mesh(geoProjetil, matProjetil);
  const brilho = new THREE.Sprite(matBrilhoProjetil);
  brilho.scale.setScalar(1.4);
  malha.add(brilho);
  jogador.rig.orbe.getWorldPosition(malha.position);
  scene.add(malha);
  const vel = new THREE.Vector3(Math.sin(jogador.dir), 0, Math.cos(jogador.dir)).multiplyScalar(atk.velocidadeProjetil);
  projeteis.push({ malha, vel, alvo: jogador.alvo, vida: atk.alcance / atk.velocidadeProjetil });
  particulas.emitir(malha.position, 0x66ccff, 12, { vel: 2.5, vida: 0.4 });
}

function atualizarProjeteis(dt) {
  const atk = jogador ? jogador.cls.ataque : null;
  for (let i = projeteis.length - 1; i >= 0; i--) {
    const p = projeteis[i];
    p.vida -= dt;
    // persegue suavemente o alvo
    if (p.alvo && !p.alvo.morto) {
      tmp.set(p.alvo.pos.x, 0.8, p.alvo.pos.z).sub(p.malha.position).normalize().multiplyScalar(atk.velocidadeProjetil);
      p.vel.lerp(tmp, Math.min(1, dt * 8));
    } else {
      p.vel.y += (0.9 - p.malha.position.y) * dt * 4;
    }
    p.malha.position.addScaledVector(p.vel, dt);
    particulas.emitir(p.malha.position, 0x3aa0ff, 2, { vel: 0.6, vida: 0.35 });

    let explodiu = p.vida <= 0;
    for (const d of duendes) {
      if (d.morto) continue;
      tmp2.set(d.pos.x, 0.7, d.pos.z);
      if (tmp2.distanceTo(p.malha.position) < 0.75) {
        danoDuende(d, calcularDano(jogador.cls.inteligencia, DUENDE.defesa), p.malha.position);
        explodiu = true;
        break;
      }
    }
    if (!explodiu) {
      tmp2.copy(p.malha.position);
      mundo.resolverColisao(tmp2, 0.15);
      if (tmp2.distanceToSquared(p.malha.position) > 1e-6) explodiu = true; // bateu numa árvore
    }
    if (explodiu) {
      particulas.emitir(p.malha.position, 0x7fd8ff, 26, { vel: 4, vida: 0.55 });
      scene.remove(p.malha);
      projeteis.splice(i, 1);
    }
  }
}

function danoJogador(dano, origem) {
  if (!jogador.vivo || jogador.invul > 0) return;
  jogador.hp -= dano;
  jogador.invul = REGRAS.invulnerabilidade;
  tremor = 0.25;
  tmp.copy(jogador.pos).setY(1.8);
  numeros.mostrar(tmp, dano, 'jogador');
  particulas.emitir(tmp.setY(1.2), 0xff2222, 12, { vel: 3, vida: 0.5, gravidade: 8 });
  const v = $('hurt-vignette');
  v.classList.remove('pisca');
  void v.offsetWidth;
  v.classList.add('pisca');
  tmp.subVectors(jogador.pos, origem).setY(0).normalize();
  jogador.pos.addScaledVector(tmp, 0.35);
  atualizarHUD();
  if (jogador.hp <= 0) {
    jogador.vivo = false;
    timerFim = 1.8;
  }
}

function atualizarJogador(dt, t) {
  const j = jogador;
  const rig = j.rig;
  j.invul = Math.max(0, j.invul - dt);
  j.recarga -= dt;

  if (!j.vivo) {
    j.mortoT += dt;
    rig.root.rotation.x = Math.max(-Math.PI / 2, rig.root.rotation.x - dt * 4);
    animarRig(rig, dt, t, 0);
    return;
  }

  // movimento relativo à câmera
  const m = estado === 'jogando' ? input.movimento() : { x: 0, y: 0 };
  const mag = Math.hypot(m.x, m.y);
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const mx = cy * m.x - sy * m.y;
  const mz = -sy * m.x - cy * m.y;
  const atacando = j.ataqueT >= 0;
  if (mag > 0.01) {
    const vel = j.velocidade * (atacando ? 0.5 : 1);
    j.pos.x += mx * vel * dt;
    j.pos.z += mz * vel * dt;
    if (!atacando) j.dir = girarPara(j.dir, Math.atan2(mx, mz), dt * 14);
  }
  mundo.resolverColisao(j.pos, j.raio);
  j.andar += (Math.min(1, mag) - j.andar) * Math.min(1, dt * 10);

  // ataque
  if (estado === 'jogando' && input.atacando() && j.recarga <= 0 && !atacando) iniciarAtaque();
  const atk = j.cls.ataque;
  if (j.ataqueT >= 0) {
    j.ataqueT += dt;
    if (!j.acertou && j.ataqueT >= atk.acerto) {
      j.acertou = true;
      if (atk.tipo === 'fisico') golpeCorpoACorpo();
      else lancarMagia();
    }
    if (j.ataqueT >= atk.duracao) j.ataqueT = -1;
  }

  rig.root.rotation.y = j.dir;
  animarRig(rig, dt, t, j.andar, j.ataqueT >= 0 ? j.ataqueT / atk.duracao : -1);
  // pisca enquanto está invulnerável
  rig.root.visible = j.invul <= 0 || Math.floor(j.invul * 20) % 2 === 0;

  if (rig.luzOrbe) rig.luzOrbe.intensity = 4 + (j.ataqueT >= 0 ? 6 : 0) + Math.sin(t * 5) * 0.6;

  const pronto = Math.max(0, j.recarga) / atk.recarga;
  $('attack-cd').style.transform = `scaleY(${pronto})`;
}

// ------------------------------------------------------------------ Câmera
function atualizarCamera(dt, t) {
  if (estado === 'selecao') {
    // câmera de apresentação dos avatares
    const foco = classeSelecionada === 'assassino' ? -1.0 : 1.0;
    const empe = window.innerWidth < window.innerHeight;
    const ang = Math.sin(t * 0.25) * 0.3;
    const dist = empe ? 7.2 : 4.8;
    alvoCam.set(foco * (empe ? 0.25 : 0.6), 0, 0);
    tmp.set(alvoCam.x + Math.sin(ang) * dist, empe ? 1.7 : 1.2, Math.cos(ang) * dist);
    camera.position.lerp(tmp, Math.min(1, dt * 3));
    // em pé, as cartas ocupam a parte de baixo: os avatares sobem na tela
    alvoCam.y = empe ? 0.2 : 0.95;
    camera.lookAt(alvoCam);
    return;
  }

  const olhar = input.consumirOlhar(dt);
  cam.yaw -= olhar.dx * 0.006;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + olhar.dy * 0.004, 0.08, 1.2);

  alvoCam.set(jogador.pos.x, 1.3, jogador.pos.z);
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    alvoCam.x + Math.sin(cam.yaw) * cp * cam.dist,
    alvoCam.y + Math.sin(cam.pitch) * cam.dist,
    alvoCam.z + Math.cos(cam.yaw) * cp * cam.dist
  );
  if (tremor > 0) {
    tremor = Math.max(0, tremor - dt);
    const f = tremor * 0.5;
    camera.position.x += (Math.random() - 0.5) * f;
    camera.position.y += (Math.random() - 0.5) * f;
  }
  camera.lookAt(alvoCam);
}

// ------------------------------------------------------------------ Loop
const relogio = new THREE.Clock();
let tempo = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, relogio.getDelta());
  tempo += dt;

  if (estado === 'selecao') {
    for (const [id, rig] of Object.entries(preview)) {
      if (!rig) continue;
      const sel = id === classeSelecionada;
      // o avatar selecionado demonstra o ataque de tempos em tempos
      const ciclo = (tempo * 0.6) % 2;
      const prog = sel && ciclo < 0.6 ? ciclo / 0.6 : -1;
      animarRig(rig, dt, tempo, 0, prog);
      const s = sel ? 1.08 : 0.95;
      rig.root.scale.lerp(tmp.set(s, s, s), Math.min(1, dt * 6));
    }
    mundo.atualizar(dt, tempo, tmp2.set(0, 0, 0), camera);
    luzJogador.position.set(0, 3, 2.5);
  } else if (jogador) {
    atualizarJogador(dt, tempo);
    atualizarDuendes(dt, tempo);
    atualizarProjeteis(dt);
    if (rastro) rastro.atualizar(dt);
    mundo.atualizar(dt, tempo, jogador.pos, camera);
    luzJogador.position.set(jogador.pos.x, 3, jogador.pos.z);
    if (timerFim > 0 && estado === 'jogando') {
      timerFim -= dt;
      if (timerFim <= 0) terminar(jogador.vivo);
    }
  }

  atualizarCamera(dt, tempo);
  particulas.atualizar(dt);
  numeros.atualizar(dt);
  renderer.render(scene, camera);
}

montarCartas();
mostrarSelecao();
camera.position.set(0, 1.5, 6);
loop();
