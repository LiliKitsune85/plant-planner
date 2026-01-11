import { render, screen } from '@testing-library/react'

import { AuthLinks } from './AuthLinks'

describe('AuthLinks', () => {
  it('returns null when no links are provided', () => {
    const { container } = render(<AuthLinks links={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders navigation with aria-label for helper links', () => {
    render(
      <AuthLinks
        links={[
          { label: 'Reset password', description: 'Przypomnij hasło', href: '/reset' },
          { label: 'Register', href: '/register' },
        ]}
      />,
    )

    const nav = screen.getByRole('navigation', { name: /linki pomocnicze/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByText('Reset password')).toBeInTheDocument()
    expect(screen.getByText('Przypomnij hasło')).toBeInTheDocument()
    const registerLink = screen.getByText('Register').closest('a')
    expect(registerLink).not.toBeNull()
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  it('omits description paragraph when not provided', () => {
    render(<AuthLinks links={[{ label: 'Register', href: '/register' }]} />)

    const link = screen.getByText('Register').closest('a')
    expect(link).not.toBeNull()
    expect(link?.querySelectorAll('p')).toHaveLength(1)
  })
})
