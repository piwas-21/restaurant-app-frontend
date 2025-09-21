import { z } from 'zod';
import { loginSchema } from '../schemas/auth.schema';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const AUTH_API_URL = `${API_BASE_URL}/api/Auth`;

export async function login(formData: z.infer<typeof loginSchema>) {
  const response = await fetch(`${AUTH_API_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  if (response.ok) {
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  }

  return response.json();
}

export async function refreshToken() {
    const accessToken = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await fetch(`${AUTH_API_URL}/refresh-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken, refreshToken }),
    });

    const data = await response.json();
    if (data.success) {
        localStorage.setItem('token', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
}

// Customer registration
export type CustomerRegistrationPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export async function registerCustomer(formData: CustomerRegistrationPayload) {
  const response = await fetch(`${API_BASE_URL}/api/User/register/customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'text/plain',
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  if (response.ok && data?.success) {
    try {
      if (data.data?.accessToken) localStorage.setItem('token', data.data.accessToken);
      if (data.data?.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
    } catch (e) {
      // localStorage may be unavailable; ignore and let caller proceed
      console.warn('Could not persist tokens to localStorage', e);
    }
  }
  return data;
}
