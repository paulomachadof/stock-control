import { Client } from "@/data/mockData";
import type { SoldDevice } from "@/types/saleTypes";

function normalizeDigits(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizePhone(value?: string) {
  const digits = normalizeDigits(value);

  if (!digits) {
    return "";
  }

  return digits.length > 11 ? digits.slice(-11) : digits;
}

function normalizeText(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function saleBelongsToClient(sale: SoldDevice, client: Client) {
  if (sale.client_id && sale.client_id === client.id) {
    return true;
  }

  const saleCpf = normalizeDigits(sale.cpf_cliente);
  const clientCpf = normalizeDigits(client.cpf);

  if (saleCpf && clientCpf && saleCpf === clientCpf) {
    return true;
  }

  const saleEmail = normalizeEmail(sale.email_cliente);
  const clientEmail = normalizeEmail(client.email);

  if (saleEmail && clientEmail && saleEmail === clientEmail) {
    return true;
  }

  const salePhone = normalizePhone(sale.numero_telefone);
  const clientPhone = normalizePhone(client.telefone);
  const saleName = normalizeText(sale.comprador);
  const clientName = normalizeText(client.nome);

  if (salePhone && clientPhone && salePhone === clientPhone) {
    return true;
  }

  if (saleName && clientName && saleName === clientName && salePhone && clientPhone) {
    return salePhone === clientPhone;
  }

  return false;
}

export function getClientSales(sales: SoldDevice[], client: Client) {
  return sales
    .filter((sale) => saleBelongsToClient(sale, client))
    .sort((left, right) => right.data.localeCompare(left.data));
}

export function getClientSalesSummary(sales: SoldDevice[]) {
  const totalSpent = sales.reduce((sum, sale) => sum + (sale.valor_total_venda ?? 0), 0);
  const averageTicket = sales.length ? totalSpent / sales.length : 0;

  return {
    totalSpent,
    averageTicket,
    lastPurchaseDate: sales[0]?.data ?? null,
  };
}

export function formatSaleDate(dateString: string) {
  const [year, month, day] = dateString.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}
