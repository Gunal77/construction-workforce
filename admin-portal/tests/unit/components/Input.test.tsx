/**
 * Input Component Unit Tests
 * 
 * Tests for the Input component including:
 * - Rendering with different props
 * - Label display
 * - Error state handling
 * - Helper text display
 * - User interactions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '@/components/Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<Input label="Email Address" />);
      
      const label = screen.getByText('Email Address');
      expect(label).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter your email" />);
      
      const input = screen.getByPlaceholderText('Enter your email');
      expect(input).toBeInTheDocument();
    });

    it('should render required indicator when required', () => {
      render(<Input label="Email" required />);
      
      const requiredIndicator = screen.getByText('*');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveClass('text-red-500');
    });

    it('should render helper text', () => {
      render(<Input helperText="This is a hint" />);
      
      const helperText = screen.getByText('This is a hint');
      expect(helperText).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error message', () => {
      render(<Input error="This field is required" />);
      
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
    });

    it('should apply error styling when error prop is provided', () => {
      render(<Input error="Invalid email" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-300');
    });

    it('should not show helper text when error is present', () => {
      render(<Input error="Error message" helperText="Helper text" />);
      
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle value changes', async () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test@example.com');
      
      expect(handleChange).toHaveBeenCalled();
    });

    it('should accept controlled value', () => {
      render(<Input value="controlled value" onChange={() => {}} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('controlled value');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Input Types', () => {
    it('should render email input', () => {
      render(<Input type="email" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render password input', () => {
      const { container } = render(<Input type="password" />);
      
      const input = container.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('should render number input', () => {
      render(<Input type="number" />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name from label', () => {
      render(<Input label="Username" />);
      
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('should associate label with input via htmlFor', () => {
      render(<Input id="email-input" label="Email" />);
      
      const label = screen.getByText('Email');
      const input = screen.getByLabelText('Email');
      
      expect(label).toHaveAttribute('for', 'email-input');
      expect(input).toHaveAttribute('id', 'email-input');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<Input className="custom-class" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });
  });
});

