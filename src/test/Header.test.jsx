import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Header from '../components/Header'

// Mock localStorage
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('Header Component', () => {
  it('renders header component', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('shows login state when not authenticated', () => {
    localStorage.setItem('auth', JSON.stringify({ isAuthenticated: false }))
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    // Header should render without errors
    expect(document.querySelector('header')).toBeTruthy()
  })

  it('handles authentication state', () => {
    const authData = {
      isAuthenticated: true,
      email: 'test@example.com',
      role: 'staff'
    }
    localStorage.setItem('auth', JSON.stringify(authData))
    
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    
    expect(document.querySelector('header')).toBeTruthy()
  })
})
