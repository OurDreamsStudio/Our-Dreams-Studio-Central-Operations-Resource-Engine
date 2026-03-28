'use client';

// This page re-exports the main Kanban (Sales) board.
// The Sales Kanban is the primary UI for the Vendas pipeline.
// Route: /admin/vendas -> maps to the same board logic as /kanban
import { redirect } from 'next/navigation';

export default function AdminVendasPage() {
  redirect('/kanban');
}
