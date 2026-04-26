import { AppUser } from "@/stores/useSessionStore";
import type { SoldDevice } from "@/types/saleTypes";

export interface SalesMetrics {
  completedSales: number;
  pendingSales: number;
  totalRevenue: number;
  totalProfit: number;
  averageTicket: number;
  accessoryRevenue: number;
  closeRate: number;
}

export interface GoalProgress {
  target: number;
  achieved: number;
  percent: number;
  remaining: number;
}

export interface MonthlyPerformancePoint {
  month: string;
  revenue: number;
  profit: number;
  sales: number;
}

export interface SellerLeaderboardEntry {
  sellerId: string;
  sellerName: string;
  role: AppUser["role"];
  revenue: number;
  profit: number;
  completedSales: number;
  pendingSales: number;
  averageTicket: number;
  goal: number;
  progress: number;
}

export interface DistributionPoint {
  name: string;
  value: number;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getRevenue(sale: SoldDevice) {
  return sale.valor_total_venda ?? 0;
}

function getCost(sale: SoldDevice) {
  return sale.valor_compra ?? 0;
}

function getProfit(sale: SoldDevice) {
  return (sale.aparelho_recebido ? getRevenue(sale) : 0) - getCost(sale);
}

function getMonthKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
}

function getMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  })
    .format(new Date(dateString))
    .replace(".", "")
    .replace(/^\w/, (char) => char.toUpperCase());
}

function isSameMonth(dateString: string, referenceDate: Date) {
  const date = new Date(dateString);

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

export function getVisibleSales(sales: SoldDevice[], currentUser: AppUser) {
  if (currentUser.role === "admin") {
    return sales;
  }

  return sales.filter((sale) => sale.vendedor_id === currentUser.id);
}

export function getSalesMetrics(sales: SoldDevice[]): SalesMetrics {
  const completedSales = sales.filter((sale) => sale.aparelho_recebido);
  const pendingSales = sales.length - completedSales.length;
  const totalRevenue = completedSales.reduce((sum, sale) => sum + getRevenue(sale), 0);
  const totalProfit = completedSales.reduce((sum, sale) => sum + getProfit(sale), 0);
  const accessoryRevenue = completedSales.reduce(
    (sum, sale) => sum + (sale.valor_capa_pelicula ?? 0),
    0,
  );

  return {
    completedSales: completedSales.length,
    pendingSales,
    totalRevenue,
    totalProfit,
    averageTicket: completedSales.length ? totalRevenue / completedSales.length : 0,
    accessoryRevenue,
    closeRate: sales.length ? (completedSales.length / sales.length) * 100 : 0,
  };
}

export function getGoalProgress(
  currentUser: AppUser,
  sales: SoldDevice[],
  users: AppUser[],
  referenceDate = new Date(),
): GoalProgress {
  const monthSales = sales.filter((sale) => isSameMonth(sale.data, referenceDate));

  const target =
    currentUser.role === "admin"
      ? users
          .filter((user) => user.role === "seller")
          .reduce((sum, user) => sum + user.monthlyGoal, 0)
      : currentUser.monthlyGoal;

  const achieved = monthSales
    .filter((sale) =>
      currentUser.role === "admin" ? true : sale.vendedor_id === currentUser.id,
    )
    .reduce((sum, sale) => sum + getRevenue(sale), 0);

  const percent = target ? Math.min((achieved / target) * 100, 100) : 0;

  return {
    target,
    achieved,
    percent,
    remaining: Math.max(target - achieved, 0),
  };
}

export function getMonthComparison(
  sales: SoldDevice[],
  referenceDate = new Date(),
) {
  const currentMonth = sales
    .filter((sale) => isSameMonth(sale.data, referenceDate))
    .reduce((sum, sale) => sum + getRevenue(sale), 0);

  const previousDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);

  const previousMonth = sales
    .filter((sale) => isSameMonth(sale.data, previousDate))
    .reduce((sum, sale) => sum + getRevenue(sale), 0);

  if (!previousMonth) {
    return {
      currentMonth,
      previousMonth,
      deltaPercent: currentMonth > 0 ? 100 : 0,
      positive: currentMonth >= previousMonth,
    };
  }

  const deltaPercent = ((currentMonth - previousMonth) / previousMonth) * 100;

  return {
    currentMonth,
    previousMonth,
    deltaPercent,
    positive: deltaPercent >= 0,
  };
}

export function buildMonthlyPerformance(sales: SoldDevice[]) {
  const grouped = new Map<string, MonthlyPerformancePoint>();

  sales.forEach((sale) => {
    const key = getMonthKey(sale.data);
    const current = grouped.get(key) ?? {
      month: getMonthLabel(sale.data),
      revenue: 0,
      profit: 0,
      sales: 0,
    };

    current.revenue += getRevenue(sale);
    current.profit += getProfit(sale);
    current.sales += sale.aparelho_recebido ? 1 : 0;

    grouped.set(key, current);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([, value]) => value);
}

export function buildSellerLeaderboard(sales: SoldDevice[], users: AppUser[]) {
  const grouped = new Map<string, SellerLeaderboardEntry>();

  sales.forEach((sale) => {
    const user =
      users.find((candidate) => candidate.id === sale.vendedor_id) ??
      ({
        id: sale.vendedor_id,
        name: sale.vendedor_nome,
        role: "seller",
        monthlyGoal: 0,
      } as AppUser);

    const entry = grouped.get(user.id) ?? {
      sellerId: user.id,
      sellerName: user.name,
      role: user.role,
      revenue: 0,
      profit: 0,
      completedSales: 0,
      pendingSales: 0,
      averageTicket: 0,
      goal: user.monthlyGoal,
      progress: 0,
    };

    entry.revenue += sale.aparelho_recebido ? getRevenue(sale) : 0;
    entry.profit += getProfit(sale);
    entry.completedSales += sale.aparelho_recebido ? 1 : 0;
    entry.pendingSales += sale.aparelho_recebido ? 0 : 1;

    grouped.set(user.id, entry);
  });

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      averageTicket: entry.completedSales ? entry.revenue / entry.completedSales : 0,
      progress: entry.goal ? Math.min((entry.revenue / entry.goal) * 100, 100) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);
}

export function buildConditionDistribution(sales: SoldDevice[]) {
  const grouped = new Map<string, number>();

  sales.forEach((sale) => {
    const key = sale.condicao;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  });

  return [...grouped.entries()].map(([name, value]) => ({ name, value }));
}

export function getTopProduct(sales: SoldDevice[]) {
  const grouped = new Map<string, { revenue: number; sales: number }>();

  sales.forEach((sale) => {
    const current = grouped.get(sale.aparelho) ?? { revenue: 0, sales: 0 };
    current.revenue += getRevenue(sale);
    current.sales += 1;
    grouped.set(sale.aparelho, current);
  });

  const [name, values] =
    [...grouped.entries()].sort((left, right) => right[1].revenue - left[1].revenue)[0] ?? [];

  return name
    ? {
        name,
        revenue: values.revenue,
        sales: values.sales,
      }
    : null;
}
