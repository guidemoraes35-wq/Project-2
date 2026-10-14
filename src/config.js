// Atributos e regras do jogo.

export const CLASSES = {
  assassino: {
    id: 'assassino',
    nome: 'Assassino',
    descricao: 'Rápido e letal. Golpeia com adagas gêmeas a curta distância.',
    icone: '🗡️',
    vida: 20,
    poder: 30,
    velocidade: 35,
    defesa: 10,
    inteligencia: 15,
    ataque: {
      tipo: 'fisico',
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
    vida: 30,
    poder: 10,
    velocidade: 20,
    defesa: 20,
    inteligencia: 40,
    ataque: {
      tipo: 'magico',
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
  vida: 10,
  poder: 10,
  velocidade: 20,
  defesa: 10,
  inteligencia: 0,
  alcance: 1.45,
  recarga: 1.3,
};

export const ATRIBUTOS = [
  { chave: 'vida', nome: 'Vida', max: 40 },
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

// Dano = ataque² / (ataque + defesa). Quanto maior a defesa, menor o dano.
// Ataques físicos usam o Poder; ataques mágicos usam a Inteligência.
export function calcularDano(ataque, defesa) {
  if (ataque <= 0) return 0;
  return Math.max(1, Math.round((ataque * ataque) / (ataque + defesa)));
}
