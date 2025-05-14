"use client";

import React from 'react';
import Link from 'next/link';

export default function ServerPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Server Interface</h1>
      <p>This page is for serving staff. Features to be implemented:</p>
      <ul>
        <li>Manage Table Orders</li>
        <li>Send Orders to Kitchen/Bar</li>
        <li>Table Status (e.g., Occupied, Needs Cleaning)</li>
      </ul>
      <Link href="/" style={{ marginTop: '2rem', display: 'inline-block' }}>Go to Homepage</Link>
    </main>
  );
}
