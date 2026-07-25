// /cart renders the active template's CartPage (ADR-006 — cart surface).
// Classic = the original page relocated verbatim to templates/classic/;
// craft = the order-pad re-skin. Both orchestrate the shared useCartPage
// hook + cart-page bodies.
export { default } from '@active-template/CartPage';
