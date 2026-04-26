export interface StockItem {
  id: string;
  imei: string;
  modelo: string;
  marca: string;
  cor: string;
  capacidade: string;
  preco: number;
  valor_unitario: number;
  condicao: string;
  dataEntrada: string; // formato YYYY-MM-DD
  fornecedor: string;
  observacao?: string;
  ativo?: boolean;
}

export interface StockResponse {
  data: StockItem[];
  total: number;
  page: number;
  limit: number;
}
