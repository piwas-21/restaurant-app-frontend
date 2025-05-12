// src/app/auth/login/page.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import styles from "../../styles/AuthPage.module.css"; // Create this CSS module

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Basic validation
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    // TODO: Implement actual login logic (e.g., API call)
    console.log("Login attempt:", { email });
    alert("Login functionality to be implemented. Check console.");
    // On success, redirect or update auth state
  };

  return (
    <main className={styles.authContainer}>
      <div className={styles.authForm} role="form" aria-labelledby="login-heading">
        <h1 id="login-heading">Login</h1>
        <form onSubmit={handleSubmit} noValidate>
          {error && <p className={styles.errorMessage} role="alert">{error}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error && email === "" ? "email-error" : undefined}
              ref={emailInputRef}
              autoComplete="email"
            />
            {error && email === "" && <span id="email-error" className="sr-only">Email is required.</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error && password === "" ? "password-error" : undefined}
              autoComplete="current-password"
            />
            {error && password === "" && <span id="password-error" className="sr-only">Password is required.</span>}
          </div>
          <button type="submit" className={styles.submitButton}>Login</button>
        </form>
        <p className={styles.switchFormText}>
          Don&apos;t have an account? <Link href="/auth/register">Register here</Link>
        </p>
      </div>
    </main>
  );
}

