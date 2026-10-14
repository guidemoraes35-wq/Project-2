# Floresta Sombria

Jogo medieval 3D para navegador (feito para celular, mas funciona no computador).
O jogador escolhe um avatar — **Assassino** ou **Maga** — e entra numa dungeon:
uma trilha sinuosa por uma floresta escura, iluminada apenas pela lua e por lamparinas,
e cercada por um rio que não pode ser atravessado. Quanto mais se avança pela trilha,
mais duendes aparecem. No fim dela, numa clareira com pedras antigas, espera o
**Chefão Duende**. Tudo isso é o tutorial.

## Depois do tutorial

1. **Portal:** quando o Chefão Duende morre, um portal verde se abre onde ele caiu.
   Atravessar o portal leva à criação do personagem.
2. **Criação do personagem definitivo**, em três etapas (com prévia 3D num pedestal; arraste para girar):
   - **Aparência:** menino ou menina, e uma das 6 combinações de cor de pele, cabelo e olhos
     (só as cores aparecem na tela).
   - **Roupa:** vermelha com detalhes marrons, azul com detalhes brancos ou verde com detalhes pretos.
   - **Presente:** espada, vara ou escudo, cada um com um bônus nos atributos.
3. **Vilarejo:** o personagem aparece num vilarejo de dia — praça com poço, casas, feira, horta,
   moinho e floresta em volta. O joystick e o botão de ataque continuam na tela. O botão com o
   ícone do personagem (canto superior direito) mostra os atributos (só os números) e os itens,
   cada um com o botão **Equipar** / **Remover**. O herói segura até **dois itens** ao mesmo tempo.
   Se cair, levanta de novo na entrada do vilarejo.

### Gnomos

Sempre há de 10 a 15 gnomos passeando pelo vilarejo: pequenos, chapéu de cone vermelho, roupa
azul ou verde e barba branca cheia. São pacíficos, mas quem bate num gnomo deixa ele (e os gnomos
a até 8 m) bravos: ficam mais rápidos e revidam com uma **espadinha** (Poder) ou com a **magia de
terra** (Inteligência), que marca um círculo no chão e faz espinhos de pedra saírem da terra.
Ficam calmos de novo depois de 20 s sem apanhar. Um gnomo derrotado é substituído por outro após 12 s.

| | Vida | Poder | Velocidade | Defesa | Inteligência |
| --- | --- | --- | --- | --- | --- |
| Gnomo | 120 | 30 | 20 (feliz) / 45 (bravo) | 30 | 80 |

O **Gnomo Chefe** fica parado na praça, ao lado do poço, com coroa em vez de chapéu pontudo.
Chegando perto dele aparece o botão **Falar com o Gnomo Chefe**.

### Conversas

Em qualquer conversa, o joystick e o botão de ataque somem, o herói fica parado olhando para quem
fala e a câmera se aproxima dos dois. As falas ficam em `src/conversas.js`.

Na conversa do Gnomo Chefe ele desconfia, se espanta ("UM HUMANO???"), tenta lembrar, pensa e
pergunta se o herói topa ajudar a vila:
- **Não:** o chefe cai na risada e acaba com o herói na hora (ele volta na entrada da vila).
- **Sim:** o chefe conta da peste dos duendes, promete um presente "apropriado" e um **portal
  verde** se abre no fundo da vila, perto do moinho, levando ao castelo dos duendes.

## Castelo dos Duendes

Um pátio murado ao entardecer, com torres, a fortaleza no fundo, fogueira, tendas e barricadas.
Os duendes ficam parados até o herói chegar perto (13 m). Um contador no alto mostra quantos faltam;
derrotando todos, abre-se um portal de volta para a vila. Se o herói cair, volta no portão do castelo.

| | Vida | Poder | Velocidade | Defesa | Inteligência | Quantidade |
| --- | --- | --- | --- | --- | --- | --- |
| Duende fraco (clava) | 20 | 5 | 20 | 5 | 0 | 30 |
| Duende arqueiro (flechas) | 20 | 8 | 15 | 0 | 0 | 8 |
| Duende mágico (veneno) | 5 | 5 | 30 | 5 | 20 | 6 |

### Experiência e níveis

Duendes fracos e arqueiros deixam cair **XP**: uma molécula vermelha brilhante que voa até o herói
quando ele chega perto (duende fraco 5 XP, arqueiro 8 XP). O herói começa no **nível 1** e sobe de
nível ao juntar **15 + 5N** de XP (N = nível atual), até o **nível 10**. A cada nível o jogo pausa
e o jogador escolhe uma melhoria:

| | Melhoria |
| --- | --- |
| A | Vida +5 |
| B | Ataque (Poder) +2 |
| C | Velocidade +2 |
| D | Defesa +3 |
| E | Inteligência +2 |

No computador também dá para escolher com as teclas A a E. O nível e o XP aparecem embaixo da
barra de vida e no painel do personagem.

O **veneno** do duende mágico não causa dano no contato: tira 1 de vida por segundo durante 3 s
(a barra de vida fica verde enquanto isso).

### Atributos do personagem definitivo

| | Vida | Poder | Velocidade | Defesa | Inteligência |
| --- | --- | --- | --- | --- | --- |
| Base | 10 | 5 | 25 | 5 | 5 |
| Espada | | +15 | | | |
| Vara | +5 | | | | +10 |
| Escudo | | | −3 | +15 | |

A velocidade final define a velocidade de movimento no vilarejo (`velocidade × 0,2` metros por segundo).

## Como jogar

O jogo abre numa tela escura com o botão **Iniciar Tutorial** (vai para a escolha do avatar) e, embaixo,
**Pular tutorial**, que leva direto à criação do personagem.

| Ação | Celular | Computador |
| --- | --- | --- |
| Mover | Joystick no canto inferior esquerdo (360°) | WASD / setas |
| Atacar | Botão no canto inferior direito (segure para atacar sem parar) | Espaço ou J |
| SUPER | Botão menor acima e à direita do botão de ataque | K |
| Girar a câmera | Arrastar o dedo em qualquer região sem botões | Arrastar o mouse, ou Q / E |

O ataque tem mira automática: o avatar se vira para o duende mais próximo ao atacar.

## Rodando localmente

Os módulos JavaScript precisam ser servidos por HTTP (abrir o `index.html` direto do disco não funciona):

```bash
python3 -m http.server 8000
# abra http://localhost:8000 (no celular: http://<ip-do-computador>:8000)
```

Não há etapa de build nem dependências para instalar — o Three.js está em `vendor/`.
Também funciona publicado no GitHub Pages.

Para gerar uma versão em arquivo único (`dist/floresta-sombria.html`, com o Three.js vindo da CDN):

```bash
node tools/build-single-html.mjs
```

## Atributos

| | Vida | Poder | Velocidade | Defesa | Inteligência |
| --- | --- | --- | --- | --- | --- |
| Assassino | 100 | 30 | 35 | 10 | 15 |
| Maga | 150 | 10 | 20 | 20 | 40 |
| Duende | 50 | 10 | 20 | 10 | 0 |
| Duende Arqueiro | 75 | 30 | 25 | 20 | 0 |
| Chefão Duende | 200 | 40 | 10 | 50 | 0 |

- **Vida**: pontos de vida; ao chegar a zero, o personagem morre.
- **Poder**: dano dos ataques físicos (adagas do Assassino, clava dos duendes).
- **Velocidade**: velocidade de movimento (`velocidade × 0,2` metros por segundo).
- **Defesa**: reduz o dano recebido.
- **Inteligência**: dano dos ataques mágicos (orbes da Maga).

Cada ataque usa um atributo, e 1 ponto de Poder ou de Inteligência vale 1 ponto de ataque.
Hoje o Assassino ataca com o Poder, a Maga com a Inteligência e os duendes (inclusive as
flechas do arqueiro) com o Poder.

## SUPER

Todo avatar e o Chefão têm um SUPER (entre os duendes comuns, nenhum tem ainda).

- **Maga — Bola de Fogo 🔥:** persegue o inimigo mais próximo e ataca com o dobro da
  Inteligência (80 pontos de ataque, passando pela fórmula da defesa). Depois queima o
  inimigo: 3 de vida por segundo durante 5 segundos. Carrega a cada 15 inimigos derrotados.
- **Assassino — Invisibilidade (ícone de capa de mago translúcida):** fica invisível para todos
  os inimigos por 2 segundos; eles param de perseguir e de atacar. Para quem joga, ele vira um
  vulto azul translúcido, ainda visível. Pode ser usada a cada 10 segundos.
- **Chefão — Arremesso de Pedra:** a cada 8 a 10 ataques, arranca uma pedra do chão e a
  arremessa no jogador, causando 80 de dano. Um círculo no chão mostra onde ela vai cair.

**Regeneração:** depois de 5 segundos sem tomar dano, todos os personagens recuperam 3% da
vida máxima por segundo, arredondado para cima (Assassino 3, Maga 5, Duende 2, Arqueiro 3,
Chefão 6 por segundo).

**Duendes por rodada:** 20 a 25 duendes comuns ao longo de toda a trilha e 5 a 8 arqueiros
nas regiões intermediária e final. Eles surgem à frente do jogador conforme ele avança,
cada vez mais concentrados perto do fim. O arqueiro mantém distância e atira flechas na
posição atual do jogador: andando, dá para desviar.

Fórmula de dano: `dano = ataque² / (ataque + defesa)`, arredondado, mínimo 1.
Por exemplo: Assassino → duende = 30²/40 ≈ 23 (3 golpes); Maga → duende = 40²/50 = 32 (2 orbes);
duende → Assassino = 10²/20 = 5 (20 golpes); duende → Maga = 10²/30 ≈ 3 (50 golpes).

O Chefão aparece quando o jogador chega à clareira no fim da trilha. Ele é lento, mas cada golpe da
clava é pesado: Assassino → chefão = 30²/80 ≈ 11 (19 golpes); Maga → chefão = 40²/90 ≈ 18 (12 orbes);
chefão → Assassino = 40²/50 = 32 (4 golpes); chefão → Maga = 40²/60 ≈ 27 (6 golpes).
Um círculo vermelho no chão avisa onde a clava vai cair: saia dele para não ser atingido.

Todos os valores ficam em `src/config.js`.

## Estrutura

```
index.html        HUD, controles e telas
css/style.css     estilos (responsivo: celular em pé/deitado e computador)
src/config.js     atributos, regras, fórmula de dano e opções da criação do personagem
src/main.js       loop do jogo, jogador, duendes, combate, câmera, telas, portal, criação e vilarejo
src/world.js      trilha, rio, floresta, lamparinas, clareira final, lua, colisões
src/portal.js     portal verde que se abre quando o chefão morre
src/estudio.js    cenário da criação do personagem (pedestal mágico)
src/vilarejo.js   vilarejo: casas, praça, poço, feira, horta, moinho e colisões
src/gnomos.js     gnomos do vilarejo: passeio, raiva, espada, magia de terra e o Gnomo Chefe (expressões)
src/conversas.js  falas das conversas
src/castelo.js    castelo dos duendes: muralhas, torres, fortaleza, pátio e colisões
src/duendesCastelo.js  duendes do castelo: fracos, arqueiros e mágicos (veneno)
src/xp.js         orbes de XP que os duendes deixam cair
src/natureza.js   pinheiros, carvalhos, pedras, arbustos, grama ao vento, lamparinas e braseiros
src/models.js     modelos cartoon (sombreado toon + contorno, joelhos e cotovelos articulados) e animações
src/effects.js    partículas, rastro de golpe e números de dano
src/input.js      joystick, botão de ataque, arrastar câmera e teclado
vendor/           Three.js r170
```
