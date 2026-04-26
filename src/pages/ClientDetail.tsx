import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  History,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Save,
  ShoppingBag,
  Store,
  UserRoundPen,
  X,
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { masks } from "@/hooks/use-masks";
import {
  clientToFormData,
  emptyClientForm,
  formDataToClientInput,
  formatClientCEP,
  formatClientCPF,
  formatClientPhone,
  type ClientFormData,
  type ClientFormErrors,
  validateClientForm,
} from "@/lib/clientForm";
import { formatSaleDate, getClientSales, getClientSalesSummary } from "@/lib/clientSales";
import sellService, { type SoldDevice } from "@/services/sellService";
import { useClientStore } from "@/stores/useClientStore";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

const ClientDetail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id } = useParams();
  const clients = useClientStore((state) => state.clients);
  const updateClient = useClientStore((state) => state.updateClient);

  const client = useMemo(
    () => clients.find((candidate) => candidate.id === id) ?? null,
    [clients, id],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>(emptyClientForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [sales, setSales] = useState<SoldDevice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    setFormData(clientToFormData(client));
    setErrors({});
    setIsEditing(false);
  }, [client]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const response = await sellService.getSales({ page: 1, limit: 500 });

        if (!cancelled) {
          setSales(response.data);
        }
      } catch (error) {
        console.error("Erro ao carregar histórico do cliente:", error);

        if (!cancelled) {
          setHistoryError("Não foi possível carregar o histórico de compras deste cliente.");
          setSales([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const clientSales = useMemo(
    () => (client ? getClientSales(sales, client) : []),
    [client, sales],
  );
  const salesSummary = useMemo(() => getClientSalesSummary(clientSales), [clientSales]);

  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    const maskMap: Partial<Record<keyof ClientFormData, (current: string) => string>> = {
      cpf: masks.cpf,
      telefone: masks.phone,
      cep: masks.cep,
    };
    const nextValue = maskMap[field] ? maskMap[field]?.(value) ?? value : value;

    setFormData((current) => ({
      ...current,
      [field]: nextValue,
    }));

    if (errors[field as keyof ClientFormErrors]) {
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
    }
  };

  const handleCancelEdit = () => {
    if (!client) {
      return;
    }

    setFormData(clientToFormData(client));
    setErrors({});
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!client) {
      return;
    }

    const nextErrors = validateClientForm(formData, clientToFormData(client));
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Revise os dados do cliente",
        description: "Corrija os campos destacados antes de salvar as alterações.",
        variant: "destructive",
      });
      return;
    }

    updateClient(client.id, formDataToClientInput(formData));
    setIsEditing(false);
    toast({
      title: "Perfil atualizado",
      description: `${formData.nome} foi atualizado com sucesso.`,
    });
  };

  if (!client) {
    return (
      <Layout>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Cliente não encontrado</CardTitle>
            <CardDescription>
              O cadastro solicitado não existe mais ou ainda não foi sincronizado nesta base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/clients")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para clientes
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" className="w-fit px-0" onClick={() => navigate("/clients")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para clientes
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{client.nome}</h1>
                <Badge variant="secondary">Cliente #{client.id}</Badge>
              </div>
              <p className="text-muted-foreground">
                Visualize o perfil completo, edite os dados cadastrais e acompanhe o histórico de compras.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar alterações
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <UserRoundPen className="mr-2 h-4 w-4" />
                Editar perfil
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Compras no cadastro</CardDescription>
              <CardTitle className="text-3xl">{client.total_compras}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vendas localizadas</CardDescription>
              <CardTitle className="text-3xl">{clientSales.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total movimentado</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(salesSummary.totalSpent)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ticket médio</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(salesSummary.averageTicket)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Última compra</CardDescription>
              <CardTitle className="text-xl">
                {salesSummary.lastPurchaseDate ? formatSaleDate(salesSummary.lastPurchaseDate) : "Sem compras"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Perfil do Cliente</CardTitle>
              <CardDescription>
                Dados principais do cadastro usados nas vendas, no atendimento e no pós-venda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(event) => handleInputChange("nome", event.target.value)}
                    disabled={!isEditing}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome ? <p className="text-sm text-destructive">{errors.nome}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(event) => handleInputChange("telefone", event.target.value)}
                    disabled={!isEditing}
                    maxLength={15}
                    className={errors.telefone ? "border-destructive" : ""}
                  />
                  {errors.telefone ? <p className="text-sm text-destructive">{errors.telefone}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(event) => handleInputChange("cpf", event.target.value)}
                    disabled={!isEditing}
                    maxLength={14}
                    className={errors.cpf ? "border-destructive" : ""}
                  />
                  {errors.cpf ? <p className="text-sm text-destructive">{errors.cpf}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(event) => handleInputChange("email", event.target.value)}
                    disabled={!isEditing}
                    type="email"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(event) => handleInputChange("endereco", event.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(event) => handleInputChange("cidade", event.target.value)}
                    disabled={!isEditing}
                    className={errors.cidade ? "border-destructive" : ""}
                  />
                  {errors.cidade ? <p className="text-sm text-destructive">{errors.cidade}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">UF</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(event) =>
                      handleInputChange("estado", event.target.value.toUpperCase().slice(0, 2))
                    }
                    disabled={!isEditing}
                    maxLength={2}
                    className={errors.estado ? "border-destructive" : ""}
                  />
                  {errors.estado ? <p className="text-sm text-destructive">{errors.estado}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(event) => handleInputChange("cep", event.target.value)}
                    disabled={!isEditing}
                    maxLength={9}
                    className={errors.cep ? "border-destructive" : ""}
                  />
                  {errors.cep ? <p className="text-sm text-destructive">{errors.cep}</p> : null}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Cliente desde</p>
                  <p className="mt-1 font-medium">{formatSaleDate(client.data_cadastro)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Resumo rápido</p>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{formatClientPhone(client.telefone)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{client.email || "Email não informado"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {client.cidade}, {client.estado} • CEP {formatClientCEP(client.cep)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      <span>CPF {formatClientCPF(client.cpf)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Compras
              </CardTitle>
              <CardDescription>
                Expanda uma compra para ver os detalhes financeiros, produtos vinculados e acessar a venda completa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando compras anteriores do cliente...
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                  {historyError}
                </div>
              ) : clientSales.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma compra encontrada para este cliente até o momento.
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {clientSales.map((sale) => (
                    <AccordionItem key={sale.id} value={String(sale.id)}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full flex-col gap-3 pr-4 text-left md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{sale.aparelho}</p>
                              <Badge variant={sale.aparelho_recebido ? "default" : "secondary"}>
                                {sale.aparelho_recebido ? "Concluída" : "Pendente"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{formatSaleDate(sale.data)}</span>
                              <span>{sale.canal_venda ?? "Loja"}</span>
                              <span>
                                {sale.items?.length ? `${sale.items.length} item(ns)` : "Venda direta"}
                              </span>
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-sm text-muted-foreground">Total da compra</p>
                            <p className="text-lg font-semibold text-primary">
                              {formatCurrency(sale.valor_total_venda)}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              Data da venda
                            </p>
                            <p className="mt-2 font-medium">{formatSaleDate(sale.data)}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Store className="h-4 w-4" />
                              Vendedor
                            </p>
                            <p className="mt-2 font-medium">{sale.vendedor_nome || "Não informado"}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CreditCard className="h-4 w-4" />
                              Recebido
                            </p>
                            <p className="mt-2 font-medium">{formatCurrency(sale.valor_recebido)}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ShoppingBag className="h-4 w-4" />
                              Código principal
                            </p>
                            <p className="mt-2 font-medium">{sale.imei}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 p-4">
                            <p className="text-sm font-medium text-muted-foreground">Detalhes do comprador</p>
                            <div className="mt-3 space-y-2 text-sm">
                              <p>
                                <span className="text-muted-foreground">Telefone:</span>{" "}
                                {sale.numero_telefone || formatClientPhone(client.telefone)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">CPF:</span>{" "}
                                {sale.cpf_cliente
                                  ? formatClientCPF(sale.cpf_cliente)
                                  : formatClientCPF(client.cpf)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Email:</span>{" "}
                                {sale.email_cliente || client.email || "Não informado"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 p-4">
                            <p className="text-sm font-medium text-muted-foreground">Resumo financeiro</p>
                            <div className="mt-3 space-y-2 text-sm">
                              <p>
                                <span className="text-muted-foreground">Preço à vista:</span>{" "}
                                {formatCurrency(sale.preco_vista)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Preço no cartão:</span>{" "}
                                {formatCurrency(sale.preco_cartao)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Entrega + acessórios:</span>{" "}
                                {formatCurrency(sale.valor_entrega + sale.valor_capa_pelicula)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {sale.items?.length ? (
                          <div className="overflow-x-auto rounded-2xl border">
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
                                {sale.items.map((item) => (
                                  <TableRow key={`${sale.id}-${item.productId}`}>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>{item.sku}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell>{formatCurrency(item.discount)}</TableCell>
                                    <TableCell className="font-semibold">
                                      {formatCurrency(item.subtotal)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                            Compra em formato legado. O detalhe completo do aparelho e dos valores continua disponível na tela da venda.
                          </div>
                        )}

                        {sale.observacao ? (
                          <div className="rounded-2xl border border-border/70 p-4">
                            <p className="text-sm font-medium text-muted-foreground">Observações</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                              {sale.observacao}
                            </p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" onClick={() => navigate(`/sale/${sale.id}`)}>
                            Ver detalhes da compra
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ClientDetail;
