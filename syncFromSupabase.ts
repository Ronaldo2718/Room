import { supabase } from './supabase'

export async function loadFromSupabase() {
  const tables = [
    'properties',
    'rooms',
    'tenants',
    'transactions',
    'suppliers'
  ]

  const result: any = {}

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')

    if (error) {
      console.error(⁠ Erro ao carregar ${table} ⁠, error)
      throw error
    }

    result[table] = data
  }

  return result
}