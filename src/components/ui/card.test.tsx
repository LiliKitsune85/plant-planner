import { render, screen } from '@testing-library/react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card'

describe('Card UI primitives', () => {
  it('applies data-slot and merges className on Card root', () => {
    render(
      <Card data-testid="card-root" className="border-primary shadow-xl">
        Root content
      </Card>,
    )

    const card = screen.getByTestId('card-root')
    expect(card).toHaveAttribute('data-slot', 'card')
    expect(card).toHaveClass('border-primary')
    expect(card).toHaveClass('shadow-xl')
    expect(card).toHaveTextContent('Root content')
  })

  it('sets slot attributes for structural children', () => {
    render(
      <Card>
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Title</CardTitle>
          <CardDescription data-testid="description">Description</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>,
    )

    expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'card-header')
    expect(screen.getByTestId('title')).toHaveAttribute('data-slot', 'card-title')
    expect(screen.getByTestId('description')).toHaveAttribute('data-slot', 'card-description')
    expect(screen.getByTestId('content')).toHaveAttribute('data-slot', 'card-content')
    expect(screen.getByTestId('footer')).toHaveAttribute('data-slot', 'card-footer')
  })
})
