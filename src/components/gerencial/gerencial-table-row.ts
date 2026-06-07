'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

export function stopRowClickPropagation(event: MouseEvent) {
  event.stopPropagation();
}

export function openRowDetail<T>(record: T, onOpen: (record: T) => void) {
  onOpen(record);
}

export function handleRowDetailKeyDown<T>(
  event: KeyboardEvent<HTMLTableRowElement>,
  record: T,
  onOpen: (record: T) => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onOpen(record);
  }
}

export const gerencialTableRowClassName =
  'produccion-table-row produccion-table-row--clickable border-b transition-colors cursor-pointer';
