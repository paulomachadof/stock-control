import { Client } from "@/data/mockData";
import { masks, validators } from "@/hooks/use-masks";
import { ClientInput } from "@/stores/useClientStore";

export interface ClientFormData extends Omit<ClientInput, "total_compras"> {
  total_compras: string;
}

export interface ClientFormErrors {
  nome?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

function isLegacyValueUnchanged(
  formData: ClientFormData,
  baseline: Partial<ClientFormData> | undefined,
  field: keyof ClientFormErrors,
) {
  return baseline?.[field] != null && baseline[field] === formData[field];
}

export const emptyClientForm = (referenceDate = new Date().toISOString().split("T")[0]): ClientFormData => ({
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  data_cadastro: referenceDate,
  total_compras: "0",
});

export function formatClientCPF(cpf: string) {
  return masks.cpf(cpf);
}

export function formatClientPhone(phone: string) {
  return masks.phone(phone);
}

export function formatClientCEP(cep: string) {
  return masks.cep(cep);
}

export function clientToFormData(client: Client): ClientFormData {
  return {
    ...client,
    cpf: formatClientCPF(client.cpf),
    telefone: formatClientPhone(client.telefone),
    cep: formatClientCEP(client.cep),
    total_compras: String(client.total_compras),
  };
}

export function validateClientForm(
  formData: ClientFormData,
  baseline?: Partial<ClientFormData>,
) {
  const errors: ClientFormErrors = {};

  if (!formData.nome.trim() && !isLegacyValueUnchanged(formData, baseline, "nome")) {
    errors.nome = "Nome é obrigatório";
  }

  if (!validators.cpf(formData.cpf) && !isLegacyValueUnchanged(formData, baseline, "cpf")) {
    errors.cpf = "CPF inválido";
  }

  if (
    !validators.email(formData.email) &&
    !isLegacyValueUnchanged(formData, baseline, "email")
  ) {
    errors.email = "Email inválido";
  }

  if (
    !validators.phone(formData.telefone) &&
    !isLegacyValueUnchanged(formData, baseline, "telefone")
  ) {
    errors.telefone = "Telefone inválido";
  }

  if (!formData.cidade.trim() && !isLegacyValueUnchanged(formData, baseline, "cidade")) {
    errors.cidade = "Cidade é obrigatória";
  }

  if (
    formData.estado.trim().length !== 2 &&
    !isLegacyValueUnchanged(formData, baseline, "estado")
  ) {
    errors.estado = "Informe a UF com 2 letras";
  }

  if (!validators.cep(formData.cep) && !isLegacyValueUnchanged(formData, baseline, "cep")) {
    errors.cep = "CEP inválido";
  }

  return errors;
}

export function formDataToClientInput(formData: ClientFormData): ClientInput {
  return {
    nome: formData.nome.trim(),
    cpf: formData.cpf.replace(/\D/g, ""),
    email: formData.email.trim().toLowerCase(),
    telefone: formData.telefone.replace(/\D/g, ""),
    endereco: formData.endereco.trim(),
    cidade: formData.cidade.trim(),
    estado: formData.estado.trim().toUpperCase(),
    cep: formData.cep.replace(/\D/g, ""),
    data_cadastro: formData.data_cadastro,
    total_compras: Number(formData.total_compras || 0),
  };
}
