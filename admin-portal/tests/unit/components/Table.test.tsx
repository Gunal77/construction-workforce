/**
 * Table Component Unit Tests
 * 
 * Tests for the Table component including:
 * - Column rendering
 * - Data rendering
 * - Empty state
 * - Row click handling
 * - Custom renderers
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Table from '@/components/Table';

interface TestItem {
  id: string;
  name: string;
  email: string;
  status: string;
}

describe('Table Component', () => {
  const mockData: TestItem[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', status: 'Active' },
  ];

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status' },
  ];

  const defaultProps = {
    columns,
    data: mockData,
    keyExtractor: (item: TestItem) => item.id,
  };

  describe('Rendering', () => {
    it('should render table with headers', () => {
      render(<Table {...defaultProps} />);
      
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should render all data rows', () => {
      render(<Table {...defaultProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('should render correct number of rows', () => {
      render(<Table {...defaultProps} />);
      
      const rows = screen.getAllByRole('row');
      // Header row + 3 data rows = 4 total
      expect(rows).toHaveLength(4);
    });
  });

  describe('Empty State', () => {
    it('should render empty message when data is empty', () => {
      render(<Table {...defaultProps} data={[]} />);
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render custom empty message', () => {
      render(
        <Table {...defaultProps} data={[]} emptyMessage="No employees found" />
      );
      
      expect(screen.getByText('No employees found')).toBeInTheDocument();
    });

    it('should not render table when data is empty', () => {
      render(<Table {...defaultProps} data={[]} />);
      
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Row Click Handler', () => {
    it('should call onRowClick when row is clicked', async () => {
      const onRowClick = jest.fn();
      render(<Table {...defaultProps} onRowClick={onRowClick} />);
      
      const firstDataRow = screen.getAllByRole('row')[1]; // Skip header
      await userEvent.click(firstDataRow);
      
      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('should add cursor-pointer class when onRowClick is provided', () => {
      const onRowClick = jest.fn();
      render(<Table {...defaultProps} onRowClick={onRowClick} />);
      
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // Skip header
      
      expect(dataRow).toHaveClass('cursor-pointer');
    });
  });

  describe('Custom Renderers', () => {
    it('should use custom render function for column', () => {
      const columnsWithRender = [
        {
          key: 'name',
          header: 'Name',
          render: (item: TestItem) => <strong data-testid="custom-name">{item.name}</strong>,
        },
        { key: 'email', header: 'Email' },
      ];

      render(
        <Table
          columns={columnsWithRender}
          data={mockData}
          keyExtractor={(item) => item.id}
        />
      );
      
      const customNames = screen.getAllByTestId('custom-name');
      expect(customNames).toHaveLength(3);
      expect(customNames[0]).toHaveTextContent('John Doe');
    });

    it('should render status badges using custom render', () => {
      const columnsWithStatus = [
        { key: 'name', header: 'Name' },
        {
          key: 'status',
          header: 'Status',
          render: (item: TestItem) => (
            <span
              className={item.status === 'Active' ? 'text-green-500' : 'text-red-500'}
              data-testid="status-badge"
            >
              {item.status}
            </span>
          ),
        },
      ];

      render(
        <Table
          columns={columnsWithStatus}
          data={mockData}
          keyExtractor={(item) => item.id}
        />
      );
      
      const badges = screen.getAllByTestId('status-badge');
      expect(badges).toHaveLength(3);
    });

    it('should use custom header renderer', () => {
      const columnsWithCustomHeader = [
        {
          key: 'name',
          header: 'Name',
          renderHeader: () => <span data-testid="custom-header">Custom Header</span>,
        },
        { key: 'email', header: 'Email' },
      ];

      render(
        <Table
          columns={columnsWithCustomHeader}
          data={mockData}
          keyExtractor={(item) => item.id}
        />
      );
      
      expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    });
  });

  describe('Key Extractor', () => {
    it('should use keyExtractor for row keys', () => {
      const keyExtractor = jest.fn((item: TestItem) => item.id);
      render(<Table {...defaultProps} keyExtractor={keyExtractor} />);
      
      expect(keyExtractor).toHaveBeenCalledTimes(mockData.length);
    });
  });

  describe('Styling', () => {
    it('should apply hover effect on rows', () => {
      render(<Table {...defaultProps} />);
      
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      
      expect(dataRow).toHaveClass('hover:bg-gray-50/50');
    });

    it('should have proper table structure', () => {
      const { container } = render(<Table {...defaultProps} />);
      
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tbody')).toBeInTheDocument();
    });
  });

  describe('Column Alignment', () => {
    it('should align checkbox columns to center', () => {
      const columnsWithCheckbox = [
        { key: 'checkbox', header: 'Select' },
        { key: 'name', header: 'Name' },
      ];

      render(
        <Table
          columns={columnsWithCheckbox}
          data={mockData}
          keyExtractor={(item) => item.id}
        />
      );
      
      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveClass('text-center');
    });
  });
});

