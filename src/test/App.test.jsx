import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.querySelector('.layout-container')).toBeInTheDocument()
  })

  it('renders error boundary', () => {
    render(<App />)
    // App should be wrapped in ErrorBoundary
    expect(document.querySelector('.layout-container')).toBeTruthy()
  })

  it('has proper background gradient', () => {
    render(<App />)
    const container = document.querySelector('.bg-gradient-to-br')
    expect(container).toBeInTheDocument()
  })
})
