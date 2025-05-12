// src/app/admin/dashboard/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import styles from "../../styles/AdminPage.module.css"; // Create this CSS module

// Mock-up, actual admin auth and data fetching would be implemented
const isAdmin = true; // Placeholder for admin check

export default function AdminDashboardPage() {
  if (!isAdmin) {
    return <p>Access Denied. You must be an admin to view this page.</p>;
    // Or redirect to login: router.push('/auth/login');
  }

  return (
    <main className={styles.adminContainer}>
      <header className={styles.adminHeader}>
        <h1>Admin Dashboard</h1>
      </header>
      <nav className={styles.adminNav}>
        <ul>
          <li><Link href="/admin/menu-management">Manage Menu</Link></li>
          <li><Link href="/admin/specials-management">Manage Daily Specials</Link></li>
          <li><Link href="/admin/member-management">Manage Members</Link></li>
          {/* Add other admin links as needed */}
        </ul>
      </nav>
      <section className={styles.adminContent}>
        <h2>Welcome, Admin!</h2>
        <p>Select an option from the navigation to manage restaurant data.</p>
        {/* Display some quick stats or overview if needed */}
      </section>
    </main>
  );
}

