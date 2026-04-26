import { describe, expect, it } from "vitest";

import { getClientSales, getClientSalesSummary, saleBelongsToClient } from "@/lib/clientSales";
import type { SoldDevice } from "@/types/saleTypes";
import type { Client } from "@/data/mockData";

const client: Client = {
  id: "client-1",
  nome: "Carlos Silva",
  cpf: "12345678901",
  email: "carlos@email.com",
  telefone: "11987654321",
  endereco: "Rua A",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01001000",
  data_cadastro: "2026-04-01",
  total_compras: 2,
};

const baseSale: SoldDevice = {
  id: "sale-1",
  data: "2026-04-10",
  aparelho: "iPhone 15",
  cor: "Preto",
  condicao: "Novo",
  imei: "111111111111111",
  fornecedor: "Apple Store",
  valor_compra: 5000,
  comprador: "Carlos Silva",
  numero_telefone: "(11) 98765-4321",
  aparelho_recebido: true,
  observacao: "",
  valor_recebido: 6200,
  preco_vista: 6200,
  preco_cartao: 6400,
  valor_entrega: 0,
  valor_capa_pelicula: 0,
  valor_total_venda: 6200,
};

describe("clientSales", () => {
  it("relaciona venda ao cliente pelo client_id quando existir", () => {
    const sale = {
      ...baseSale,
      client_id: "client-1",
      comprador: "Outro Nome",
      numero_telefone: "(11) 90000-0000",
    };

    expect(saleBelongsToClient(sale, client)).toBe(true);
  });

  it("relaciona vendas legadas ao cliente pelo telefone/cpf/email", () => {
    const phoneSale = {
      ...baseSale,
      numero_telefone: "+55 (11) 98765-4321",
    };
    const cpfSale = {
      ...baseSale,
      id: "sale-2",
      numero_telefone: "(11) 90000-0000",
      cpf_cliente: "123.456.789-01",
    };
    const emailSale = {
      ...baseSale,
      id: "sale-3",
      numero_telefone: "(11) 90000-0000",
      email_cliente: "CARLOS@EMAIL.COM",
    };

    expect(saleBelongsToClient(phoneSale, client)).toBe(true);
    expect(saleBelongsToClient(cpfSale, client)).toBe(true);
    expect(saleBelongsToClient(emailSale, client)).toBe(true);
  });

  it("filtra e resume o histórico de compras do cliente", () => {
    const sales: SoldDevice[] = [
      baseSale,
      {
        ...baseSale,
        id: "sale-2",
        data: "2026-04-21",
        valor_total_venda: 7100,
      },
      {
        ...baseSale,
        id: "sale-3",
        comprador: "Maria",
        numero_telefone: "(11) 95555-1111",
        valor_total_venda: 4000,
      },
    ];

    const clientSales = getClientSales(sales, client);
    const summary = getClientSalesSummary(clientSales);

    expect(clientSales).toHaveLength(2);
    expect(clientSales[0].id).toBe("sale-2");
    expect(summary.totalSpent).toBe(13300);
    expect(summary.averageTicket).toBe(6650);
    expect(summary.lastPurchaseDate).toBe("2026-04-21");
  });
});
