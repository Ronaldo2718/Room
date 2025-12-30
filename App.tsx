import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Property, Room, Tenant, Transaction, TabType, Supplier } from './types';
import { loadFromSupabase } from './services/syncFromSupabase';

// --- CONSTANTS ---
const STORAGE_KEY = 'rentmaster_pro_db_v8'; // Version bumped to regenerate data

// --- FORMATTER HELPERS ---
const formatMoney = (value: number) => 
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const getMonthNameShort = (monthIndex: number) => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months[monthIndex];
};

const formatMonthYear = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  const mIndex = parseInt(month) - 1;
  return `${getMonthNameShort(mIndex)}/${year.slice(2)}`;
};

const toDateStr = (year: number, month: number, day: number) => 
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const getTodayStr = () => {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
};

const cleanAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const getDaysInPeriod = (start: Date, end: Date) => {
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
};

const getIntersectionDays = (range1Start: Date, range1End: Date, range2Start: Date, range2End: Date) => {
  const start = range1Start > range2Start ? range1Start : range2Start;
  const end = range1End < range2End ? range1End : range2End;
  if (start <= end) return getDaysInPeriod(start, end);
  return 0;
};

// --- INITIAL DATA ---
const INITIAL_PROPERTIES: Property[] = [
  { id: 'p1', name: 'Casa Centro', type: 'Casa', address: 'Rua Almirante Teffe, XXX' },
  { id: 'p2', name: 'Apartamento Icarai', type: 'Apartamento', address: 'Rua Pereira da Silva, 18/201' }
];

const INITIAL_ROOMS: Room[] = [
  // Casa Centro
  { id: 'r1', propertyId: 'p1', number: 'C1', area: 15, description: 'Quarto Fundos', isOccupied: true, tenantId: 't1', price: 700 },
  { id: 'r2', propertyId: 'p1', number: 'C2', area: 8, description: 'Quarto Interno', isOccupied: true, tenantId: 't2', price: 700 },
  { id: 'r3', propertyId: 'p1', number: 'C3', area: 20, description: 'Quarto Frente', isOccupied: true, tenantId: 't3', price: 850 },
  { id: 'r4', propertyId: 'p1', number: 'C4', area: 8, description: 'Quarto Pequeno', isOccupied: true, tenantId: 't4', price: 700 },
  { id: 'r5', propertyId: 'p1', number: 'C5', area: 5, description: 'Quarto Externo', isOccupied: true, tenantId: 't5', price: 700 },
  // Apartamento Icarai
  { id: 'r7', propertyId: 'p2', number: 'I1', area: 7, description: 'Quarto meia sala 1', isOccupied: true, tenantId: 't6', price: 890 },
  { id: 'r8', propertyId: 'p2', number: 'I2', area: 7, description: 'Quarto meia sala 2', isOccupied: true, tenantId: 't7', price: 900 },
  { id: 'r9', propertyId: 'p2', number: 'I3', area: 20, description: 'Quarto Central', isOccupied: true, tenantId: 't8', price: 1000 },
  { id: 'r10', propertyId: 'p2', number: 'I4', area: 8, description: 'Quarto Ultimo', isOccupied: true, tenantId: 't9', price: 1000 },
  { id: 'r11', propertyId: 'p2', number: 'I5', area: 12, description: 'Quarto Penultimo', isOccupied: true, tenantId: 't10', price: 850 },
  { id: 'r12', propertyId: 'p2', number: 'I6', area: 8, description: 'Quarto Externo', isOccupied: true, tenantId: 't11', price: 900 },
  { id: 'r13', propertyId: 'p2', number: 'I7', area: 8, description: 'Quarto Pequeno', isOccupied: false, price: 750 },
];

const INITIAL_TENANTS: Tenant[] = [
  { id: 't1', name: 'Lia', nickname: 'Debora', cpf: '123.456.789-00', profession: 'Engenheira', entryDate: '2024-01-15', dueDay: 8, roomId: 'r1' },
  { id: 't2', name: 'Julia', nickname: '', cpf: '234.567.890-11', profession: 'Designer', entryDate: '2024-05-19', dueDay: 17, roomId: 'r2' },
  { id: 't3', name: 'Giórgia', nickname: '', cpf: '345.678.901-22', profession: 'Advogada', entryDate: '2024-06-24', dueDay: 27, roomId: 'r3' },
  { id: 't4', name: 'Yasmin', nickname: '', cpf: '456.789.012-33', profession: 'Estudante', entryDate: '2024-08-16', dueDay: 10, roomId: 'r4' },
  { id: 't5', name: 'Amanda', nickname: '', cpf: '567.890.123-44', profession: 'Professor', entryDate: '2024-10-09', dueDay: 10, roomId: 'r5' },
  { id: 't6', name: 'Jamile', nickname: '', cpf: '678.901.234-55', profession: 'Arquiteta', entryDate: '2024-02-06', dueDay: 5, roomId: 'r7' },
  { id: 't7', name: 'Tainá', nickname: '', cpf: '789.012.345-66', profession: 'Analista', entryDate: '2024-04-14', dueDay: 5, roomId: 'r8' },
  { id: 't8', name: 'Cristina', nickname: '', cpf: '890.123.456-77', profession: 'Psicóloga', entryDate: '2024-07-29', dueDay: 20, roomId: 'r9' },
  { id: 't9', name: 'Bruna', nickname: '', cpf: '234.567.890-11', profession: 'Desenvolvedora', entryDate: '2024-09-22', dueDay: 25, roomId: 'r10' },
  { id: 't10', name: 'Caroliny', nickname: '', cpf: '345.678.901-22', profession: 'Veterinária', entryDate: '2024-11-06', dueDay: 10, roomId: 'r11' },
  { id: 't11', name: 'Rafaella', nickname: '', cpf: '456.789.012-33', profession: 'Publicitária', entryDate: '2024-12-14', dueDay: 5, roomId: 'r12' },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  // Casa Centro (p1)
  { id: 's1', name: 'Águas de Niterói - Centro', category: 'Utilidade', specialty: 'Água', propertyId: 'p1', accountNumber: '123456-7', phone: '0800-757-0400', dueDay: 18, costType: 'variable', baseValue: 470.00, frequency: 'Mensal' },
  { id: 's2', name: 'IPTU - Centro', category: 'Utilidade', specialty: 'IPTU', propertyId: 'p1', accountNumber: '25-243190', phone: '', dueDay: 10, costType: 'fixed', baseValue: 99.90, frequency: 'Mensal' },
  { id: 's3', name: 'Enel Rio - Centro', category: 'Utilidade', specialty: 'Energia', propertyId: 'p1', accountNumber: '987654321-9', phone: '0800-280-0120', dueDay: 25, costType: 'variable', baseValue: 500.00, frequency: 'Mensal' },
  { id: 's5', name: 'Claro Fibra - Centro', category: 'Utilidade', specialty: 'Internet', propertyId: 'p1', accountNumber: '000123-456', phone: '', dueDay: 25, costType: 'fixed', baseValue: 69.17, frequency: 'Mensal' },
  
  // Apartamento Icarai (p2)
  { id: 's4', name: 'Enel Rio - Icarai', category: 'Utilidade', specialty: 'Energia', propertyId: 'p2', accountNumber: '554433221-34', phone: '0800-280-0120', dueDay: 25, costType: 'variable', baseValue: 170.00, frequency: 'Mensal' },
  { id: 's6', name: 'PredialNet - Icarai', category: 'Utilidade', specialty: 'Internet', propertyId: 'p2', accountNumber: '123-4579', phone: '', dueDay: 25, costType: 'fixed', baseValue: 114.89, frequency: 'Mensal' },
  { id: 's7a', name: 'Naturgy - Icarai', category: 'Utilidade', specialty: 'Gás', propertyId: 'p2', accountNumber: '998877-00', phone: '0800-024-7777', dueDay: 25, costType: 'variable', baseValue: 160.00, frequency: 'Mensal' },
  
  // Profissionais (Sem Imóvel Fixo ou Eventuais)
  { id: 's8a', name: 'Ismael', category: 'Profissional', specialty: 'Marceneiro', propertyId: '', accountNumber: '', phone: 'xxxx', dueDay: undefined, costType: 'variable', baseValue: undefined, frequency: 'Eventual' },
  { id: 's9', name: 'Francisco', category: 'Profissional', specialty: 'Hidráulica', propertyId: '', accountNumber: '', phone: 'xxxx', dueDay: undefined, costType: 'variable', baseValue: undefined, frequency: 'Eventual' },
  { id: 's10', name: 'Carlos', category: 'Profissional', specialty: 'Elétrica', propertyId: '', accountNumber: '', phone: 'xxxx', dueDay: undefined, costType: 'variable', baseValue: undefined, frequency: 'Eventual' },
  { id: 's11', name: 'João', category: 'Profissional', specialty: 'Pedreiro', propertyId: '', accountNumber: '', phone: 'xxxx', dueDay: undefined, costType: 'variable', baseValue: undefined, frequency: 'Eventual' },
];

// --- GENERATOR LOGIC ---
const generateFullTransactions = (): Transaction[] => {
  const trans: Transaction[] = [];
  const simulationEndDate = new Date(); // Hoje
  const suppliersStartDate = new Date(2024, 0, 1); // 01/01/2024

  // 1. Gerar Receitas (Aluguéis) - Desde a data de entrada do inquilino
  INITIAL_TENANTS.forEach(tenant => {
    if (!tenant.roomId) return;
    const room = INITIAL_ROOMS.find(r => r.id === tenant.roomId);
    if (!room) return;
    const property = INITIAL_PROPERTIES.find(p => p.id === room.propertyId);

    // Ajuste seguro para timezone
    const parts = tenant.entryDate.split('-');
    const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const end = tenant.exitDate ? new Date(tenant.exitDate) : simulationEndDate;

    // Iterar mês a mês a partir da data de entrada
    let iterator = new Date(start.getFullYear(), start.getMonth(), 1);

    while (iterator <= end) {
       const y = iterator.getFullYear();
       const m = iterator.getMonth();

       // O vencimento neste mês específico
       const dueDate = new Date(y, m, tenant.dueDay, 12, 0, 0);

       // Se a data de vencimento for >= data de entrada e <= data fim (hoje)
       if (dueDate >= start && dueDate <= end) {
           const dateStr = toDateStr(y, m, tenant.dueDay);
           const monthYear = formatMonthYear(dateStr);
           trans.push({
             id: `gen-rent-${tenant.id}-${dateStr}`,
             description: `${tenant.name.split(' ')[0]} - Aluguel ${monthYear}`,
             amount: room.price,
             date: dateStr,
             type: 'revenue',
             category: 'Aluguel',
             tenantId: tenant.id,
             roomId: tenant.roomId,
             propertyId: property?.id
           });
       }
       iterator.setMonth(iterator.getMonth() + 1);
    }
  });

  // 2. Gerar Despesas (Fornecedores) - Todas a partir de Jan/2024
  INITIAL_SUPPLIERS.forEach(s => {
      // Pular se não tiver dia de vencimento (Eventuais)
      if (!s.dueDay || !s.baseValue) return;
      
      const prop = INITIAL_PROPERTIES.find(p => p.id === s.propertyId);
      
      // Começa em Jan 2024
      let iterator = new Date(suppliersStartDate);

      while (iterator <= simulationEndDate) {
        const y = iterator.getFullYear();
        const m = iterator.getMonth();
        const dueDate = new Date(y, m, s.dueDay, 12, 0, 0);

        // Gera se a data de vencimento for <= hoje e >= data de inicio (Jan 24)
        if (dueDate >= suppliersStartDate && dueDate <= simulationEndDate) {
            const dateStr = toDateStr(y, m, s.dueDay);
            const monthYear = formatMonthYear(dateStr);

            let amount = s.baseValue;
            // Variação apenas se for variável
            if (s.costType === 'variable') {
                // Variação aleatória suave entre -10% e +10%
                const variation = (Math.random() * 0.2) - 0.1;
                amount = amount * (1 + variation);
            }

            trans.push({
                id: `gen-util-${s.id}-${dateStr}`,
                description: `${s.name} - ${monthYear}`,
                amount: cleanAmount(amount),
                date: dateStr,
                type: 'expense',
                category: s.category,
                propertyId: s.propertyId,
                supplierId: s.id
            });
        }
        iterator.setMonth(iterator.getMonth() + 1);
      }
  });

  return trans.sort((a,b) => b.date.localeCompare(a.date));
};

function loadData<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(`${STORAGE_KEY}_${key}`);
  if (!saved) return fallback;
  try { 
      const parsed = JSON.parse(saved);
      return parsed; 
  } catch { return fallback; }
}
const saveData = (key: string, data: any) => localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(data));

const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"><i className="fa-solid fa-xmark"></i></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---
const TransactionCard: React.FC<{ 
  t: Transaction, 
  properties: Property[], 
  rooms: Room[], 
  tenants: Tenant[],
  suppliers: Supplier[],
  onClick: (t: Transaction) => void 
}> = ({ t, properties, rooms, tenants, suppliers, onClick }) => {
  const property = properties.find(p => p.id === t.propertyId);
  const room = rooms.find(r => r.id === t.roomId);
  const tenant = tenants.find(tn => tn.id === t.tenantId);
  const supplier = suppliers.find(s => s.id === t.supplierId);

  const isRevenue = t.type === 'revenue';

  return (
    <div 
      onClick={() => onClick(t)} 
      className={`p-5 rounded-[2.2rem] flex flex-col gap-3 border shadow-sm cursor-pointer active:scale-[0.98] transition-all ${
        isRevenue 
          ? 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-200' 
          : 'bg-rose-50/60 border-rose-100 hover:border-rose-200'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
          isRevenue ? 'bg-white text-emerald-500' : 'bg-white text-rose-500'
        }`}>
          <i className={`fa-solid ${isRevenue ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <p className="font-black text-slate-800 text-sm truncate uppercase tracking-tighter">{t.description}</p>
            <p className={`font-black text-sm shrink-0 ml-2 ${isRevenue ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isRevenue ? '+' : '-'} {formatMoney(t.amount)}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">
            {formatDate(t.date)} • <span className={isRevenue ? 'text-emerald-600' : 'text-rose-600'}>{t.category}</span>
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200/50">
        <div className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-slate-100">
          <i className="fa-solid fa-building text-[8px] text-slate-400"></i>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">{property?.name || 'Geral'}</span>
        </div>
        
        {isRevenue && (
          <>
            {room && (
              <div className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-slate-100">
                <i className="fa-solid fa-door-open text-[8px] text-indigo-400"></i>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Quarto {room.number}</span>
              </div>
            )}
            {tenant && (
              <div className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-slate-100">
                <i className="fa-solid fa-user text-[8px] text-emerald-400"></i>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">{tenant.name}</span>
              </div>
            )}
          </>
        )}

        {!isRevenue && (
          <>
            {supplier && (
              <div className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-slate-100">
                <i className="fa-solid fa-briefcase text-[8px] text-rose-400"></i>
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-tighter">{supplier.name}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
    async function syncFromCloud() {
    const data = await loadFromSupabase()

    localStorage.setItem(
      'rentmaster_pro_db_v8_properties',
      JSON.stringify(data.properties)
    )
    localStorage.setItem(
      'rentmaster_pro_db_v8_rooms',
      JSON.stringify(data.rooms)
    )
    localStorage.setItem(
      'rentmaster_pro_db_v8_tenants',
      JSON.stringify(data.tenants)
    )
    localStorage.setItem(
      'rentmaster_pro_db_v8_transactions',
      JSON.stringify(data.transactions)
    )
    localStorage.setItem(
      'rentmaster_pro_db_v8_suppliers',
      JSON.stringify(data.suppliers)
    )

    window.location.reload()
  }

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [periodMode, setPeriodMode] = useState<'all' | 'current' | 'last'>('current');
  const [globalPropId, setGlobalPropId] = useState<string>('all');
  const [tenantViewFilter, setTenantViewFilter] = useState<'active' | 'all'>('active');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [properties, setProperties] = useState<Property[]>(() => loadData('properties', INITIAL_PROPERTIES));
  const [rooms, setRooms] = useState<Room[]>(() => loadData('rooms', INITIAL_ROOMS));
  const [tenants, setTenants] = useState<Tenant[]>(() => loadData('tenants', INITIAL_TENANTS));
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadData('transactions', generateFullTransactions()));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadData('suppliers', INITIAL_SUPPLIERS));

  useEffect(() => {
    saveData('properties', properties);
    saveData('rooms', rooms);
    saveData('tenants', tenants);
    saveData('transactions', transactions);
    saveData('suppliers', suppliers);
  }, [properties, rooms, tenants, transactions, suppliers]);

  const { allMovements, dashStats, currentPeriodLabel } = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    const lastMDate = new Date(curY, curM - 1, 1);
    const lastM = lastMDate.getMonth();
    const lastMY = lastMDate.getFullYear();

    const filtered = transactions.filter(t => {
      if (globalPropId !== 'all' && t.propertyId !== globalPropId) return false;
      const [ty, tm, td] = t.date.split('-').map(Number);
      if (periodMode === 'current') return ty === curY && (tm-1) === curM && td <= now.getDate();
      if (periodMode === 'last') return ty === lastMY && (tm-1) === lastM;
      return true;
    });

    const rev = filtered.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.amount, 0);
    const exp = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    let start: Date, end: Date;
    if (periodMode === 'current') { start = new Date(curY, curM, 1); end = now; }
    else if (periodMode === 'last') { start = new Date(lastMY, lastM, 1); end = new Date(curY, curM, 0, 23, 59, 59); }
    else { start = new Date(2023,0,1); end = new Date(2030,11,31); }

    const relevantRooms = globalPropId === 'all' ? rooms : rooms.filter(r => r.propertyId === globalPropId);
    const totalPot = relevantRooms.length * getDaysInPeriod(start, end);
    let totalOcc = 0;
    relevantRooms.forEach(r => {
      tenants.filter(tn => tn.roomId === r.id).forEach(tn => {
        totalOcc += getIntersectionDays(start, end, new Date(tn.entryDate), tn.exitDate ? new Date(tn.exitDate) : now);
      });
    });

    const chartData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mFiltered = transactions.filter(t => {
        if (globalPropId !== 'all' && t.propertyId !== globalPropId) return false;
        const [ty, tm] = t.date.split('-').map(Number);
        return (tm-1) === d.getMonth() && ty === d.getFullYear();
      });
      const mRev = mFiltered.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.amount, 0);
      const mExp = mFiltered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      chartData.push({ month: getMonthNameShort(d.getMonth()), profit: cleanAmount(mRev - mExp), isCurrent: i === 0 });
    }

    return { 
      allMovements: filtered.sort((a,b) => b.date.localeCompare(a.date)), 
      dashStats: { currProfit: cleanAmount(rev - exp), currRev: cleanAmount(rev), currExp: cleanAmount(exp), currOccupancy: totalPot > 0 ? Math.round((totalOcc / totalPot)*100) : 0, chartData },
      currentPeriodLabel: periodMode === 'all' ? 'Histórico Geral' : (periodMode === 'current' ? `Atual (${getMonthNameShort(curM)})` : `Passado (${getMonthNameShort(lastM)})`)
    };
  }, [transactions, periodMode, globalPropId, rooms, tenants]);

  const { alerts, pendingTotal, upcomingForecast } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const overdue: { id: string, type: 'rent' | 'expense', title: string, subtitle: string, amount: number, dueDay: number, data: any }[] = [];
    const upcoming: any[] = []; // Changed to any for flexibility in UI
    let pendingVal = 0;

    // 1. Check Unpaid Tenants
    for (const t of tenants.filter(tn => !tn.exitDate)) {
      const room = rooms.find(r => r.id === t.roomId);
      if (!room || (globalPropId !== 'all' && room.propertyId !== globalPropId)) continue;
      
      const paid = transactions.some(tr => {
        const [ty, tm] = tr.date.split('-').map(Number);
        return tr.tenantId === t.id && tr.type === 'revenue' && (tm - 1) === currentMonth && ty === currentYear;
      });

      if (!paid && today.getDate() > t.dueDay) {
        overdue.push({ 
            id: `alert-rent-${t.id}`,
            type: 'rent',
            title: t.name,
            subtitle: `Aluguel • ${room.number}`,
            amount: room.price,
            dueDay: t.dueDay,
            data: { tenant: t, room }
        });
        pendingVal += room.price;
      }
    }

    // 2. Check Unpaid Suppliers
    for (const s of suppliers.filter(sup => sup.dueDay)) {
       if (globalPropId !== 'all' && s.propertyId && s.propertyId !== globalPropId) continue;
       
       const paid = transactions.some(tr => {
           const [ty, tm] = tr.date.split('-').map(Number);
           return tr.supplierId === s.id && tr.type === 'expense' && (tm - 1) === currentMonth && ty === currentYear;
       });

       if (!paid && s.dueDay && today.getDate() > s.dueDay) {
           overdue.push({
               id: `alert-exp-${s.id}`,
               type: 'expense',
               title: s.name,
               subtitle: s.specialty || s.category,
               amount: s.baseValue || 0,
               dueDay: s.dueDay,
               data: { supplier: s }
           });
       }
    }

    // Forecast
    for (let i = 0; i <= 5; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const day = targetDate.getDate();
        const dateStr = toDateStr(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        tenants.filter(t => !t.exitDate && t.dueDay === day).forEach(t => {
            const room = rooms.find(r => r.id === t.roomId);
            if (!room || (globalPropId !== 'all' && room.propertyId !== globalPropId)) return;
            const isPaid = transactions.some(tr => tr.tenantId === t.id && tr.date === dateStr);
            if (!isPaid) {
                upcoming.push({ 
                    type: 'revenue', 
                    description: `Aluguel ${t.name.split(' ')[0]}`, 
                    amount: room.price, 
                    date: dateStr, 
                    sortDate: targetDate,
                    tenantId: t.id,
                    roomId: room.id,
                    propertyId: room.propertyId,
                    category: 'Aluguel'
                });
            }
        });
        
        suppliers.filter(s => s.dueDay === day).forEach(s => {
             if (globalPropId !== 'all' && s.propertyId && s.propertyId !== globalPropId) return;
             const isPaid = transactions.some(tr => tr.supplierId === s.id && tr.date === dateStr);
             if (!isPaid) {
                 upcoming.push({ 
                     type: 'expense', 
                     description: s.name, 
                     amount: s.baseValue || 0, 
                     date: dateStr, 
                     sortDate: targetDate,
                     supplierId: s.id,
                     propertyId: s.propertyId,
                     category: s.category
                 });
             }
        });
    }

    return { alerts: overdue, pendingTotal: pendingVal, upcomingForecast: upcoming.sort((a,b) => a.sortDate.getTime() - b.sortDate.getTime()) };
  }, [tenants, rooms, transactions, globalPropId, suppliers]);

  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'revenue' | 'expense'>('revenue');
  const [transactionForm, setTransactionForm] = useState<Partial<Transaction>>({});
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [isTenantModalOpen, setTenantModalOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState<Partial<Tenant>>({});
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);

  const [isPropertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyForm, setPropertyForm] = useState<Partial<Property>>({});
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState<Partial<Room>>({});
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const handleExport = (type: string) => {
    alert(`Exportando ${type}... (Simulação)`);
  };

  const handleEditTransaction = (t: Transaction) => {
    setTransactionForm(t);
    setEditingTransactionId(t.id);
    setTransactionType(t.type);
    setTransactionModalOpen(true);
  };
  
  // Logic to find the next expected transaction to pre-fill the form
  const getNextExpectedTransaction = (type: 'revenue' | 'expense'): Partial<Transaction> => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    
    // Helper to check if paid
    const isPaid = (id: string, entityType: 'tenant' | 'supplier', month: number, year: number) => {
       const strMonth = String(month + 1).padStart(2, '0');
       const prefix = `${year}-${strMonth}`;
       return transactions.some(t => {
          if (t.date.substring(0, 7) !== prefix) return false;
          if (entityType === 'tenant') return t.tenantId === id && t.type === 'revenue';
          if (entityType === 'supplier') return t.supplierId === id && t.type === 'expense';
          return false;
       });
    };

    let candidates: Array<{ date: Date, form: Partial<Transaction> }> = [];

    if (type === 'revenue') {
       // Look through active tenants
       tenants.filter(t => !t.exitDate).forEach(t => {
          const room = rooms.find(r => r.id === t.roomId);
          if (!room) return;

          // Check current month
          let targetMonth = currentMonth;
          let targetYear = currentYear;
          
          // If paid for current month, move to next
          if (isPaid(t.id, 'tenant', currentMonth, currentYear)) {
             targetMonth++;
             if (targetMonth > 11) { targetMonth = 0; targetYear++; }
          }
          
          // Construct date
          const targetDate = new Date(targetYear, targetMonth, t.dueDay);
          const dateStr = toDateStr(targetYear, targetMonth, t.dueDay);

          candidates.push({
             date: targetDate,
             form: {
                 type: 'revenue',
                 description: `Aluguel ${t.name.split(' ')[0]} - ${formatMonthYear(dateStr)}`,
                 amount: room.price,
                 category: 'Aluguel',
                 date: dateStr,
                 tenantId: t.id,
                 roomId: room.id,
                 propertyId: room.propertyId
             }
          });
       });
    } else {
       // Suppliers
       suppliers.filter(s => s.dueDay && s.baseValue).forEach(s => {
          let targetMonth = currentMonth;
          let targetYear = currentYear;
          
          if (isPaid(s.id, 'supplier', currentMonth, currentYear)) {
             targetMonth++;
             if (targetMonth > 11) { targetMonth = 0; targetYear++; }
          }

          const targetDate = new Date(targetYear, targetMonth, s.dueDay!);
          const dateStr = toDateStr(targetYear, targetMonth, s.dueDay!);
          
          candidates.push({
             date: targetDate,
             form: {
                 type: 'expense',
                 description: `${s.name} - ${formatMonthYear(dateStr)}`,
                 amount: s.baseValue,
                 category: s.category,
                 date: dateStr,
                 supplierId: s.id,
                 propertyId: s.propertyId
             }
          });
       });
    }

    if (candidates.length === 0) {
        return { date: getTodayStr(), category: type === 'revenue' ? 'Aluguel' : 'Utilidade' };
    }

    // Sort by date ascending (earliest first)
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Return the earliest one
    return candidates[0].form;
  };

  const handleNewRevenue = () => {
    setTransactionType('revenue');
    const prefill = getNextExpectedTransaction('revenue');
    setTransactionForm(prefill);
    setEditingTransactionId(null);
    setTransactionModalOpen(true);
  };

  const handleNewExpense = () => {
    setTransactionType('expense');
    const prefill = getNextExpectedTransaction('expense');
    setTransactionForm(prefill);
    setEditingTransactionId(null);
    setTransactionModalOpen(true);
  };

  const handleForecastClick = (item: any) => {
    setTransactionType(item.type);
    setTransactionForm({
        description: item.description,
        amount: item.amount,
        date: item.date,
        category: item.category,
        propertyId: item.propertyId,
        tenantId: item.tenantId,
        roomId: item.roomId,
        supplierId: item.supplierId
    });
    setEditingTransactionId(null);
    setTransactionModalOpen(true);
  };

  // --- GESTÃO FUNCTIONS ---
  const handleBackup = () => {
    const data = { properties, rooms, tenants, transactions, suppliers };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rentmaster_backup_${getTodayStr()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.properties) setProperties(data.properties);
        if (data.rooms) setRooms(data.rooms);
        if (data.tenants) setTenants(data.tenants);
        if (data.transactions) setTransactions(data.transactions);
        if (data.suppliers) setSuppliers(data.suppliers);
        alert('Dados restaurados com sucesso!');
      } catch (err) {
        alert('Erro ao processar arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const exportTSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join('\t');
    const body = data.map(d => Object.values(d).map(v => String(v).replace(/\t/g, ' ')).join('\t')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.tsv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    setTimeout(() => exportTSV(properties, 'imoveis'), 100);
    setTimeout(() => exportTSV(rooms, 'quartos'), 300);
    setTimeout(() => exportTSV(tenants, 'inquilinos'), 500);
    setTimeout(() => exportTSV(transactions, 'transacoes'), 700);
    setTimeout(() => exportTSV(suppliers, 'fornecedores'), 900);
  };

  const goToTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setTenantForm(tenant);
      setEditingTenantId(tenantId);
      setTenantModalOpen(true);
      setActiveTab('inquilinos');
    }
  };

  const TopFilters = () => (
    <div className="space-y-4 mb-6">
      <div className="flex bg-indigo-50 p-1.5 rounded-2xl shadow-inner border border-indigo-100">
        <select 
          value={globalPropId} 
          onChange={(e) => setGlobalPropId(e.target.value)}
          className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-indigo-900 outline-none px-3 py-1 cursor-pointer"
        >
          <option value="all">🏢 Todos os Imóveis</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 shadow-inner">
        {['all', 'current', 'last'].map(m => (
          <button key={m} onClick={() => setPeriodMode(m as any)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${periodMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
            {m === 'all' ? 'Histórico' : (m === 'current' ? 'Mês Atual' : 'Mês Passado')}
          </button>
        ))}
      </div>
    </div>
  );

  // --- RENDER FUNCTIONS ---
  const renderHome = () => (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      <section>
        <TopFilters />
        <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col items-center">
            <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">{currentPeriodLabel}</p>
            <p className="text-4xl font-black tracking-tighter mb-4">{formatMoney(dashStats.currProfit)}</p>
            <div className="w-full flex justify-center gap-6 pt-4 border-t border-white/10">
                <div className="text-center">
                    <p className="text-[8px] font-black text-indigo-300/60 uppercase tracking-widest mb-0.5">Receita</p>
                    <p className="text-xs font-bold text-emerald-400">{formatMoney(dashStats.currRev)}</p>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center">
                    <p className="text-[8px] font-black text-indigo-300/60 uppercase tracking-widest mb-0.5">Despesas</p>
                    <p className="text-xs font-bold text-rose-400">{formatMoney(dashStats.currExp)}</p>
                </div>
            </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ocupação</p>
           <p className="text-2xl font-black text-indigo-600 tracking-tighter">{dashStats.currOccupancy}%</p>
           <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
             <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${dashStats.currOccupancy}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendente</p>
           <p className={`text-2xl font-black tracking-tighter ${pendingTotal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
             {formatMoney(pendingTotal)}
           </p>
           <p className="text-[8px] font-bold text-slate-300 mt-1 uppercase">{alerts.length} Alertas</p>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="space-y-3">
           <div className="flex justify-between items-center px-2">
             <p className="font-black text-rose-500 text-[10px] uppercase tracking-widest">Alertas de Atraso ({alerts.length})</p>
           </div>
           <div className="space-y-3">
               {alerts.map((a, i) => (
                 <div 
                    key={`${a.id}-${i}`} 
                    onClick={() => { 
                        if (a.type === 'rent') {
                            setTransactionType('revenue'); 
                            setTransactionForm({ description: `Aluguel ${a.title}`, amount: a.amount, date: getTodayStr(), category: 'Aluguel', tenantId: a.data.tenant.id, propertyId: a.data.room.propertyId, roomId: a.data.room.id }); 
                        } else {
                            setTransactionType('expense');
                            setTransactionForm({ description: '', category: a.data.supplier.category, date: getTodayStr(), supplierId: a.data.supplier.id, propertyId: a.data.supplier.propertyId, amount: a.amount });
                        }
                        setEditingTransactionId(null); 
                        setTransactionModalOpen(true); 
                    }} 
                    className={`bg-white border p-5 rounded-[2.2rem] flex flex-col gap-3 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${a.type === 'rent' ? 'border-rose-100 hover:border-rose-300' : 'border-amber-100 hover:border-amber-300'}`}
                 >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${a.type === 'rent' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                           <i className={`fa-solid ${a.type === 'rent' ? 'fa-user' : 'fa-bolt'}`}></i>
                        </div>
                        <div>
                          <p className={`text-sm font-black leading-tight uppercase tracking-tight ${a.type === 'rent' ? 'text-rose-900' : 'text-amber-900'}`}>{a.title}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{a.subtitle}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm ${a.type === 'rent' ? 'text-rose-700' : 'text-amber-700'}`}>{a.amount > 0 ? formatMoney(a.amount) : 'A Definir'}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${a.type === 'rent' ? 'text-rose-400 bg-rose-50/50' : 'text-amber-400 bg-amber-50/50'}`}>Venceu dia {a.dueDay}</span>
                      </div>
                    </div>
                 </div>
               ))}
           </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-2">Desempenho Semestral</p>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashStats.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} dy={10} />
              <Tooltip cursor={{fill: 'transparent'}} content={({active, payload}) => active && payload ? <div className="bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-xl">{formatMoney(payload[0].value as number)}</div> : null} />
              <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                {dashStats.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.isCurrent ? '#4f46e5' : '#e2e8f0'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );

  const renderImoveis = () => {
    if (selectedPropertyId) {
      const property = properties.find(p => p.id === selectedPropertyId);
      const propRooms = rooms.filter(r => r.propertyId === selectedPropertyId);
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-10">
           <div className="bg-indigo-900 p-6 rounded-[2.5rem] text-white shadow-xl flex justify-between items-center">
              <div>
                <button onClick={() => setSelectedPropertyId(null)} className="mb-2 text-[10px] font-black uppercase text-indigo-300 flex items-center gap-1"><i className="fa-solid fa-chevron-left"></i> Voltar</button>
                <h2 className="text-xl font-black">{property?.name}</h2>
                <p className="text-[10px] text-indigo-300 font-medium mb-2">{property?.address}</p>
              </div>
              <button onClick={() => { setPropertyForm(property!); setEditingPropertyId(property!.id); setPropertyModalOpen(true); }} className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center shrink-0"><i className="fa-solid fa-pen text-xs"></i></button>
           </div>
           <div className="flex justify-between items-center px-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quartos</p>
             <button onClick={() => { setRoomForm({ propertyId: selectedPropertyId }); setEditingRoomId(null); setRoomModalOpen(true); }} className="text-[10px] font-black text-indigo-600 uppercase">+ Adicionar</button>
           </div>
           <div className="grid grid-cols-1 gap-4">
             {propRooms.map(r => {
               const activeTenant = tenants.find(t => t.roomId === r.id && !t.exitDate);
               return (
               <div key={r.id} onClick={() => { setRoomForm(r); setEditingRoomId(r.id); setRoomModalOpen(true); }} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer shadow-sm">
                  <div className="flex-1 pr-4">
                    <p className={`font-black uppercase text-xs flex items-center gap-2 ${activeTenant ? 'text-slate-800' : 'text-slate-400'}`}>
                       {activeTenant 
                         ? <>Quarto {r.number} • <span onClick={(e) => { e.stopPropagation(); goToTenant(activeTenant.id); }} className="text-indigo-600 hover:underline">{activeTenant.name.split(' ')[0]}</span></>
                         : `${r.number}. Vago`
                       }
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{r.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-indigo-600 text-sm">{formatMoney(r.price)}</p>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${activeTenant ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>{activeTenant ? 'Ocupado' : 'Vago'}</span>
                  </div>
               </div>
             )})}
           </div>
        </div>
      );
    }
    return (
      <div className="space-y-4 animate-in slide-in-from-left duration-300 pb-10">
        <div className="flex justify-between items-center px-2">
          <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Patrimônio</p>
          <button onClick={() => { setPropertyForm({}); setEditingPropertyId(null); setPropertyModalOpen(true); }} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">+ Novo Imóvel</button>
        </div>
        {properties.map(p => {
          const propRooms = rooms.filter(r => r.propertyId === p.id).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

          return (
            <div key={p.id} onClick={() => setSelectedPropertyId(p.id)} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800">{p.name}</h3>
                  <p className="text-xs text-slate-400 leading-tight">{p.address}</p>
                </div>
                <span className="bg-slate-50 text-slate-400 text-[8px] font-black px-3 py-1 rounded-full uppercase shrink-0">{p.type}</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {propRooms.map(r => {
                   const activeTenant = tenants.find(t => t.roomId === r.id && !t.exitDate);
                   return (
                     <div key={r.id} className={`px-3 py-2 rounded-xl flex items-center justify-between border ${activeTenant ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <span className="text-[10px] font-black">{r.number}</span>
                        <span 
                            onClick={(e) => {
                                if (activeTenant) {
                                    e.stopPropagation();
                                    goToTenant(activeTenant.id);
                                }
                            }}
                            className={`text-[8px] font-bold uppercase tracking-tight truncate ml-1 ${activeTenant ? 'cursor-pointer hover:underline hover:text-emerald-800' : ''}`}
                        >
                           {activeTenant ? activeTenant.name.split(' ')[0] : 'VAGO'}
                        </span>
                     </div>
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInquilinos = () => (
    <div className="space-y-4 pb-10 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center px-2">
        <div className="flex flex-col gap-2">
          <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Locatários</p>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shadow-inner w-32 shrink-0">
             <button onClick={() => setTenantViewFilter('active')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tenantViewFilter === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Ativos</button>
             <button onClick={() => setTenantViewFilter('all')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tenantViewFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Todos</button>
          </div>
        </div>
        <button onClick={() => { setTenantForm({ entryDate: getTodayStr(), dueDay: 10 }); setEditingTenantId(null); setTenantModalOpen(true); }} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">+ Novo</button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {tenants
          .filter(t => tenantViewFilter === 'all' || !t.exitDate)
          .map(t => {
            const room = rooms.find(r => r.id === t.roomId);
            const prop = properties.find(p => p.id === room?.propertyId);
            const isActive = !t.exitDate;
            return (
              <div key={t.id} onClick={() => { setTenantForm(t); setEditingTenantId(t.id); setTenantModalOpen(true); }} className={`bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4 cursor-pointer active:scale-[0.99] transition-all ${!isActive ? 'opacity-60 bg-slate-50 grayscale' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                      {t.name.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                       <h3 className="font-black text-slate-800 text-sm leading-tight">{t.name}</h3>
                       <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mt-0.5">
                         {prop?.name || 'Sem Imóvel'} • {room?.number || '-'}
                       </p>
                       {t.exitDate && <span className="text-[8px] text-rose-500 font-bold block mt-1">Saída: {formatDate(t.exitDate)}</span>}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {isActive ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );

  const renderFinanceiro = () => (
    <div className="space-y-6 pb-10 animate-in slide-in-from-bottom duration-500">
      <TopFilters />
      <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden text-center">
          <p className="text-indigo-300 text-[10px] font-black uppercase mb-1">Balanço do Período</p>
          <p className="text-4xl font-black tracking-tighter mb-6">{formatMoney(dashStats.currProfit)}</p>
          <div className="flex gap-3">
            <button onClick={handleNewRevenue} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-600 transition-colors">+ Receita</button>
            <button onClick={handleNewExpense} className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg hover:bg-rose-600 transition-colors">+ Despesa</button>
          </div>
      </div>

      {upcomingForecast.length > 0 && (
         <div className="space-y-3">
            <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-2">Lançamentos Previstos (Próx. 5 dias)</p>
            <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x">
              {upcomingForecast.map((item, idx) => (
                <div 
                   key={idx} 
                   onClick={() => handleForecastClick(item)}
                   className="min-w-[160px] bg-white border-2 border-dashed border-slate-200 p-4 rounded-2xl flex flex-col justify-between shrink-0 snap-center cursor-pointer hover:border-indigo-300 transition-colors"
                >
                   <div>
                     <p className={`text-[9px] font-black uppercase mb-1 ${item.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>{item.type === 'revenue' ? 'Receber' : 'Pagar'}</p>
                     <p className="text-xs font-bold text-slate-700 leading-tight">{item.description}</p>
                   </div>
                   <div className="mt-2">
                     <p className="text-sm font-black text-slate-900">{formatMoney(item.amount)}</p>
                     <p className="text-[9px] text-slate-400 font-bold">{formatDate(item.date)}</p>
                   </div>
                </div>
              ))}
            </div>
         </div>
      )}

      <div className="space-y-3">
        <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-2">Histórico</p>
        {allMovements.map(t => (
          <TransactionCard key={t.id} t={t} properties={properties} rooms={rooms} tenants={tenants} suppliers={suppliers} onClick={handleEditTransaction} />
        ))}
      </div>
    </div>
  );

  const renderContas = () => (
    <div className="space-y-8 pb-10 pt-4 animate-in fade-in">
       <section className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Contas de Consumo / Fornecedores</p>
          <button onClick={() => { setSupplierForm({}); setEditingSupplierId(null); setSupplierModalOpen(true); }} className="text-[10px] font-black text-indigo-600 uppercase">+ Novo Cadastro</button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {suppliers.map(s => {
            const prop = properties.find(p => p.id === s.propertyId);
            return (
              <div key={s.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm flex flex-col gap-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <i className={`fa-solid ${s.category === 'Utilidade' ? 'fa-bolt' : 'fa-tools'} text-sm`}></i>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm uppercase">{s.name}</h4>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">
                        <i className="fa-solid fa-building mr-1"></i> {prop?.name || 'Não vinculado'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSupplierForm(s); setEditingSupplierId(s.id); setSupplierModalOpen(true); }} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500 transition-colors">
                      <i className="fa-solid fa-pen text-[10px]"></i>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                   <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Conta</p>
                      <p className="text-[10px] font-bold text-slate-600">{s.accountNumber || '-'}</p>
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Vencimento</p>
                      <p className="text-[10px] font-bold text-rose-500">{s.dueDay ? `Dia ${s.dueDay}` : '-'}</p>
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Telefone</p>
                      <p className="text-[10px] font-bold text-slate-600">{s.phone && s.phone !== 'xxxx' ? s.phone : '-'}</p>
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Valor Base ({s.costType === 'fixed' ? 'Fixo' : 'Var.'})</p>
                      <p className="text-[10px] font-bold text-emerald-600">{s.baseValue ? formatMoney(s.baseValue) : '-'}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderGestao = () => (
    <div className="space-y-8 pb-10 pt-4 animate-in fade-in">
      <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-indigo-900">Ferramentas de Dados</h3>
          <p className="text-xs text-indigo-700/70 -mt-4">
             Backup, restauração e exportação de dados.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
             <button onClick={handleBackup} className="bg-white text-indigo-600 border border-indigo-100 p-4 rounded-2xl text-xs font-black uppercase shadow-sm flex items-center justify-center gap-2">
               <i className="fa-solid fa-download"></i> Backup JSON
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-100 p-4 rounded-2xl text-xs font-black uppercase shadow-sm flex items-center justify-center gap-2">
               <i className="fa-solid fa-upload"></i> Restaurar
             </button>
             <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json" />
          </div>

          <div className="space-y-2">
             <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Exportar Tabelas (TSV)</p>
             <button onClick={handleExportAll} className="w-full bg-emerald-500 text-white border-none p-4 rounded-2xl text-xs font-black uppercase shadow-lg flex items-center justify-center gap-2">
               <i className="fa-solid fa-file-csv"></i> Baixar Tudo
             </button>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => exportTSV(properties, 'imoveis')} className="bg-white text-slate-500 border border-slate-100 p-3 rounded-xl text-[9px] font-bold uppercase shadow-sm">Imóveis</button>
                <button onClick={() => exportTSV(rooms, 'quartos')} className="bg-white text-slate-500 border border-slate-100 p-3 rounded-xl text-[9px] font-bold uppercase shadow-sm">Quartos</button>
                <button onClick={() => exportTSV(tenants, 'inquilinos')} className="bg-white text-slate-500 border border-slate-100 p-3 rounded-xl text-[9px] font-bold uppercase shadow-sm">Inquilinos</button>
                <button onClick={() => exportTSV(transactions, 'transacoes')} className="bg-white text-slate-500 border border-slate-100 p-3 rounded-xl text-[9px] font-bold uppercase shadow-sm">Transações</button>
                <button onClick={() => exportTSV(suppliers, 'fornecedores')} className="bg-white text-slate-500 border border-slate-100 p-3 rounded-xl text-[9px] font-bold uppercase shadow-sm">Fornecedores</button>
             </div>
          </div>

          <div className="pt-4 border-t border-indigo-100/50">
             <button onClick={() => {
                if(window.confirm("ATENÇÃO: Isso apagará todos os dados do sistema. Deseja continuar?")) {
                  setProperties([]); setRooms([]); setTenants([]); setTransactions([]); setSuppliers([]);
                }
             }} className="w-full bg-rose-50 text-rose-600 border border-rose-100 p-4 rounded-2xl text-xs font-black uppercase shadow-sm">
               Zerar Sistema
             </button>
          </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-900 relative pb-28 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 px-6 py-5 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-black text-slate-800 tracking-tight">RentMaster <span className="text-indigo-600">Pro</span></h1>
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">RP</div>
      </header>
      
      <div className="px-6 py-2">
  <button
    onClick={syncFromCloud}
    className="w-full bg-indigo-100 text-indigo-700 font-bold text-xs py-3 rounded-xl"
  >
    🔄 Carregar dados da nuvem
  </button>
</div>

      <main className="px-6 pt-6">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'imoveis' && renderImoveis()}
        {activeTab === 'inquilinos' && renderInquilinos()}
        {activeTab === 'financeiro' && renderFinanceiro()}
        {activeTab === 'contas' && renderContas()}
        {activeTab === 'gestao' && renderGestao()}
      </main>

      {/* Transaction Modal */}
      <Modal title={editingTransactionId ? "Editar Lançamento" : "Novo Lançamento"} isOpen={isTransactionModalOpen} onClose={() => setTransactionModalOpen(false)}>
        <div className="space-y-4">
           {/* New Fields: Property, Room, Tenant/Supplier */}
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Detalhes do Vínculo</label>
              <select 
                value={transactionForm.propertyId || ''} 
                onChange={e => setTransactionForm({...transactionForm, propertyId: e.target.value})} 
                className="w-full bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border border-slate-100 mb-2"
              >
                <option value="">Selecione o Imóvel (Opcional)</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {transactionType === 'revenue' && (
                <div className="grid grid-cols-2 gap-2">
                   <select 
                      value={transactionForm.roomId || ''} 
                      onChange={e => setTransactionForm({...transactionForm, roomId: e.target.value})} 
                      className="w-full bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border border-slate-100"
                   >
                     <option value="">Quarto</option>
                     {rooms
                        .filter(r => !transactionForm.propertyId || r.propertyId === transactionForm.propertyId)
                        .map(r => <option key={r.id} value={r.id}>{r.number}</option>)
                     }
                   </select>
                   <select 
                      value={transactionForm.tenantId || ''} 
                      onChange={e => setTransactionForm({...transactionForm, tenantId: e.target.value})} 
                      className="w-full bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border border-slate-100"
                   >
                     <option value="">Inquilino</option>
                     {tenants
                        .filter(t => !t.exitDate)
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                     }
                   </select>
                </div>
              )}

              {transactionType === 'expense' && (
                 <select 
                    value={transactionForm.supplierId || ''} 
                    onChange={e => setTransactionForm({...transactionForm, supplierId: e.target.value})} 
                    className="w-full bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border border-slate-100"
                 >
                   <option value="">Fornecedor / Profissional</option>
                   {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
              )}
           </div>

           <div className="border-t border-slate-100 pt-2 space-y-4">
               <input placeholder="Descrição" value={transactionForm.description || ''} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
               <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Valor" value={transactionForm.amount || ''} onChange={e => setTransactionForm({...transactionForm, amount: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
                  <input type="date" value={transactionForm.date || ''} onChange={e => setTransactionForm({...transactionForm, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
               </div>
               
               <select value={transactionForm.category || ''} onChange={e => setTransactionForm({...transactionForm, category: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100">
                <option value="">Categoria</option>
                {transactionType === 'revenue' ? (
                  <><option value="Aluguel">Aluguel</option><option value="Outros">Outros</option></>
                ) : (
                  <><option value="Utilidade">Utilidade</option><option value="Manutenção">Manutenção</option><option value="Geral">Geral</option></>
                )}
               </select>
           </div>

           <div className="flex gap-2">
             {editingTransactionId && (
               <button 
                  type="button"
                  onClick={() => {
                  setTransactions(prev => prev.filter(t => t.id !== editingTransactionId));
                  setTransactionModalOpen(false);
               }} className="bg-rose-100 text-rose-600 py-4 px-6 rounded-2xl font-black shadow-lg">Excluir</button>
             )}
             <button onClick={() => {
                const finalAmt = cleanAmount(transactionForm.amount || 0);
                const finalTransaction = { ...transactionForm, amount: finalAmt, type: transactionType } as Transaction;
                if (editingTransactionId) setTransactions(prev => prev.map(t => t.id === editingTransactionId ? finalTransaction : t));
                else setTransactions(prev => [{ id: `tr-${Date.now()}`, ...finalTransaction }, ...prev]);
                setTransactionModalOpen(false);
             }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl">Salvar</button>
           </div>
        </div>
      </Modal>

      {/* Supplier Modal */}
      <Modal title={editingSupplierId ? "Editar Cadastro" : "Novo Cadastro"} isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)}>
        <div className="space-y-4">
          <input placeholder="Nome (Ex: Enel, João)" value={supplierForm.name || ''} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
          
          <div className="grid grid-cols-2 gap-4">
             <select value={supplierForm.category || 'Utilidade'} onChange={e => setSupplierForm({...supplierForm, category: e.target.value as any})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100">
               <option value="Utilidade">Utilidade</option>
               <option value="Profissional">Profissional</option>
             </select>
             <input placeholder="Especialidade (Ex: Luz)" value={supplierForm.specialty || ''} onChange={e => setSupplierForm({...supplierForm, specialty: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
          </div>

          <select value={supplierForm.propertyId || ''} onChange={e => setSupplierForm({...supplierForm, propertyId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100">
            <option value="">Vincular ao Imóvel (Opcional)</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-4">
             <input placeholder="Conta / Instalação" value={supplierForm.accountNumber || ''} onChange={e => setSupplierForm({...supplierForm, accountNumber: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
             <input placeholder="Telefone" value={supplierForm.phone || ''} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Vencimento</label>
                <input placeholder="Dia" type="number" min="1" max="31" value={supplierForm.dueDay || ''} onChange={e => setSupplierForm({...supplierForm, dueDay: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100 text-center" />
             </div>
             <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tipo Gasto</label>
                <select value={supplierForm.costType || 'variable'} onChange={e => setSupplierForm({...supplierForm, costType: e.target.value as any})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100">
                  <option value="variable">Variável</option>
                  <option value="fixed">Fixo</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor Base</label>
                <input placeholder="R$" type="number" value={supplierForm.baseValue || ''} onChange={e => setSupplierForm({...supplierForm, baseValue: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
             </div>
          </div>
          
          <div className="flex gap-2">
            {editingSupplierId && (
               <button 
                  type="button" 
                  onClick={() => {
                  if(window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
                      const idToDelete = editingSupplierId;
                      setSuppliers(prev => prev.filter(s => s.id !== idToDelete));
                      setSupplierModalOpen(false);
                      setEditingSupplierId(null);
                  }
               }} className="bg-rose-100 text-rose-600 py-4 px-6 rounded-2xl font-black shadow-lg">Excluir</button>
            )}
            <button 
              type="button"
              onClick={() => {
              if (editingSupplierId) setSuppliers(prev => prev.map(s => s.id === editingSupplierId ? { ...s, ...supplierForm } as Supplier : s));
              else setSuppliers(prev => [...prev, { id: `s-${Date.now()}`, ...supplierForm, frequency: 'Mensal' } as Supplier]);
              setSupplierModalOpen(false);
            }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* Property Modal */}
      <Modal title={editingPropertyId ? "Editar Imóvel" : "Novo Imóvel"} isOpen={isPropertyModalOpen} onClose={() => setPropertyModalOpen(false)}>
        <div className="space-y-4">
          <input placeholder="Nome" value={propertyForm.name || ''} onChange={e => setPropertyForm({...propertyForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
          <input placeholder="Endereço" value={propertyForm.address || ''} onChange={e => setPropertyForm({...propertyForm, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
          <button onClick={() => {
            if (editingPropertyId) setProperties(prev => prev.map(p => p.id === editingPropertyId ? { ...p, ...propertyForm } as Property : p));
            else setProperties(prev => [...prev, { id: `p-${Date.now()}`, ...propertyForm, type: 'Casa' } as Property]);
            setPropertyModalOpen(false);
          }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl">Salvar</button>
        </div>
      </Modal>

      {/* Tenant Modal */}
      <Modal title={editingTenantId ? "Editar Locatário" : "Novo Locatário"} isOpen={isTenantModalOpen} onClose={() => setTenantModalOpen(false)}>
        <div className="space-y-4">
          {/* Row 1: Name and Due Day */}
          <div className="flex gap-3">
             <div className="flex-1">
               <input placeholder="Nome Completo" value={tenantForm.name || ''} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
             </div>
             <div className="w-24">
                <input type="number" placeholder="Dia Pgto" min="1" max="31" value={tenantForm.dueDay || ''} onChange={e => setTenantForm({...tenantForm, dueDay: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100 text-center" />
             </div>
          </div>
          
          {/* Row 2: Profession */}
          <input placeholder="Profissão" value={tenantForm.profession || ''} onChange={e => setTenantForm({...tenantForm, profession: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />

          {/* Row 3: Contacts */}
          <div className="grid grid-cols-2 gap-4">
             <input placeholder="Telefone" value={tenantForm.phone || ''} onChange={e => setTenantForm({...tenantForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
             <input placeholder="Whatsapp" value={tenantForm.whatsapp || ''} onChange={e => setTenantForm({...tenantForm, whatsapp: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
          </div>

          {/* Row 4: Room */}
          <select value={tenantForm.roomId || ''} onChange={e => setTenantForm({...tenantForm, roomId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100">
            <option value="">Selecione o Quarto / Imóvel</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.number} - {properties.find(p => p.id === r.propertyId)?.name}</option>)}
          </select>

          {/* Row 5: Dates */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Data Entrada</label>
                 <input type="date" value={tenantForm.entryDate || ''} onChange={e => setTenantForm({...tenantForm, entryDate: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
             </div>
             <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Data Saída (Opcional)</label>
                 <input type="date" value={tenantForm.exitDate || ''} onChange={e => setTenantForm({...tenantForm, exitDate: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-xs outline-none border border-slate-100" />
             </div>
          </div>

          {/* Row 6: Obs */}
          <textarea placeholder="Observações..." value={tenantForm.description || ''} onChange={e => setTenantForm({...tenantForm, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100 h-24 resize-none" />

          <button onClick={() => {
            if (editingTenantId) setTenants(prev => prev.map(t => t.id === editingTenantId ? { ...t, ...tenantForm } as Tenant : t));
            else setTenants(prev => [...prev, { ...tenantForm, id: `t-${Date.now()}` } as Tenant]);
            setTenantModalOpen(false);
          }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl">Salvar</button>
        </div>
      </Modal>

      {/* Room Modal */}
      <Modal title={editingRoomId ? "Editar Quarto" : "Novo Quarto"} isOpen={isRoomModalOpen} onClose={() => setRoomModalOpen(false)}>
        <div className="space-y-4">
           <input placeholder="Número (Ex: 101)" value={roomForm.number || ''} onChange={e => setRoomForm({...roomForm, number: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
           <input type="number" placeholder="Preço (R$)" value={roomForm.price || ''} onChange={e => setRoomForm({...roomForm, price: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none border border-slate-100" />
           <button onClick={() => {
            if (editingRoomId) setRooms(prev => prev.map(r => r.id === editingRoomId ? { ...r, ...roomForm } as Room : r));
            else setRooms(prev => [...prev, { ...roomForm, id: `r-${Date.now()}`, isOccupied: false } as Room]);
            setRoomModalOpen(false);
          }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl">Salvar Quarto</button>
        </div>
      </Modal>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t flex justify-around items-center safe-area-bottom z-30 shadow-2xl">
        {[ 
          { id: 'home', icon: 'fa-chart-pie', label: 'Início' }, 
          { id: 'imoveis', icon: 'fa-building', label: 'Imóveis' }, 
          { id: 'inquilinos', icon: 'fa-users', label: 'Inquilinos' }, 
          { id: 'contas', icon: 'fa-file-invoice-dollar', label: 'Contas' }, 
          { id: 'financeiro', icon: 'fa-wallet', label: 'Fluxo' }, 
          { id: 'gestao', icon: 'fa-toolbox', label: 'Gestão' } 
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as TabType)} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-300'}`}>
            <i className={`fa-solid ${item.icon} text-lg`}></i>
            <span className="text-[7px] font-black uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
