import * as THREE from 'three';
import {
  CLASSES, DUENDE, ARQUEIRO, CHEFAO, ATRIBUTOS, REGRAS, NOMES_ATRIBUTO, calcularDano, pontosDeAtaque, vidaPorSegundo,
  GENEROS, APARENCIAS, ROUPAS, ROUPA_SIMPLES, PRESENTES, atributosHeroi, textoBonus, HEROI_BASE, ESPACOS, GNOMO_CHEFE,
} from './config.js';
import { Input } from './input.js';
import { criarMundo, texturaBrilho } from './world.js';
import { criarAssassino, criarMaga, criarDuende, criarChefao, criarHeroi, descartarRig, animarRig, criarContornoTranslucido } from './models.js';
import { Particulas, RastroGolpe, NumerosDano } from './effects.js';
import { criarPortal } from './portal.js';
import { criarEstudio } from './estudio.js';
import { criarVilarejo } from './vilarejo.js';
import { criarPovoGnomo } from './gnomos.js';
import { criarCastelo } from './castelo.js';
import { criarDuendesCastelo } from './duendesCastelo.js';
import { criarOrbes } from './xp.js';
import { XP, xpParaSubir, MELHORIAS, DUENDE_FRACO, ARQUEIRO_CASTELO, DUENDE_MAGICO, PRINCESA, ITENS, item, ATAQUES_HEROI } from './config.js';
import { CONVERSA_CHEFE, CONVERSA_CHEFE_SIM, CONVERSA_CHEFE_NAO, CONVERSA_CHEFE_LEMBRETE, CONVERSA_CHEFE_VITORIA, CONVERSA_PRINCESA_MORTE, CONVERSA_CHEFE_PRESENTE } from './conversas.js';

// ------------------------------------------------------------------ Elementos
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const telaSelecao = $('select-screen');
const telaFim = $('end-screen');
const telaCriacao = $('create-screen');
const hud = $('hud');
const controles = $('controls');

// ------------------------------------------------------------------ Three.js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene(); // a floresta do tutorial
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 420);
const mundo = criarMundo(scene);
const particulas = new Particulas(scene);
const estudio = criarEstudio(); // cenário da criação do personagem
let vilarejo = null;            // criado na primeira visita
let cena = scene;               // cena desenhada agora

/** Troca a cena desenhada; as partículas vão junto. */
function trocarCena(nova) {
  cena = nova;
  nova.add(particulas.pontos);
}
// luz fraca que acompanha o jogador para que o avatar seja visível no escuro
const luzJogador = new THREE.PointLight(0x8fa6ff, 5, 9, 1.4);
scene.add(luzJogador);
const numeros = new NumerosDano($('damage-layer'), camera);
const input = new Input({
  superficie: canvas,
  joystick: $('joystick'),
  knob: $('joystick-knob'),
  botaoAtaque: $('attack-btn'),
  botaoSuper: $('super-btn'),
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
let estado = 'selecao'; // selecao | jogando | fim | portal | criacao | vilarejo
let classeSelecionada = 'assassino';
let jogador = null;
let duendes = [];
let projeteis = [];
let flechas = [];
let bolasDeFogo = [];
let pedras = [];
let rastro = null;
let mortos = 0;
let filaInimigos = []; // duendes planejados ao longo da trilha, ordenados pela posição
let progresso = 0;     // quantos metros da trilha o jogador já percorreu
let timerFim = -1;
let chefao = null;
let tremor = 0;
let portal = null;
let timerPortal = -1;
let localPortal = null;
let heroi = null; // personagem definitivo, no vilarejo
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

// ------------------------------------------------------------------ Ícones do SUPER
// Capa de mago translúcida (Invisibilidade do Assassino), desenhada em SVG
const ICONE_CAPA = `<svg class="icone-capa" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="capa-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe2ff" stop-opacity="0.85"/>
      <stop offset="0.6" stop-color="#8fb4ff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#8fb4ff" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <path d="M32 5 C22 6 17 15 17 24 C17 30 14 38 9 47 C8 50 9 53 12 54 C18 56 23 52 27 55 C29 57 35 57 37 55 C41 52 46 56 52 54 C55 53 56 50 55 47 C50 38 47 30 47 24 C47 15 42 6 32 5 Z"
    fill="url(#capa-g)" stroke="#e6f0ff" stroke-opacity="0.9" stroke-width="1.6" stroke-dasharray="3 2.2"/>
  <path d="M32 13 C26 13 23 18 23 23 C23 27 26 30 32 30 C38 30 41 27 41 23 C41 18 38 13 32 13 Z" fill="#0d1226" fill-opacity="0.85"/>
  <path d="M26 33 C28 41 27 48 24 53 M38 33 C36 41 37 48 40 53" fill="none" stroke="#e6f0ff" stroke-opacity="0.45" stroke-width="1.2"/>
  <circle cx="13" cy="15" r="1.6" fill="#fff"/><circle cx="52" cy="11" r="1.2" fill="#fff"/><circle cx="55" cy="30" r="1" fill="#fff"/>
</svg>`;
const iconeSuper = (sup) => (sup.icone === 'capa' ? ICONE_CAPA : sup.icone);

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
      <p class="card-ataque">Ataque: <b>${NOMES_ATRIBUTO[cls.ataque.atributo]}</b> (${cls[cls.ataque.atributo]} pontos)</p>
      <p class="card-super">SUPER: <b>${iconeSuper(cls.super)} ${cls.super.nome}</b><span class="card-super-desc"> — ${cls.super.descricao}</span></p>
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
  removerHeroi();
  removerPrevia();
  trocarCena(scene);
  camera.clearViewOffset();
  montarPreview();
  telaFim.classList.add('hidden');
  telaCriacao.classList.add('hidden');
  hud.classList.remove('modo-vilarejo');
  controles.classList.remove('sem-super');
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
  for (const f of flechas) scene.remove(f.malha);
  for (const b of bolasDeFogo) scene.remove(b.malha);
  for (const p of pedras) scene.remove(p.malha, p.aviso);
  flechas = [];
  bolasDeFogo = [];
  pedras = [];
  if (rastro) rastro.remover(scene);
  if (portal) portal.remover();
  portal = null;
  timerPortal = -1;
  jogador = null;
  chefao = null;
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
    semDano: 0,
    regenT: 0,
    superRecarga: 0,  // assassino: segundos até poder ficar invisível de novo
    invisivel: 0,     // assassino: segundos restantes de invisibilidade
    abatesSuper: 0,   // maga: inimigos derrotados desde o último SUPER
    vivo: true,
    mortoT: 0,
    raio: 0.4,
  };
  rig.root.rotation.y = jogador.dir;
  if (cls.super.tipo === 'invisibilidade') prepararTransparencia(rig);
  $('super-icon').innerHTML = iconeSuper(cls.super);
  if (cls.ataque.tipo === 'fisico') rastro = new RastroGolpe(scene, cls.ataque.arco);

  mortos = 0;
  progresso = mundo.consultar(0, 0).s;
  filaInimigos = planejarInimigos();
  timerFim = -1;
  tremor = 0;
  $('boss-bar').classList.add('hidden');
  hud.classList.remove('com-chefao');
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
  dica.textContent = 'Siga a trilha até o fim. Arraste a tela para girar a câmera.';
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
  $('kills').textContent = String(mortos);
  $('path-fill').style.width = `${Math.min(100, (progresso / mundo.comprimento) * 100)}%`;
  if (chefao) $('boss-fill').style.width = `${Math.max(0, chefao.hp / chefao.hpMax) * 100}%`;
}

/** O jogador morreu no tutorial (vencer o chefão abre o portal em vez desta tela). */
function terminar() {
  estado = 'fim';
  controles.classList.add('hidden');
  input.reiniciar();
  $('end-title').textContent = 'Você morreu';
  $('end-title').className = 'derrota';
  const pct = Math.round(Math.min(1, progresso / mundo.comprimento) * 100);
  $('end-text').textContent = chefao && chefao.morto
    ? `O ${CHEFAO.nome} foi derrotado, mas você caiu antes de atravessar o portal. Duendes derrotados: ${mortos}.`
    : chefao
      ? `Você chegou ao fim da trilha, mas caiu diante do ${CHEFAO.nome}. Duendes derrotados: ${mortos}.`
      : `Você percorreu ${pct}% da trilha e derrotou ${mortos} duendes antes de cair.`;
  telaFim.classList.remove('hidden');
}

// ------------------------------------------------------------------ Duendes
const geoBarra = new THREE.PlaneGeometry(0.8, 0.09);
const geoBarraFill = new THREE.PlaneGeometry(0.76, 0.06).translate(0.38, 0, 0);
const matBarraFundo = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
const matBarraVida = new THREE.MeshBasicMaterial({ color: 0xd63a2a, depthWrite: false });

/**
 * Sorteia os duendes da rodada e onde cada um aparece na trilha. A densidade cresce
 * ao longo do caminho; os arqueiros ficam nas regiões intermediária e final.
 */
function planejarInimigos() {
  const L = mundo.comprimento;
  const fim = L - REGRAS.distanciaChefao - 4;
  const inicio = 24;
  const sortear = (min, max) => Math.floor(aleatorio(min, max + 1));
  const plano = [];
  const nNormais = sortear(REGRAS.duendesMin, REGRAS.duendesMax);
  for (let i = 0; i < nNormais; i++) {
    // raiz quadrada: mais duendes quanto mais perto do fim
    const u = (i + Math.random()) / nNormais;
    plano.push({ s: inicio + (fim - inicio) * Math.sqrt(u), cfg: DUENDE });
  }
  const nArqueiros = sortear(REGRAS.arqueirosMin, REGRAS.arqueirosMax);
  const inicioArq = L / 3;
  for (let i = 0; i < nArqueiros; i++) {
    const u = (i + Math.random()) / nArqueiros;
    plano.push({ s: inicioArq + (fim - inicioArq) * Math.sqrt(u), cfg: ARQUEIRO });
  }
  return plano.sort((a, b) => a.s - b.s);
}

/** Procura um lugar livre na trilha perto da posição s, longe do jogador. */
function pontoNaTrilha(s, folga, distMin = 11) {
  const L = mundo.comprimento;
  for (let i = 0; i < 40; i++) {
    const ss = Math.min(L - 4, s + aleatorio(-4, 8) + i * 0.5);
    const lat = aleatorio(-1, 1) * (mundo.larguraEm(ss) - 2);
    const p = mundo.pontoNoCaminho(ss, lat);
    if (Math.hypot(p.x - jogador.pos.x, p.z - jogador.pos.z) < distMin) continue;
    if (!mundo.livre(p.x, p.z, folga)) continue;
    return p;
  }
  return null;
}

function criarInimigo(cfg, rig, x, z) {
  rig.root.position.set(x, 0, z);
  scene.add(rig.root);
  const barra = new THREE.Group();
  barra.add(new THREE.Mesh(geoBarra, matBarraFundo));
  const fill = new THREE.Mesh(geoBarraFill, matBarraVida);
  fill.position.set(-0.38, 0, 0.001);
  barra.add(fill);
  barra.renderOrder = 10;
  barra.visible = cfg !== CHEFAO; // o chefão usa a barra grande do HUD
  scene.add(barra);
  const inimigo = {
    cfg,
    rig,
    pos: rig.root.position,
    hp: cfg.vida,
    hpMax: cfg.vida,
    velocidade: cfg.velocidade * REGRAS.escalaVelocidade * (cfg === CHEFAO ? 1 : aleatorio(0.9, 1.05)),
    dir: Math.atan2(jogador.pos.x - x, jogador.pos.z - z),
    andar: 0,
    recarga: aleatorio(0.4, 1.0),
    ataqueT: -1,
    acertou: false,
    flash: 0,
    semDano: 0,
    regenT: 0,
    queima: 0,       // segundos de queimadura restantes
    queimaT: 0,
    superT: -1,      // chefão: progresso do SUPER (-1 = parado)
    ataquesFeitos: 0,
    proximoSuper: cfg.super ? Math.floor(aleatorio(cfg.super.ataquesMin, cfg.super.ataquesMax + 1)) : Infinity,
    empurrao: new THREE.Vector3(),
    desvio: cfg === CHEFAO ? 0 : aleatorio(-0.6, 0.6),
    morto: false,
    mortoT: 0,
    raio: cfg.raio,
    barra,
    fill,
  };
  duendes.push(inimigo);
  return inimigo;
}

function surgirNaTrilha(item) {
  const s = Math.max(item.s, progresso + 16);
  const p = pontoNaTrilha(s + (item.cfg === ARQUEIRO ? 6 : 0), 0.8);
  if (!p) return;
  const rig = item.cfg === ARQUEIRO ? criarDuende('arqueiro') : criarDuende();
  const d = criarInimigo(item.cfg, rig, p.x, p.z);
  d.recarga = aleatorio(0.8, 1.8);
  tmp.set(p.x, 0.5, p.z);
  particulas.emitir(tmp, item.cfg === ARQUEIRO ? 0xffc04a : 0x5dff6a, 24, { vel: 3, vida: 0.8, subir: 1.5 });
}

function surgirChefao() {
  const p = mundo.pontoNoCaminho(mundo.comprimento - 9);
  chefao = criarInimigo(CHEFAO, criarChefao(), p.x, p.z);
  chefao.recarga = 1.5;
  // círculo vermelho que mostra onde o golpe vai cair
  chefao.aviso = new THREE.Mesh(
    new THREE.RingGeometry(0.2, CHEFAO.alcance + 0.3, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  chefao.aviso.position.y = 0.03;
  scene.add(chefao.aviso);
  tmp.set(p.x, 1, p.z);
  particulas.emitir(tmp, 0x4cff3a, 80, { vel: 6, vida: 1.4, subir: 2 });
  tremor = 0.6;
  $('boss-name').textContent = CHEFAO.nome;
  $('boss-bar').classList.remove('hidden');
  hud.classList.add('com-chefao');
  atualizarHUD();
  mostrarAviso(`O ${CHEFAO.nome} apareceu!`);
}

function mostrarAviso(texto) {
  const el = $('banner');
  el.textContent = texto;
  el.classList.remove('hidden', 'mostra');
  void el.offsetWidth;
  el.classList.add('mostra');
}

function removerDuende(d) {
  scene.remove(d.rig.root);
  scene.remove(d.barra);
  if (d.aviso) scene.remove(d.aviso);
  d.rig.pele.dispose();
}

/** op: { empurra, interrompe } (padrão true) e `classe` do número de dano. */
function danoDuende(d, dano, origem, op = {}) {
  if (d.morto) return;
  d.hp -= dano;
  d.flash = 0.15;
  if (op.empurra !== false) {
    tmp.subVectors(d.pos, origem).setY(0).normalize().multiplyScalar(7 * d.cfg.empurrao);
    d.empurrao.copy(tmp);
  }
  if (d.cfg.interrompivel && op.interrompe !== false) {
    d.ataqueT = -1; // interrompe o ataque
    d.recarga = Math.max(d.recarga, 0.5);
  }
  tmp.copy(d.pos).setY(d.cfg.alturaAcerto + 0.5);
  numeros.mostrar(tmp, dano, op.classe || 'inimigo');
  if (d === chefao) atualizarHUD();
  if (op.empurra !== false) particulas.emitir(tmp, 0xff4433, 14, { vel: 4, vida: 0.5, gravidade: 9 });
  d.semDano = 0;
  d.regenT = 0;
  if (d.hp <= 0) {
    d.morto = true;
    d.barra.visible = false;
    if (d.aviso) d.aviso.visible = false;
    if (d === chefao) {
      particulas.emitir(tmp, 0x8cff6a, 90, { vel: 6, vida: 1.6, subir: 2 });
      tremor = 0.5;
      // um portal verde se abre onde o chefão caiu
      timerPortal = 2.0;
      localPortal = { x: d.pos.x, z: d.pos.z };
      atualizarHUD();
      return;
    }
    mortos++;
    if (jogador.cls.super.abatesNecessarios) {
      jogador.abatesSuper = Math.min(jogador.cls.super.abatesNecessarios, jogador.abatesSuper + 1);
    }
    particulas.emitir(tmp, 0x8cff6a, 30, { vel: 3.5, vida: 1, subir: 1 });
    atualizarHUD();
  }
}

function atualizarDuendes(dt, t) {
  if (estado === 'jogando' && jogador.vivo) {
    // os duendes vão surgindo à frente conforme o jogador avança pela trilha
    const antes = progresso;
    progresso = Math.max(progresso, mundo.consultar(jogador.pos.x, jogador.pos.z).s);
    while (filaInimigos.length && filaInimigos[0].s <= progresso + REGRAS.distanciaSurgimento) {
      surgirNaTrilha(filaInimigos.shift());
    }
    if (!chefao && progresso >= mundo.comprimento - REGRAS.distanciaChefao) surgirChefao();
    if (Math.floor(antes) !== Math.floor(progresso)) atualizarHUD();
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

    const cfg = d.cfg;
    const visivel = jogadorVisivel();
    const dist = distXZ(d.pos, jogador.pos);
    const alvoAng = Math.atan2(jogador.pos.x - d.pos.x, jogador.pos.z - d.pos.z);
    let movendo = 0;
    d.recarga -= dt;

    if (d.superT >= 0) {
      atualizarSuperChefao(d, dt);
    } else if (cfg.distancia) {
      movendo = comportamentoArqueiro(d, dt, dist, alvoAng);
    } else if (d.ataqueT >= 0) {
      d.ataqueT += dt;
      if (!d.acertou && d.ataqueT >= cfg.preparo) {
        d.acertou = true;
        if (visivel && dist < cfg.alcance + 0.35) {
          danoJogador(calcularDano(pontosDeAtaque(cfg, cfg.atributoAtaque), jogador.cls.defesa), d.pos);
        }
        if (d === chefao) {
          // impacto no chão
          tmp.set(d.pos.x + Math.sin(d.dir) * 1.6, 0.2, d.pos.z + Math.cos(d.dir) * 1.6);
          particulas.emitir(tmp, 0xb59a6a, 40, { vel: 6, vida: 0.8, gravidade: 8, subir: 2 });
          tremor = Math.max(tremor, 0.35);
        }
      }
      if (d.ataqueT >= cfg.duracaoAtaque) d.ataqueT = -1;
    } else if (visivel && cfg.super && d.recarga <= 0 && d.ataquesFeitos >= d.proximoSuper && dist < cfg.super.alcance) {
      // SUPER do chefão: arremesso de pedra
      d.superT = 0;
      d.acertou = false;
      d.ataquesFeitos = 0;
      d.proximoSuper = Math.floor(aleatorio(cfg.super.ataquesMin, cfg.super.ataquesMax + 1));
    } else if (visivel && dist < cfg.alcance && d.recarga <= 0) {
      d.ataqueT = 0;
      d.acertou = false;
      d.ataquesFeitos++;
      d.recarga = cfg.recarga + aleatorio(0, 0.5);
    } else if (visivel && dist > cfg.alcance * 0.8) {
      // persegue o jogador, com um pequeno desvio para cercá-lo
      const ang = alvoAng + d.desvio * Math.min(1, dist / 10);
      d.pos.x += Math.sin(ang) * d.velocidade * dt;
      d.pos.z += Math.cos(ang) * d.velocidade * dt;
      movendo = 1;
    }
    // o chefão não consegue se virar enquanto desce a clava
    const travado = d === chefao && (d.ataqueT >= 0 || d.superT >= CHEFAO.super.lancamento);
    if (visivel && !travado) d.dir = girarPara(d.dir, alvoAng, dt * (d === chefao ? 4 : 10));

    // empurrão ao ser atingido
    d.pos.addScaledVector(d.empurrao, dt);
    d.empurrao.multiplyScalar(Math.exp(-9 * dt));

    // separação entre duendes
    for (const o of duendes) {
      if (o === d || o.morto) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const min = d.raio + o.raio + 0.1;
      if (d2 < min * min && d2 > 1e-6) {
        const k = (min - Math.sqrt(d2)) * (d === chefao ? 0.05 : 0.5) / Math.sqrt(d2);
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
    rig.modo = d.superT >= 0 ? 'pedra' : null;
    const prog = d.superT >= 0 ? d.superT / cfg.super.duracao : d.ataqueT >= 0 ? d.ataqueT / cfg.duracaoAtaque : -1;
    animarRig(rig, dt, t, d.andar, prog);
    if (rig.pedra) rig.pedra.visible = d.superT >= cfg.super.pegar && d.superT < cfg.super.lancamento;

    regenerar(d, dt);

    // pisca ao ser atingido
    d.flash = Math.max(0, d.flash - dt);
    rig.pele.emissive.setRGB(d.flash > 0 ? 1 : 0, d.flash > 0 ? 0.25 : 0, d.flash > 0 ? 0.2 : 0);

    if (d.aviso) {
      const preparando = d.ataqueT >= 0 && d.ataqueT < cfg.preparo;
      d.aviso.position.set(d.pos.x, 0.03, d.pos.z);
      d.aviso.material.opacity = preparando ? 0.15 + (d.ataqueT / cfg.preparo) * 0.45 : 0;
    }
    d.barra.position.set(d.pos.x, 1.65, d.pos.z);
    d.barra.quaternion.copy(camera.quaternion);
    d.fill.scale.x = Math.max(0.001, d.hp / d.hpMax);
    queimar(d, dt);
  }
}

// ------------------------------------------------------------------ Arqueiros
/** Mantém distância do jogador, anda de lado e atira. Retorna 1 se andou. */
function comportamentoArqueiro(d, dt, dist, alvoAng) {
  const cfg = d.cfg;
  if (d.ataqueT >= 0) {
    d.ataqueT += dt;
    if (!d.acertou && d.ataqueT >= cfg.preparo) {
      d.acertou = true;
      if (jogadorVisivel()) dispararFlecha(d);
    }
    if (d.ataqueT >= cfg.duracaoAtaque) d.ataqueT = -1;
    return 0;
  }
  if (!jogadorVisivel()) return 0;
  if (dist <= cfg.alcance && d.recarga <= 0) {
    d.ataqueT = 0;
    d.acertou = false;
    d.recarga = cfg.recarga + aleatorio(0, 0.8);
    return 0;
  }
  let ang, vel = d.velocidade;
  if (dist > cfg.distanciaIdeal + 2) ang = alvoAng; // aproxima
  else if (dist < cfg.distanciaIdeal - 3) ang = alvoAng + Math.PI; // recua
  else {
    ang = alvoAng + (d.desvio >= 0 ? 1 : -1) * Math.PI / 2; // anda de lado
    vel *= 0.45;
  }
  d.pos.x += Math.sin(ang) * vel * dt;
  d.pos.z += Math.cos(ang) * vel * dt;
  return 1;
}

const geoHaste = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 5).rotateX(Math.PI / 2);
const geoPontaFlecha = new THREE.ConeGeometry(0.04, 0.12, 5).rotateX(Math.PI / 2).translate(0, 0, 0.42);
const geoPenaFlecha = new THREE.ConeGeometry(0.05, 0.14, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.33);
const matHaste = new THREE.MeshBasicMaterial({ color: 0x8a6038 });
const matPontaFlecha = new THREE.MeshBasicMaterial({ color: 0xd8e0ea });
const matPenaFlecha = new THREE.MeshBasicMaterial({ color: 0xd2402e });
const matBrilhoFlecha = new THREE.SpriteMaterial({
  map: texturaBrilho('rgba(255,150,60,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8,
});

function dispararFlecha(d) {
  const cfg = d.cfg;
  const malha = new THREE.Group();
  malha.add(new THREE.Mesh(geoHaste, matHaste), new THREE.Mesh(geoPontaFlecha, matPontaFlecha), new THREE.Mesh(geoPenaFlecha, matPenaFlecha));
  const brilho = new THREE.Sprite(matBrilhoFlecha);
  brilho.scale.setScalar(0.6);
  brilho.position.z = 0.4;
  malha.add(brilho);
  malha.position.set(d.pos.x + Math.sin(d.dir) * 0.5, 0.95, d.pos.z + Math.cos(d.dir) * 0.5);
  // mira onde o jogador está agora: dá para desviar andando
  tmp.set(jogador.pos.x, 1.0, jogador.pos.z).sub(malha.position).normalize();
  const vel = tmp.clone().multiplyScalar(cfg.velocidadeFlecha);
  malha.lookAt(tmp.add(malha.position));
  scene.add(malha);
  flechas.push({ malha, vel, cfg, vida: (cfg.alcance + 6) / cfg.velocidadeFlecha });
}

function atualizarFlechas(dt) {
  for (let i = flechas.length - 1; i >= 0; i--) {
    const f = flechas[i];
    f.vida -= dt;
    f.malha.position.addScaledVector(f.vel, dt);
    const pos = f.malha.position;
    particulas.emitir(pos, 0x7a3a12, 1, { vel: 0.2, vida: 0.25 });
    let fim = f.vida <= 0;
    if (!fim && jogador.vivo) {
      tmp2.set(jogador.pos.x, 1.0, jogador.pos.z);
      if (tmp2.distanceTo(pos) < 0.6) {
        tmp.copy(pos).addScaledVector(f.vel, -0.05);
        danoJogador(calcularDano(pontosDeAtaque(f.cfg, f.cfg.atributoAtaque), jogador.cls.defesa), tmp);
        fim = true;
      }
    }
    if (!fim && mundo.colideObstaculo(pos.x, pos.z, 0.05)) {
      particulas.emitir(pos, 0xa07040, 8, { vel: 2, vida: 0.4, gravidade: 6 });
      fim = true;
    }
    if (fim) {
      scene.remove(f.malha);
      flechas.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ SUPER
/** Os inimigos só enxergam o jogador vivo e fora da invisibilidade. */
const jogadorVisivel = () => jogador.vivo && jogador.invisivel <= 0;

function usarSuper() {
  const sup = jogador.cls.super;
  let usou = false;
  if (sup.tipo === 'bolaDeFogo' && jogador.abatesSuper >= sup.abatesNecessarios) {
    jogador.abatesSuper = 0;
    lancarBolaDeFogo();
    usou = true;
  } else if (sup.tipo === 'invisibilidade' && jogador.superRecarga <= 0) {
    jogador.invisivel = sup.duracao;
    jogador.superRecarga = sup.recarga;
    tmp.copy(jogador.pos).setY(1);
    particulas.emitir(tmp, 0x9fb4ff, 40, { vel: 3, vida: 0.7, subir: 0.5 });
    // os inimigos perdem o alvo: ataques em preparação são cancelados
    for (const d of duendes) if (d.ataqueT >= 0 && !d.acertou) d.ataqueT = -1;
    usou = true;
  }
  if (!usou) {
    const b = $('super-btn');
    b.classList.remove('negado');
    void b.offsetWidth;
    b.classList.add('negado');
  }
}

function atualizarBotaoSuper() {
  const sup = jogador.cls.super;
  const b = $('super-btn');
  let carga, rotulo;
  if (sup.tipo === 'bolaDeFogo') {
    carga = jogador.abatesSuper / sup.abatesNecessarios;
    rotulo = carga >= 1 ? 'SUPER' : `${jogador.abatesSuper}/${sup.abatesNecessarios}`;
  } else {
    carga = 1 - Math.max(0, jogador.superRecarga) / sup.recarga;
    rotulo = jogador.invisivel > 0 ? 'ATIVO' : carga >= 1 ? 'SUPER' : `${Math.ceil(jogador.superRecarga)}s`;
  }
  b.style.setProperty('--carga', Math.min(1, carga).toFixed(3));
  b.classList.toggle('pronto', carga >= 1 && jogador.invisivel <= 0);
  b.classList.toggle('ativo', jogador.invisivel > 0);
  const el = $('super-label');
  if (el.textContent !== rotulo) el.textContent = rotulo;
}

// Invisibilidade: o assassino recebe materiais próprios para poder ficar translúcido.
// Ele continua visível para o jogador, como um vulto azulado com contorno claro.
const contornoTranslucido = criarContornoTranslucido();
function prepararTransparencia(rig) {
  rig.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.contorno) {
      o.userData.matOriginal = o.material;
      return;
    }
    o.material = o.material.clone();
    if (o.material.emissive) o.userData.emissivoOriginal = o.material.emissive.clone();
  });
}
const brilhoInvisivel = new THREE.Color(0x2a4a8a);
function definirOpacidade(rig, a) {
  const translucido = a < 1;
  contornoTranslucido.opacity = a * 0.9;
  rig.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.contorno) {
      o.material = translucido ? contornoTranslucido : o.userData.matOriginal;
      return;
    }
    o.material.transparent = translucido;
    o.material.opacity = a;
    o.material.depthWrite = !translucido;
    if (o.userData.emissivoOriginal) {
      o.material.emissive.copy(translucido ? brilhoInvisivel : o.userData.emissivoOriginal);
    }
  });
}

const geoBolaFogo = new THREE.SphereGeometry(0.28, 14, 12);
const matBolaFogo = new THREE.MeshBasicMaterial({ color: 0xffd27a });
const matBrilhoFogo = new THREE.SpriteMaterial({
  map: texturaBrilho('rgba(255,120,30,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});

function inimigoMaisProximoDe(pos, maxDist) {
  let melhor = null, md = maxDist;
  for (const d of duendes) {
    if (d.morto) continue;
    const dd = distXZ(d.pos, pos);
    if (dd < md) {
      md = dd;
      melhor = d;
    }
  }
  return melhor;
}

function lancarBolaDeFogo() {
  const sup = jogador.cls.super;
  const alvo = inimigoMaisProximoDe(jogador.pos, sup.busca);
  if (alvo) jogador.dir = Math.atan2(alvo.pos.x - jogador.pos.x, alvo.pos.z - jogador.pos.z);
  // usa a animação do ataque normal, sem disparar o orbe comum
  jogador.ataqueT = 0;
  jogador.acertou = true;
  jogador.recarga = jogador.cls.ataque.recarga;
  const malha = new THREE.Mesh(geoBolaFogo, matBolaFogo);
  const brilho = new THREE.Sprite(matBrilhoFogo);
  brilho.scale.setScalar(2.6);
  malha.add(brilho);
  jogador.rig.orbe.getWorldPosition(malha.position);
  malha.position.y += 0.3;
  scene.add(malha);
  const vel = new THREE.Vector3(Math.sin(jogador.dir), 0.25, Math.cos(jogador.dir)).normalize().multiplyScalar(sup.velocidade);
  bolasDeFogo.push({ malha, vel, alvo, vida: 6 });
  particulas.emitir(malha.position, 0xff8a2a, 40, { vel: 4, vida: 0.6 });
  tremor = Math.max(tremor, 0.15);
}

function atualizarBolasDeFogo(dt, t) {
  const sup = CLASSES.maga.super;
  for (let i = bolasDeFogo.length - 1; i >= 0; i--) {
    const b = bolasDeFogo[i];
    b.vida -= dt;
    // se o alvo morreu, procura outro
    if (!b.alvo || b.alvo.morto) b.alvo = inimigoMaisProximoDe(b.malha.position, sup.busca);
    if (b.alvo) {
      tmp.set(b.alvo.pos.x, b.alvo.cfg.alturaAcerto, b.alvo.pos.z).sub(b.malha.position).normalize().multiplyScalar(sup.velocidade);
      b.vel.lerp(tmp, Math.min(1, dt * 5));
    }
    b.malha.position.addScaledVector(b.vel, dt);
    b.malha.children[0].scale.setScalar(2.4 + Math.sin(t * 30) * 0.3);
    particulas.emitir(b.malha.position, Math.random() < 0.5 ? 0xff6a1a : 0xffc04a, 4, { vel: 1.2, vida: 0.45, subir: 1 });
    let acabou = b.vida <= 0;
    if (b.alvo) {
      tmp2.set(b.alvo.pos.x, b.alvo.cfg.alturaAcerto, b.alvo.pos.z);
      if (tmp2.distanceTo(b.malha.position) < b.alvo.raio + 0.45) {
        const ataque = pontosDeAtaque(jogador.cls, jogador.cls.ataque.atributo) * sup.multiplicador;
        const alvo = b.alvo;
        danoDuende(alvo, calcularDano(ataque, alvo.cfg.defesa), b.malha.position);
        if (!alvo.morto) {
          alvo.queima = sup.queimaDuracao;
          alvo.queimaT = 0;
        }
        acabou = true;
      }
    }
    if (acabou) {
      particulas.emitir(b.malha.position, 0xff7a20, 60, { vel: 6, vida: 0.8, subir: 1 });
      particulas.emitir(b.malha.position, 0xffe08a, 25, { vel: 3, vida: 0.5 });
      scene.remove(b.malha);
      bolasDeFogo.splice(i, 1);
    }
  }
}

/** Queimadura: 3 de vida por segundo, ignora a defesa. */
function queimar(d, dt) {
  if (d.queima <= 0 || d.morto) return;
  if (Math.random() < 0.6) {
    tmp.set(d.pos.x + aleatorio(-0.3, 0.3), aleatorio(0.3, d.cfg.alturaAcerto + 0.6), d.pos.z + aleatorio(-0.3, 0.3));
    particulas.emitir(tmp, Math.random() < 0.5 ? 0xff5a10 : 0xffb030, 1, { vel: 0.5, vida: 0.6, subir: 1.6 });
  }
  d.queimaT += dt;
  while (d.queimaT >= 1 && d.queima > 0 && !d.morto) {
    d.queimaT -= 1;
    d.queima -= 1;
    danoDuende(d, CLASSES.maga.super.queimaDano, d.pos, { empurra: false, interrompe: false, classe: 'queima' });
  }
}

// SUPER do chefão: pega uma pedra do chão e arremessa no jogador
const geoPedraArremesso = new THREE.DodecahedronGeometry(0.47, 0);
const matPedraArremesso = new THREE.MeshStandardMaterial({ color: 0x6b6f78, roughness: 0.9, flatShading: true });

function atualizarSuperChefao(d, dt) {
  const sup = d.cfg.super;
  const antes = d.superT;
  d.superT += dt;
  if (antes < sup.pegar && d.superT >= sup.pegar) {
    // arranca a pedra do chão
    tmp.set(d.pos.x + Math.sin(d.dir) * 1.0, 0.2, d.pos.z + Math.cos(d.dir) * 1.0);
    particulas.emitir(tmp, 0x8a7458, 30, { vel: 3, vida: 0.7, gravidade: 8, subir: 2 });
  }
  if (antes < sup.lancamento && d.superT >= sup.lancamento) arremessarPedra(d);
  if (d.superT >= sup.duracao) {
    d.superT = -1;
    d.recarga = 1.2;
  }
}

function arremessarPedra(d) {
  const sup = d.cfg.super;
  const malha = new THREE.Mesh(geoPedraArremesso, matPedraArremesso);
  malha.castShadow = true;
  d.rig.pedra.getWorldPosition(malha.position);
  // mira onde o jogador está agora; um círculo no chão mostra onde a pedra vai cair
  const alvo = new THREE.Vector3(jogador.pos.x, 0, jogador.pos.z);
  const voo = THREE.MathUtils.clamp(distXZ(malha.position, alvo) / 13, 0.7, 1.4);
  const g = 22;
  const vel = new THREE.Vector3(
    (alvo.x - malha.position.x) / voo,
    (alvo.y - malha.position.y) / voo + 0.5 * g * voo,
    (alvo.z - malha.position.z) / voo
  );
  const aviso = new THREE.Mesh(
    new THREE.RingGeometry(sup.raioImpacto - 0.25, sup.raioImpacto, 36).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff4a1a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  aviso.position.set(alvo.x, 0.04, alvo.z);
  scene.add(malha, aviso);
  pedras.push({ malha, vel, g, alvo, aviso, t: 0, voo, dano: sup.dano, raio: sup.raioImpacto });
}

function atualizarPedras(dt) {
  for (let i = pedras.length - 1; i >= 0; i--) {
    const p = pedras[i];
    p.t += dt;
    p.vel.y -= p.g * dt;
    p.malha.position.addScaledVector(p.vel, dt);
    p.malha.rotation.x += dt * 6;
    p.malha.rotation.z += dt * 4;
    p.aviso.material.opacity = 0.35 + 0.35 * Math.sin(p.t * 20);
    if (p.t >= p.voo) {
      tmp.copy(p.alvo).setY(0.3);
      particulas.emitir(tmp, 0x9a8466, 60, { vel: 7, vida: 0.9, gravidade: 10, subir: 3 });
      tremor = Math.max(tremor, 0.45);
      if (jogador.vivo && distXZ(jogador.pos, p.alvo) < p.raio + jogador.raio) danoJogador(p.dano, p.alvo);
      scene.remove(p.malha, p.aviso);
      p.aviso.geometry.dispose();
      p.aviso.material.dispose();
      pedras.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ Regeneração
/** Depois de 5 s sem tomar dano, recupera 3% da vida máxima (arredondado para cima) por segundo. */
function regenerar(ent, dt) {
  ent.semDano += dt;
  if (ent.semDano < REGRAS.regeneracaoEspera || ent.hp >= ent.hpMax) {
    ent.regenT = 0;
    return;
  }
  ent.regenT += dt;
  while (ent.regenT >= 1) {
    ent.regenT -= 1;
    const ganho = Math.min(vidaPorSegundo(ent.hpMax), ent.hpMax - ent.hp);
    ent.hp += ganho;
    if (ent === jogador || ent === heroi) {
      tmp.copy(ent.pos).setY(2.0);
      numeros.mostrar(tmp, `+${ganho}`, 'cura');
      particulas.emitir(tmp.setY(1.0), 0x6aff8a, 6, { vel: 1, vida: 0.7, subir: 1.2 });
    }
    if (ent === jogador || ent === chefao) atualizarHUD();
    if (ent === heroi) atualizarHUDHeroi();
  }
}

// ------------------------------------------------------------------ Jogador
/** Move com o joystick/teclado relativo à câmera. Retorna a intensidade do movimento (0 a 1). */
function moverPelaCamera(ent, vel, dt, girar = true) {
  const m = input.movimento();
  const mag = Math.min(1, Math.hypot(m.x, m.y));
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const mx = cy * m.x - sy * m.y;
  const mz = -sy * m.x - cy * m.y;
  // acelera e freia em vez de começar e parar de uma vez
  ent.vx ??= 0;
  ent.vz ??= 0;
  const k = 1 - Math.exp(-dt * (mag > 0.01 ? 9 : 13));
  ent.vx += (mx * vel - ent.vx) * k;
  ent.vz += (mz * vel - ent.vz) * k;
  ent.pos.x += ent.vx * dt;
  ent.pos.z += ent.vz * dt;
  if (girar && mag > 0.01) ent.dir = girarPara(ent.dir, Math.atan2(mx, mz), dt * 11);
  return vel > 0 ? Math.min(1, Math.hypot(ent.vx, ent.vz) / vel) : 0;
}

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
    danoDuende(d, calcularDano(pontosDeAtaque(jogador.cls, atk.atributo), d.cfg.defesa), jogador.pos);
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
      tmp.set(p.alvo.pos.x, p.alvo.cfg.alturaAcerto, p.alvo.pos.z).sub(p.malha.position).normalize().multiplyScalar(atk.velocidadeProjetil);
      p.vel.lerp(tmp, Math.min(1, dt * 8));
    } else {
      p.vel.y += (0.9 - p.malha.position.y) * dt * 4;
    }
    p.malha.position.addScaledVector(p.vel, dt);
    particulas.emitir(p.malha.position, 0x3aa0ff, 2, { vel: 0.6, vida: 0.35 });

    let explodiu = p.vida <= 0;
    for (const d of duendes) {
      if (d.morto) continue;
      tmp2.set(d.pos.x, d.cfg.alturaAcerto, d.pos.z);
      if (tmp2.distanceTo(p.malha.position) < d.raio + 0.35) {
        danoDuende(d, calcularDano(pontosDeAtaque(jogador.cls, atk.atributo), d.cfg.defesa), p.malha.position);
        explodiu = true;
        break;
      }
    }
    if (!explodiu && mundo.colideObstaculo(p.malha.position.x, p.malha.position.z, 0.15)) explodiu = true; // bateu numa árvore
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
  jogador.semDano = 0;
  jogador.regenT = 0;
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
  j.superRecarga = Math.max(0, j.superRecarga - dt);
  if (j.invisivel > 0) {
    j.invisivel = Math.max(0, j.invisivel - dt);
    definirOpacidade(rig, j.invisivel > 0 ? 0.38 + Math.sin(t * 10) * 0.06 : 1);
  }
  if (estado === 'jogando' && j.vivo && input.consumirSuper()) usarSuper();
  atualizarBotaoSuper();

  if (j.vivo) regenerar(j, dt);
  if (!j.vivo) {
    j.mortoT += dt;
    rig.root.rotation.x = Math.max(-Math.PI / 2, rig.root.rotation.x - dt * 4);
    animarRig(rig, dt, t, 0);
    return;
  }

  const atacando = j.ataqueT >= 0;
  const mag = estado === 'jogando' ? moverPelaCamera(j, j.velocidade * (atacando ? 0.5 : 1), dt, !atacando) : 0;
  mundo.resolverColisao(j.pos, j.raio);
  j.andar += (mag - j.andar) * Math.min(1, dt * 10);

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
  if (estado === 'criacao') {
    cameraCriacao(dt);
    return;
  }

  const olhar = input.consumirOlhar(dt);
  cam.yaw -= olhar.dx * 0.006;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + olhar.dy * 0.004, 0.08, 1.2);

  let foco = heroi && (estado === 'aventura' || estado === 'portal') ? heroi.pos : jogador.pos;
  // na conversa, a câmera chega mais perto e gira de lado para mostrar os dois rostos
  const k = Math.min(1, dt * 2.5);
  cam.zoom = (cam.zoom ?? 1) + ((conversa?.com ? 0.62 : 1) - (cam.zoom ?? 1)) * k;
  if (conversa?.com) {
    const c = conversa.com;
    const alvoYaw = Math.atan2(heroi.pos.x - c.x, heroi.pos.z - c.z) + 1.15;
    cam.yaw += difAngulo(cam.yaw, alvoYaw) * k;
    cam.pitch += (0.16 - cam.pitch) * k;
    foco = tmp2.set((heroi.pos.x + c.x) / 2, 0, (heroi.pos.z + c.z) / 2);
  }
  alvoCam.set(foco.x, 1.3 - (1 - (cam.zoom ?? 1)) * 0.6, foco.z);
  let dist = cam.dist * (cam.zoom ?? 1);
  // nos corredores do labirinto a câmera fica mais alta, olhando por cima das paredes
  const alvoPitch = heroi && mapa === castelo ? castelo.pitchMinimo(heroi.pos.z) : 0.08;
  cam.minPitch = (cam.minPitch ?? 0.08) + (alvoPitch - (cam.minPitch ?? 0.08)) * Math.min(1, dt * 3);
  if (cam.pitch < cam.minPitch) cam.pitch = cam.minPitch;
  // dentro do castelo (passagem, labirinto e sala) a câmera também desce suave quando dá
  if (heroi && mapa === castelo && heroi.pos.z < -44 && cam.pitch > cam.minPitch) cam.pitch += (cam.minPitch - cam.pitch) * Math.min(1, dt * 1.5);
  // se uma parede ficar entre a câmera e o herói, a câmera chega mais perto
  if (heroi && mapa?.colide && (estado === 'aventura' || estado === 'portal')) {
    const sp = Math.sin(cam.yaw) * Math.cos(cam.pitch), cpz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
    for (let d = 0.8; d < dist; d += 0.35) {
      const y = alvoCam.y + Math.sin(cam.pitch) * d;
      if (y < 4 && mapa.colide(alvoCam.x + sp * d, alvoCam.z + cpz * d, 0.2)) {
        dist = Math.max(1.2, d - 0.4);
        break;
      }
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    alvoCam.x + Math.sin(cam.yaw) * cp * dist,
    alvoCam.y + Math.sin(cam.pitch) * dist,
    alvoCam.z + Math.cos(cam.yaw) * cp * dist
  );
  if (tremor > 0) {
    tremor = Math.max(0, tremor - dt);
    const f = tremor * 0.5;
    camera.position.x += (Math.random() - 0.5) * f;
    camera.position.y += (Math.random() - 0.5) * f;
  }
  camera.lookAt(alvoCam);
}

// ------------------------------------------------------------------ Portal
function abrirPortal() {
  const { x, z } = localPortal;
  // de frente para o jogador
  portal = criarPortal(scene, x, z, Math.atan2(jogador.pos.x - x, jogador.pos.z - z));
  tmp.set(x, 1.5, z);
  particulas.emitir(tmp, 0x7dff6a, 90, { vel: 7, vida: 1.2, subir: 1 });
  tremor = Math.max(tremor, 0.4);
  mostrarAviso('Um portal se abriu! Atravesse-o.');
}

function atualizarPortal(dt) {
  if (timerPortal > 0) {
    timerPortal -= dt;
    if (timerPortal <= 0) abrirPortal();
  }
  if (!portal) return;
  portal.atualizar(dt, particulas);
  if (estado === 'jogando' && jogador.vivo && portal.abertura >= 1 && distXZ(jogador.pos, portal) < 1.1) {
    entrarNoPortal();
  }
  if (estado === 'portal') {
    // o portal puxa o jogador para dentro
    const k = Math.min(1, dt * 4);
    jogador.pos.x += (portal.x - jogador.pos.x) * k;
    jogador.pos.z += (portal.z - jogador.pos.z) * k;
    jogador.rig.root.scale.multiplyScalar(Math.exp(-dt * 2.5));
  }
}

function entrarNoPortal() {
  estado = 'portal';
  jogador.invul = Infinity;
  controles.classList.add('hidden');
  hud.classList.add('hidden');
  input.reiniciar();
  tmp.copy(jogador.pos).setY(1.2);
  particulas.emitir(tmp, 0xd8ffb0, 60, { vel: 5, vida: 0.9, subir: 1 });
  transicao(mostrarCriacao);
}

/** Escurece a tela com um clarão verde, executa `meio` e clareia de novo. */
function transicao(meio) {
  const fade = $('fade');
  fade.classList.add('ativo');
  setTimeout(() => {
    meio();
    setTimeout(() => fade.classList.remove('ativo'), 150);
  }, 950);
}

// ------------------------------------------------------------------ Criação do personagem
const ETAPAS = ['Aparência', 'Roupa', 'Presente'];
let etapa = 0;
let escolha = { genero: null, aparencia: null, roupa: null, item: null };
let previa = null;
const giro = { angulo: 0.3, vel: 0 };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** Ícones dos presentes (o escudo é pintado com a cor da roupa escolhida). */
function iconePresente(id) {
  if (id === 'espada') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M47 6 L58 6 L58 17 L27 48 L16 37 Z" fill="#e2e8f2" stroke="#5a6478" stroke-width="2" stroke-linejoin="round"/>
      <path d="M53 11 L24 40" stroke="#9aa6b8" stroke-width="2"/>
      <path d="M11 33 L31 53" stroke="#d9a93e" stroke-width="6" stroke-linecap="round"/>
      <path d="M19 45 L10 54" stroke="#6b4423" stroke-width="6" stroke-linecap="round"/>
      <circle cx="8" cy="56" r="4.5" fill="#d9a93e"/></svg>`;
  }
  if (id === 'vara') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M9 57 L55 7" stroke="#7a5230" stroke-width="6" stroke-linecap="round"/>
      <path d="M26 38.5 L33.5 30.5" stroke="#5a3a20" stroke-width="9"/>
      <path d="M50.5 12 L56 6" stroke="#c8d2e0" stroke-width="7"/>
      <path d="M8 58 L12 54" stroke="#c8d2e0" stroke-width="7"/>
      <circle cx="18" cy="47" r="2.8" fill="#5a3a20"/><circle cx="43" cy="20" r="2.8" fill="#5a3a20"/></svg>`;
  }
  if (id === 'espadaDuendeira') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M47 6 L58 6 L58 17 L54 18 L52 22 L48 23 L46 27 L42 28 L40 32 L36 33 L34 37 L27 48 L16 37 L27 30 L28 26 L32 24 L33 20 L37 18 L38 14 L42 12 L43 8 Z" fill="#9adf7a" stroke="#2f6a20" stroke-width="2" stroke-linejoin="round"/>
      <path d="M11 33 L31 53" stroke="#3a6a2a" stroke-width="6" stroke-linecap="round"/>
      <path d="M19 45 L10 54" stroke="#2a1a10" stroke-width="6" stroke-linecap="round"/>
      <circle cx="8" cy="56" r="4.5" fill="#6aff4a"/></svg>`;
  }
  if (id === 'feiticoDuendes') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="14" fill="#a8ff6a" stroke="#3ad02a" stroke-width="3"/>
      <ellipse cx="32" cy="32" rx="25" ry="9" fill="none" stroke="#7dff4a" stroke-width="2.5" transform="rotate(-25 32 32)"/>
      <ellipse cx="32" cy="32" rx="25" ry="9" fill="none" stroke="#7dff4a" stroke-width="2.5" transform="rotate(35 32 32)"/>
      <circle cx="27" cy="27" r="4" fill="#ffffff" opacity="0.7"/></svg>`;
  }
  if (id === 'gorroGnomos') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 50 C16 34 22 20 32 12 C40 8 50 12 52 22 C46 18 40 20 38 28 C40 36 46 44 50 50 Z" fill="#d02a26" stroke="#7a1010" stroke-width="2" stroke-linejoin="round"/>
      <rect x="10" y="48" width="44" height="8" rx="4" fill="#b81e1c" stroke="#7a1010" stroke-width="2"/>
      <circle cx="52" cy="24" r="5" fill="#f6f4ee"/></svg>`;
  }
  if (id === 'escudoDuendeiro') {
    // escudo verde com espinhos e uma pedra brilhante
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="#8a9a5a">${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M32 3 L36 10 L28 10 Z" transform="rotate(${a + 30} 32 32)"/>`).join('')}</g>
      <circle cx="32" cy="32" r="23" fill="#3f8a2a"/>
      <rect x="27.5" y="9" width="9" height="46" fill="#1f4a14"/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="#8a9a5a" stroke-width="4"/>
      <path d="M32 24 L39 32 L32 40 L25 32 Z" fill="#9dff6a" stroke="#3ad02a" stroke-width="1.5"/></svg>`;
  }
  const cor = escolha.roupa ? hex(escolha.roupa.principal) : '#8a5a30';
  const faixa = escolha.roupa ? hex(escolha.roupa.detalhe) : '#c8b48a';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <clipPath id="disco-escudo"><circle cx="32" cy="32" r="24"/></clipPath>
    <circle cx="32" cy="32" r="24" fill="${cor}"/>
    <rect x="27" y="6" width="10" height="52" fill="${faixa}" clip-path="url(#disco-escudo)"/>
    <circle cx="32" cy="32" r="25" fill="none" stroke="#9aa6b8" stroke-width="4"/>
    <circle cx="32" cy="32" r="7" fill="#c8d2e0" stroke="#5a6478" stroke-width="1.5"/></svg>`;
}

function mostrarCriacao() {
  limparPartida();
  removerPreview();
  estado = 'criacao';
  etapa = 0;
  escolha = { genero: null, aparencia: null, roupa: null, item: null };
  giro.angulo = 0.3;
  giro.vel = 0;
  trocarCena(estudio.scene);
  hud.classList.add('hidden');
  controles.classList.add('hidden');
  telaFim.classList.add('hidden');
  telaSelecao.classList.add('hidden');
  telaCriacao.classList.remove('hidden');
  montarEtapa();
  atualizarModeloPrevia();
  camera.position.set(0, 1.5, 6);
}

/** Opções obrigatórias de cada etapa. */
function etapaCompleta() {
  if (etapa === 0) return !!(escolha.genero && escolha.aparencia);
  if (etapa === 1) return !!escolha.roupa;
  return !!escolha.item;
}

function botaoOpcao(campo, valor, selecionada, conteudo) {
  return `<button class="opcao${selecionada ? ' selecionada' : ''}" data-campo="${campo}" data-valor="${valor}" aria-pressed="${selecionada}">${conteudo}</button>`;
}

function montarEtapa() {
  const corpo = $('create-body');
  const rolagem = corpo.scrollTop;
  const menina = escolha.genero === 'menina';
  let html = '';
  if (etapa === 0) {
    html += '<h2 class="criacao-pergunta">Menino ou menina?</h2><div class="opcoes opcoes-2">';
    for (const g of GENEROS) {
      html += botaoOpcao('genero', g.id, escolha.genero === g.id, `<span class="opcao-nome">${g.nome}</span>`);
    }
    // só as cores de pele, cabelo e olhos; o nome fica apenas para leitores de tela
    html += '</div><h2 class="criacao-pergunta">Aparência</h2><div class="opcoes opcoes-3 opcoes-cores">';
    for (const a of APARENCIAS) {
      const nome = a.nome[menina ? 1 : 0];
      html += botaoOpcao('aparencia', a.id, escolha.aparencia === a, `
        <span class="amostras" role="img" aria-label="${nome}">
          <i style="background:${hex(a.pele)}"></i><i style="background:${hex(a.cabelo)}"></i><i style="background:${hex(a.olhos)}"></i>
        </span>`);
    }
    html += '</div>';
  } else if (etapa === 1) {
    html += '<h2 class="criacao-pergunta">Escolha a roupa</h2><div class="opcoes opcoes-1">';
    for (const r of ROUPAS) {
      html += botaoOpcao('roupa', r.id, escolha.roupa === r, `
        <span class="amostra-roupa" style="--a:${hex(r.principal)};--b:${hex(r.detalhe)}" aria-hidden="true"></span>
        <span class="opcao-nome">${r.nome} <small>com ${r.detalhes}</small></span>`);
    }
    html += '</div>';
  } else {
    html += '<h2 class="criacao-pergunta">Escolha um presente</h2><div class="opcoes opcoes-3">';
    for (const p of PRESENTES) {
      html += botaoOpcao('item', p.id, escolha.item === p.id, `
        <span class="icone-presente">${iconePresente(p.id)}</span>
        <span class="opcao-nome">${p.nome}<small>${textoBonus(p.bonus)}</small></span>`);
    }
    html += '</div>';
  }
  corpo.innerHTML = html;
  corpo.scrollTop = rolagem;

  $('create-steps').innerHTML = ETAPAS.map((nome, i) =>
    `<li class="${i === etapa ? 'atual' : i < etapa ? 'feita' : ''}"><span>${i < etapa ? '✓' : i + 1}</span>${nome}</li>`).join('');
  $('create-back').classList.toggle('invisivel', etapa === 0);
  const prox = $('create-next');
  prox.textContent = etapa < ETAPAS.length - 1 ? 'Próximo' : 'Entrar no Vilarejo';
  prox.disabled = !etapaCompleta();
}

function escolher(campo, valor) {
  if (campo === 'genero') escolha.genero = valor;
  else if (campo === 'aparencia') escolha.aparencia = APARENCIAS.find((a) => a.id === valor);
  else if (campo === 'roupa') escolha.roupa = ROUPAS.find((r) => r.id === valor);
  else if (campo === 'item') escolha.item = valor;
  montarEtapa();
  atualizarModeloPrevia();
  tmp.set(0, estudio.alturaPedestal + 1.1, 0);
  particulas.emitir(tmp, 0x9dff8a, 40, { vel: 2.5, vida: 0.8, subir: 0.6 });
}

$('create-body').addEventListener('click', (e) => {
  const b = e.target.closest('[data-campo]');
  if (b) escolher(b.dataset.campo, b.dataset.valor);
});
$('create-back').addEventListener('click', () => {
  if (etapa === 0) return;
  etapa--;
  montarEtapa();
});
$('create-next').addEventListener('click', () => {
  if (!etapaCompleta()) return;
  if (etapa < ETAPAS.length - 1) {
    etapa++;
    $('create-body').scrollTop = 0;
    montarEtapa();
  } else {
    $('create-next').disabled = true;
    transicao(mostrarVilarejo);
  }
});

/** Prévia no pedestal: até a escolha, usa um menino de roupa de linho. */
function atualizarModeloPrevia() {
  removerPrevia();
  previa = criarHeroi({
    genero: escolha.genero || 'menino',
    aparencia: escolha.aparencia || APARENCIAS[4],
    roupa: escolha.roupa || ROUPA_SIMPLES,
    item: escolha.item,
  });
  previa.root.position.y = estudio.alturaPedestal;
  previa.root.rotation.y = giro.angulo;
  estudio.scene.add(previa.root);
}

function removerPrevia() {
  if (!previa) return;
  estudio.scene.remove(previa.root);
  descartarRig(previa);
  previa = null;
}

function atualizarPrevia(dt, t) {
  // arrastar gira o personagem; solto, ele volta devagar a olhar para a câmera
  const olhar = input.consumirOlhar(dt);
  if (olhar.dx) giro.vel = olhar.dx * 0.012 / Math.max(dt, 1 / 120);
  giro.angulo += giro.vel * dt;
  giro.vel *= Math.exp(-dt * 6);
  if (Math.abs(giro.vel) < 0.2) giro.angulo += difAngulo(giro.angulo, 0.3 + Math.sin(t * 0.6) * 0.25) * Math.min(1, dt * 1.5);
  if (!previa) return;
  previa.root.rotation.y = giro.angulo;
  animarRig(previa, dt, t, 0);
}

/** A câmera enquadra o pedestal na parte da tela que o painel não cobre. */
function cameraCriacao(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  const painel = document.querySelector('.criacao-painel').getBoundingClientRect();
  const empe = w < h;
  // em pé o painel fica embaixo; deitado, à direita
  const livreX = empe ? w : Math.max(w * 0.4, painel.left);
  const livreY = empe ? Math.max(h * 0.35, painel.top) : h;
  camera.setViewOffset(w, h, (w - livreX) / 2, (h - livreY) / 2, w, h);
  const fracao = livreY / h;
  const dist = THREE.MathUtils.clamp(3.2 / (0.8 * fracao * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))), 4, 11);
  camera.position.lerp(tmp.set(0, 1.75, dist), Math.min(1, dt * 4));
  camera.lookAt(0, 1.2, 0);
}

// ------------------------------------------------------------------ Aventura (vilarejo e castelo)
// Depois da criação, o herói anda por "mapas": o vilarejo e o castelo dos duendes.
// Cada mapa tem os seus personagens (gnomos ou duendes) e os seus portais.
let povo = null;             // gnomos do vilarejo
let castelo = null;          // mapa do castelo dos duendes
let duendesCastelo = null;   // inimigos do castelo
let mapa = null;             // mapa onde o herói está
let inimigos = null;         // personagens do mapa atual (gnomos ou duendes)
let portais = [];            // { portal, mapa, destino }
let missaoAceita = false;    // o herói aceitou ajudar os gnomos
let princesaDerrotada = false; // a Princesa Duendete foi derrotada
let bauAberto = false;       // o baú do labirinto já foi aberto
let gorroEntregue = false;   // o Rei Gnomo já deu o Gorro dos Gnomos
let aguas = [];              // jatos de água da vara
let pausado = false;         // o jogo para enquanto o jogador escolhe a melhoria de nível
let niveisPendentes = 0;     // níveis ganhos que ainda esperam uma escolha

const POSICAO_PORTAL_VILA = { x: -3, z: -29 }; // no fundo da vila, perto do moinho

function contexto(scene, extra) {
  return {
    scene,
    particulas,
    numeros,
    camera,
    heroi: () => heroi,
    heroiVisivel: () => !!heroi && heroi.vivo && !conversa,
    danoHeroi,
    envenenar,
    tremor: (v) => { tremor = Math.max(tremor, v); },
    ...extra,
  };
}

function prepararVilarejo() {
  if (vilarejo) return;
  vilarejo = criarVilarejo();
  vilarejo.orbes = criarOrbes({ scene: vilarejo.scene, particulas, coletar: ganharXP });
  povo = criarPovoGnomo(contexto(vilarejo.scene, {
    vilarejo,
    aoMorrer: (g) => soltarXP(vilarejo, g.pos, g.rei ? XP.porRei : XP.porGnomo),
  }));
  povo.reiniciar();
}

function prepararCastelo() {
  if (castelo) return;
  castelo = criarCastelo();
  castelo.orbes = criarOrbes({ scene: castelo.scene, particulas, coletar: ganharXP });
  duendesCastelo = criarDuendesCastelo(contexto(castelo.scene, {
    mapa: castelo,
    aoMorrer(d) {
      if (d.cfg === DUENDE_FRACO) soltarXP(castelo, d.pos, XP.porDuende);
      else if (d.cfg === ARQUEIRO_CASTELO) soltarXP(castelo, d.pos, XP.porArqueiro);
      else if (d.cfg === DUENDE_MAGICO) soltarXP(castelo, d.pos, XP.porMagico);
      else if (d.cfg === PRINCESA) derrotouPrincesa(d);
    },
    aoFerirPrincesa: (d) => mostrarBarraPrincesa(d),
    // antes de morrer, a princesa ainda diz as últimas palavras
    aoPrincesaCaindo: (d) => iniciarConversa(CONVERSA_PRINCESA_MORTE, {
      nome: PRINCESA.nome,
      com: d.pos,
      expressar: (pose) => { d.pose = pose; },
      aoTerminar: () => duendesCastelo.finalizarPrincesa(),
    }),
  }));
  duendesCastelo.reiniciar();
}

function mostrarVilarejo() {
  prepararVilarejo();
  removerPrevia();
  removerHeroi();
  camera.clearViewOffset();
  heroi = {
    rig: null,
    escolha: { ...escolha },
    pos: null,
    dir: vilarejo.inicio.dir,
    andar: 0,
    raio: 0.4,
    recarga: 0,
    ataqueT: -1,
    acertou: false,
    // o presente começa equipado; o herói pode segurar até dois itens
    // o presente começa equipado (escudo na mão esquerda, armas na direita)
    inventario: [escolha.item],
    equipamento: { cabeca: null, colar: null, dorso: null, maoD: null, maoE: null, calcas: null, pes: null,
      [escolha.item === 'escudo' ? 'maoE' : 'maoD']: escolha.item },
    vivo: true,
    mortoT: 0,
    invul: 0,
    semDano: 0,
    regenT: 0,
    veneno: null,
    nivel: 1,
    xp: 0,
    bonusNivel: {}, // pontos ganhos ao subir de nível
  };
  aplicarAtributos();
  heroi.hp = heroi.hpMax;
  montarPainelAtributos();
  telaCriacao.classList.add('hidden');
  hud.classList.add('modo-vilarejo');
  hud.classList.remove('hidden', 'com-chefao');
  controles.classList.add('sem-super');
  $('stats-panel').classList.add('hidden');
  $('bag-panel').classList.add('hidden');
  $('hud-name').textContent = 'Herói';
  entrarNoMapa('vilarejo', vilarejo.inicio);
  mostrarAviso('Bem-vindo ao Vilarejo!');
}

/** Solta orbes de XP no mapa (no máximo 6 orbes; o valor é dividido entre eles). */
function soltarXP(m, pos, total) {
  const n = Math.min(total, 6);
  for (let i = 0; i < n; i++) {
    const valor = Math.floor(total / n) + (i < total % n ? 1 : 0);
    m.orbes.soltar(pos.x + (Math.random() - 0.5) * 0.6, pos.z + (Math.random() - 0.5) * 0.6, valor);
  }
}

// ------------------------------------------------------------------ Princesa Duendete
function mostrarBarraPrincesa(d) {
  $('boss-name').textContent = PRINCESA.nome;
  $('boss-fill').style.width = `${Math.max(0, d.hp / d.hpMax) * 100}%`;
  $('boss-bar').classList.remove('hidden');
  hud.classList.add('com-chefao', 'com-princesa');
}

function derrotouPrincesa(d) {
  princesaDerrotada = true;
  soltarXP(castelo, d.pos, XP.porPrincesa);
  $('boss-fill').style.width = '0%';
  setTimeout(() => {
    $('boss-bar').classList.add('hidden');
    hud.classList.remove('com-chefao', 'com-princesa');
  }, 1500);
  // um portal azul-claro aparece e leva de volta à vila dos gnomos
  const { x, z } = castelo.centroSala;
  portais.push({ portal: criarPortal(castelo.scene, x, z, 0, { cor: 'azul' }), mapa: castelo, destino: voltarComVitoria });
  tremor = Math.max(tremor, 0.4);
}

/** Coloca o herói num mapa ('vilarejo' ou 'castelo') no ponto indicado. */
function entrarNoMapa(nome, { x, z, dir }) {
  if (nome === 'castelo') prepararCastelo();
  mapa = nome === 'castelo' ? castelo : vilarejo;
  inimigos = nome === 'castelo' ? duendesCastelo : povo;
  mapa.nome = nome;
  heroi.dir = dir;
  heroi.vx = heroi.vz = 0;
  montarRigHeroi(x, z);
  trocarCena(mapa.scene);
  estado = 'aventura';
  cam.yaw = dir - Math.PI;
  cam.pitch = 0.38;
  encerrarConversa();
  controles.classList.remove('hidden');
  const princesaAtiva = nome === 'castelo' && !princesaDerrotada && duendesCastelo.princesa()?.alerta;
  $('boss-bar').classList.toggle('hidden', !princesaAtiva);
  hud.classList.toggle('com-chefao', !!princesaAtiva);
  hud.classList.toggle('com-princesa', !!princesaAtiva);
  for (const a of aguas) a.malha.parent?.remove(a.malha);
  aguas = [];
  atualizarHUDHeroi();
  input.reiniciar();
  tmp.set(x, 1, z);
  particulas.emitir(tmp, 0x9dff8a, 70, { vel: 4, vida: 1, subir: 1 });
}

function mostrarCastelo() {
  entrarNoMapa('castelo', castelo ? castelo.inicio : { x: 0, z: 1.5, dir: Math.PI });
}

function voltarAoVilarejo() {
  entrarNoMapa('vilarejo', { x: POSICAO_PORTAL_VILA.x + 2, z: POSICAO_PORTAL_VILA.z + 3, dir: 0 });
}

/** O portal azul leva de volta à praça, na frente do Rei Gnomo, que entrega o presente. */
function voltarComVitoria() {
  entrarNoMapa('vilarejo', { x: GNOMO_CHEFE.x, z: GNOMO_CHEFE.z + 2.6, dir: Math.PI });
  if (gorroEntregue) return;
  setTimeout(() => {
    if (estado !== 'aventura' || mapa !== vilarejo || conversa || povo.chefe.morto) return;
    iniciarConversa(CONVERSA_CHEFE_PRESENTE, {
      nome: GNOMO_CHEFE.nome, com: povo.chefe.pos, expressar: povo.expressar,
      aoTerminar: () => {
        gorroEntregue = true;
        ganharItens(['gorroGnomos']);
      },
    });
  }, 900);
}

/** Coloca itens na mochila e mostra o que foi encontrado. */
function ganharItens(ids) {
  for (const id of ids) if (!heroi.inventario.includes(id)) heroi.inventario.push(id);
  montarMochila();
  tmp.copy(heroi.pos).setY(1.4);
  particulas.emitir(tmp, 0xffe08a, 50, { vel: 3, vida: 0.9, subir: 1.2 });
  mostrarAviso(`Você recebeu: ${ids.map((id) => item(id).nome).join(' e ')}!`);
  $('bag-btn').classList.add('novo');
}

function mostrarDica(texto) {
  const dica = $('hint');
  dica.textContent = texto;
  dica.classList.remove('hidden', 'some');
  clearTimeout(mostrarDica.timer);
  mostrarDica.timer = setTimeout(() => dica.classList.add('some'), 6000);
}

/** (Re)cria o modelo do herói com os itens equipados, no lugar indicado do mapa atual. */
function montarRigHeroi(x, z) {
  if (heroi.rig) {
    heroi.rig.root.parent?.remove(heroi.rig.root);
    descartarRig(heroi.rig);
  }
  const rig = criarHeroi({ ...heroi.escolha, equipamento: heroi.equipamento });
  rig.root.position.set(x, 0, z);
  rig.root.rotation.y = heroi.dir;
  (mapa ? mapa.scene : vilarejo.scene).add(rig.root);
  heroi.rig = rig;
  heroi.pos = rig.root.position;
}

/** Recalcula os atributos (base + itens equipados) e o que depende deles. */
function aplicarAtributos() {
  const antes = heroi.hpMax || 0;
  heroi.atributos = atributosHeroi(Object.values(heroi.equipamento).filter(Boolean));
  for (const [k, v] of Object.entries(heroi.bonusNivel)) heroi.atributos[k] += v;
  heroi.hpMax = heroi.atributos.vida;
  heroi.velocidade = heroi.atributos.velocidade * REGRAS.escalaVelocidade;
  if (heroi.hp !== undefined) heroi.hp = Math.max(1, Math.min(heroi.hpMax, heroi.hp + Math.max(0, heroi.hpMax - antes)));
}

function removerHeroi() {
  if (!heroi) return;
  heroi.rig.root.parent?.remove(heroi.rig.root);
  descartarRig(heroi.rig);
  heroi = null;
}

function atualizarHUDHeroi() {
  if (!heroi) return;
  const f = Math.max(0, heroi.hp / heroi.hpMax);
  $('hp-fill').style.width = `${f * 100}%`;
  $('hp-fill').classList.toggle('baixa', f <= 0.3);
  $('hp-fill').classList.toggle('envenenado', !!heroi.veneno);
  $('hp-text').textContent = `${Math.max(0, Math.ceil(heroi.hp))} / ${heroi.hpMax}`;
  const max = heroi.nivel >= XP.nivelMaximo;
  const precisa = xpParaSubir(heroi.nivel);
  $('hud-name').textContent = `Herói · Nível ${heroi.nivel}`;
  $('xp-fill').style.width = `${max ? 100 : (heroi.xp / precisa) * 100}%`;
  $('xp-text').textContent = max ? 'XP MÁX' : `XP ${heroi.xp} / ${precisa}`;
}

// ------------------------------------------------------------------ Experiência e níveis
/** Recebe XP de um orbe; ao completar a barra, sobe de nível (até o 10). */
function ganharXP(valor, pos) {
  const h = heroi;
  if (h.nivel >= XP.nivelMaximo) return;
  h.xp += valor;
  tmp.copy(pos).setY(1.8);
  numeros.mostrar(tmp, `+${valor} XP`, 'xp');
  while (h.nivel < XP.nivelMaximo && h.xp >= xpParaSubir(h.nivel)) {
    h.xp -= xpParaSubir(h.nivel);
    h.nivel++;
    niveisPendentes++;
  }
  if (h.nivel >= XP.nivelMaximo) h.xp = 0;
  atualizarHUDHeroi();
  if (niveisPendentes > 0 && !pausado) abrirEscolhaNivel();
}

/** Pausa o jogo e mostra as cinco melhorias. */
function abrirEscolhaNivel() {
  pausado = true;
  controles.classList.add('hidden');
  $('stats-panel').classList.add('hidden');
  $('bag-panel').classList.add('hidden');
  input.reiniciar();
  const nivel = heroi.nivel - niveisPendentes + 1;
  $('levelup-title').textContent = `Nível ${nivel}!`;
  $('levelup-options').innerHTML = MELHORIAS.map((m, i) => `
    <button class="melhoria" data-melhoria="${i}">
      <span class="melhoria-letra">${m.letra}</span>
      <span class="melhoria-nome">${m.nome}</span>
      <span class="melhoria-valor">+${m.valor}</span>
      <span class="melhoria-atual">${heroi.atributos[m.atributo]} → ${heroi.atributos[m.atributo] + m.valor}</span>
    </button>`).join('');
  $('levelup').classList.remove('hidden');
  tmp.copy(heroi.pos).setY(1);
  particulas.emitir(tmp, 0xffd23a, 60, { vel: 4, vida: 1, subir: 2 });
}

function escolherMelhoria(i) {
  if (!pausado) return;
  const m = MELHORIAS[i];
  heroi.bonusNivel[m.atributo] = (heroi.bonusNivel[m.atributo] || 0) + m.valor;
  aplicarAtributos();
  montarPainelAtributos();
  atualizarHUDHeroi();
  niveisPendentes--;
  if (niveisPendentes > 0) {
    abrirEscolhaNivel();
    return;
  }
  $('levelup').classList.add('hidden');
  pausado = false;
  if (!conversa && estado === 'aventura') controles.classList.remove('hidden');
  mostrarAviso(`${m.nome} +${m.valor}!`);
}

$('levelup-options').addEventListener('click', (e) => {
  const b = e.target.closest('[data-melhoria]');
  if (b) escolherMelhoria(Number(b.dataset.melhoria));
});
// no computador: teclas A a E (ou 1 a 5)
window.addEventListener('keydown', (e) => {
  if (!pausado) return;
  const i = ['KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE'].indexOf(e.code);
  const j = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
  if (i >= 0 || j >= 0) escolherMelhoria(i >= 0 ? i : j);
});


function danoHeroi(dano, origem) {
  const h = heroi;
  if (!h || !h.vivo || h.invul > 0) return;
  h.hp -= dano;
  h.invul = REGRAS.invulnerabilidade;
  h.semDano = 0;
  h.regenT = 0;
  tremor = Math.max(tremor, 0.25);
  tmp.copy(h.pos).setY(1.9);
  numeros.mostrar(tmp, dano, 'jogador');
  particulas.emitir(tmp.setY(1.2), 0xff2222, 12, { vel: 3, vida: 0.5, gravidade: 8 });
  piscarVinheta('pisca');
  tmp.subVectors(h.pos, origem).setY(0).normalize();
  h.pos.addScaledVector(tmp, 0.35);
  if (h.hp <= 0) derrubarHeroi('Você foi derrotado!');
  atualizarHUDHeroi();
}

function piscarVinheta(classe) {
  const v = $('hurt-vignette');
  v.classList.remove('pisca', 'veneno');
  void v.offsetWidth;
  v.classList.add(classe);
}

function derrubarHeroi(aviso) {
  const h = heroi;
  h.hp = 0;
  h.vivo = false;
  h.mortoT = 0;
  h.veneno = null;
  inimigos.acalmar();
  mostrarAviso(aviso);
  atualizarHUDHeroi();
}

/** Veneno: não machuca no contato; tira `dano` de vida por segundo durante `duracao` s. */
function envenenar(dano, duracao) {
  const h = heroi;
  if (!h || !h.vivo) return;
  h.veneno = { dano, restante: duracao, t: 0 };
  tmp.copy(h.pos).setY(2.0);
  numeros.mostrar(tmp, 'Envenenado!', 'veneno');
  piscarVinheta('veneno');
  atualizarHUDHeroi();
}

function atualizarVeneno(dt) {
  const h = heroi;
  if (!h.veneno) return;
  h.veneno.t += dt;
  if (Math.random() < 0.4) {
    tmp.set(h.pos.x + (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 1.2, h.pos.z + (Math.random() - 0.5) * 0.5);
    particulas.emitir(tmp, 0x7dff3a, 1, { vel: 0.4, vida: 0.7, subir: 1 });
  }
  while (h.veneno && h.veneno.t >= 1) {
    h.veneno.t -= 1;
    h.veneno.restante -= 1;
    h.hp -= h.veneno.dano;
    h.semDano = 0;
    h.regenT = 0;
    tmp.copy(h.pos).setY(1.9);
    numeros.mostrar(tmp, h.veneno.dano, 'veneno');
    if (h.hp <= 0) derrubarHeroi('O veneno te derrubou!');
    else if (h.veneno.restante <= 0) h.veneno = null;
    atualizarHUDHeroi();
  }
}

/**
 * Ataque do herói conforme o item da mão direita: a espada corta de perto, a vara lança
 * um jato de água e, sem uma arma (só escudo ou nada), ele dá socos.
 */
function ataqueAtual() {
  const eq = heroi.equipamento;
  const arma = [eq.maoD, eq.maoE].find((id) => id && item(id).arma);
  if (arma === 'vara') {
    // com o Feitiço dos Duendes na outra mão, a vara lança veneno em vez de água
    return eq.maoD === 'feiticoDuendes' || eq.maoE === 'feiticoDuendes' ? ATAQUES_HEROI.veneno : ATAQUES_HEROI.vara;
  }
  if (arma) return { ...ATAQUES_HEROI.espada, danoExtra: item(arma).danoExtra };
  return ATAQUES_HEROI.soco;
}

const geoAgua = new THREE.SphereGeometry(0.2, 14, 10);
const matAgua = new THREE.MeshStandardMaterial({ color: 0x6ac8ff, emissive: 0x1a6aaa, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.1 });
const matBrilhoAgua = new THREE.SpriteMaterial({ map: texturaBrilho('rgba(90,190,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
const matVenenoHeroi = new THREE.MeshStandardMaterial({ color: 0xa8ff6a, emissive: 0x3ac81a, emissiveIntensity: 1.2, transparent: true, opacity: 0.85, roughness: 0.2 });
const matBrilhoVenenoHeroi = new THREE.SpriteMaterial({ map: texturaBrilho('rgba(120,255,60,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });

/** Jato de água da vara: segue reto (com uma leve mira) até acertar alguém. */
function lancarAgua(atk, alvo) {
  const veneno = atk.tipo === 'veneno';
  const malha = new THREE.Mesh(geoAgua, veneno ? matVenenoHeroi : matAgua);
  const brilho = new THREE.Sprite(veneno ? matBrilhoVenenoHeroi : matBrilhoAgua);
  brilho.scale.setScalar(1.1);
  malha.add(brilho);
  malha.position.set(heroi.pos.x + Math.sin(heroi.dir) * 0.6, 1.25, heroi.pos.z + Math.cos(heroi.dir) * 0.6);
  mapa.scene.add(malha);
  const vel = new THREE.Vector3(Math.sin(heroi.dir), 0, Math.cos(heroi.dir)).multiplyScalar(atk.velocidade);
  aguas.push({ malha, vel, alvo, vida: atk.alcance / atk.velocidade, ataque: heroi.atributos[atk.atributo], atk });
  particulas.emitir(malha.position, veneno ? 0x8aff4a : 0x8ad8ff, 12, { vel: 2, vida: 0.4 });
}

function atualizarAguas(dt) {
  for (let i = aguas.length - 1; i >= 0; i--) {
    const a = aguas[i];
    a.vida -= dt;
    if (a.alvo && !a.alvo.morto) {
      tmp.set(a.alvo.pos.x, 0.9, a.alvo.pos.z).sub(a.malha.position).normalize().multiplyScalar(a.vel.length());
      a.vel.lerp(tmp, Math.min(1, dt * 6));
    }
    a.malha.position.addScaledVector(a.vel, dt);
    a.malha.scale.setScalar(1 + Math.sin(a.vida * 30) * 0.12);
    const corA = a.atk.tipo === 'veneno' ? [0x7dff3a, 0xd8ffb0] : [0x6ac8ff, 0xd8f2ff];
    particulas.emitir(a.malha.position, corA[Math.random() < 0.5 ? 0 : 1], 2, { vel: 0.8, vida: 0.35, gravidade: 4 });
    let fim = a.vida <= 0 || (mapa.colide && mapa.colide(a.malha.position.x, a.malha.position.z, 0.1));
    if (!fim) {
      for (const alvo of inimigos.alvos()) {
        tmp2.set(alvo.pos.x, 0.9, alvo.pos.z);
        if (tmp2.distanceTo(a.malha.position) < 0.75) {
          if (a.atk.tipo === 'veneno') inimigos.envenenar(alvo, a.ataque, a.atk.duracaoVeneno, a.atk.multiplicador);
          else inimigos.atingir(alvo, a.ataque, a.malha.position);
          fim = true;
          break;
        }
      }
    }
    if (fim) {
      particulas.emitir(a.malha.position, a.atk.tipo === 'veneno' ? 0x8aff4a : 0x8ad8ff, 30, { vel: 4, vida: 0.6, gravidade: 8 });
      a.malha.parent?.remove(a.malha);
      aguas.splice(i, 1);
    }
  }
}

function atualizarHeroi(dt, t) {
  const h = heroi;
  h.invul = Math.max(0, h.invul - dt);
  if (!h.vivo) {
    // caído: depois de um tempo, levanta de novo na entrada do mapa
    h.mortoT += dt;
    h.rig.root.rotation.x = Math.max(-Math.PI / 2, h.rig.root.rotation.x - dt * 4);
    animarRig(h.rig, dt, t, 0);
    if (h.mortoT > 2.5) {
      const { x, z, dir } = mapa.inicio;
      h.pos.set(x, 0, z);
      h.dir = dir;
      h.vx = h.vz = 0;
      h.rig.root.rotation.x = 0;
      h.vivo = true;
      h.hp = h.hpMax;
      h.invul = 1.5;
      cam.yaw = dir - Math.PI;
      atualizarHUDHeroi();
      tmp.set(x, 1, z);
      particulas.emitir(tmp, 0x9dff8a, 50, { vel: 3, vida: 0.9, subir: 1 });
    }
    return;
  }
  const atacando = h.ataqueT >= 0;
  // durante uma conversa o herói fica parado, olhando para quem fala
  const mag = conversa ? moverPelaCamera(h, 0, dt, false) : moverPelaCamera(h, h.velocidade * (atacando ? 0.5 : 1), dt, !atacando);
  if (conversa?.com) h.dir = girarPara(h.dir, Math.atan2(conversa.com.x - h.pos.x, conversa.com.z - h.pos.z), dt * 6);
  mapa.resolverColisao(h.pos, h.raio);
  h.andar += (mag - h.andar) * Math.min(1, dt * 10);

  h.recarga -= dt;
  const atk = ataqueAtual();
  if (!conversa && input.atacando() && h.recarga <= 0 && !atacando) {
    // mira automática no inimigo mais próximo (a água alcança mais longe)
    let alvo = null, melhor = atk.tipo === 'agua' || atk.tipo === 'veneno' ? 9 : 3;
    for (const g of inimigos.alvos()) {
      const d = distXZ(g.pos, h.pos);
      if (d < melhor) { melhor = d; alvo = g; }
    }
    if (alvo) h.dir = Math.atan2(alvo.pos.x - h.pos.x, alvo.pos.z - h.pos.z);
    h.alvo = alvo;
    h.ataqueT = 0;
    h.acertou = false;
    h.recarga = atk.recarga;
  }
  if (h.ataqueT >= 0) {
    h.ataqueT += dt;
    if (!h.acertou && h.ataqueT >= atk.acerto) {
      h.acertou = true;
      if (atk.tipo === 'agua' || atk.tipo === 'veneno') lancarAgua(atk, h.alvo);
      else {
        // Espada Duendeira: dano extra nos duendes (castelo) e um pouco menos nos outros seres
        const extra = atk.danoExtra ? (mapa === castelo ? atk.danoExtra.duendes : atk.danoExtra.outros) : 0;
        inimigos.atacar(h.pos, h.dir, atk.alcance, atk.arco, h.atributos[atk.atributo], extra);
      }
    }
    if (h.ataqueT >= atk.duracao) h.ataqueT = -1;
  }
  regenerar(h, dt);
  atualizarVeneno(dt);
  if (!h.vivo) return;
  h.rig.root.rotation.y = h.dir;
  animarRig(h.rig, dt, t, h.andar, h.ataqueT >= 0 ? h.ataqueT / atk.duracao : -1);
  h.rig.root.visible = h.invul <= 0 || Math.floor(h.invul * 20) % 2 === 0;
  $('attack-cd').style.transform = `scaleY(${Math.max(0, h.recarga) / atk.recarga})`;

  // botão de ação: conversar com o Rei Gnomo ou abrir o baú
  let acao = null;
  const rei = povo.chefe;
  if (mapa === vilarejo && !rei.morto && !rei.bravo && distXZ(h.pos, rei.pos) < GNOMO_CHEFE.distanciaConversa) acao = 'conversar';
  else if (mapa === castelo && !bauAberto && distXZ(h.pos, castelo.bau) < 2.2) acao = 'bau';
  const botao = $('talk-btn');
  botao.classList.toggle('hidden', !acao || !!conversa);
  if (acao && botao.dataset.acao !== acao) {
    botao.dataset.acao = acao;
    botao.textContent = acao === 'bau' ? 'Abrir o baú' : `Falar com o ${GNOMO_CHEFE.nome}`;
  }
}

/**
 * O baú do labirinto depende do presente escolhido:
 * escudo → Escudo Duendeiro e Espada Duendeira; espada → Escudo e Espada Duendeira;
 * vara → Escudo e Feitiço dos Duendes.
 */
const CONTEUDO_BAU = {
  escudo: ['escudoDuendeiro', 'espadaDuendeira'],
  espada: ['escudo', 'espadaDuendeira'],
  vara: ['escudo', 'feiticoDuendes'],
};
function abrirBau() {
  bauAberto = true;
  castelo.abrirBau();
  tmp.set(castelo.bau.x, 1.2, castelo.bau.z);
  particulas.emitir(tmp, 0xffe08a, 60, { vel: 3.5, vida: 1, subir: 1.5 });
  ganharItens(CONTEUDO_BAU[heroi.escolha.item]);
}

/** Portais do mapa atual: girar, brilhar e levar o herói quando ele entra. */
function atualizarPortais(dt) {
  for (const p of portais) {
    if (p.mapa !== mapa) continue;
    p.portal.atualizar(dt, particulas);
    if (heroi.vivo && !conversa && estado === 'aventura' && p.portal.abertura >= 1 && distXZ(heroi.pos, p.portal) < 1.1) {
      estado = 'portal';
      controles.classList.add('hidden');
      input.reiniciar();
      transicao(p.destino);
      return;
    }
  }
  // a barra da Princesa acompanha a vida dela
  const pr = duendesCastelo?.princesa();
  if (mapa === castelo && pr && pr.alerta && !pr.morto) mostrarBarraPrincesa(pr);
}

// ------------------------------------------------------------------ Conversas
// Regra para qualquer conversa: os botões de movimento e ataque somem e o herói fica parado.
let conversa = null; // { falas, i, nome, com, aoEscolher, aoTerminar, expressar, auto }

function iniciarConversa(falas, { nome, com = null, expressar = null, aoEscolher = null, aoTerminar = null }) {
  conversa = { falas, i: 0, nome, com, expressar, aoEscolher, aoTerminar, auto: -1 };
  controles.classList.add('hidden');
  $('talk-btn').classList.add('hidden');
  $('stats-panel').classList.add('hidden');
  $('bag-panel').classList.add('hidden');
  input.reiniciar();
  $('dialog').classList.remove('hidden');
  mostrarFala();
}

function mostrarFala() {
  const c = conversa;
  const fala = c.falas[c.i];
  $('dialog-name').textContent = c.nome;
  $('dialog-text').textContent = fala.texto;
  c.expressar?.(fala.expressao || null);
  c.auto = fala.auto ?? -1;
  const botoes = $('dialog-buttons');
  if (fala.opcoes) {
    botoes.innerHTML = fala.opcoes.map((o) => `<button class="botao-opcao" data-opcao="${o.id}">${o.texto}</button>`).join('');
  } else if (fala.auto) {
    botoes.innerHTML = '';
  } else {
    botoes.innerHTML = '<button class="botao-continuar" data-opcao="continuar">Continuar ▸</button>';
  }
  // reinicia a animação de entrada do texto
  const p = $('dialog-text');
  p.classList.remove('entra');
  void p.offsetWidth;
  p.classList.add('entra');
}

function avancarConversa(opcao = 'continuar') {
  const c = conversa;
  if (!c) return;
  if (opcao !== 'continuar') {
    // a resposta pode trocar as próximas falas
    c.aoEscolher?.(opcao);
    return;
  }
  if (c.i < c.falas.length - 1) {
    c.i++;
    mostrarFala();
  } else {
    const fim = c.aoTerminar;
    encerrarConversa();
    fim?.();
  }
}

/** Continua a conversa com outras falas (depois de uma escolha). */
function continuarConversa(falas, aoTerminar) {
  conversa.falas = falas;
  conversa.i = 0;
  conversa.aoTerminar = aoTerminar;
  mostrarFala();
}

function encerrarConversa() {
  if (!conversa) return;
  conversa.expressar?.(null);
  conversa = null;
  $('dialog').classList.add('hidden');
  if (estado === 'aventura') controles.classList.remove('hidden');
}

function atualizarConversa(dt) {
  if (!conversa || conversa.auto < 0) return;
  conversa.auto -= dt;
  if (conversa.auto <= 0) {
    conversa.auto = -1;
    avancarConversa();
  }
}

$('dialog-buttons').addEventListener('click', (e) => {
  const b = e.target.closest('[data-opcao]');
  if (b) avancarConversa(b.dataset.opcao);
});

// ------------------------------------------------------------------ Conversa com o Rei Gnomo
function conversarComChefe() {
  const base = { nome: GNOMO_CHEFE.nome, com: povo.chefe.pos, expressar: povo.expressar };
  if (princesaDerrotada && !gorroEntregue) {
    iniciarConversa(CONVERSA_CHEFE_PRESENTE, { ...base, aoTerminar: () => { gorroEntregue = true; ganharItens(['gorroGnomos']); } });
  } else if (princesaDerrotada) {
    iniciarConversa(CONVERSA_CHEFE_VITORIA, base);
  } else if (missaoAceita) {
    iniciarConversa(CONVERSA_CHEFE_LEMBRETE, base);
  } else {
    iniciarConversa(CONVERSA_CHEFE, {
      ...base,
      aoEscolher(resposta) {
        if (resposta === 'sim') {
          continuarConversa(CONVERSA_CHEFE_SIM, abrirPortalDaVila);
        } else {
          // o chefe ri… e acaba com o herói na hora
          continuarConversa(CONVERSA_CHEFE_NAO, () => {
            povo.raioMortal(heroi.pos);
            derrubarHeroi(`O ${GNOMO_CHEFE.nome} acabou com você!`);
          });
        }
      },
    });
  }
}

function abrirPortalDaVila() {
  missaoAceita = true;
  const { x, z } = POSICAO_PORTAL_VILA;
  portais.push({ portal: criarPortal(vilarejo.scene, x, z, Math.atan2(-x, -z)), mapa: vilarejo, destino: mostrarCastelo });
}

$('talk-btn').addEventListener('click', () => {
  if ($('talk-btn').dataset.acao === 'bau') abrirBau();
  else conversarComChefe();
});

// ------------------------------------------------------------------ Painel de atributos e itens
const ICONE_PERSONAGEM = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="21" r="11" fill="currentColor"/>
  <path d="M12 56 C12 42 21 35 32 35 C43 35 52 42 52 56 Z" fill="currentColor"/></svg>`;

const sinal = (v) => `${v > 0 ? '+' : ''}${v}`;

/** Atributos do herói: só os números, com o bônus dos itens e dos níveis. */
function montarPainelAtributos() {
  const h = heroi;
  const linhas = ATRIBUTOS.map((a) => {
    const bonus = h.atributos[a.chave] - HEROI_BASE[a.chave];
    const extra = bonus ? ` <span class="${bonus > 0 ? 'bonus-mais' : 'bonus-menos'}">(${sinal(bonus)})</span>` : '';
    return `<div class="atributo"><span>${a.nome}</span><b>${h.atributos[a.chave]}${extra}</b></div>`;
  }).join('');
  const max = h.nivel >= XP.nivelMaximo;
  $('stats-body').innerHTML = `
    <div class="painel-nivel"><b>Nível ${h.nivel}</b><span>${max ? 'nível máximo' : `XP ${h.xp} / ${xpParaSubir(h.nivel)}`}</span></div>
    <div class="atributos">${linhas}</div>`;
}

$('stats-btn').innerHTML = ICONE_PERSONAGEM;
$('stats-btn').addEventListener('click', () => {
  $('bag-panel').classList.add('hidden');
  $('stats-panel').classList.toggle('hidden');
});
$('stats-close').addEventListener('click', () => $('stats-panel').classList.add('hidden'));

// ------------------------------------------------------------------ Mochila
// Os itens que o herói tem e os lugares do corpo onde podem ser equipados, em volta de um
// retrato do herói. Tocar num item equipa; tocar num lugar ocupado guarda o item de volta.
const ICONE_MOCHILA = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M22 16 C22 8 42 8 42 16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <rect x="12" y="16" width="40" height="40" rx="10" fill="currentColor"/>
  <rect x="20" y="34" width="24" height="14" rx="3" fill="#1a1426" opacity="0.55"/>
  <rect x="29" y="32" width="6" height="6" rx="1.5" fill="#1a1426" opacity="0.8"/></svg>`;
let espacoEscolhido = null; // lugar tocado para escolher o item dele

/** Em qual lugar um item vai. Escudos só na mão esquerda; armas preferem a direita. */
function lugarPara(id) {
  const it = item(id);
  const eq = heroi.equipamento;
  if (it.lugar !== 'mao') return it.lugar;
  if (it.escudo) return 'maoE';
  if (espacoEscolhido === 'maoD' || espacoEscolhido === 'maoE') return espacoEscolhido;
  if (id === 'feiticoDuendes') return !eq.maoE || item(eq.maoE).escudo ? 'maoE' : !eq.maoD ? 'maoD' : 'maoE';
  if (!eq.maoD) return 'maoD';
  if (!eq.maoE) return 'maoE';
  return 'maoD';
}

function serveNoEspaco(id, espaco) {
  const it = item(id);
  if (espaco === 'maoD') return it.lugar === 'mao' && !it.escudo;
  if (espaco === 'maoE') return it.lugar === 'mao';
  return it.lugar === espaco;
}

function equiparItem(id) {
  const eq = heroi.equipamento;
  for (const k of Object.keys(eq)) if (eq[k] === id) eq[k] = null;
  eq[lugarPara(id)] = id;
  espacoEscolhido = null;
  equipamentoMudou();
}

function guardarItem(espaco) {
  heroi.equipamento[espaco] = null;
  equipamentoMudou();
}

function equipamentoMudou() {
  const h = heroi;
  montarRigHeroi(h.pos.x, h.pos.z);
  aplicarAtributos();
  montarPainelAtributos();
  montarMochila();
  atualizarHUDHeroi();
  tmp.copy(h.pos).setY(1.2);
  particulas.emitir(tmp, 0xffe08a, 25, { vel: 2.5, vida: 0.6, subir: 0.6 });
}

const textoItem = (it) => it.descricao || Object.entries(it.bonus).map(([k, v]) => `${sinal(v)} ${ATRIBUTOS.find((a) => a.chave === k).nome}`).join(', ');

function montarMochila() {
  if (!heroi) return;
  const eq = heroi.equipamento;
  for (const e of ESPACOS) {
    const el = document.querySelector(`.espaco-corpo[data-espaco="${e.id}"]`);
    const id = eq[e.id];
    el.classList.toggle('ocupado', !!id);
    el.classList.toggle('escolhido', espacoEscolhido === e.id);
    el.innerHTML = id
      ? `<span class="icone-presente">${iconePresente(id)}</span><span class="espaco-nome">${item(id).nome}</span>`
      : `<span class="espaco-vazio"></span><span class="espaco-nome">${e.nome}</span>`;
    el.setAttribute('aria-label', id ? `${e.nome}: ${item(id).nome}. Toque para guardar` : `${e.nome}: vazio`);
  }
  const lista = heroi.inventario.map((id) => {
    const it = item(id);
    const equipado = Object.values(eq).includes(id);
    const apagado = espacoEscolhido && !serveNoEspaco(id, espacoEscolhido);
    return `<button class="item-mochila${equipado ? ' equipado' : ''}${apagado ? ' apagado' : ''}" data-item="${id}" ${apagado ? 'disabled' : ''}>
        <span class="icone-presente">${iconePresente(id)}</span>
        <span class="item-mochila-texto"><b>${it.nome}</b><small>${textoItem(it)}</small></span>
        <span class="item-mochila-estado">${equipado ? 'Equipado' : 'Equipar'}</span>
      </button>`;
  }).join('');
  $('bag-items').innerHTML = lista;
  $('bag-hint').textContent = espacoEscolhido
    ? `Escolha um item para: ${ESPACOS.find((e) => e.id === espacoEscolhido).nome}`
    : 'Toque num item para equipar. Toque num lugar ocupado para guardar o item.';
  atualizarRetrato();
}

// retrato do herói no meio da mochila (um renderizador pequeno só para ele)
const retrato = { renderer: null, scene: null, camera: null, rig: null };
function atualizarRetrato() {
  if (!retrato.renderer) {
    const canvas = $('bag-preview');
    retrato.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    retrato.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    retrato.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    retrato.scene = new THREE.Scene();
    retrato.scene.add(new THREE.HemisphereLight(0xdcefff, 0x4a3a28, 1.4));
    const luz = new THREE.DirectionalLight(0xfff0d8, 1.8);
    luz.position.set(2, 4, 5);
    retrato.scene.add(luz);
    retrato.camera = new THREE.PerspectiveCamera(30, 0.66, 0.1, 20);
    retrato.camera.position.set(0, 1.2, 5.2);
    retrato.camera.lookAt(0, 1.05, 0);
  }
  if (retrato.rig) {
    retrato.scene.remove(retrato.rig.root);
    descartarRig(retrato.rig);
  }
  retrato.rig = criarHeroi({ ...heroi.escolha, equipamento: heroi.equipamento });
  retrato.rig.root.rotation.y = 0.35;
  retrato.scene.add(retrato.rig.root);
}

function desenharRetrato(dt, t) {
  if (!retrato.rig || $('bag-panel').classList.contains('hidden')) return;
  const canvas = $('bag-preview');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * retrato.renderer.getPixelRatio())) {
    retrato.renderer.setSize(w, h, false);
    retrato.camera.aspect = w / h;
    retrato.camera.updateProjectionMatrix();
  }
  retrato.rig.root.rotation.y = 0.35 + Math.sin(t * 0.6) * 0.35;
  animarRig(retrato.rig, dt, t, 0);
  retrato.renderer.render(retrato.scene, retrato.camera);
}

$('bag-btn').innerHTML = ICONE_MOCHILA;
$('bag-btn').addEventListener('click', () => {
  $('stats-panel').classList.add('hidden');
  $('bag-btn').classList.remove('novo');
  espacoEscolhido = null;
  $('bag-panel').classList.toggle('hidden');
  if (!$('bag-panel').classList.contains('hidden')) montarMochila();
});
$('bag-close').addEventListener('click', () => $('bag-panel').classList.add('hidden'));
$('bag-items').addEventListener('click', (e) => {
  const b = e.target.closest('[data-item]');
  if (!b || b.disabled) return;
  const id = b.dataset.item;
  // tocar num item já equipado (sem um lugar escolhido) guarda ele
  const onde = Object.keys(heroi.equipamento).find((k) => heroi.equipamento[k] === id);
  if (onde && !espacoEscolhido) guardarItem(onde);
  else equiparItem(id);
});
$('bag-doll').addEventListener('click', (e) => {
  const b = e.target.closest('[data-espaco]');
  if (!b) return;
  const espaco = b.dataset.espaco;
  if (heroi.equipamento[espaco]) {
    espacoEscolhido = null;
    guardarItem(espaco);
  } else {
    espacoEscolhido = espacoEscolhido === espaco ? null : espaco;
    montarMochila();
  }
});

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
  } else if (estado === 'criacao') {
    atualizarPrevia(dt, tempo);
    estudio.atualizar(dt, tempo);
  } else if (pausado) {
    // escolhendo a melhoria de nível: tudo parado
  } else if (estado === 'aventura' || (estado === 'portal' && heroi)) {
    atualizarHeroi(dt, tempo);
    mapa.orbes.atualizar(dt, heroi);
    atualizarAguas(dt);
    inimigos.atualizar(dt, tempo);
    mapa.atualizar(dt, tempo, heroi.pos, camera);
    atualizarPortais(dt);
    atualizarConversa(dt);
  } else if (jogador) {
    atualizarJogador(dt, tempo);
    atualizarDuendes(dt, tempo);
    atualizarProjeteis(dt);
    atualizarFlechas(dt);
    atualizarBolasDeFogo(dt, tempo);
    atualizarPedras(dt);
    if (rastro) rastro.atualizar(dt);
    mundo.atualizar(dt, tempo, jogador.pos, camera);
    luzJogador.position.set(jogador.pos.x, 3, jogador.pos.z);
    if (timerFim > 0 && estado === 'jogando') {
      timerFim -= dt;
      if (timerFim <= 0) terminar();
    }
    atualizarPortal(dt);
  }

  atualizarCamera(dt, tempo);
  if (!pausado) particulas.atualizar(dt);
  if (estado === 'aventura') desenharRetrato(dt, tempo);
  numeros.atualizar(dt);
  renderer.render(cena, camera);
}

// ------------------------------------------------------------------ Tela inicial
function sairDaIntro() {
  const intro = $('intro-screen');
  intro.classList.add('saindo');
  setTimeout(() => intro.classList.add('hidden'), 700);
}
$('intro-btn').addEventListener('click', sairDaIntro);
// pular o tutorial: vai direto para a criação do personagem
$('skip-btn').addEventListener('click', () => {
  sairDaIntro();
  mostrarCriacao();
});

montarCartas();
mostrarSelecao();
camera.position.set(0, 1.5, 6);
loop();
