// Uso: node --import ./tools/register.mjs tools/simulate.mjs [trackId]
import { register } from 'node:module';

register(new URL('./three-hooks.mjs', import.meta.url));
