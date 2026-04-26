import { describe, expect, it } from "vitest";

import {
  addProductToSale,
  buildAvailableProductOptions,
  buildSaleItemFromOption,
  buildSaleItemsFromSale,
  buildSaleLegacySummary,
  buildSaleProductOptions,
  calculateSaleTotals,
  getInventoryDiff,
  SaleValidationError,
  updateSaleItemFromOption,
} from "@/lib/saleItems";
import type { SoldDevice } from "@/types/saleTypes";
import type { StockItem } from "@/types/stockTypes";

const stockCatalog: StockItem[] = [
  {
    id: "stk-1",
    imei: "111111111111111",
    modelo: "iPhone 13 128GB",
    marca: "Apple",
    cor: "Azul",
    capacidade: "128GB",
    preco: 2300,
    valor_unitario: 2300,
    condicao: "Seminovo",
    dataEntrada: "2026-04-01",
    fornecedor: "Pedro",
    observacao: "",
    ativo: true,
  },
  {
    id: "stk-2",
    imei: "222222222222222",
    modelo: "iPhone 13 128GB",
    marca: "Apple",
    cor: "Azul",
    capacidade: "128GB",
    preco: 2300,
    valor_unitario: 2300,
    condicao: "Seminovo",
    dataEntrada: "2026-04-02",
    fornecedor: "Pedro",
    observacao: "",
    ativo: true,
  },
  {
    id: "stk-3",
    imei: "333333333333333",
    modelo: "Galaxy S24",
    marca: "Samsung",
    cor: "Preto",
    capacidade: "256GB",
    preco: 3200,
    valor_unitario: 3200,
    condicao: "Novo",
    dataEntrada: "2026-04-03",
    fornecedor: "Distribuidora",
    observacao: "",
    ativo: true,
  },
  {
    id: "stk-inactive",
    imei: "999999999999999",
    modelo: "Galaxy S24",
    marca: "Samsung",
    cor: "Preto",
    capacidade: "256GB",
    preco: 3200,
    valor_unitario: 3200,
    condicao: "Novo",
    dataEntrada: "2026-04-03",
    fornecedor: "Distribuidora",
    observacao: "",
    ativo: false,
  },
];

describe("saleItems", () => {
  it("agrupa produtos disponíveis do estoque e ignora itens inativos", () => {
    const options = buildSaleProductOptions(stockCatalog);

    expect(options).toHaveLength(2);
    expect(options[0].productName).toBe("Galaxy S24");
    expect(options[0].availableQuantity).toBe(1);
    expect(options[1].productName).toBe("iPhone 13 128GB");
    expect(options[1].availableQuantity).toBe(2);
  });

  it("consolida o mesmo produto na mesma linha e soma a quantidade", () => {
    const option = buildSaleProductOptions(stockCatalog).find(
      (item) => item.productName === "iPhone 13 128GB",
    );

    expect(option).toBeDefined();

    const firstInsert = addProductToSale([], option!);
    const secondInsert = addProductToSale(firstInsert.items, option!);

    expect(secondInsert.action).toBe("consolidated");
    expect(secondInsert.items).toHaveLength(1);
    expect(secondInsert.items[0].quantity).toBe(2);
    expect(secondInsert.items[0].subtotal).toBe(4600);
  });

  it("remove dinamicamente da lista o produto sem saldo restante", () => {
    const options = buildSaleProductOptions(stockCatalog);
    const iphone = options.find((item) => item.productName === "iPhone 13 128GB");
    const galaxy = options.find((item) => item.productName === "Galaxy S24");

    const twoIphonesSelected = [buildSaleItemFromOption(iphone!, 2)];
    const availableAfterFullSelection = buildAvailableProductOptions(options, twoIphonesSelected);

    expect(
      availableAfterFullSelection.some((entry) => entry.option.productId === iphone!.productId),
    ).toBe(false);
    expect(
      availableAfterFullSelection.some((entry) => entry.option.productId === galaxy!.productId),
    ).toBe(true);

    const oneIphoneSelected = [buildSaleItemFromOption(iphone!, 1)];
    const availableAfterPartialSelection = buildAvailableProductOptions(options, oneIphoneSelected);
    const iphoneAvailability = availableAfterPartialSelection.find(
      (entry) => entry.option.productId === iphone!.productId,
    );

    expect(iphoneAvailability?.remainingQuantity).toBe(1);
  });

  it("bloqueia quantidade acima do estoque disponível", () => {
    const option = buildSaleProductOptions(stockCatalog).find(
      (item) => item.productName === "Galaxy S24",
    );
    const saleItem = buildSaleItemFromOption(option!);

    expect(() =>
      updateSaleItemFromOption(saleItem, option!, {
        quantity: 2,
      }),
    ).toThrow(SaleValidationError);
  });

  it("recalcula subtotal, total e resumo legado automaticamente", () => {
    const options = buildSaleProductOptions(stockCatalog);
    const iphone = options.find((item) => item.productName === "iPhone 13 128GB");
    const galaxy = options.find((item) => item.productName === "Galaxy S24");

    const items = [
      buildSaleItemFromOption(iphone!, 2, { discount: 100 }),
      buildSaleItemFromOption(galaxy!, 1, { unitPrice: 3500, discount: 50 }),
    ];

    const totals = calculateSaleTotals(items);
    const summary = buildSaleLegacySummary(items);

    expect(totals.totalQuantity).toBe(3);
    expect(totals.totalDiscount).toBe(150);
    expect(totals.totalCost).toBe(7800);
    expect(totals.totalSale).toBe(7950);
    expect(summary.aparelho).toContain("3 item(ns)");
    expect(summary.valorCompra).toBe(7800);
    expect(summary.valorTotalVenda).toBe(7950);
  });

  it("hidrata uma venda legada em item de venda com autopreenchimento", () => {
    const legacySale: SoldDevice = {
      id: "sale-legacy",
      data: "2026-04-24",
      aparelho: "Moto G84 256GB",
      cor: "Grafite",
      condicao: "Seminovo",
      imei: "444444444444444",
      fornecedor: "Cliente",
      valor_compra: 1500,
      comprador: "Ana",
      numero_telefone: "(11) 99999-9999",
      aparelho_recebido: true,
      observacao: "Venda antiga",
      valor_recebido: 1900,
      preco_vista: 1900,
      preco_cartao: 1990,
      valor_entrega: 0,
      valor_capa_pelicula: 0,
      valor_total_venda: 1900,
    };

    const items = buildSaleItemsFromSale(legacySale);

    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe("Moto G84 256GB");
    expect(items[0].stockEntries[0].imei).toBe("444444444444444");
    expect(items[0].subtotal).toBe(1900);
  });

  it("identifica corretamente o que consumir e restaurar no estoque", () => {
    const options = buildSaleProductOptions(stockCatalog);
    const iphone = options.find((item) => item.productName === "iPhone 13 128GB");
    const galaxy = options.find((item) => item.productName === "Galaxy S24");

    const previousItems = [buildSaleItemFromOption(iphone!, 1)];
    const nextItems = [buildSaleItemFromOption(galaxy!, 1)];

    const diff = getInventoryDiff(previousItems, nextItems);

    expect(diff.toRestore.map((item) => item.id)).toEqual(["stk-1"]);
    expect(diff.toConsume.map((item) => item.id)).toEqual(["stk-3"]);
  });
});
