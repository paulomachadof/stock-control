import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { getPaymentMethodLabel, getSalePaymentSummaryFromSale } from "@/lib/salePayment";
import type { SoldDevice } from "@/types/saleTypes";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

export function buildSaleReceiptFilename(sale: SoldDevice) {
  const safeId = String(sale.id).replace(/[^a-zA-Z0-9-_]/g, "-");
  return `recibo-venda-${safeId}.pdf`;
}

export function downloadSaleReceiptPdf(sale: SoldDevice) {
  const paymentSummary = getSalePaymentSummaryFromSale(sale);
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Recibo de Venda", 14, 18);

  doc.setFontSize(10);
  doc.text(`Venda: #${sale.id}`, 14, 26);
  doc.text(`Data: ${formatDate(sale.data)}`, 14, 31);
  doc.text(`Vendedor: ${sale.vendedor_nome ?? "Não informado"}`, 14, 36);

  autoTable(doc, {
    startY: 44,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    head: [["Dados da venda", "Informação"]],
    body: [
      ["Cliente", sale.comprador],
      ["Telefone", sale.numero_telefone || "Não informado"],
      ["CPF", sale.cpf_cliente || "Não informado"],
      ["Email", sale.email_cliente || "Não informado"],
      [
        "Endereço",
        [sale.endereco_cliente, sale.cidade_cliente, sale.estado_cliente, sale.cep_cliente]
          .filter(Boolean)
          .join(" • ") || "Não informado",
      ],
      ["Canal da venda", sale.canal_venda ?? "Loja"],
      ["Método de pagamento", getPaymentMethodLabel(sale.metodo_pagamento)],
      ["Parcelas", String(sale.parcelas_pagamento ?? 1)],
    ],
    headStyles: {
      fillColor: [59, 130, 246],
    },
  });

  const itemRows = sale.items?.length
    ? sale.items.map((item) => [
        item.productName,
        item.sku,
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.discount),
        formatCurrency(item.subtotal),
      ])
    : [
        [
          sale.aparelho,
          sale.imei,
          "1",
          formatCurrency(paymentSummary.subtotalProdutos),
          formatCurrency(0),
          formatCurrency(paymentSummary.subtotalProdutos),
        ],
      ];

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 44) + 8
      : 44,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    head: [["Produto", "Código", "Qtd.", "Unitário", "Desconto", "Subtotal"]],
    body: itemRows,
    headStyles: {
      fillColor: [15, 23, 42],
    },
  });

  autoTable(doc, {
    startY: ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120) + 8,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    head: [["Pagamento", "Valor"]],
    body: [
      ["Subtotal dos produtos", formatCurrency(paymentSummary.subtotalProdutos)],
      ["Desconto adicional", formatCurrency(paymentSummary.descontoPagamento)],
      ["Taxas adicionais", formatCurrency(paymentSummary.taxasPagamento)],
      ["Entrega / frete", formatCurrency(paymentSummary.valorEntrega)],
      ["Acessórios / adicionais", formatCurrency(paymentSummary.valorAcessorios)],
      ["Total final", formatCurrency(paymentSummary.totalFinal)],
      ["Valor recebido", formatCurrency(paymentSummary.valorRecebido)],
      ["Troco", formatCurrency(paymentSummary.troco)],
      ["Saldo pendente", formatCurrency(paymentSummary.saldoPendente)],
      ["Custo da venda", formatCurrency(sale.valor_compra)],
    ],
    headStyles: {
      fillColor: [16, 185, 129],
    },
  });

  if (sale.observacao) {
    const nextY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 170) + 10;
    doc.setFontSize(11);
    doc.text("Observações", 14, nextY);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(sale.observacao, 180), 14, nextY + 6);
  }

  doc.save(buildSaleReceiptFilename(sale));
}
