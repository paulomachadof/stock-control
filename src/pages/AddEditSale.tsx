import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  addProductToSale,
  buildAvailableProductOptions,
  buildSaleItemsFromSale,
  buildSaleLegacySummary,
  buildSaleProductOptions,
  calculateSaleTotals,
  extractSaleStockEntries,
  getInventoryDiff,
  getProductSearchText,
  SaleValidationError,
  type SaleProductOption,
  updateSaleItemFromOption,
} from "@/lib/saleItems";
import { saleBelongsToClient } from "@/lib/clientSales";
import {
  calculateSalePaymentSummary,
  getSalePaymentSummaryFromSale,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/salePayment";
import sellService, { type SaleLineItem, type SoldDevice } from "@/services/sellService";
import stockService, { type StockItem } from "@/services/stockServices";
import { masks } from "@/hooks/use-masks";
import { selectCurrentUser, useSessionStore } from "@/stores/useSessionStore";
import { useClientStore } from "@/stores/useClientStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const saleSchema = z.object({
  data: z.string().min(1, "Data é obrigatória"),
  comprador: z.string().min(1, "Comprador é obrigatório").max(100),
  numero_telefone: z.string().min(1, "Telefone é obrigatório").max(20),
  cpf_cliente: z.string().max(14),
  email_cliente: z.string().email("Email inválido").or(z.literal("")),
  endereco_cliente: z.string().max(150),
  cidade_cliente: z.string().max(100),
  estado_cliente: z.string().max(2),
  cep_cliente: z.string().max(9),
  salvar_cliente_na_base: z.boolean(),
  observacao: z.string().max(1000),
  valor_compra: z.number().min(0),
  valor_recebido: z.number().min(0),
  desconto_pagamento: z.number().min(0),
  taxas_pagamento: z.number().min(0),
  preco_vista: z.number().min(0),
  metodo_pagamento: z.string().min(1, "Selecione o método de pagamento"),
  parcelas_pagamento: z.number().int().min(1).max(24),
  valor_entrega: z.number().min(0),
  valor_capa_pelicula: z.number().min(0),
  valor_total_venda: z.number().min(0),
});

type SaleFormData = z.infer<typeof saleSchema>;

const defaultValues: SaleFormData = {
  data: new Date().toISOString().split("T")[0],
  comprador: "",
  numero_telefone: "",
  cpf_cliente: "",
  email_cliente: "",
  endereco_cliente: "",
  cidade_cliente: "",
  estado_cliente: "",
  cep_cliente: "",
  salvar_cliente_na_base: false,
  observacao: "",
  valor_compra: 0,
  valor_recebido: 0,
  desconto_pagamento: 0,
  taxas_pagamento: 0,
  preco_vista: 0,
  metodo_pagamento: "pix",
  parcelas_pagamento: 1,
  valor_entrega: 0,
  valor_capa_pelicula: 0,
  valor_total_venda: 0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function mapStockItemToCreatePayload(entry: StockItem) {
  return {
    imei: entry.imei,
    modelo: entry.modelo,
    marca: entry.marca,
    cor: entry.cor,
    capacidade: entry.capacidade,
    preco: entry.preco,
    valor_unitario: entry.valor_unitario,
    condicao: entry.condicao,
    dataEntrada: entry.dataEntrada,
    fornecedor: entry.fornecedor,
    observacao: entry.observacao ?? "",
  };
}

const AddEditSale = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const currentUser = useSessionStore(selectCurrentUser);
  const clients = useClientStore((state) => state.clients);
  const upsertClientFromSale = useClientStore((state) => state.upsertClientFromSale);
  const isEditing = Boolean(id);
  const stockIdFromQuery = searchParams.get("stockId");

  const [pageLoading, setPageLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentSale, setCurrentSale] = useState<SoldDevice | null>(null);
  const [stockCatalog, setStockCatalog] = useState<StockItem[]>([]);
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<null | string>(null);

  const prefilledFromQueryRef = useRef(false);
  const lastSuggestedReceivedValueRef = useRef(0);

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues,
  });
  const [
    watchedReceivedValue,
    watchedPaymentDiscount,
    watchedPaymentFees,
    watchedDeliveryValue,
    watchedAccessoriesValue,
    watchedPaymentMethod,
  ] = useWatch({
    control: form.control,
    name: [
      "valor_recebido",
      "desconto_pagamento",
      "taxas_pagamento",
      "valor_entrega",
      "valor_capa_pelicula",
      "metodo_pagamento",
    ],
  });

  const reservedStockEntries = currentSale ? extractSaleStockEntries(currentSale) : [];
  const productOptions = buildSaleProductOptions(stockCatalog, reservedStockEntries);
  const availableProductOptions = buildAvailableProductOptions(productOptions, saleItems);
  const saleTotals = calculateSaleTotals(saleItems);
  const paymentSummary = useMemo(
    () =>
      calculateSalePaymentSummary({
        subtotalProdutos: saleTotals.totalSale,
        descontoPagamento: watchedPaymentDiscount,
        taxasPagamento: watchedPaymentFees,
        valorEntrega: watchedDeliveryValue,
        valorAcessorios: watchedAccessoriesValue,
        valorRecebido: watchedReceivedValue,
      }),
    [
      saleTotals.totalSale,
      watchedAccessoriesValue,
      watchedDeliveryValue,
      watchedPaymentDiscount,
      watchedPaymentFees,
      watchedReceivedValue,
    ],
  );
  const isInstallmentEnabled = watchedPaymentMethod === "cartao_credito";
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const visibleClientOptions = useMemo(() => {
    const normalizedSearch = clientSearchTerm.trim().toLowerCase();

    if (!normalizedSearch || selectedClientId) {
      return [];
    }

    return clients
      .filter((client) =>
        [
          client.nome,
          client.email,
          masks.phone(client.telefone),
          masks.cpf(client.cpf),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      )
      .slice(0, 6);
  }, [clientSearchTerm, clients, selectedClientId]);
  const visibleProductOptions = (searchTerm.trim()
    ? availableProductOptions.filter(({ option }) =>
        getProductSearchText(option).includes(searchTerm.trim().toLowerCase()),
      )
    : availableProductOptions
  ).slice(0, 8);

  const handleErrorToast = (error: unknown, fallbackMessage: string) => {
    if (error instanceof SaleValidationError) {
      toast.error(error.message);
      return;
    }

    const err = error as { message?: string };
    toast.error(err?.message || fallbackMessage);
  };

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setPageLoading(true);
      setCatalogLoading(true);
      setCatalogError(null);

      const [stockResult, saleResult] = await Promise.allSettled([
        stockService.getStock({ page: 1, limit: 500 }),
        isEditing && id ? sellService.getSaleById(id) : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      let nextCatalog: StockItem[] = [];
      let nextSale: SoldDevice | null = null;

      if (stockResult.status === "fulfilled") {
        nextCatalog = stockResult.value.data;
        setStockCatalog(nextCatalog);
      } else {
        setCatalogError("Não foi possível carregar os produtos disponíveis do estoque.");
        setStockCatalog([]);
      }

      if (saleResult.status === "fulfilled") {
        nextSale = saleResult.value;
        setCurrentSale(nextSale);
      } else if (isEditing) {
        toast.error("Erro ao carregar venda.");
        navigate("/painel-comercial");
        return;
      }

      const options = buildSaleProductOptions(
        nextCatalog,
        nextSale ? extractSaleStockEntries(nextSale) : [],
      );

      if (nextSale) {
        const nextItems = buildSaleItemsFromSale(nextSale, options);
        const totals = calculateSaleTotals(nextItems);
        const nextPaymentSummary = getSalePaymentSummaryFromSale(nextSale, totals.totalSale);

        setSaleItems(nextItems);
        form.reset({
          data: nextSale.data.split("T")[0],
          comprador: nextSale.comprador,
          numero_telefone: nextSale.numero_telefone,
          cpf_cliente: nextSale.cpf_cliente ? masks.cpf(nextSale.cpf_cliente) : "",
          email_cliente: nextSale.email_cliente ?? "",
          endereco_cliente: nextSale.endereco_cliente ?? "",
          cidade_cliente: nextSale.cidade_cliente ?? "",
          estado_cliente: nextSale.estado_cliente ?? "",
          cep_cliente: nextSale.cep_cliente ? masks.cep(nextSale.cep_cliente) : "",
          salvar_cliente_na_base: false,
          observacao: nextSale.observacao ?? "",
          valor_compra: totals.totalCost,
          valor_recebido: nextPaymentSummary.valorRecebido || nextPaymentSummary.totalFinal,
          desconto_pagamento: nextPaymentSummary.descontoPagamento,
          taxas_pagamento: nextPaymentSummary.taxasPagamento,
          preco_vista: nextPaymentSummary.subtotalProdutos,
          metodo_pagamento: nextSale.metodo_pagamento ?? "pix",
          parcelas_pagamento: nextSale.parcelas_pagamento ?? 1,
          valor_entrega: nextPaymentSummary.valorEntrega,
          valor_capa_pelicula: nextPaymentSummary.valorAcessorios,
          valor_total_venda: nextPaymentSummary.totalFinal,
        });
        const matchedClient = clients.find((client) => saleBelongsToClient(nextSale, client));

        if (matchedClient) {
          setSelectedClientId(matchedClient.id);
          setClientSearchTerm(matchedClient.nome);
          form.setValue(
            "cpf_cliente",
            nextSale.cpf_cliente ? masks.cpf(nextSale.cpf_cliente) : masks.cpf(matchedClient.cpf),
          );
          form.setValue("email_cliente", nextSale.email_cliente ?? matchedClient.email);
          form.setValue("endereco_cliente", nextSale.endereco_cliente ?? matchedClient.endereco);
          form.setValue("cidade_cliente", nextSale.cidade_cliente ?? matchedClient.cidade);
          form.setValue("estado_cliente", nextSale.estado_cliente ?? matchedClient.estado);
          form.setValue(
            "cep_cliente",
            nextSale.cep_cliente ? masks.cep(nextSale.cep_cliente) : masks.cep(matchedClient.cep),
          );
        } else {
          setSelectedClientId(null);
          setClientSearchTerm("");
        }
        lastSuggestedReceivedValueRef.current =
          nextPaymentSummary.valorRecebido || nextPaymentSummary.totalFinal;
      } else {
        setSaleItems([]);
        form.reset(defaultValues);
        setSelectedClientId(null);
        setClientSearchTerm("");
      }

      setCatalogLoading(false);
      setPageLoading(false);
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [clients, form, id, isEditing, navigate]);

  useEffect(() => {
    if (form.getValues("valor_compra") !== saleTotals.totalCost) {
      form.setValue("valor_compra", saleTotals.totalCost, { shouldValidate: true });
    }

    if (form.getValues("preco_vista") !== paymentSummary.subtotalProdutos) {
      form.setValue("preco_vista", paymentSummary.subtotalProdutos, { shouldValidate: true });
    }

    if (form.getValues("valor_total_venda") !== paymentSummary.totalFinal) {
      form.setValue("valor_total_venda", paymentSummary.totalFinal, { shouldValidate: true });
    }

    if (
      watchedReceivedValue === 0 ||
      watchedReceivedValue === lastSuggestedReceivedValueRef.current
    ) {
      if (form.getValues("valor_recebido") !== paymentSummary.totalFinal) {
        form.setValue("valor_recebido", paymentSummary.totalFinal, { shouldValidate: true });
      }
    }

    if (!isInstallmentEnabled && form.getValues("parcelas_pagamento") !== 1) {
      form.setValue("parcelas_pagamento", 1, { shouldValidate: true });
    }

    lastSuggestedReceivedValueRef.current = paymentSummary.totalFinal;
  }, [
    form,
    isInstallmentEnabled,
    paymentSummary.subtotalProdutos,
    paymentSummary.totalFinal,
    saleTotals.totalCost,
    watchedReceivedValue,
  ]);

  useEffect(() => {
    if (isEditing || !stockIdFromQuery || prefilledFromQueryRef.current || !productOptions.length) {
      return;
    }

    const selectedOption = productOptions.find((option) =>
      option.stockEntries.some((entry) => entry.id === stockIdFromQuery || entry.imei === stockIdFromQuery),
    );

    if (!selectedOption) {
      return;
    }

    try {
      const result = addProductToSale([], selectedOption);
      setSaleItems(result.items);
      prefilledFromQueryRef.current = true;
      toast.success("Produto carregado do estoque para a venda.");
    } catch (error) {
      handleErrorToast(error, "Não foi possível carregar o produto selecionado.");
    }
  }, [isEditing, productOptions, stockIdFromQuery]);

  const syncInventory = async (previousItems: SaleLineItem[], nextItems: SaleLineItem[]) => {
    const diff = getInventoryDiff(previousItems, nextItems);

    for (const entry of diff.toRestore) {
      await stockService.createStock(mapStockItemToCreatePayload(entry));
    }

    for (const entry of diff.toConsume) {
      await stockService.deleteStock(entry.id);
    }
  };

  const handleAddProduct = (option: SaleProductOption) => {
    try {
      const result = addProductToSale(saleItems, option);
      setSaleItems(result.items);
      setSearchTerm("");

      if (result.action === "consolidated") {
        toast.success("Produto consolidado na mesma linha da venda.");
      } else {
        toast.success("Produto adicionado à venda.");
      }
    } catch (error) {
      handleErrorToast(error, "Não foi possível adicionar o produto.");
    }
  };

  const handleItemChange = (
    productId: string,
    changes: Partial<Pick<SaleLineItem, "quantity" | "unitPrice" | "discount">>,
  ) => {
    const currentItem = saleItems.find((item) => item.productId === productId);
    const option = productOptions.find((candidate) => candidate.productId === productId);

    if (!currentItem || !option) {
      toast.error("Produto não encontrado para atualizar.");
      return;
    }

    try {
      const nextItems = saleItems.map((item) =>
        item.productId === productId ? updateSaleItemFromOption(currentItem, option, changes) : item,
      );
      setSaleItems(nextItems);
    } catch (error) {
      handleErrorToast(error, "Não foi possível atualizar o item.");
    }
  };

  const handleRemoveItem = (productId: string) => {
    setSaleItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  };

  const handleClientSearchChange = (value: string) => {
    setClientSearchTerm(value);

    if (selectedClientId) {
      setSelectedClientId(null);
    }
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find((candidate) => candidate.id === clientId);

    if (!client) {
      return;
    }

    setSelectedClientId(client.id);
    setClientSearchTerm(client.nome);
    form.setValue("comprador", client.nome, { shouldValidate: true });
    form.setValue("numero_telefone", masks.phone(client.telefone), { shouldValidate: true });
    form.setValue("cpf_cliente", masks.cpf(client.cpf));
    form.setValue("email_cliente", client.email);
    form.setValue("endereco_cliente", client.endereco);
    form.setValue("cidade_cliente", client.cidade);
    form.setValue("estado_cliente", client.estado);
    form.setValue("cep_cliente", masks.cep(client.cep));
    form.setValue("salvar_cliente_na_base", false);
    toast.success("Cliente carregado na venda.");
  };

  const handleClearSelectedClient = () => {
    setSelectedClientId(null);
    setClientSearchTerm("");
  };

  const onSubmit = async (data: SaleFormData) => {
    if (!saleItems.length) {
      toast.error("Adicione pelo menos um produto antes de registrar a venda.");
      return;
    }

    try {
      setSubmitting(true);
      const summary = buildSaleLegacySummary(saleItems);
      const nextPaymentSummary = calculateSalePaymentSummary({
        subtotalProdutos: saleTotals.totalSale,
        descontoPagamento: data.desconto_pagamento,
        taxasPagamento: data.taxas_pagamento,
        valorEntrega: data.valor_entrega,
        valorAcessorios: data.valor_capa_pelicula,
        valorRecebido: data.valor_recebido,
      });
      const paymentMethod = (data.metodo_pagamento || "pix") as PaymentMethod;
      const installments = paymentMethod === "cartao_credito" ? data.parcelas_pagamento : 1;
      const previousItems = currentSale ? buildSaleItemsFromSale(currentSale, productOptions) : [];
      const payload: Omit<SoldDevice, "id"> = {
        data: data.data,
        aparelho: summary.aparelho,
        cor: summary.cor,
        condicao: summary.condicao,
        imei: summary.imei,
        fornecedor: summary.fornecedor,
        valor_compra: summary.valorCompra,
        comprador: data.comprador,
        numero_telefone: data.numero_telefone,
        aparelho_recebido: currentSale?.aparelho_recebido ?? true,
        observacao: data.observacao,
        valor_recebido: nextPaymentSummary.valorRecebido || nextPaymentSummary.totalFinal,
        preco_vista: nextPaymentSummary.subtotalProdutos,
        preco_cartao: nextPaymentSummary.totalFinal,
        valor_entrega: nextPaymentSummary.valorEntrega,
        valor_capa_pelicula: nextPaymentSummary.valorAcessorios,
        desconto_pagamento: nextPaymentSummary.descontoPagamento,
        taxas_pagamento: nextPaymentSummary.taxasPagamento,
        metodo_pagamento: paymentMethod,
        parcelas_pagamento: installments,
        valor_total_venda: nextPaymentSummary.totalFinal,
        vendedor_id: currentUser.id,
        vendedor_nome: currentUser.name,
        canal_venda: currentSale?.canal_venda ?? "Loja",
        client_id: selectedClientId ?? undefined,
        cpf_cliente: data.cpf_cliente || undefined,
        email_cliente: data.email_cliente || undefined,
        endereco_cliente: data.endereco_cliente || undefined,
        cidade_cliente: data.cidade_cliente || undefined,
        estado_cliente: data.estado_cliente || undefined,
        cep_cliente: data.cep_cliente || undefined,
        items: saleItems,
      };

      let savedSale = isEditing && id
        ? await sellService.updateSale(id, payload)
        : await sellService.createSale(payload);

      setCurrentSale(savedSale);

      if (selectedClientId || data.salvar_cliente_na_base) {
        const syncResult = upsertClientFromSale(
          {
            selectedClientId,
            nome: data.comprador,
            cpf: data.cpf_cliente,
            email: data.email_cliente,
            telefone: data.numero_telefone,
            endereco: data.endereco_cliente,
            cidade: data.cidade_cliente,
            estado: data.estado_cliente,
            cep: data.cep_cliente,
            data_cadastro: data.data,
          },
          {
            incrementPurchases: !isEditing,
          },
        );

        if (!selectedClientId && data.salvar_cliente_na_base) {
          toast.success("Cliente adicionado à base.", {
            description: `${syncResult.client.nome} foi salvo junto com a venda.`,
          });
        }

        if (savedSale.client_id !== syncResult.client.id) {
          try {
            savedSale = await sellService.updateSale(savedSale.id, {
              client_id: syncResult.client.id,
              cpf_cliente: data.cpf_cliente || syncResult.client.cpf,
              email_cliente: data.email_cliente || syncResult.client.email,
              endereco_cliente: data.endereco_cliente || syncResult.client.endereco,
              cidade_cliente: data.cidade_cliente || syncResult.client.cidade,
              estado_cliente: data.estado_cliente || syncResult.client.estado,
              cep_cliente: data.cep_cliente || syncResult.client.cep,
            });
            setCurrentSale(savedSale);
          } catch (linkError) {
            console.error("Erro ao vincular cliente à venda:", linkError);
            toast.error("Venda salva, mas não foi possível vincular o cliente ao histórico.");
          }
        }
      }

      try {
        await syncInventory(previousItems, saleItems);
      } catch (inventoryError) {
        console.error("Erro ao sincronizar estoque da venda:", inventoryError);
        toast.error("Venda salva, mas não foi possível sincronizar o estoque automaticamente.");
      }

      toast.success(isEditing ? "Venda atualizada!" : "Venda registrada!", {
        description: `${saleTotals.totalQuantity} item(ns) vinculados com sucesso.`,
      });

      navigate(`/sale/${savedSale.id}/receipt?${isEditing ? "updated=1" : "created=1"}`);
    } catch (error) {
      handleErrorToast(error, "Erro ao salvar venda.");
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Carregando fluxo de venda...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => navigate("/painel-comercial")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? "Editar Venda" : "Registrar Nova Venda"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Busque produtos do estoque, monte a venda com mais de um item e deixe os totais sempre consistentes.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Produto</CardTitle>
                <CardDescription>
                  Pesquise itens ativos no estoque, adicione um ou mais produtos e ajuste quantidade, preço e desconto sem redigitar dados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
                  <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da Venda</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Buscar produto no estoque</FormLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Busque por nome, cor, fornecedor, condição ou código"
                        className="pl-9"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Apenas produtos com saldo disponível aparecem nos resultados.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20">
                  {catalogLoading ? (
                    <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando produtos disponíveis...
                    </div>
                  ) : catalogError ? (
                    <div className="flex items-start gap-3 px-4 py-6 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">Erro ao carregar o estoque disponível.</p>
                        <p className="text-muted-foreground">{catalogError}</p>
                      </div>
                    </div>
                  ) : !productOptions.length ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Não há estoque disponível para venda no momento.
                    </div>
                  ) : !visibleProductOptions.length ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Nenhum produto encontrado para a busca informada.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {visibleProductOptions.map(({ option, remainingQuantity }) => (
                        <button
                          key={option.productId}
                          type="button"
                          onClick={() => handleAddProduct(option)}
                          className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{option.productName}</span>
                              <Badge variant="secondary">{remainingQuantity} disponível(is)</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Código: {option.sku}</span>
                              <span>Fornecedor: {option.supplier || "Não informado"}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{formatCurrency(option.unitPrice)}</p>
                            <p className="text-xs text-primary">Clique para adicionar</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Card className="border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Quantidade total</p>
                      <p className="text-2xl font-semibold">{saleTotals.totalQuantity}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total dos produtos</p>
                      <p className="text-2xl font-semibold">{formatCurrency(saleTotals.totalSale)}</p>
                    </CardContent>
                  </Card>
                </div>

                {saleItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum produto adicionado ainda. Selecione um item do estoque para começar a montar a venda.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Código / SKU</TableHead>
                          <TableHead className="w-[120px]">Quantidade</TableHead>
                          <TableHead className="w-[160px]">Preço unitário</TableHead>
                          <TableHead className="w-[160px]">Desconto</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead className="w-[80px] text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  Disponível: {item.availableQuantity} {item.unit}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <p>{item.sku}</p>
                                <p className="text-xs text-muted-foreground">
                                  IMEIs: {item.stockEntries.map((entry) => entry.imei).join(", ")}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={item.availableQuantity}
                                value={item.quantity}
                                onChange={(event) =>
                                  handleItemChange(item.productId, {
                                    quantity: Number(event.target.value) || 1,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  handleItemChange(item.productId, {
                                    unitPrice: Number(event.target.value) || 0,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.discount}
                                onChange={(event) =>
                                  handleItemChange(item.productId, {
                                    discount: Number(event.target.value) || 0,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(item.subtotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.productId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dados do Comprador</CardTitle>
                <CardDescription>
                  Busque um cliente já cadastrado ou preencha os dados manualmente e escolha se quer salvar esse cadastro na base.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Buscar cliente cadastrado</FormLabel>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={clientSearchTerm}
                      onChange={(event) => handleClientSearchChange(event.target.value)}
                      placeholder="Busque por nome, telefone, email ou CPF"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ao selecionar um cliente, os dados são preenchidos automaticamente na venda.
                  </p>
                </div>

                {selectedClient ? (
                  <div className="flex flex-col gap-3 rounded-xl border bg-primary/5 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{selectedClient.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {masks.phone(selectedClient.telefone)}
                        {selectedClient.email ? ` • ${selectedClient.email}` : ""}
                      </p>
                      <p className="text-xs text-primary">
                        Cliente já cadastrado. A compra será refletida automaticamente na base ao salvar a venda.
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearSelectedClient}>
                      <X className="mr-2 h-4 w-4" />
                      Limpar seleção
                    </Button>
                  </div>
                ) : clientSearchTerm.trim() ? (
                  <div className="rounded-xl border bg-muted/20">
                    {!clients.length ? (
                      <div className="px-4 py-4 text-sm text-muted-foreground">
                        Ainda não há clientes cadastrados na base.
                      </div>
                    ) : !visibleClientOptions.length ? (
                      <div className="px-4 py-4 text-sm text-muted-foreground">
                        Nenhum cliente encontrado para a busca informada.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {visibleClientOptions.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client.id)}
                            className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60"
                          >
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{client.nome}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span>{masks.phone(client.telefone)}</span>
                                {client.email ? <span>{client.email}</span> : null}
                                {client.cpf ? <span>CPF: {masks.cpf(client.cpf)}</span> : null}
                              </div>
                            </div>
                            <Badge variant="secondary">{client.total_compras} compra(s)</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="comprador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Comprador</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numero_telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(11) 98765-4321"
                            {...field}
                            onChange={(event) => field.onChange(masks.phone(event.target.value))}
                            maxLength={15}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            {...field}
                            onChange={(event) => field.onChange(masks.cpf(event.target.value))}
                            maxLength={14}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="cliente@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="endereco_cliente"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, número e complemento" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cidade_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estado_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="SP"
                            {...field}
                            onChange={(event) => field.onChange(event.target.value.toUpperCase().slice(0, 2))}
                            maxLength={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cep_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="00000-000"
                            {...field}
                            onChange={(event) => field.onChange(masks.cep(event.target.value))}
                            maxLength={9}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!selectedClient ? (
                  <FormField
                    control={form.control}
                    name="salvar_cliente_na_base"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Adicionar cliente na base</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Salva nome, telefone e os demais dados preenchidos no cadastro de clientes ao concluir a venda.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                    <UserPlus className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Cliente vinculado à base</p>
                      <p className="text-sm text-muted-foreground">
                        Como este cliente já existe no cadastro, a venda atualiza automaticamente a quantidade de compras e complementa os dados preenchidos.
                      </p>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamento</CardTitle>
                <CardDescription>
                  Defina desconto, taxas e forma de pagamento. O total final e o troco são recalculados em tempo real.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="valor_compra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custo Total dos Itens (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} readOnly className="bg-muted" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preco_vista"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtotal dos Produtos (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} readOnly className="bg-muted" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="desconto_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto Adicional (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxas_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taxas Adicionais (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_entrega"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entrega / Frete (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_capa_pelicula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Acessórios / Adicionais (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="metodo_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Pagamento</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um método" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHOD_OPTIONS.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {PAYMENT_METHOD_LABELS[method]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parcelas_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcelas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={24}
                            {...field}
                            disabled={!isInstallmentEnabled}
                            className={!isInstallmentEnabled ? "bg-muted" : ""}
                            onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_recebido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Recebido (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_total_venda"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Final (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} readOnly className="bg-muted" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <p className="text-sm text-muted-foreground">Desconto dos itens</p>
                    <p className="mt-2 text-xl font-semibold">{formatCurrency(saleTotals.totalDiscount)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="mt-2 text-xl font-semibold">{formatCurrency(paymentSummary.troco)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <p className="text-sm text-muted-foreground">Saldo pendente</p>
                    <p className="mt-2 text-xl font-semibold">{formatCurrency(paymentSummary.saldoPendente)}</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="observacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adicionar Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Anote condições combinadas, taxas negociadas, detalhes do pagamento ou qualquer informação importante para o recibo."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-xl border bg-primary/5 px-4 py-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      <p className="font-medium">Resumo automático do pagamento</p>
                    </div>
                    <p className="text-xl font-semibold text-primary">
                      {formatCurrency(paymentSummary.totalFinal)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total final = subtotal dos produtos - desconto adicional + taxas + entrega + acessórios. Após salvar, o sistema abre o recibo pronto para impressão ou download.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" size="lg" disabled={submitting || saleItems.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : isEditing ? (
                  "Salvar Alterações"
                ) : (
                  "Registrar Venda"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate("/painel-comercial")}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
};

export default AddEditSale;
