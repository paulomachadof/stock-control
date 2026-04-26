import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Loader2,
  Printer,
  ReceiptText,
  ShoppingCart,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatClientCPF, formatClientPhone } from "@/lib/clientForm";
import { saleBelongsToClient } from "@/lib/clientSales";
import { getPaymentMethodLabel, getSalePaymentSummaryFromSale } from "@/lib/salePayment";
import { downloadSaleReceiptPdf } from "@/lib/saleReceipt";
import sellService, { type SoldDevice } from "@/services/sellService";
import { useClientStore } from "@/stores/useClientStore";
import { toast } from "sonner";

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

const SaleReceipt = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const clients = useClientStore((state) => state.clients);
  const [sale, setSale] = useState<SoldDevice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchSale = async () => {
      try {
        setLoading(true);
        const response = await sellService.getSaleById(id);
        setSale(response);
      } catch {
        toast.error("Não foi possível carregar o recibo da venda.");
        navigate("/painel-comercial");
      } finally {
        setLoading(false);
      }
    };

    void fetchSale();
  }, [id, navigate]);

  const linkedClient = useMemo(
    () => (sale ? clients.find((client) => saleBelongsToClient(sale, client)) ?? null : null),
    [clients, sale],
  );
  const paymentSummary = useMemo(
    () => (sale ? getSalePaymentSummaryFromSale(sale) : null),
    [sale],
  );

  const successMessage = searchParams.get("created")
    ? "Venda registrada com sucesso. O recibo já está pronto para impressão ou download."
    : searchParams.get("updated")
      ? "Venda atualizada com sucesso. Este é o recibo com os dados mais recentes."
      : "";

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Gerando recibo da venda...</span>
      </div>
    );
  }

  if (!sale || !paymentSummary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Recibo não encontrado</CardTitle>
            <CardDescription>
              Não foi possível localizar os dados desta venda para montar o recibo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/painel-comercial")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para vendas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientPhone = sale.numero_telefone || (linkedClient ? formatClientPhone(linkedClient.telefone) : "");
  const clientCpf = sale.cpf_cliente || linkedClient?.cpf || "";
  const clientEmail = sale.email_cliente || linkedClient?.email || "";
  const clientAddress = [
    sale.endereco_cliente || linkedClient?.endereco || "",
    sale.cidade_cliente || linkedClient?.cidade || "",
    sale.estado_cliente || linkedClient?.estado || "",
    sale.cep_cliente || linkedClient?.cep || "",
  ]
    .filter(Boolean)
    .join(" • ");
  const receiptItems = sale.items?.length
    ? sale.items
    : [
        {
          productId: String(sale.id),
          productName: sale.aparelho,
          description: [sale.cor, sale.condicao].filter(Boolean).join(" • "),
          sku: sale.imei,
          unit: "un",
          quantity: 1,
          availableQuantity: 1,
          unitPrice: paymentSummary.subtotalProdutos,
          discount: 0,
          subtotal: paymentSummary.subtotalProdutos,
          color: sale.cor,
          condition: sale.condicao,
          supplier: sale.fornecedor,
          stockEntries: [],
        },
      ];

  return (
    <div className="min-h-screen bg-muted/20">
      <style>{`
        @media print {
          .receipt-actions { display: none !important; }
          .receipt-shell { padding: 0 !important; background: #ffffff !important; }
          .receipt-card { box-shadow: none !important; border-color: #d1d5db !important; }
        }
      `}</style>

      <div className="receipt-shell container mx-auto px-4 py-8">
        <div className="receipt-actions mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate("/painel-comercial")} className="mb-2 px-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para vendas
            </Button>
            <div className="flex items-center gap-3">
              <ReceiptText className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Recibo da Venda</h1>
                <p className="text-muted-foreground">
                  Revise, imprima ou baixe o comprovante com todos os dados da transação.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/sale/${sale.id}`)}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Ver venda
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={() => downloadSaleReceiptPdf(sale)}>
              <FileDown className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        </div>

        {successMessage ? (
          <div className="receipt-actions mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">{successMessage}</p>
          </div>
        ) : null}

        <Card className="receipt-card border-border/70 shadow-lg">
          <CardHeader className="border-b bg-card/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl">Comprovante da venda #{sale.id}</CardTitle>
                <CardDescription>
                  Emitido em {formatDate(sale.data)} • {sale.canal_venda ?? "Loja"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
                {getPaymentMethodLabel(sale.metodo_pagamento)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Total final</p>
                <p className="mt-2 text-2xl font-semibold text-primary">
                  {formatCurrency(paymentSummary.totalFinal)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Valor recebido</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(paymentSummary.valorRecebido)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(paymentSummary.troco)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Saldo pendente</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(paymentSummary.saldoPendente)}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/70 p-5">
                <h2 className="text-lg font-semibold">Dados do cliente</h2>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Nome:</span> {sale.comprador}</p>
                  <p><span className="text-muted-foreground">Telefone:</span> {clientPhone || "Não informado"}</p>
                  <p><span className="text-muted-foreground">CPF:</span> {clientCpf ? formatClientCPF(clientCpf) : "Não informado"}</p>
                  <p><span className="text-muted-foreground">Email:</span> {clientEmail || "Não informado"}</p>
                  <p><span className="text-muted-foreground">Endereço:</span> {clientAddress || "Não informado"}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 p-5">
                <h2 className="text-lg font-semibold">Dados da venda</h2>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Data:</span> {formatDate(sale.data)}</p>
                  <p><span className="text-muted-foreground">Canal:</span> {sale.canal_venda ?? "Loja"}</p>
                  <p><span className="text-muted-foreground">Vendedor:</span> {sale.vendedor_nome ?? "Não informado"}</p>
                  <p><span className="text-muted-foreground">Método de pagamento:</span> {getPaymentMethodLabel(sale.metodo_pagamento)}</p>
                  <p><span className="text-muted-foreground">Parcelas:</span> {sale.parcelas_pagamento ?? 1}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Itens da venda</h2>
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Unitário</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptItems.map((item) => (
                      <TableRow key={`${sale.id}-${item.productId}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{item.productName}</p>
                            {item.description ? (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell>{formatCurrency(item.discount)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3 rounded-2xl border border-border/70 p-5">
                <h2 className="text-lg font-semibold">Pagamento</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Subtotal dos produtos</p>
                    <p className="font-medium">{formatCurrency(paymentSummary.subtotalProdutos)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Desconto adicional</p>
                    <p className="font-medium">{formatCurrency(paymentSummary.descontoPagamento)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxas adicionais</p>
                    <p className="font-medium">{formatCurrency(paymentSummary.taxasPagamento)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Entrega / frete</p>
                    <p className="font-medium">{formatCurrency(paymentSummary.valorEntrega)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Acessórios / adicionais</p>
                    <p className="font-medium">{formatCurrency(paymentSummary.valorAcessorios)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Custo da venda</p>
                    <p className="font-medium">{formatCurrency(sale.valor_compra)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <h2 className="text-lg font-semibold">Resumo final</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Adicionais</span>
                    <span>{formatCurrency(paymentSummary.totalAdicionais)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total final</span>
                    <span className="text-lg font-semibold text-primary">
                      {formatCurrency(paymentSummary.totalFinal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recebido</span>
                    <span>{formatCurrency(paymentSummary.valorRecebido)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Troco</span>
                    <span>{formatCurrency(paymentSummary.troco)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Saldo</span>
                    <span>{formatCurrency(paymentSummary.saldoPendente)}</span>
                  </div>
                </div>
              </div>
            </div>

            {sale.observacao ? (
              <div className="space-y-2 rounded-2xl border border-border/70 p-5">
                <h2 className="text-lg font-semibold">Observações</h2>
                <p className="whitespace-pre-wrap text-sm text-foreground">{sale.observacao}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SaleReceipt;
