"use client";

import React from 'react';
import Link from 'next/link';

export default function KitchenStaffPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Kitchen Staff Dashboard</h1>
      <p>This page is for kitchen staff. Features to be implemented:</p>
      <ul>
        <li>View Incoming Orders</li>
        <li>Manage Order Status (e.g., Preparing, Ready)</li>
        <li>Inventory Alerts (Low Stock)</li>
      </ul>
      <Link href="/" style={{ marginTop: '2rem', display: 'inline-block' }}>Go to Homepage</Link>
    </main>
  );
}
