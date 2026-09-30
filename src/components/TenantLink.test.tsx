import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import TenantLink from './TenantLink';

jest.mock('next/link', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/ar/cart'),
}));

describe('TenantLink URL objects', () => {
  const nextLinkMock = NextLink as unknown as jest.Mock;

  beforeEach(() => {
    nextLinkMock.mockClear();
    jest.mocked(usePathname).mockReturnValue('/ar/cart');
  });

  it('preserves an external object destination without localizing its path', () => {
    const href: ComponentProps<typeof NextLink>['href'] = {
      protocol: 'https:',
      host: 'cdn.example.test',
      hostname: 'cdn.example.test',
      pathname: '/menu',
      query: { source: 'fixture' },
      hash: 'section',
    };

    render(<TenantLink href={href}>External</TenantLink>);

    expect(lastLinkProps().href).toEqual(href);
  });

  it('localizes a relative object destination and retains query and hash', () => {
    const href: ComponentProps<typeof NextLink>['href'] = {
      pathname: '/menu',
      query: { qr: 'printed-code' },
      hash: 'section',
    };

    render(<TenantLink href={href}>Menu</TenantLink>);

    expect(lastLinkProps().href).toEqual({ ...href, pathname: '/ar/menu' });
  });

  function lastLinkProps(): { href: ComponentProps<typeof NextLink>['href'] } {
    const call = nextLinkMock.mock.calls[nextLinkMock.mock.calls.length - 1];
    return call[0] as { href: ComponentProps<typeof NextLink>['href'] };
  }
});
