"use client";

import React from 'react';
import Link from 'next/link';

export default function CashierPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Cashier Interface</h1>
      <p>This page is for cashier staff. Features to be implemented:</p>
      <ul>
        <li>Process Orders</li>
        <li>Manage Payments</li>
        <li>View Active Tables/Pickups</li>
      </ul>
      <Link href="/" style={{ marginTop: '2rem', display: 'inline-block' }}>Go to Homepage</Link>
    </main>
  );
}
