// Controles: joystick virtual (inferior esquerdo), botão de ataque (inferior direito)
// e arrastar a tela para girar a câmera. Também aceita teclado/mouse no computador.

export class Input {
  constructor({ superficie, joystick, knob, botaoAtaque }) {
    this.joystick = joystick;
    this.knob = knob;
    this.joy = { x: 0, y: 0 };
    this.joyId = null;
    this.olharIds = new Map();
    this.olharDX = 0;
    this.olharDY = 0;
    this.ataqueToque = false;
    this.teclas = new Set();

    // --- Joystick ---
    joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      joystick.setPointerCapture(e.pointerId);
      joystick.classList.add('ativo');
      this._atualizarJoy(e);
    });
    joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyId) this._atualizarJoy(e);
    });
    const soltarJoy = (e) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joy.x = 0;
      this.joy.y = 0;
      joystick.classList.remove('ativo');
      this._posicionarKnob(0, 0);
    };
    joystick.addEventListener('pointerup', soltarJoy);
    joystick.addEventListener('pointercancel', soltarJoy);
    joystick.addEventListener('lostpointercapture', soltarJoy);

    // --- Botão de ataque (segurar = atacar continuamente) ---
    botaoAtaque.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      botaoAtaque.setPointerCapture(e.pointerId);
      this.ataqueToque = true;
      botaoAtaque.classList.add('ativo');
    });
    const soltarAtaque = () => {
      this.ataqueToque = false;
      botaoAtaque.classList.remove('ativo');
    };
    botaoAtaque.addEventListener('pointerup', soltarAtaque);
    botaoAtaque.addEventListener('pointercancel', soltarAtaque);
    botaoAtaque.addEventListener('lostpointercapture', soltarAtaque);

    // --- Câmera: arrastar em qualquer região sem botões ---
    superficie.addEventListener('pointerdown', (e) => {
      superficie.setPointerCapture(e.pointerId);
      this.olharIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    superficie.addEventListener('pointermove', (e) => {
      const ultimo = this.olharIds.get(e.pointerId);
      if (!ultimo) return;
      this.olharDX += e.clientX - ultimo.x;
      this.olharDY += e.clientY - ultimo.y;
      ultimo.x = e.clientX;
      ultimo.y = e.clientY;
    });
    const soltarOlhar = (e) => this.olharIds.delete(e.pointerId);
    superficie.addEventListener('pointerup', soltarOlhar);
    superficie.addEventListener('pointercancel', soltarOlhar);

    // --- Teclado (computador) ---
    window.addEventListener('keydown', (e) => {
      this.teclas.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.code));
    window.addEventListener('blur', () => this.teclas.clear());

    // Evita menus/zoom do navegador durante o jogo
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  _atualizarJoy(e) {
    const r = this.joystick.getBoundingClientRect();
    const raio = r.width / 2;
    let dx = e.clientX - (r.left + raio);
    let dy = e.clientY - (r.top + raio);
    const dist = Math.hypot(dx, dy);
    if (dist > raio) {
      dx = (dx / dist) * raio;
      dy = (dy / dist) * raio;
    }
    this._posicionarKnob(dx, dy);
    let x = dx / raio;
    let y = -dy / raio;
    const mag = Math.hypot(x, y);
    const zonaMorta = 0.12;
    if (mag < zonaMorta) {
      x = 0;
      y = 0;
    } else {
      const escala = (mag - zonaMorta) / (1 - zonaMorta) / mag;
      x *= escala;
      y *= escala;
    }
    this.joy.x = x;
    this.joy.y = y;
  }

  _posicionarKnob(dx, dy) {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  /** Vetor de movimento: x = direita, y = frente. Comprimento máximo 1. */
  movimento() {
    let x = this.joy.x;
    let y = this.joy.y;
    const t = this.teclas;
    if (t.has('KeyW') || t.has('ArrowUp')) y += 1;
    if (t.has('KeyS') || t.has('ArrowDown')) y -= 1;
    if (t.has('KeyD') || t.has('ArrowRight')) x += 1;
    if (t.has('KeyA') || t.has('ArrowLeft')) x -= 1;
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return { x, y };
  }

  atacando() {
    return this.ataqueToque || this.teclas.has('Space') || this.teclas.has('KeyJ');
  }

  /** Retorna quanto a câmera foi arrastada desde a última chamada. */
  consumirOlhar(dt) {
    let dx = this.olharDX;
    const dy = this.olharDY;
    if (this.teclas.has('KeyQ')) dx -= 500 * dt;
    if (this.teclas.has('KeyE')) dx += 500 * dt;
    this.olharDX = 0;
    this.olharDY = 0;
    return { dx, dy };
  }

  reiniciar() {
    this.joy.x = 0;
    this.joy.y = 0;
    this.joyId = null;
    this.ataqueToque = false;
    this.olharIds.clear();
    this.olharDX = 0;
    this.olharDY = 0;
    this._posicionarKnob(0, 0);
  }
}
