import { describe, expect, it } from "vitest";

import { calculateSalePaymentSummary, getPaymentMethodLabel, getSalePaymentSummaryFromSale } from "@/lib/salePayment";
import type { SoldDevice } from "@/types/saleTypes";

describe("salePayment", () => {
  it("recalcula o total final com desconto, taxas e adicionais", () => {
    const summary = calculateSalePaymentSummary({
      subtotalProdutos: 5000,
      descontoPagamento: 200,
      taxasPagamento: 75,
      valorEntrega: 40,
      valorAcessorios: 60,
      valorRecebido: 5200,
    });

    expect(summary.totalAdicionais).toBe(175);
    expect(summary.totalFinal).toBe(4975);
    expect(summary.troco).toBe(225);
    expect(summary.saldoPendente).toBe(0);
  });

  it("deriva corretamente o resumo de pagamento de uma venda legada", () => {
    const sale: Partial<SoldDevice> = {
      preco_vista: 9500,
      valor_entrega: 0,
      valor_capa_pelicula: 150,
      valor_total_venda: 9650,
      valor_recebido: 9650,
    };

    const summary = getSalePaymentSummaryFromSale(sale);

    expect(summary.subtotalProdutos).toBe(9500);
    expect(summary.valorAcessorios).toBe(150);
    expect(summary.totalFinal).toBe(9650);
    expect(summary.saldoPendente).toBe(0);
  });

  it("respeita o total salvo em vendas legadas pendentes", () => {
    const sale: Partial<SoldDevice> = {
      aparelho_recebido: false,
      preco_vista: 3790,
      valor_entrega: 40,
      valor_capa_pelicula: 110,
      valor_total_venda: 0,
      valor_recebido: 0,
    };

    const summary = getSalePaymentSummaryFromSale(sale);

    expect(summary.subtotalProdutos).toBe(3790);
    expect(summary.totalFinal).toBe(0);
    expect(summary.saldoPendente).toBe(0);
  });

  it("traduz o método de pagamento em texto legível", () => {
    expect(getPaymentMethodLabel("cartao_credito")).toBe("Cartão de crédito");
    expect(getPaymentMethodLabel("nao-mapeado")).toBe("Não informado");
  });
});
