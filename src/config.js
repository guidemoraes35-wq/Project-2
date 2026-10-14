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
  atrasoSurgimento: 2.5, // segundos após o último duende cair
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
  duendesMax: 30,
  duendesSimultaneosInicio: 3,
  duendesSimultaneosMax: 7,
  intervaloSurgimento: 1.2,
  escalaVelocidade: 0.2,   // atributo de velocidade -> metros por segundo
  raioMapa: 55,
  invulnerabilidade: 0.45, // segundos sem receber dano após ser atingido
};

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
