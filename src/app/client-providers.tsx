'use client';

import { ThemeProvider } from '@/components/ThemeContext';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { CookieConsentProvider } from '@/components/CookieConsentContext';
import { CartProvider } from '@/components/cart/CartContext';
import { SnackbarProvider, closeSnackbar } from 'notistack';
import React from 'react';
import { AuthProvider } from '@/components/AuthContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { CheckoutProvider } from '@/contexts/CheckoutContext';
import { OrderTypeProvider } from '@/contexts/OrderTypeContext';
import { TableContextProvider } from '@/contexts/TableContext';
import { X } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ModulesProvider } from '@/contexts/ModulesContext';
import type { ModuleId } from '@/lib/modules';
import DocumentLanguage from '@/components/DocumentLanguage';
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';

/**
 * @param modules Product modules this tenant runs, read server-side in the root layout
 *   (sofra ADR-010 / S11). Passed down rather than fetched here so a gated route never
 *   paints before the answer arrives.
 */
export default function ClientProviders({
  modules,
  children,
}: Readonly<{ modules: ModuleId[]; children: React.ReactNode }>) {
  return (
    <ModulesProvider modules={modules}>
      <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'}>
        <AuthProvider>
          <SessionProvider>
            <ThemeProvider>
              <I18nextProvider i18n={i18n}>
                {/* Inside the i18n provider (it reads the active language) and outside everything
                    else (it renders nothing and must run whatever the rest of the tree does). */}
                <DocumentLanguage />
                {/* PWA (task A): the registrar renders nothing and only runs in a production
                    build; the install banner is mobile-only and self-suppressing. Both live
                    inside the i18n provider because the banner is translated. */}
                <ServiceWorkerRegistrar />
                <PwaInstallPrompt />
                <CookieConsentProvider>
                  <TableContextProvider>
                    <CartProvider>
                      <CheckoutProvider>
                        <OrderTypeProvider>
                          <SnackbarProvider
                            maxSnack={3}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            autoHideDuration={4000}
                            // #424. The positioning override has to be scoped PER ANCHOR, and this
                            // prop is the only hook for it: `.notistack-SnackbarContainer` matches
                            // every container, so one logical-property rule there necessarily
                            // breaks whichever anchor it was not written for. Converting it moved
                            // the bottom-right toasts correctly and clipped the top-center cart
                            // toast to x=-151..199 in `ar` — 151px of 349px off screen — because
                            // `inset-inline-end` resolves to `left`, which beats notistack's
                            // centring `left: 50%` while its `translateX(-50%)` survives.
                            //
                            // Only two anchors exist in the tree, and the split is lopsided: of 89
                            // `enqueueSnackbar` call sites, exactly ONE is top-center —
                            // `useCartFeedback`'s `notifyItemAdded`. Everything else lands in the
                            // bottom-right container, whether it passes the anchor explicitly (24
                            // do) or inherits this default (the other 64). `useCartFeedback` is on
                            // BOTH sides: its `notifyAddFailed` passes no anchor, so the add-FAILURE
                            // toast is bottom-right while the add-success one is not.
                            //
                            // The centre one is deliberately given NO class — notistack centres it
                            // correctly on its own, in both directions.
                            //
                            // Doing it here rather than flipping `anchorOrigin` is what makes it
                            // work at all: notistack resolves per-snack options over provider
                            // props, so a provider-level flip is dead for every call site that
                            // passes its own. Driving it from CSS ignores what they pass.
                            //
                            // ⚠️ Only the anchors below are mapped. A `bottom-left` or `top-right`
                            // toast added later would get NO class and fall back to notistack's own
                            // PHYSICAL `left: 20px` / `right: 20px` — silently reintroducing this
                            // exact bug, and invisibly to `check-physical-css.mjs`, which only walks
                            // `src/**/*.css` and cannot see a vendor's injected rules. Add the
                            // matching key here when you add the anchor.
                            classes={{ containerAnchorOriginBottomRight: 'notistack-anchor-bottom-trailing' }}
                            action={(snackbarKey) => (
                              <button
                                onClick={() => closeSnackbar(snackbarKey)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'inherit',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginInlineStart: '8px',
                                  opacity: 0.8,
                                  transition: 'opacity 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                                aria-label="Close notification"
                              >
                                <X size={18} strokeWidth={2} />
                              </button>
                            )}
                          >
                            {children}
                          </SnackbarProvider>
                        </OrderTypeProvider>
                      </CheckoutProvider>
                    </CartProvider>
                  </TableContextProvider>
                </CookieConsentProvider>
              </I18nextProvider>
            </ThemeProvider>
          </SessionProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ModulesProvider>
  );
}
