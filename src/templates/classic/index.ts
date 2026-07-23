// classic template — the original RUMI look, extracted as-is (ADR-006, T2).
// Consumed exclusively through the `@active-template` alias; never import
// `src/templates/classic/...` directly outside this directory.
import type { TemplateDefinition } from '../types';
import { fonts } from './fonts';
import Shell from './Shell';
import HomePage from './HomePage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import CheckoutReviewPage from './CheckoutReviewPage';
import CartPage from './CartPage';
import ReservationsPage from './ReservationsPage';
import MyReservationsPage from './MyReservationsPage';

export const template: TemplateDefinition = {
  name: 'classic',
  fonts,
  Shell,
  HomePage,
  LoginPage,
  RegisterPage,
  CheckoutReviewPage,
  CartPage,
  ReservationsPage,
  MyReservationsPage,
};
