# Floresta Sombria

Jogo medieval 3D para navegador (feito para celular, mas funciona no computador).
O jogador escolhe um avatar — **Assassino** ou **Maga** — e entra numa dungeon:
uma floresta escura, iluminada apenas pela lua e por algumas lamparinas.
Para vencer, é preciso derrotar todos os duendes (entre 20 e 30) que surgem na floresta
e, depois deles, o **Chefão Duende**.

## Como jogar

| Ação | Celular | Computador |
| --- | --- | --- |
| Mover | Joystick no canto inferior esquerdo (360°) | WASD / setas |
| Atacar | Botão no canto inferior direito (segure para atacar sem parar) | Espaço ou J |
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
| Chefão Duende | 200 | 40 | 10 | 50 | 0 |

- **Vida**: pontos de vida; ao chegar a zero, o personagem morre.
- **Poder**: dano dos ataques físicos (adagas do Assassino, clava dos duendes).
- **Velocidade**: velocidade de movimento (`velocidade × 0,2` metros por segundo).
- **Defesa**: reduz o dano recebido.
- **Inteligência**: dano dos ataques mágicos (orbes da Maga).

Cada ataque usa um atributo, e 1 ponto de Poder ou de Inteligência vale 1 ponto de ataque.
Hoje o Assassino ataca com o Poder, a Maga com a Inteligência e os duendes com o Poder.

Fórmula de dano: `dano = ataque² / (ataque + defesa)`, arredondado, mínimo 1.
Por exemplo: Assassino → duende = 30²/40 ≈ 23 (3 golpes); Maga → duende = 40²/50 = 32 (2 orbes);
duende → Assassino = 10²/20 = 5 (20 golpes); duende → Maga = 10²/30 ≈ 3 (50 golpes).

O Chefão aparece alguns segundos depois que o último duende cai. Ele é lento, mas cada golpe da
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
src/world.js      floresta: árvores, lamparinas, lua, névoa, vaga-lumes, colisões
src/models.js     modelos cartoon (sombreado toon + contorno) e animações
src/effects.js    partículas, rastro de golpe e números de dano
src/input.js      joystick, botão de ataque, arrastar câmera e teclado
vendor/           Three.js r170
```
