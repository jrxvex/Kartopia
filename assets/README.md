# Recursos (assets)

Todos los recursos del juego son **originales**:

- `icons/items/*.svg` — iconos de los objetos, dibujados a mano en SVG.
- `ui/favicon.svg` — icono de la pestaña.
- `fonts/` — fuentes con licencia SIL Open Font License (Lilita One, Nunito). Ver los `OFL-*.txt`.

Los **modelos 3D** (karts, personajes, decoración, monumentos) se generan por código en `js/models/` y
`js/track/LandmarkKit.js`; las **texturas** se pintan en tiempo real con Canvas 2D en
`js/render/TextureFactory.js`; y la **música y los efectos de sonido** se sintetizan con Web Audio API
(`js/audio/`) a partir de las partituras de `data/music.json`. Así el juego no depende de archivos
binarios ni de recursos de terceros protegidos por derechos de autor.
