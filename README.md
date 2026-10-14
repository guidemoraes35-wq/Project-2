# Floresta Sombria

Jogo medieval 3D para navegador (feito para celular, mas funciona no computador).
O jogador escolhe um avatar — **Assassino** ou **Maga** — e entra numa dungeon:
uma trilha sinuosa por uma floresta escura, iluminada apenas pela lua e por lamparinas,
e cercada por um rio que não pode ser atravessado. Quanto mais se avança pela trilha,
mais duendes aparecem. No fim dela, numa clareira com pedras antigas, espera o
**Chefão Duende**: derrotá-lo vence o jogo.

## Como jogar

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
- **Assassino — Invisibilidade 👻:** fica invisível para todos os inimigos por 2 segundos;
  eles param de perseguir e de atacar. Pode ser usada a cada 10 segundos.
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
src/config.js     atributos, regras e fórmula de dano
src/main.js       loop do jogo, jogador, duendes, combate, câmera, telas
src/world.js      trilha, rio, floresta, lamparinas, clareira final, lua, colisões
src/models.js     modelos cartoon (sombreado toon + contorno) e animações
src/effects.js    partículas, rastro de golpe e números de dano
src/input.js      joystick, botão de ataque, arrastar câmera e teclado
vendor/           Three.js r170
```
