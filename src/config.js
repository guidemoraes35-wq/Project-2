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
export const HEROI_BASE = { vida: 10, poder: 8, velocidade: 25, defesa: 5, inteligencia: 5 };

/** Lugares do corpo onde se equipa um item (um item em cada). */
export const ESPACOS = [
  { id: 'cabeca', nome: 'Cabeça' },
  { id: 'colar', nome: 'Colar' },
  { id: 'dorso', nome: 'Dorso' },
  { id: 'maoD', nome: 'Mão direita' },
  { id: 'maoE', nome: 'Mão esquerda' },
  { id: 'calcas', nome: 'Calças' },
  { id: 'pes', nome: 'Pés' },
];

/**
 * Todos os itens e o bônus de cada um. Os três primeiros são os presentes da criação.
 * A espada ataca de perto, a vara lança água e os escudos não têm ataque próprio (o herói dá socos).
 */
export const ITENS = [
  { id: 'espada', nome: 'Espada', bonus: { poder: 15 }, presente: true, lugar: 'mao', arma: true },
  { id: 'vara', nome: 'Vara', bonus: { inteligencia: 10, vida: 5 }, presente: true, lugar: 'mao', arma: true },
  { id: 'escudo', nome: 'Escudo', bonus: { defesa: 15, velocidade: -3 }, presente: true, lugar: 'mao', escudo: true },
  { id: 'escudoDuendeiro', nome: 'Escudo Duendeiro', bonus: { defesa: 20, velocidade: -5 }, lugar: 'mao', escudo: true },
  // a Espada Duendeira causa dano extra em cada golpe: +15 nos duendes e +10 nos outros seres
  { id: 'espadaDuendeira', nome: 'Espada Duendeira', bonus: {}, lugar: 'mao', arma: true, danoExtra: { duendes: 15, outros: 10 }, descricao: '+15 de dano em duendes, +10 nos outros' },
  // equipado junto com a vara, troca o jato de água pelo veneno dos duendes mágicos
  { id: 'feiticoDuendes', nome: 'Feitiço dos Duendes', bonus: {}, lugar: 'mao', descricao: 'Com a vara: lança veneno em vez de água' },
  { id: 'gorroGnomos', nome: 'Gorro dos Gnomos', bonus: { vida: 5, inteligencia: 5 }, lugar: 'cabeca' },
];
export const PRESENTES = ITENS.filter((i) => i.presente);
export const item = (id) => ITENS.find((i) => i.id === id);

/** Ataques do herói: depende do que ele segura na mão direita. */
export const ATAQUES_HEROI = {
  espada: { tipo: 'corte', atributo: 'poder', alcance: 1.9, arco: Math.PI * 0.7, recarga: 0.55, duracao: 0.45, acerto: 0.2 },
  vara: { tipo: 'agua', atributo: 'inteligencia', alcance: 10, velocidade: 14, recarga: 0.75, duracao: 0.5, acerto: 0.22 },
  // vara + Feitiço dos Duendes: o veneno não machuca no contato, mas tira vida por 3 s
  // (no total, 1,5 vez o dano que a água causaria)
  veneno: { tipo: 'veneno', atributo: 'inteligencia', alcance: 10, velocidade: 11, recarga: 0.8, duracao: 0.5, acerto: 0.22, duracaoVeneno: 3, multiplicador: 1.5 },
  soco: { tipo: 'soco', atributo: 'poder', alcance: 1.35, arco: Math.PI * 0.5, recarga: 0.4, duracao: 0.32, acerto: 0.13 },
};

/** Atributos finais do herói: base + bônus dos itens equipados. */
export function atributosHeroi(equipados) {
  const total = { ...HEROI_BASE };
  for (const id of equipados) {
    const bonus = item(id)?.bonus || {};
    for (const [k, v] of Object.entries(bonus)) total[k] += v;
  }
  return total;
}

/** Texto do bônus, por exemplo "+15 Poder, -3 Velocidade". */
export function textoBonus(bonus) {
  return Object.entries(bonus)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${ATRIBUTOS.find((a) => a.chave === k).nome}`)
    .join(', ');
}

// ------------------------------------------------------------------ Gnomos do vilarejo
// Pacíficos: só atacam quem os ataca. Bravos, ficam mais rápidos.
export const GNOMO = {
  nome: 'Gnomo',
  vida: 120,
  poder: 30,
  velocidade: 20,       // feliz
  velocidadeBrava: 45,  // bravo
  defesa: 30,
  inteligencia: 80,
  raio: 0.32,
  alturaAcerto: 0.55,
  quantidadeMin: 10,
  quantidadeMax: 15,
  renascer: 12,         // segundos até outro gnomo chegar no lugar de um derrotado
  raiva: 20,            // segundos sem apanhar até se acalmar
  raioAlerta: 8,        // gnomos a esta distância do atacado também ficam bravos
  espada: { atributo: 'poder', alcance: 1.15, recarga: 1.1, preparo: 0.38, duracao: 0.7 },
  magia: {
    atributo: 'inteligencia',
    alcance: 11,          // distância máxima para lançar
    distanciaIdeal: 6.5,  // tenta ficar a esta distância
    recarga: 2.6,
    preparo: 0.7,         // erguer as mãos
    duracao: 1.05,
    atraso: 0.75,         // tempo entre o aviso no chão e os espinhos de terra
    raio: 1.35,
  },
};

/** O Rei Gnomo (antes "Gnomo Chefe"). Também pode ser atacado: revida com magia de terra. */
export const GNOMO_CHEFE = {
  nome: 'Rei Gnomo',
  vida: 300, poder: 40, velocidade: 0, defesa: 40, inteligencia: 120,
  recargaMagia: 2.2,
  renascer: 40,           // segundos até o rei voltar à praça depois de derrotado
  x: 0,
  z: 2.7,                 // na praça, ao lado do poço
  distanciaConversa: 3,
};

// ------------------------------------------------------------------ Castelo dos duendes
// Os duendes do castelo começam parados e atacam quando o herói chega perto.
export const CASTELO = {
  alerta: 9,   // distância em que um duende nota o herói
  duendesNoPatio: 6, // duendes fracos na entrada; o resto fica espalhado no labirinto
};

/** Princesa Duendete: a cada 5 s chama 5 duendes fracos para atacar o herói. */
export const PRINCESA = {
  nome: 'Princesa Duendete',
  vida: 80, poder: 10, velocidade: 30, defesa: 15, inteligencia: 30,
  invocacao: { intervalo: 5, quantidade: 5, preparo: 0.8, duracao: 1.2, maximo: 5 }, // no máximo 5 vivos de cada vez
  distanciaIdeal: 7,
  raio: 0.45, escala: 1.2, alturaAcerto: 0.8,
};

export const DUENDE_FRACO = {
  nome: 'Duende',
  vida: 20, poder: 5, velocidade: 20, defesa: 5, inteligencia: 0,
  quantidade: 30,
  atributoAtaque: 'poder',
  alcance: 1.3, recarga: 1.2, preparo: 0.45, duracaoAtaque: 0.8,
  raio: 0.36, escala: 0.85, alturaAcerto: 0.6,
};

export const ARQUEIRO_CASTELO = {
  nome: 'Duende Arqueiro',
  vida: 20, poder: 8, velocidade: 15, defesa: 0, inteligencia: 0,
  quantidade: 8,
  atributoAtaque: 'poder',
  distancia: true,
  alcance: 14, distanciaIdeal: 9, recarga: 2.3, preparo: 0.8, duracaoAtaque: 1.1,
  velocidadeFlecha: 17,
  raio: 0.38, escala: 0.9, alturaAcerto: 0.65,
};

/** Duende mágico: o veneno não machuca no contato, mas tira 1 de vida por segundo por 3 s. */
export const DUENDE_MAGICO = {
  nome: 'Duende Mágico',
  vida: 5, poder: 5, velocidade: 30, defesa: 5, inteligencia: 20,
  quantidade: 6,
  distancia: true,
  alcance: 10, distanciaIdeal: 6.5, recarga: 3, preparo: 0.6, duracaoAtaque: 0.9,
  velocidadeVeneno: 9,
  veneno: { dano: 1, duracao: 3 },
  raio: 0.34, escala: 0.85, alturaAcerto: 0.6,
};

// ------------------------------------------------------------------ Experiência e níveis
export const XP = {
  // XP que cada um deixa cair ao ser derrotado (não existe XP no tutorial)
  porDuende: 1,
  porArqueiro: 1,
  porMagico: 2,
  porPrincesa: 10,
  porGnomo: 30,
  porRei: 50,
  nivelMaximo: 10,
  raioIma: 3,          // o orbe voa até o herói a esta distância
  raioColeta: 0.7,
};

/** XP necessário para passar do nível `n` para o seguinte: 15 + 5N. */
export const xpParaSubir = (n) => 15 + 5 * n;

/** Escolhas ao subir de nível. */
export const MELHORIAS = [
  { letra: 'A', atributo: 'vida', valor: 5, nome: 'Vida' },
  { letra: 'B', atributo: 'poder', valor: 2, nome: 'Ataque' },
  { letra: 'C', atributo: 'velocidade', valor: 2, nome: 'Velocidade' },
  { letra: 'D', atributo: 'defesa', valor: 3, nome: 'Defesa' },
  { letra: 'E', atributo: 'inteligencia', valor: 2, nome: 'Inteligência' },
];
