// Nombres legibles para los códigos de tecla (KeyboardEvent.code).

const SPECIAL = {
  Space: 'Espacio',
  ShiftLeft: 'Shift Izq.',
  ShiftRight: 'Shift Der.',
  ControlLeft: 'Ctrl Izq.',
  ControlRight: 'Ctrl Der.',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Meta',
  MetaRight: 'Meta Der.',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Enter: 'Intro',
  NumpadEnter: 'Intro (num)',
  Backspace: 'Retroceso',
  Tab: 'Tab',
  CapsLock: 'Bloq Mayús',
  Backquote: 'º',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: 'Ñ',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (SPECIAL[code]) return SPECIAL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
