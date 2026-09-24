// Créditos y licencias.
import { Screen } from './Screen.js';
import { h, button } from '../dom.js';

export class CreditsScreen extends Screen {
  build() {
    this.el.append(
      this.header('Créditos'),
      h(
        'div.credits',
        h('div.info-card', h('h2', 'KARTOPIA · Turbo Grand Prix'), h('p', 'Juego de karts original inspirado en la jugabilidad de los juegos de karts arcade modernos. Personajes, karts, circuitos, objetos, música y efectos son creaciones originales.')),
        h('div.info-card', h('h2', 'Todo procedural'), h('p', 'Los modelos 3D se construyen por código, las texturas se pintan con Canvas 2D y toda la música y los efectos se sintetizan en tiempo real con Web Audio API a partir de partituras en data/music.json. No se usan recursos de terceros protegidos.')),
        h('div.info-card', h('h2', 'Tecnología de terceros'), h('p', 'three.js — Licencia MIT (vendor/three/LICENSE).'), h('p', 'Fuentes Lilita One y Nunito — SIL Open Font License 1.1 (assets/fonts).')),
        button('Volver', () => this.back(), { default: true }),
      ),
      this.footer([['Esc', 'Volver']]),
    );
  }
}
