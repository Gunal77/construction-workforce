/**
 * Modal Component Unit Tests
 * 
 * Tests for the Modal component including:
 * - Open/close states
 * - Title rendering
 * - Size variants
 * - Close interactions
 * - Body overflow management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('should render title correctly', () => {
      render(<Modal {...defaultProps} title="Custom Title" />);
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <Modal {...defaultProps}>
          <p>Custom child content</p>
          <button>Action Button</button>
        </Modal>
      );
      
      expect(screen.getByText('Custom child content')).toBeInTheDocument();
      expect(screen.getByText('Action Button')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      const { container } = render(<Modal {...defaultProps} size="sm" />);
      
      const modalContent = container.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('should render with medium size (default)', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modalContent = container.querySelector('.max-w-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('should render with large size', () => {
      const { container } = render(<Modal {...defaultProps} size="lg" />);
      
      const modalContent = container.querySelector('.max-w-2xl');
      expect(modalContent).toBeInTheDocument();
    });

    it('should render with extra large size', () => {
      const { container } = render(<Modal {...defaultProps} size="xl" />);
      
      const modalContent = container.querySelector('.max-w-4xl');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button');
      await userEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const onClose = jest.fn();
      const { container } = render(<Modal {...defaultProps} onClose={onClose} />);
      
      const backdrop = container.querySelector('.bg-black.bg-opacity-50');
      if (backdrop) {
        await userEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Body Overflow Management', () => {
    it('should set body overflow to hidden when modal opens', () => {
      render(<Modal {...defaultProps} isOpen={true} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should reset body overflow when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
      
      rerender(<Modal {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('unset');
    });

    it('should reset body overflow on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} isOpen={true} />);
      
      unmount();
      
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Accessibility', () => {
    it('should have visible title', () => {
      render(<Modal {...defaultProps} />);
      
      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent('Test Modal');
    });

    it('should have close button', () => {
      render(<Modal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Scrollable Content', () => {
    it('should allow scrolling for long content', () => {
      const { container } = render(
        <Modal {...defaultProps}>
          <div style={{ height: '2000px' }}>Very long content</div>
        </Modal>
      );
      
      const scrollableArea = container.querySelector('.max-h-\\[90vh\\].overflow-y-auto');
      expect(scrollableArea).toBeInTheDocument();
    });
  });
});

