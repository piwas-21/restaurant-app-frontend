"use client";

import React from 'react';
import Link from 'next/link';

export default function AccountPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Customer Account Page</h1>
      <p>This is your personal account area. Features to be implemented:</p>
      <ul>
        <li>View Order History</li>
        <li>Manage Profile</li>
        <li>Saved Addresses</li>
        <li>Payment Methods</li>
      </ul>
      <Link href="/" style={{ marginTop: '2rem', display: 'inline-block' }}>Go to Homepage</Link>
    </main>
  );
}
