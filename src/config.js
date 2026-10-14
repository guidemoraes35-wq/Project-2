// Atributos e regras do jogo.

export const CLASSES = {
  assassino: {
    id: 'assassino',
    nome: 'Assassino',
    descricao: 'Rápido e letal. Golpeia com adagas gêmeas a curta distância.',
    icone: '🗡️',
    vida: 100,
    poder: 30,
    velocidade: 35,
    defesa: 10,
    inteligencia: 15,
    ataque: {
      tipo: 'fisico',
      atributo: 'poder', // 1 ponto de Poder = 1 ponto de ataque
      recarga: 0.42,   // segundos entre ataques
      duracao: 0.35,   // duração da animação
      acerto: 0.12,    // momento em que o golpe acerta
      alcance: 2.4,
      arco: Math.PI * 0.62,
      mira: 4.5,       // distância da mira automática
    },
    super: {
      tipo: 'invisibilidade',
      nome: 'Invisibilidade',
      icone: 'capa', // desenhado em SVG: uma capa de mago translúcida
      descricao: 'Fica invisível para todos os inimigos por 2 s. Recarrega em 10 s.',
      duracao: 2,
      recarga: 10,
    },
  },
  maga: {
    id: 'maga',
    nome: 'Maga',
    descricao: 'Domina a magia arcana. Lança orbes mágicos à distância.',
    icone: '🔮',
    vida: 150,
    poder: 10,
    velocidade: 20,
    defesa: 20,
    inteligencia: 40,
    ataque: {
      tipo: 'magico',
      atributo: 'inteligencia', // 1 ponto de Inteligência = 1 ponto de ataque
      recarga: 0.75,
      duracao: 0.5,
      acerto: 0.22,
      alcance: 20,
      velocidadeProjetil: 17,
      mira: 18,
    },
    super: {
      tipo: 'bolaDeFogo',
      nome: 'Bola de Fogo',
      icone: '🔥',
      descricao: 'Persegue um inimigo, causa o dobro do ataque e queima 3 de vida/s por 5 s. Carrega a cada 15 inimigos derrotados.',
      abatesNecessarios: 15,
      multiplicador: 2,     // o ataque da bola de fogo é 2x a Inteligência
      queimaDano: 3,        // vida perdida por segundo enquanto queima
      queimaDuracao: 5,
      velocidade: 13,
      busca: 35,            // distância máxima para escolher o alvo
    },
  },
};

export const DUENDE = {
  nome: 'Duende',
  vida: 50,
  poder: 10,
  velocidade: 20,
  defesa: 10,
  inteligencia: 0,
  atributoAtaque: 'poder',
  alcance: 1.45,
  recarga: 1.3,
  preparo: 0.55,      // segundos entre erguer a clava e acertar
  duracaoAtaque: 0.85,
  raio: 0.4,
  empurrao: 1,        // quanto é empurrado ao ser atingido
  interrompivel: true, // levar dano cancela o ataque
  alturaAcerto: 0.7,
};

export const ARQUEIRO = {
  nome: 'Duende Arqueiro',
  vida: 75,
  poder: 30,
  velocidade: 25,
  defesa: 20,
  inteligencia: 0,
  atributoAtaque: 'poder', // a flecha usa o Poder
  distancia: true,
  alcance: 14,          // distância máxima do tiro
  distanciaIdeal: 9,    // tenta manter essa distância do jogador
  recarga: 2.2,
  preparo: 0.8,         // tempo puxando a corda
  duracaoAtaque: 1.1,
  velocidadeFlecha: 19,
  raio: 0.4,
  empurrao: 0.8,
  interrompivel: true,
  alturaAcerto: 0.7,
};

export const CHEFAO = {
  nome: 'Chefão Duende',
  vida: 200,
  poder: 40,
  velocidade: 10,
  defesa: 50,
  inteligencia: 0,
  atributoAtaque: 'poder',
  alcance: 2.6,
  recarga: 1.6,
  preparo: 0.95,
  duracaoAtaque: 1.4,
  raio: 0.95,
  empurrao: 0.12,
  interrompivel: false,
  alturaAcerto: 1.4,
  super: {
    tipo: 'pedra',
    nome: 'Arremesso de Pedra',
    atributo: 'poder',
    dano: 80,
    ataquesMin: 8,        // o super sai a cada 8 a 10 ataques do chefão
    ataquesMax: 10,
    alcance: 24,
    duracao: 2.0,         // agachar, pegar a pedra, erguer e arremessar
    pegar: 0.55,          // momento em que a pedra aparece na mão
    lancamento: 1.35,     // momento em que a pedra é solta
    raioImpacto: 1.9,
  },
};

export const ATRIBUTOS = [
  { chave: 'vida', nome: 'Vida', max: 200 },
  { chave: 'poder', nome: 'Poder', max: 40 },
  { chave: 'velocidade', nome: 'Velocidade', max: 40 },
  { chave: 'defesa', nome: 'Defesa', max: 40 },
  { chave: 'inteligencia', nome: 'Inteligência', max: 40 },
];

export const REGRAS = {
  duendesMin: 20,
  duendesMax: 25,
  arqueirosMin: 5,
  arqueirosMax: 8,
  distanciaSurgimento: 30, // os duendes surgem esta distância à frente do jogador na trilha
  distanciaChefao: 34,     // o chefão surge quando o jogador chega a esta distância do fim
  escalaVelocidade: 0.2,   // atributo de velocidade -> metros por segundo
  invulnerabilidade: 0.45, // segundos sem receber dano após ser atingido
  regeneracaoEspera: 5,     // segundos sem tomar dano antes de começar a recuperar vida
  regeneracaoPorSegundo: 0.03, // fração da vida máxima recuperada por segundo
};

/** Vida recuperada a cada segundo de regeneração: 3% da vida máxima, arredondado para cima. */
export function vidaPorSegundo(vidaMaxima) {
  return Math.ceil(vidaMaxima * REGRAS.regeneracaoPorSegundo - 1e-9);
}

// Cada ataque usa um atributo: 1 ponto de Poder ou de Inteligência = 1 ponto de ataque.
// Dano = ataque² / (ataque + defesa). Quanto maior a defesa, menor o dano.
export function calcularDano(ataque, defesa) {
  if (ataque <= 0) return 0;
  return Math.max(1, Math.round((ataque * ataque) / (ataque + defesa)));
}

export const NOMES_ATRIBUTO = { poder: 'Poder', inteligencia: 'Inteligência' };

/** Pontos de ataque de um personagem: o valor do atributo que o ataque usa. */
export function pontosDeAtaque(personagem, atributo) {
  return personagem[atributo];
}

// ------------------------------------------------------------------ Criação do personagem
// Depois do tutorial, o jogador atravessa o portal e monta o personagem definitivo.

export const GENEROS = [
  { id: 'menino', nome: 'Menino' },
  { id: 'menina', nome: 'Menina' },
];

/** Aparências: cor da pele, do cabelo e dos olhos. `nome` = [menino, menina]. */
export const APARENCIAS = [
  { id: 'loiro', nome: ['Loiro de olhos azuis', 'Loira de olhos azuis'], pele: 0xf7d3b8, cabelo: 0xf0cc62, olhos: 0x3d8de0 },
  { id: 'asiatico', nome: ['Asiático oriental', 'Asiática oriental'], pele: 0xf0cfa6, cabelo: 0x1c1816, olhos: 0x3a2414, olhosPuxados: true },
  { id: 'indiano', nome: ['Indiano', 'Indiana'], pele: 0xc28a5c, cabelo: 0x17110e, olhos: 0x2e1c10 },
  { id: 'africano', nome: ['Africano', 'Africana'], pele: 0x7a4b2d, cabelo: 0x17110c, olhos: 0x2a170b, cacheado: true },
  { id: 'castanho', nome: ['Branco de cabelo castanho e olhos verdes', 'Branca de cabelo castanho e olhos verdes'], pele: 0xf4cba8, cabelo: 0x6e4020, olhos: 0x3f9a4c },
  { id: 'moreno', nome: ['Branco de cabelo preto e olhos castanhos', 'Branca de cabelo preto e olhos castanhos'], pele: 0xf0c6a2, cabelo: 0x1d1714, olhos: 0x5c3418 },
];

/** Roupas: cor principal e cor dos detalhes (gola, cinto, barras e punhos). */
export const ROUPAS = [
  { id: 'vermelha', nome: 'Vermelha', detalhes: 'detalhes marrons', principal: 0xb8262b, detalhe: 0x6e4524, calca: 0x4a2a1a, bota: 0x3e2716 },
  { id: 'azul', nome: 'Azul', detalhes: 'detalhes brancos', principal: 0x2c5cc0, detalhe: 0xf3f0e8, calca: 0x22305a, bota: 0x2c2a33 },
  { id: 'verde', nome: 'Verde', detalhes: 'detalhes pretos', principal: 0x2f8d3c, detalhe: 0x18181c, calca: 0x1f3322, bota: 0x16161a },
];

/** Roupa de linho usada na prévia antes de o jogador escolher a dele. */
export const ROUPA_SIMPLES = { id: 'linho', principal: 0xcdbf9f, detalhe: 0x8a7656, calca: 0x6e6250, bota: 0x4a3a28 };

/** Atributos do personagem definitivo antes do bônus do presente. */
export const HEROI_BASE = { vida: 10, poder: 5, velocidade: 15, defesa: 5, inteligencia: 5 };

/** Item de presente e o bônus que ele dá nos atributos. */
export const PRESENTES = [
  { id: 'espada', nome: 'Espada', bonus: { poder: 15 } },
  { id: 'vara', nome: 'Vara', bonus: { inteligencia: 10, vida: 5 } },
  { id: 'escudo', nome: 'Escudo', bonus: { defesa: 15, velocidade: -3 } },
];

/** Atributos finais do herói: base + bônus do presente. */
export function atributosHeroi(itemId) {
  const bonus = PRESENTES.find((p) => p.id === itemId)?.bonus || {};
  const total = { ...HEROI_BASE };
  for (const [k, v] of Object.entries(bonus)) total[k] += v;
  return total;
}

/** Texto do bônus, por exemplo "+15 Poder, -3 Velocidade". */
export function textoBonus(bonus) {
  return Object.entries(bonus)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${ATRIBUTOS.find((a) => a.chave === k).nome}`)
    .join(', ');
}
