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
                <CookieConsentProvider>
                  <TableContextProvider>
                    <CartProvider>
                      <CheckoutProvider>
                        <OrderTypeProvider>
                          <SnackbarProvider
                            maxSnack={3}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            autoHideDuration={4000}
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
                                  marginLeft: '8px',
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
