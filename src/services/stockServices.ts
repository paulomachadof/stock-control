import { stockDevices } from "@/data/mockData";
import type { StockItem, StockResponse } from "@/types/stockTypes";
import api from "./api";

export type { StockItem, StockResponse } from "@/types/stockTypes";

function shouldUseLocalStockFallback() {
  if (typeof window === "undefined") {
    return false;
  }

  const token = localStorage.getItem("accessToken");
  return !token || token === "local-demo-token";
}

function deriveCapacity(modelo: string) {
  return modelo.match(/(\d+\s?(?:GB|TB))/i)?.[1]?.toUpperCase() ?? "";
}

function deriveCondition(observacao?: string) {
  return observacao?.toLowerCase().includes("quebrada")
    ? "Tela quebrada"
    : "Seminovo";
}

function mapMockDeviceToStockItem(index: number, device: (typeof stockDevices)[number]): StockItem {
  const modelo = device.modelo ?? "Aparelho";
  const valorUnitario = device.valor_unitario ?? 0;
  const id = device.id ?? device.imei ?? `mock-stock-${index}`;

  return {
    id,
    imei: device.imei ?? id,
    modelo,
    marca: modelo.split(" ")[0] ?? "Sem marca",
    cor: device.cor ?? "",
    capacidade: deriveCapacity(modelo),
    preco: valorUnitario,
    valor_unitario: valorUnitario,
    condicao: deriveCondition(device.observacao),
    dataEntrada: "2026-01-01",
    fornecedor: device.fornecedor ?? "",
    observacao: device.observacao ?? "",
    ativo: true,
  };
}

function getFallbackStockItems() {
  return stockDevices.map((device, index) => mapMockDeviceToStockItem(index, device));
}

function findFallbackStockIndex(idOrImei: string | number) {
  return stockDevices.findIndex((device) => {
    const fallbackId = device.id ?? device.imei;
    return fallbackId === String(idOrImei) || device.imei === String(idOrImei);
  });
}

function createFallbackStockItem(data: Omit<StockItem, "id">): StockItem {
  const fallbackDevice = {
    id: data.imei,
    modelo: data.modelo,
    cor: data.cor,
    fornecedor: data.fornecedor,
    imei: data.imei,
    observacao: data.observacao ?? "",
    valor_unitario: data.valor_unitario ?? data.preco ?? 0,
    valor_total_estoque: null,
  };

  stockDevices.unshift(fallbackDevice);

  return mapMockDeviceToStockItem(0, fallbackDevice);
}

function updateFallbackStockItem(
  id: string | number,
  data: Partial<StockItem>,
): StockItem {
  const index = findFallbackStockIndex(id);

  if (index === -1) {
    throw { message: "Item não encontrado no modo local.", status: 404 };
  }

  const current = stockDevices[index];
  const next = {
    ...current,
    modelo: data.modelo ?? current.modelo,
    cor: data.cor ?? current.cor,
    fornecedor: data.fornecedor ?? current.fornecedor,
    imei: current.imei,
    observacao: data.observacao ?? current.observacao ?? "",
    valor_unitario: data.valor_unitario ?? data.preco ?? current.valor_unitario ?? 0,
  };

  stockDevices[index] = next;

  return mapMockDeviceToStockItem(index, next);
}

function deleteFallbackStockItem(id: string | number) {
  const index = findFallbackStockIndex(id);

  if (index === -1) {
    return;
  }

  stockDevices.splice(index, 1);
}

function buildFallbackStockResponse(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): StockResponse {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const normalizedSearch = params?.search?.trim().toLowerCase() ?? "";
  const filteredItems = getFallbackStockItems().filter((device) => {
    if (!normalizedSearch) {
      return true;
    }

    return [device.modelo, device.cor, device.imei, device.fornecedor]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    data: filteredItems.slice(start, end),
    total: filteredItems.length,
    page,
    limit,
  };
}

export const stockService = {
  // Listar todo o estoque
  getStock: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<StockResponse> => {
    if (shouldUseLocalStockFallback()) {
      return buildFallbackStockResponse(params);
    }

    try {
      const response = await api.get<StockResponse>("/stock", {
        params,
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return buildFallbackStockResponse(params);
      }

      throw error;
    }
  },

  // Buscar item por Id
  getStockById: async (id: string): Promise<StockItem> => {
    if (shouldUseLocalStockFallback()) {
      const localItem = getFallbackStockItems().find(
        (device) => device.id === id || device.imei === id,
      );

      if (!localItem) {
        throw { message: "Item não encontrado no modo local.", status: 404 };
      }

      return localItem;
    }

    try {
      const response = await api.get<StockItem>(`/stock/${id}`, {
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        const localItem = getFallbackStockItems().find(
          (device) => device.id === id || device.imei === id,
        );

        if (localItem) {
          return localItem;
        }
      }

      throw error;
    }
  },

  // Criar novo item no estoque
  createStock: async (data: Omit<StockItem, "id">): Promise<StockItem> => {
    if (shouldUseLocalStockFallback()) {
      return createFallbackStockItem(data);
    }

    try {
      const response = await api.post<StockItem>("/stock", data, {
        skipAuthRedirect: true,
      });
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return createFallbackStockItem(data);
      }

      console.error("Erro na API /estoque:", error);

      throw {
        message:
          error?.response?.data?.message || "Erro ao criar item no estoque",
        status: error?.response?.status,
      };
    }
  },

  // Atualizar item do estoque
  updateStock: async (
    id: string,
    data: Partial<StockItem>
  ): Promise<StockItem> => {
    if (shouldUseLocalStockFallback()) {
      return updateFallbackStockItem(id, data);
    }

    try {
      const payload = { ...data };
      delete payload.imei;

      const response = await api.put<StockItem>(`/stock/${id}`, payload, {
        skipAuthRedirect: true,
      });
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return updateFallbackStockItem(id, data);
      }

      console.error("Erro na API /estoque:", error);

      throw {
        message:
          error?.response?.data?.message || "Erro ao atualizar item no estoque",
        status: error?.response?.status,
      };
    }
  },

  // Remover item do estoque
  deleteStock: async (id: string | number): Promise<void> => {
    if (shouldUseLocalStockFallback()) {
      deleteFallbackStockItem(id);
      return;
    }

    try {
      await api.delete(`/stock/${id}`, { skipAuthRedirect: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        deleteFallbackStockItem(id);
        return;
      }

      throw error;
    }
  },
};

export default stockService;
