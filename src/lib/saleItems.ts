import type { StockItem } from "@/types/stockTypes";
import type { SaleLineItem, SoldDevice } from "@/types/saleTypes";

const DEFAULT_UNIT = "un";
const MULTIPLE_VALUES_LABEL = "Múltiplos";

export class SaleValidationError extends Error {
  code: string;

  constructor(message: string, code = "sale_validation") {
    super(message);
    this.name = "SaleValidationError";
    this.code = code;
  }
}

export interface SaleProductOption {
  productId: string;
  productName: string;
  description: string;
  sku: string;
  unit: string;
  unitPrice: number;
  availableQuantity: number;
  discount: number;
  color: string;
  condition: string;
  supplier: string;
  stockEntries: StockItem[];
}

export interface SaleTotals {
  totalItems: number;
  totalQuantity: number;
  totalDiscount: number;
  totalCost: number;
  totalSale: number;
}

export interface InventoryDiff {
  toConsume: StockItem[];
  toRestore: StockItem[];
}

export interface SaleProductAvailabilityOption {
  option: SaleProductOption;
  remainingQuantity: number;
}

function toSafeNumber(value: number | undefined | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function deriveCapacity(modelo: string) {
  return modelo.match(/(\d+\s?(?:GB|TB))/i)?.[1]?.toUpperCase() ?? "";
}

function buildDescription(entry: StockItem) {
  return [entry.modelo, entry.cor, entry.condicao].filter(Boolean).join(" • ");
}

function normalizeUniqueStockEntries(entries: StockItem[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = String(entry.id ?? entry.imei);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getGroupedValue(values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));

  if (!uniqueValues.length) {
    return "";
  }

  return uniqueValues.length === 1 ? uniqueValues[0] : MULTIPLE_VALUES_LABEL;
}

function getAvailableStockEntries(entries: StockItem[]) {
  return entries.filter((entry) => entry.ativo !== false);
}

export function normalizeStockItem(
  entry: Partial<StockItem> & Pick<StockItem, "modelo">,
): StockItem {
  const price = toSafeNumber(entry.preco ?? entry.valor_unitario);
  const id = String(entry.id ?? entry.imei ?? `${entry.modelo}-${crypto.randomUUID()}`);

  return {
    id,
    imei: entry.imei ?? id,
    modelo: entry.modelo,
    marca: entry.marca ?? entry.modelo.split(" ")[0] ?? "Sem marca",
    cor: entry.cor ?? "",
    capacidade: entry.capacidade ?? deriveCapacity(entry.modelo),
    preco: price,
    valor_unitario: toSafeNumber(entry.valor_unitario ?? entry.preco),
    condicao: entry.condicao ?? "Seminovo",
    dataEntrada: entry.dataEntrada ?? new Date().toISOString().split("T")[0],
    fornecedor: entry.fornecedor ?? "",
    observacao: entry.observacao ?? "",
    ativo: entry.ativo ?? true,
  };
}

export function buildSaleProductKey(entry: Pick<
  StockItem,
  "modelo" | "cor" | "capacidade" | "condicao" | "fornecedor" | "valor_unitario"
>) {
  return [
    entry.modelo.trim().toLowerCase(),
    entry.cor.trim().toLowerCase(),
    entry.capacidade.trim().toLowerCase(),
    entry.condicao.trim().toLowerCase(),
    entry.fornecedor.trim().toLowerCase(),
    toSafeNumber(entry.valor_unitario).toFixed(2),
  ].join("::");
}

export function calculateSaleItemSubtotal(quantity: number, unitPrice: number, discount: number) {
  const safeQuantity = Math.max(1, Math.floor(toSafeNumber(quantity)));
  const safeUnitPrice = Math.max(0, toSafeNumber(unitPrice));
  const safeDiscount = Math.max(0, toSafeNumber(discount));
  const grossSubtotal = safeQuantity * safeUnitPrice;

  if (safeDiscount > grossSubtotal) {
    throw new SaleValidationError(
      "O desconto do item não pode ser maior do que o subtotal bruto.",
      "invalid-discount",
    );
  }

  return grossSubtotal - safeDiscount;
}

export function buildSaleProductOptions(
  stockItems: StockItem[],
  reservedStockItems: StockItem[] = [],
) {
  const grouped = new Map<string, SaleProductOption>();
  const mergedEntries = normalizeUniqueStockEntries([
    ...getAvailableStockEntries(stockItems).map((entry) => normalizeStockItem(entry)),
    ...reservedStockItems.map((entry) => normalizeStockItem(entry)),
  ]);

  mergedEntries.forEach((entry) => {
    const key = buildSaleProductKey(entry);
    const current = grouped.get(key);

    if (current) {
      current.stockEntries.push(entry);
      current.availableQuantity = current.stockEntries.length;
      current.sku = current.sku || entry.id || entry.imei;
      return;
    }

    grouped.set(key, {
      productId: key,
      productName: entry.modelo,
      description: buildDescription(entry),
      sku: entry.id || entry.imei,
      unit: DEFAULT_UNIT,
      unitPrice: toSafeNumber(entry.preco ?? entry.valor_unitario),
      availableQuantity: 1,
      discount: 0,
      color: entry.cor,
      condition: entry.condicao,
      supplier: entry.fornecedor,
      stockEntries: [entry],
    });
  });

  return [...grouped.values()].sort((left, right) => {
    if (left.productName !== right.productName) {
      return left.productName.localeCompare(right.productName);
    }

    return right.availableQuantity - left.availableQuantity;
  });
}

function getSelectedStockEntries(option: SaleProductOption, quantity: number) {
  if (quantity < 1) {
    throw new SaleValidationError(
      "A quantidade mínima por item é 1.",
      "minimum-quantity",
    );
  }

  if (quantity > option.availableQuantity) {
    throw new SaleValidationError(
      "A quantidade solicitada excede o estoque disponível.",
      "stock-exceeded",
    );
  }

  return option.stockEntries.slice(0, quantity).map((entry) => normalizeStockItem(entry));
}

export function buildSaleItemFromOption(
  option: SaleProductOption,
  quantity = 1,
  overrides: Partial<Pick<SaleLineItem, "unitPrice" | "discount">> = {},
): SaleLineItem {
  const selectedEntries = getSelectedStockEntries(option, quantity);
  const unitPrice = Math.max(0, toSafeNumber(overrides.unitPrice ?? option.unitPrice));
  const discount = Math.max(0, toSafeNumber(overrides.discount ?? option.discount));

  return {
    productId: option.productId,
    productName: option.productName,
    description: option.description,
    sku: option.sku,
    unit: option.unit,
    quantity,
    availableQuantity: option.availableQuantity,
    unitPrice,
    discount,
    subtotal: calculateSaleItemSubtotal(quantity, unitPrice, discount),
    color: option.color,
    condition: option.condition,
    supplier: option.supplier,
    stockEntries: selectedEntries,
  };
}

export function updateSaleItemFromOption(
  item: SaleLineItem,
  option: SaleProductOption,
  changes: Partial<Pick<SaleLineItem, "quantity" | "unitPrice" | "discount">>,
) {
  const quantity = Math.max(1, Math.floor(toSafeNumber(changes.quantity ?? item.quantity)));
  const unitPrice = Math.max(0, toSafeNumber(changes.unitPrice ?? item.unitPrice));
  const discount = Math.max(0, toSafeNumber(changes.discount ?? item.discount));

  return buildSaleItemFromOption(option, quantity, {
    unitPrice,
    discount,
  });
}

export function addProductToSale(items: SaleLineItem[], option: SaleProductOption) {
  const currentIndex = items.findIndex((item) => item.productId === option.productId);

  if (currentIndex === -1) {
    return {
      items: [...items, buildSaleItemFromOption(option)],
      action: "added" as const,
    };
  }

  const updatedItems = [...items];
  const existingItem = updatedItems[currentIndex];
  updatedItems[currentIndex] = updateSaleItemFromOption(existingItem, option, {
    quantity: existingItem.quantity + 1,
  });

  return {
    items: updatedItems,
    action: "consolidated" as const,
  };
}

export function getSelectedQuantityForProduct(items: SaleLineItem[], productId: string) {
  return items
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + item.quantity, 0);
}

export function getRemainingProductAvailability(
  option: SaleProductOption,
  items: SaleLineItem[],
) {
  return Math.max(option.availableQuantity - getSelectedQuantityForProduct(items, option.productId), 0);
}

export function buildAvailableProductOptions(
  options: SaleProductOption[],
  items: SaleLineItem[],
) {
  return options.reduce<SaleProductAvailabilityOption[]>((availableOptions, option) => {
    const remainingQuantity = getRemainingProductAvailability(option, items);

    if (remainingQuantity < 1) {
      return availableOptions;
    }

    availableOptions.push({
      option,
      remainingQuantity,
    });

    return availableOptions;
  }, []);
}

export function calculateSaleTotals(items: SaleLineItem[]): SaleTotals {
  return items.reduce<SaleTotals>(
    (totals, item) => ({
      totalItems: totals.totalItems + 1,
      totalQuantity: totals.totalQuantity + item.quantity,
      totalDiscount: totals.totalDiscount + toSafeNumber(item.discount),
      totalCost:
        totals.totalCost +
        item.stockEntries.reduce(
          (sum, stockEntry) => sum + toSafeNumber(stockEntry.preco ?? stockEntry.valor_unitario),
          0,
        ),
      totalSale: totals.totalSale + toSafeNumber(item.subtotal),
    }),
    {
      totalItems: 0,
      totalQuantity: 0,
      totalDiscount: 0,
      totalCost: 0,
      totalSale: 0,
    },
  );
}

export function buildSaleLegacySummary(items: SaleLineItem[]) {
  if (!items.length) {
    throw new SaleValidationError(
      "Adicione pelo menos um produto antes de salvar a venda.",
      "empty-sale",
    );
  }

  const totals = calculateSaleTotals(items);
  const firstItem = items[0];
  const colors = items.map((item) => item.color);
  const conditions = items.map((item) => item.condition);
  const suppliers = items.map((item) => item.supplier);
  const mainStockEntry = firstItem.stockEntries[0];

  return {
    aparelho:
      totals.totalQuantity === 1
        ? firstItem.productName
        : `${totals.totalQuantity} item(ns) • ${firstItem.productName}${items.length > 1 ? ` +${items.length - 1}` : ""}`,
    cor: getGroupedValue(colors),
    condicao: getGroupedValue(conditions),
    imei: totals.totalQuantity === 1 ? mainStockEntry?.imei ?? firstItem.sku : firstItem.sku,
    fornecedor: getGroupedValue(suppliers),
    valorCompra: totals.totalCost,
    valorTotalVenda: totals.totalSale,
  };
}

export function extractSaleStockEntries(sale: SoldDevice) {
  if (sale.items?.length) {
    return sale.items.flatMap((item) =>
      item.stockEntries.map((entry) => normalizeStockItem(entry)),
    );
  }

  if (!sale.aparelho) {
    return [];
  }

  return [
    normalizeStockItem({
      id: String(sale.imei || sale.id),
      imei: sale.imei || String(sale.id),
      modelo: sale.aparelho,
      cor: sale.cor,
      capacidade: deriveCapacity(sale.aparelho),
      preco: sale.valor_compra,
      valor_unitario: sale.valor_compra,
      condicao: sale.condicao,
      dataEntrada: sale.data.split("T")[0],
      fornecedor: sale.fornecedor,
      observacao: sale.observacao ?? "",
    }),
  ];
}

function findProductOption(
  options: SaleProductOption[],
  item: Pick<SaleLineItem, "productId" | "productName" | "color" | "condition" | "supplier" | "unitPrice">,
) {
  return (
    options.find((option) => option.productId === item.productId) ??
    options.find(
      (option) =>
        option.productName === item.productName &&
        option.color === item.color &&
        option.condition === item.condition &&
        option.supplier === item.supplier &&
        option.unitPrice === item.unitPrice,
    )
  );
}

export function buildSaleItemsFromSale(
  sale: SoldDevice,
  productOptions: SaleProductOption[] = [],
) {
  if (sale.items?.length) {
    return sale.items.map((item) => {
      const option = findProductOption(productOptions, item);

      if (!option) {
        return {
          ...item,
          availableQuantity: item.stockEntries.length || item.availableQuantity || item.quantity,
          subtotal: calculateSaleItemSubtotal(item.quantity, item.unitPrice, item.discount),
          stockEntries: item.stockEntries.map((entry) => normalizeStockItem(entry)),
        };
      }

      return buildSaleItemFromOption(option, item.quantity, {
        unitPrice: item.unitPrice,
        discount: item.discount,
      });
    });
  }

  const fallbackEntries = extractSaleStockEntries(sale);
  const fallbackOptions = buildSaleProductOptions([], fallbackEntries);
  const fallbackOption = fallbackOptions[0];

  if (!fallbackOption) {
    return [];
  }

  return [
    buildSaleItemFromOption(fallbackOption, 1, {
      unitPrice: sale.valor_total_venda || sale.preco_vista || fallbackOption.unitPrice,
      discount: 0,
    }),
  ];
}

function flattenStockEntries(items: SaleLineItem[]) {
  return items.flatMap((item) => item.stockEntries.map((entry) => normalizeStockItem(entry)));
}

export function getInventoryDiff(previousItems: SaleLineItem[], nextItems: SaleLineItem[]): InventoryDiff {
  const previousEntries = flattenStockEntries(previousItems);
  const nextEntries = flattenStockEntries(nextItems);
  const nextIds = new Set(nextEntries.map((entry) => entry.id));
  const previousIds = new Set(previousEntries.map((entry) => entry.id));

  return {
    toConsume: nextEntries.filter((entry) => !previousIds.has(entry.id)),
    toRestore: previousEntries.filter((entry) => !nextIds.has(entry.id)),
  };
}

export function getProductSearchText(option: SaleProductOption) {
  return [
    option.productName,
    option.description,
    option.sku,
    option.supplier,
    option.condition,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
