import type { SoldDevice } from "@/types/saleTypes";

export const PAYMENT_METHOD_OPTIONS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export interface SalePaymentInput {
  subtotalProdutos: number;
  descontoPagamento?: number;
  taxasPagamento?: number;
  valorEntrega?: number;
  valorAcessorios?: number;
  valorRecebido?: number;
}

export interface SalePaymentSummary {
  subtotalProdutos: number;
  descontoPagamento: number;
  taxasPagamento: number;
  valorEntrega: number;
  valorAcessorios: number;
  totalAdicionais: number;
  totalFinal: number;
  valorRecebido: number;
  troco: number;
  saldoPendente: number;
}

function toSafeNumber(value: number | undefined | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeMethod(value?: string) {
  if (!value) {
    return undefined;
  }

  return PAYMENT_METHOD_OPTIONS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : undefined;
}

export function getPaymentMethodLabel(method?: string) {
  const normalizedMethod = normalizeMethod(method);

  return normalizedMethod ? PAYMENT_METHOD_LABELS[normalizedMethod] : "Não informado";
}

export function calculateSalePaymentSummary(input: SalePaymentInput): SalePaymentSummary {
  const subtotalProdutos = Math.max(0, toSafeNumber(input.subtotalProdutos));
  const descontoPagamento = Math.max(0, toSafeNumber(input.descontoPagamento));
  const taxasPagamento = Math.max(0, toSafeNumber(input.taxasPagamento));
  const valorEntrega = Math.max(0, toSafeNumber(input.valorEntrega));
  const valorAcessorios = Math.max(0, toSafeNumber(input.valorAcessorios));
  const totalAdicionais = taxasPagamento + valorEntrega + valorAcessorios;
  const totalFinal = Math.max(0, subtotalProdutos - descontoPagamento + totalAdicionais);
  const valorRecebido = Math.max(0, toSafeNumber(input.valorRecebido));
  const troco = Math.max(0, valorRecebido - totalFinal);
  const saldoPendente = Math.max(0, totalFinal - valorRecebido);

  return {
    subtotalProdutos,
    descontoPagamento,
    taxasPagamento,
    valorEntrega,
    valorAcessorios,
    totalAdicionais,
    totalFinal,
    valorRecebido,
    troco,
    saldoPendente,
  };
}

export function getSalePaymentSummaryFromSale(
  sale: Partial<SoldDevice>,
  fallbackSubtotalProdutos?: number,
) {
  const summary = calculateSalePaymentSummary({
    subtotalProdutos: sale.preco_vista ?? fallbackSubtotalProdutos ?? sale.valor_total_venda ?? 0,
    descontoPagamento: sale.desconto_pagamento,
    taxasPagamento: sale.taxas_pagamento,
    valorEntrega: sale.valor_entrega,
    valorAcessorios: sale.valor_capa_pelicula,
    valorRecebido: sale.valor_recebido,
  });

  const hasStoredTotal = Number.isFinite(sale.valor_total_venda);

  if (!hasStoredTotal) {
    return summary;
  }

  const totalFinal = Number(sale.valor_total_venda);
  const valorRecebido = Math.max(0, toSafeNumber(sale.valor_recebido));

  return {
    ...summary,
    totalFinal,
    valorRecebido,
    troco: Math.max(0, valorRecebido - totalFinal),
    saldoPendente: Math.max(0, totalFinal - valorRecebido),
  };
}
