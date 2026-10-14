// Falas das conversas do jogo. Cada fala tem o texto e a expressão de quem fala;
// uma fala com `opcoes` espera a resposta do jogador.

/** Primeira conversa com o Rei Gnomo. */
export const CONVERSA_CHEFE = [
  { texto: 'Mmmmmm….. você…..', expressao: 'desconfiado' },
  { texto: 'UM HUMANO???', expressao: 'surpreso' },
  { texto: 'Um humano não passa pela minha vila em muito tempo, a última vez foi quando…..', expressao: 'lembrando' },
  { texto: 'Eu não lembro, mas deve fazer muitos anos, nós Gnomos vivemos por muito tempo.', expressao: 'pensando' },
  {
    texto: 'Ei, você toparia ajudar a minha vila?',
    expressao: 'perguntando',
    opcoes: [
      { texto: 'Sim', id: 'sim' },
      { texto: 'Não', id: 'nao' },
    ],
  },
];

/** Depois de "Sim". */
export const CONVERSA_CHEFE_SIM = [
  { texto: 'Perfeito, nós Gnomos estamos lidando com uma verdadeira peste….. os DUENDEEES!', expressao: 'bravo' },
  { texto: 'Se você nos ajudar a livrar dessa peste, eu te recompenso com um presente….. apropriado.', expressao: 'misterioso' },
];

/** Depois de "Não": o chefe ri… e acaba com o jogador. */
export const CONVERSA_CHEFE_NAO = [
  { texto: 'HA HA HA HA HA!', expressao: 'rindo', auto: 2.2 },
];

/** Depois que o castelo é libertado (a recompensa ainda será definida). */
export const CONVERSA_CHEFE_VITORIA = [
  { texto: 'Você derrotou a Princesa Duendete! Seu presente….. logo, logo.', expressao: 'misterioso' },
];

/** Se o jogador voltar a falar com o chefe depois de aceitar a missão. */
export const CONVERSA_CHEFE_LEMBRETE = [
  { texto: 'O portal no fundo da vila leva ao castelo dos duendes. Livre-nos dessa peste!', expressao: 'bravo' },
];

/** Últimas palavras da Princesa Duendete antes de morrer. */
export const CONVERSA_PRINCESA_MORTE = [
  { texto: 'Os Gnomos saaa-…..', expressao: 'agonizando' },
  { texto: 'Mentirosooossss', expressao: 'fraca' },
];
