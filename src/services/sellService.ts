import { soldDevices } from "@/data/mockData";
import { calculateSalePaymentSummary } from "@/lib/salePayment";
import {
  SaleValidationError,
  calculateSaleItemSubtotal,
  calculateSaleTotals,
} from "@/lib/saleItems";
import type { SaleLineItem, SoldDevice, SoldDeviceResponse } from "@/types/saleTypes";
import api from "./api";

export type { SaleLineItem, SoldDevice, SoldDeviceResponse } from "@/types/saleTypes";

function shouldUseLocalSaleFallback() {
  if (typeof window === "undefined") {
    return false;
  }

  const token = localStorage.getItem("accessToken");
  return !token || token === "local-demo-token";
}

function matchesSearch(sale: SoldDevice, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    sale.aparelho,
    sale.comprador,
    sale.imei,
    sale.numero_telefone,
    ...(sale.items ?? []).flatMap((item) => [
      item.productName,
      item.sku,
      item.description,
      item.supplier,
      ...item.stockEntries.map((entry) => entry.imei),
    ]),
  ];

  return searchableValues
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

function buildFallbackSalesResponse(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): SoldDeviceResponse {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const filteredSales = soldDevices.filter((sale) => matchesSearch(sale, params?.search ?? ""));
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    data: filteredSales.slice(start, end),
    total: filteredSales.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(filteredSales.length / limit)),
  };
}

function sanitizeLineItem(item: SaleLineItem): SaleLineItem {
  const subtotal = calculateSaleItemSubtotal(item.quantity, item.unitPrice, item.discount);

  if (item.quantity > item.availableQuantity) {
    throw new SaleValidationError(
      "A quantidade do item não pode ultrapassar o estoque disponível.",
      "stock-exceeded",
    );
  }

  return {
    ...item,
    quantity: Math.max(1, Math.floor(item.quantity)),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    discount: Math.max(0, Number(item.discount) || 0),
    subtotal,
    stockEntries: item.stockEntries,
  };
}

function sanitizeSalePayload(
  data: Omit<SoldDevice, "id"> | Partial<Omit<SoldDevice, "id">>,
) {
  const normalizedItems = data.items?.map(sanitizeLineItem);

  if (normalizedItems?.length === 0) {
    throw new SaleValidationError(
      "Adicione pelo menos um produto à venda.",
      "empty-sale",
    );
  }

  if (!normalizedItems) {
    return data;
  }

  const totals = calculateSaleTotals(normalizedItems);
  const paymentSummary = calculateSalePaymentSummary({
    subtotalProdutos: totals.totalSale,
    descontoPagamento: data.desconto_pagamento,
    taxasPagamento: data.taxas_pagamento,
    valorEntrega: data.valor_entrega,
    valorAcessorios: data.valor_capa_pelicula,
    valorRecebido: data.valor_recebido,
  });
  const paymentMethod = data.metodo_pagamento ?? "pix";
  const installments =
    paymentMethod === "cartao_credito"
      ? Math.max(1, Math.floor(Number(data.parcelas_pagamento) || 1))
      : 1;

  return {
    ...data,
    items: normalizedItems,
    valor_compra: totals.totalCost,
    preco_vista: paymentSummary.subtotalProdutos,
    preco_cartao: paymentSummary.totalFinal,
    valor_entrega: paymentSummary.valorEntrega,
    valor_capa_pelicula: paymentSummary.valorAcessorios,
    desconto_pagamento: paymentSummary.descontoPagamento,
    taxas_pagamento: paymentSummary.taxasPagamento,
    valor_recebido:
      data.valor_recebido == null || data.valor_recebido === 0
        ? paymentSummary.totalFinal
        : paymentSummary.valorRecebido,
    metodo_pagamento: paymentMethod,
    parcelas_pagamento: installments,
    aparelho_recebido: data.aparelho_recebido ?? true,
    valor_total_venda: paymentSummary.totalFinal,
  };
}

function createFallbackSale(data: Omit<SoldDevice, "id">): SoldDevice {
  const newSale: SoldDevice = {
    id: `sale-${crypto.randomUUID()}`,
    ...sanitizeSalePayload(data),
  };

  soldDevices.unshift(newSale);
  return newSale;
}

function updateFallbackSale(
  id: string | number,
  data: Partial<Omit<SoldDevice, "id">>,
): SoldDevice {
  const index = soldDevices.findIndex((sale) => String(sale.id) === String(id));

  if (index === -1) {
    throw { message: "Venda não encontrada no modo local.", status: 404 };
  }

  const currentSale = soldDevices[index];
  const nextSale = {
    ...currentSale,
    ...sanitizeSalePayload({
      ...currentSale,
      ...data,
    }),
  };

  soldDevices[index] = nextSale;
  return nextSale;
}

export const sellService = {
  getSales: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<SoldDeviceResponse> => {
    if (shouldUseLocalSaleFallback()) {
      return buildFallbackSalesResponse(params);
    }

    try {
      const response = await api.get<SoldDeviceResponse>("/sold-devices", {
        params,
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return buildFallbackSalesResponse(params);
      }

      throw error;
    }
  },

  getSaleById: async (id: string | number): Promise<SoldDevice> => {
    if (shouldUseLocalSaleFallback()) {
      const sale = soldDevices.find((candidate) => String(candidate.id) === String(id));

      if (!sale) {
        throw { message: "Venda não encontrada no modo local.", status: 404 };
      }

      return sale;
    }

    try {
      const response = await api.get<SoldDevice>(`/sold-devices/${id}`, {
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        const sale = soldDevices.find((candidate) => String(candidate.id) === String(id));

        if (sale) {
          return sale;
        }
      }

      throw error;
    }
  },

  createSale: async (data: Omit<SoldDevice, "id">): Promise<SoldDevice> => {
    if (shouldUseLocalSaleFallback()) {
      return createFallbackSale(data);
    }

    try {
      const payload = sanitizeSalePayload(data) as Omit<SoldDevice, "id">;
      const response = await api.post<SoldDevice>("/sold-devices", payload, {
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return createFallbackSale(data);
      }

      console.error("Erro na API /sold-devices:", error);
      throw {
        message: error?.response?.data?.message || "Erro ao registrar venda",
        status: error?.response?.status,
      };
    }
  },

  updateSale: async (
    id: string | number,
    data: Partial<Omit<SoldDevice, "id">>,
  ): Promise<SoldDevice> => {
    if (shouldUseLocalSaleFallback()) {
      return updateFallbackSale(id, data);
    }

    try {
      const payload = sanitizeSalePayload(data);
      const response = await api.put<SoldDevice>(`/sold-devices/${id}`, payload, {
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return updateFallbackSale(id, data);
      }

      console.error("Erro na API /sold-devices:", error);
      throw {
        message: error?.response?.data?.message || "Erro ao atualizar venda",
        status: error?.response?.status,
      };
    }
  },
};

export default sellService;
