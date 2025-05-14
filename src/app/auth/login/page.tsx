"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import styles from "../../styles/AuthPage.module.css";
import { useRouter } from 'next/navigation'; // Import useRouter

// Mock roles for simulation - in a real app, this would come from your auth system
const ROLES = ["customer", "admin", "cashier", "kitchen-staff", "server"];
let roleIndex = 0; // Simple way to cycle roles for testing

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter(); // Initialize router

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    // Simulate login and role assignment
    console.log("Login attempt:", { email });
    // In a real app, you would authenticate and get the user's role from the backend.
    const mockUserRole = ROLES[roleIndex % ROLES.length];
    roleIndex++; // Cycle to the next role for the next login attempt for testing

    alert(`Simulating login. Assigned role: ${mockUserRole}. Redirecting...`);

    // Redirect based on role
    switch (mockUserRole) {
      case "admin":
        router.push("/admin/dashboard");
        break;
      case "customer":
        router.push("/account"); // User account page
        break;
      case "cashier":
        router.push("/cashier");
        break;
      case "kitchen-staff":
        router.push("/kitchen-staff");
        break;
      case "server":
        router.push("/server");
        break;
      default:
        setError("Unknown user role or redirect path not configured.");
        router.push("/"); // Fallback to homepage
        break;
    }
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
