import type { StockItem } from "@/types/stockTypes";

export interface SaleLineItem {
  productId: string;
  productName: string;
  description: string;
  sku: string;
  unit: string;
  quantity: number;
  availableQuantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  color: string;
  condition: string;
  supplier: string;
  stockEntries: StockItem[];
}

export interface SoldDevice {
  id: string | number;
  data: string;
  aparelho: string;
  cor: string;
  condicao: string;
  imei: string;
  fornecedor: string;
  valor_compra: number;
  comprador: string;
  numero_telefone: string;
  aparelho_recebido: boolean;
  observacao?: string;
  valor_recebido: number;
  preco_vista: number;
  preco_cartao: number;
  valor_entrega: number;
  valor_capa_pelicula: number;
  desconto_pagamento?: number;
  taxas_pagamento?: number;
  metodo_pagamento?: string;
  parcelas_pagamento?: number;
  valor_total_venda: number;
  vendedor_id?: string;
  vendedor_nome?: string;
  canal_venda?: string;
  client_id?: string;
  cpf_cliente?: string;
  email_cliente?: string;
  endereco_cliente?: string;
  cidade_cliente?: string;
  estado_cliente?: string;
  cep_cliente?: string;
  items?: SaleLineItem[];
}

export interface SoldDeviceResponse {
  data: SoldDevice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
