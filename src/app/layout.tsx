/* src/app/layout.tsx */
"use client"; 

import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartContext";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "../i18n"; 
import LanguageSwitcher from "@/components/LanguageSwitcher"; 
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeProvider, useTheme } from "@/components/ThemeContext"; 
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { SnackbarProvider } from "notistack";
import { usePathname } from "next/navigation";
import navStyles from "./styles/Header.module.css"; // Import the new header styles

const inter = Inter({ subsets: ["latin"] });

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTheme(); 
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const { t } = useTranslation(); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerHeight = "80px"; // Define header height as a constant

  useEffect(() => {
    setIsClient(true);
    const currentLang = i18n.language || window.localStorage.getItem("i18nextLng") || "en";
    document.documentElement.lang = currentLang.split("-")[0];

    const handleLanguageChanged = (lng: string) => {
      document.documentElement.lang = lng.split("-")[0];
    };
    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    if (isClient) {
        document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme, isClient]);

  useEffect(() => {
    if (isClient) {
      if (mobileMenuOpen) {
        document.body.classList.add("mobile-menu-open");
      } else {
        document.body.classList.remove("mobile-menu-open");
      }
    }
    return () => {
      if (isClient) {
        document.body.classList.remove("mobile-menu-open");
      }
    };
  }, [mobileMenuOpen, isClient]);

  const langForHtml = isClient ? (i18n.language.split("-")[0] || "en") : "en";
  const themeForHtml = isClient ? theme : "light"; 

  const logoSrc = theme === 'dark' ? "/rumi_logo_transparent_dark.png" : "/rumi_logo_transparent.png";

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <html lang={langForHtml} data-theme={themeForHtml} suppressHydrationWarning={true}>
      <body className={inter.className}>
        <I18nextProvider i18n={i18n}>
          <CartProvider>
            <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "top", horizontal: "center"}}>
              <header style={{ 
                padding: "0 1rem", 
                backgroundColor: "var(--secondary-color)", 
                color: "var(--text-color)", 
                borderBottom: "1px solid var(--border-color)",
                position: "sticky", 
                top: 0,
                zIndex: 1000,
                height: headerHeight
              }}>
                <div style={{ 
                  maxWidth: "1200px", 
                  margin: "0 auto", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  height: "100%"
                }}>
                  <Link href="/" style={{ textDecoration: "none", color: "var(--primary-color)", display: "flex", alignItems: "center" }} onClick={closeMobileMenu}>
                    <Image src={logoSrc} alt="RUMI Restaurant Logo" width={180} height={90} style={{ marginRight: "10px", objectFit: "contain", maxHeight: `calc(${headerHeight} - 10px)` }} priority />
                  </Link>
                  
                  <button className={navStyles.hamburgerMenu} onClick={toggleMobileMenu} aria-label={mobileMenuOpen ? t('close_menu') : t('open_menu')} aria-expanded={mobileMenuOpen}>
                    {mobileMenuOpen ? 
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                      </svg> 
                      :
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                    }
                  </button>

                  <nav className={`${navStyles.navLinksContainer} ${mobileMenuOpen ? navStyles.mobileMenuOpen : ''}`}>
                    <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`} onClick={closeMobileMenu}>{t('nav_home', 'Home')}</Link>
                    <Link href="/menu" className={`nav-link ${pathname === '/menu' ? 'active' : ''}`} onClick={closeMobileMenu}>{t('nav_menu', 'Menu')}</Link>
                    <Link href="/reservations" className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`} onClick={closeMobileMenu}>{t('nav_reservations', 'Reservations')}</Link>
                    <Link href="/cart" className={`nav-link ${pathname === '/cart' ? 'active' : ''}`} onClick={closeMobileMenu}>{t('nav_cart', 'Cart')}</Link> 
                    <Link href="/auth/login" className={`nav-link ${pathname === '/auth/login' ? 'active' : ''}`} onClick={closeMobileMenu}>{t('nav_login', 'Login')}</Link> 
                    {isClient && (
                      <div className={navStyles.switcherGroup}>
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                      </div>
                    )}
                  </nav>
                </div>
              </header>
              
              <main style={{ 
                  paddingLeft: isHomePage ? "0" : "1rem",
                  paddingRight: isHomePage ? "0" : "1rem",
                  paddingBottom: isHomePage ? "0" : "1rem",
                  maxWidth: isHomePage ? "none" : "1200px",
                  margin: isHomePage ? "0" : "0 auto",
                  paddingTop: isHomePage ? "0" : headerHeight
              }}>
                  {children}
              </main>
              
              {!isHomePage && (
                <footer style={{ padding: "2rem 1rem", backgroundColor: "var(--secondary-color)", color: "var(--text-color)", textAlign: "center", marginTop: "2rem", borderTop: "1px solid var(--border-color)" }}>
                  <p>&copy; {new Date().getFullYear()} RUMI Restaurant. All rights reserved.</p>
                  <p>Rue de Berne 13, 1201 Genève, Switzerland</p>
                </footer>
              )}
            </SnackbarProvider>
          </CartProvider>
        </I18nextProvider>
      </body>
    </html>
  );
}

export default function RootLayoutOuter({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AppLayout>{children}</AppLayout>
        </ThemeProvider>
    );
}
