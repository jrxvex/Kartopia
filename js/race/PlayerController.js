// Controlador del jugador: traduce el InputManager a la entrada del kart.

export class PlayerController {
  constructor(kart, input) {
    this.kart = kart;
    this.input = input;
    this.isAI = false;
  }

  /** Se llama en cada paso fijo antes de la física. */
  update() {
    const im = this.input;
    const inp = this.kart.input;
    inp.throttle = im.getThrottle();
    inp.steer = im.getSteer();
    inp.drift = im.isDown('drift');
    if (im.consumePressed('drift')) inp.driftPressed = true;
    if (im.consumePressed('item')) inp.itemPressed = true;
    if (im.consumeReleased('item')) inp.itemReleased = true;
    inp.itemHeld = im.isDown('item');
    inp.aim = im.getAim();
    inp.lookBack = im.isDown('lookBack');
    if (im.consumePressed('respawn')) inp.respawn = true;
    im.consumeReleased('drift');
  }
}
