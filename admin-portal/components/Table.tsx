'use client';

import React from 'react';

interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  render?: (item: T) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full max-w-full min-w-0">
      <div className="overflow-x-auto max-w-full min-w-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 sm:px-4 py-2.5 text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                    column.key === 'image' ? 'min-w-[120px] text-center' :
                    column.key === 'location' ? 'min-w-[140px]' :
                    column.key === 'project' ? 'min-w-[200px] max-w-[300px]' :
                    column.key === 'employee' ? 'min-w-[180px]' :
                    column.key === 'checkbox' ? 'w-12 text-center' :
                    'text-left'
                  }`}
                >
                  {column.renderHeader ? column.renderHeader() : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-gray-50/50 transition-colors border-b border-gray-100`}
              >
                  {columns.map((column) => (
                <td 
                  key={column.key} 
                  className={`px-3 sm:px-4 py-2.5 text-sm text-gray-900 align-middle ${
                    column.key === 'checkbox' ? 'text-center' :
                    column.key === 'image' || column.key === 'location' || column.key === 'project' || column.key === 'employee'
                      ? 'break-words' 
                      : 'whitespace-nowrap'
                  }`}
                >
                  {column.render
                    ? column.render(item)
                    : (item as any)[column.key]}
                </td>
              ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

