// classic template — the original RUMI look, extracted as-is (ADR-006, T2).
// Consumed exclusively through the `@active-template` alias; never import
// `src/templates/classic/...` directly outside this directory.
import type { TemplateDefinition } from '../types';
import { fonts } from './fonts';
import Shell from './Shell';
import HomePage from './HomePage';

export const template: TemplateDefinition = {
  name: 'classic',
  fonts,
  Shell,
  HomePage,
};
