// classic ships no per-surface overrides — every customer surface renders its
// shared default (T4). This empty map keeps `@active-template/surfaces` resolvable
// for the classic build and guarantees zero delta.
import type { TemplateSurfaces } from '../types';

export const surfaces: TemplateSurfaces = {};
