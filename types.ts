
export type TabType = 'home' | 'imoveis' | 'inquilinos' | 'financeiro' | 'contas' | 'gestao';

export interface Property {
  id: string;
  name: string;
  type: 'Casa' | 'Apartamento' | 'Kitnet';
  address: string;
  description?: string;
}

export interface Room {
  id: string;
  propertyId: string;
  number: string;
  area: number;
  description: string;
  isOccupied: boolean;
  tenantId?: string;
  price: number;
}

export interface Tenant {
  id: string;
  name: string;
  nickname?: string;
  cpf: string;
  profession: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  entryDate: string;
  exitDate?: string;
  dueDay: number; // Dia do mês (1-31)
  roomId?: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: 'Utilidade' | 'Profissional';
  specialty: string; // e.g., "Água", "Eletricista"
  frequency: string; // e.g., "Todo dia 10", "Eventual"
  dueDay?: number; // Dia de Vencimento
  baseValue?: number; // Novo: Valor Base
  costType?: 'fixed' | 'variable'; // Novo: Tipo de Gasto
  phone: string;
  address?: string;
  whatsapp?: string;
  accountNumber?: string; // Número do cliente/instalação
  obs?: string;
  propertyId?: string; // Imóvel principal que este fornecedor atende
}

export interface Contract {
  id: string;
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  dueDay: number;
  status: 'active' | 'finished';
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'revenue' | 'expense';
  category: string;
  propertyId?: string;
  tenantId?: string;
  roomId?: string;
  supplierId?: string;
}
