import { Client, clients as defaultClients } from "@/data/mockData";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ClientInput = Omit<Client, "id">;
export interface SaleClientDraft {
  selectedClientId?: null | string;
  nome: string;
  cpf?: string;
  email?: string;
  telefone: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  data_cadastro?: string;
}

export interface ClientSyncResult {
  action: "created" | "updated";
  client: Client;
}

function normalizeDigits(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function buildClientInputFromSale(draft: SaleClientDraft, totalCompras: number): ClientInput {
  return {
    nome: normalizeText(draft.nome) || "Cliente",
    cpf: normalizeDigits(draft.cpf),
    email: normalizeEmail(draft.email),
    telefone: normalizeDigits(draft.telefone),
    endereco: normalizeText(draft.endereco),
    cidade: normalizeText(draft.cidade),
    estado: normalizeText(draft.estado).toUpperCase().slice(0, 2),
    cep: normalizeDigits(draft.cep),
    data_cadastro: draft.data_cadastro ?? new Date().toISOString().split("T")[0],
    total_compras: totalCompras,
  };
}

function mergeClientWithSaleDraft(client: Client, draft: SaleClientDraft, incrementPurchases: boolean): Client {
  const nextCpf = normalizeDigits(draft.cpf);
  const nextEmail = normalizeEmail(draft.email);
  const nextPhone = normalizeDigits(draft.telefone);
  const nextCep = normalizeDigits(draft.cep);
  const nextAddress = normalizeText(draft.endereco);
  const nextCity = normalizeText(draft.cidade);
  const nextState = normalizeText(draft.estado).toUpperCase().slice(0, 2);

  return {
    ...client,
    nome: normalizeText(draft.nome) || client.nome,
    cpf: nextCpf || client.cpf,
    email: nextEmail || client.email,
    telefone: nextPhone || client.telefone,
    endereco: nextAddress || client.endereco,
    cidade: nextCity || client.cidade,
    estado: nextState || client.estado,
    cep: nextCep || client.cep,
    total_compras: client.total_compras + (incrementPurchases ? 1 : 0),
  };
}

function findExistingClient(clients: Client[], draft: SaleClientDraft) {
  const normalizedCpf = normalizeDigits(draft.cpf);
  const normalizedEmail = normalizeEmail(draft.email);
  const normalizedPhone = normalizeDigits(draft.telefone);
  const normalizedName = normalizeText(draft.nome).toLowerCase();

  if (draft.selectedClientId) {
    const selectedClient = clients.find((client) => client.id === draft.selectedClientId);

    if (selectedClient) {
      return selectedClient;
    }
  }

  if (normalizedCpf) {
    const clientByCpf = clients.find((client) => client.cpf === normalizedCpf);

    if (clientByCpf) {
      return clientByCpf;
    }
  }

  if (normalizedPhone) {
    const clientByPhone = clients.find((client) => client.telefone === normalizedPhone);

    if (clientByPhone) {
      return clientByPhone;
    }
  }

  if (normalizedEmail) {
    const clientByEmail = clients.find((client) => client.email.toLowerCase() === normalizedEmail);

    if (clientByEmail) {
      return clientByEmail;
    }
  }

  if (normalizedName && normalizedPhone) {
    return (
      clients.find(
        (client) =>
          client.nome.trim().toLowerCase() === normalizedName &&
          client.telefone === normalizedPhone,
      ) ?? null
    );
  }

  return null;
}

interface ClientState {
  clients: Client[];
  addClient: (data: ClientInput) => void;
  updateClient: (id: string, data: ClientInput) => void;
  deleteClient: (id: string) => void;
  upsertClientFromSale: (
    data: SaleClientDraft,
    options?: {
      incrementPurchases?: boolean;
    },
  ) => ClientSyncResult;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      clients: defaultClients,
      addClient: (data) =>
        set((state) => ({
          clients: [...state.clients, { id: crypto.randomUUID(), ...data }],
        })),
      updateClient: (id, data) =>
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === id ? { ...client, ...data } : client,
          ),
        })),
      deleteClient: (id) =>
        set((state) => ({
          clients: state.clients.filter((client) => client.id !== id),
        })),
      upsertClientFromSale: (data, options) => {
        const incrementPurchases = options?.incrementPurchases ?? true;
        const existingClient = findExistingClient(get().clients, data);
        let result: ClientSyncResult;

        set((state) => {
          if (existingClient) {
            const updatedClient = mergeClientWithSaleDraft(existingClient, data, incrementPurchases);
            result = {
              action: "updated",
              client: updatedClient,
            };

            return {
              clients: state.clients.map((client) =>
                client.id === existingClient.id ? updatedClient : client,
              ),
            };
          }

          const newClient: Client = {
            id: crypto.randomUUID(),
            ...buildClientInputFromSale(data, incrementPurchases ? 1 : 0),
          };
          result = {
            action: "created",
            client: newClient,
          };

          return {
            clients: [...state.clients, newClient],
          };
        });

        return result!;
      },
    }),
    {
      name: "stock-control-clients",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
