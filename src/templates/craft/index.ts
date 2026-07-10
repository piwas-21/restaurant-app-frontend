// craft template — the sofra-mirror look (ADR-006, S15 T3 slice 1).
// Consumed exclusively through the `@active-template` alias; never import
// `src/templates/craft/...` directly outside this directory.
import type { TemplateDefinition } from '../types';
import { fonts } from './fonts';
import Shell from './Shell';
import HomePage from './HomePage';

export const template: TemplateDefinition = {
  name: 'craft',
  fonts,
  Shell,
  HomePage,
};
