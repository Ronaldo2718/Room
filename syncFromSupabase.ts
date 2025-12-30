import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function loadTable<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*')

  if (error) {
    console.error(`Erro ao carregar ${table}`, error)
    throw error
  }

  return data as T[]
}

export async function loadFromSupabase() {
  const [
    properties,
    rooms,
    tenants,
    transactions,
    suppliers
  ] = await Promise.all([
    loadTable('properties'),
    loadTable('rooms'),
    loadTable('tenants'),
    loadTable('transactions'),
    loadTable('suppliers')
  ])

  return {
    properties,
    rooms,
    tenants,
    transactions,
    suppliers
  }
}
