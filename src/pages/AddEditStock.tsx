import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import { masks, validators } from "@/hooks/use-masks";
import stockService, { StockItem } from "@/services/stockServices";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const stockSchema = z.object({
  modelo: z
    .string()
    .min(1, "Modelo é obrigatório")
    .max(100, "Modelo deve ter no máximo 100 caracteres"),
  cor: z
    .string()
    .min(1, "Cor é obrigatória")
    .max(50, "Cor deve ter no máximo 50 caracteres"),
  fornecedor: z
    .string()
    .min(1, "Fornecedor é obrigatório")
    .max(100, "Fornecedor deve ter no máximo 100 caracteres"),
  imei: z
    .string()
    .refine((val) => validators.imei(val), "IMEI deve ter 15 dígitos"),
  observacao: z
    .string()
    .max(500, "Observação deve ter no máximo 500 caracteres")
    .optional(),
  valor_unitario: z.number().min(0.01, "Valor deve ser maior que zero"),
});

type StockFormData = z.infer<typeof stockSchema>;

const AddEditStock = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<StockItem>(null);

  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);

      const response: StockItem = await stockService.getStockById(id);
      setDevice(response);
      form.reset({
        modelo: response.modelo,
        cor: response.cor,
        fornecedor: response.fornecedor,
        imei: response.imei,
        observacao: response.observacao ?? "",
        valor_unitario: Number(response.valor_unitario),
      });
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
      toast.error("Erro ao carregar estoque. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const form = useForm<StockFormData>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      modelo: "",
      cor: "",
      fornecedor: "",
      imei: "",
      observacao: "",
      valor_unitario: 0,
    },
  });

  useEffect(() => {
    if(isEditing) fetchItem()
  }, []);

  const onSubmit = async (data: StockItem) => {
    try {
      console.log(isEditing ? "Editando:" : "Adicionando:", data);

      if (isEditing) {
        console.log("editing");
        await stockService.updateStock(id, data);
      } else {
        await stockService.createStock({
          ...data,
          marca: data.modelo.split(" ")[0] ?? "Sem marca",
          capacidade: data.modelo.match(/(\d+\s?(?:GB|TB))/i)?.[1]?.toUpperCase() ?? "",
          preco: data.valor_unitario,
          condicao: data.observacao?.toLowerCase().includes("quebrada")
            ? "Tela quebrada"
            : "Seminovo",
          dataEntrada: new Date().toISOString().split("T")[0],
        });
      }

      toast(
        `${data.modelo} foi ${
          isEditing ? "atualizado" : "adicionado"
        } ao estoque.`
      );

      navigate("/stock");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);

      toast.error(
        error?.response?.data?.message ||
          "Não foi possível salvar o produto. Tente novamente."
      );
    }
  };

  if (loading && isEditing) {
    return (
      <div className="flex flex-col justify-center items-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Carregando item...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? "Editar Produto" : "Adicionar ao Estoque"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? "Atualize as informações do produto"
              : "Cadastre um novo produto no estoque"}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              {isEditing ? "Editar Dados" : "Dados do Produto"}
            </CardTitle>
            <CardDescription>
              Preencha os campos abaixo com as informações do aparelho
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                          <Input placeholder="iPhone 13 128GB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor</FormLabel>
                        <FormControl>
                          <Input placeholder="PRETO" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fornecedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornecedor</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do fornecedor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imei"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMEI *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="359451183944323"
                            {...field}
                            onChange={(e) =>
                              field.onChange(masks.imei(e.target.value))
                            }
                            maxLength={15}
                            disabled={isEditing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valor_unitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Unitário (R$) *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0,00"
                            value={
                              field.value
                                ? masks.numberToCurrency(field.value)
                                : ""
                            }
                            onChange={(e) =>
                              field.onChange(
                                masks.currencyToNumber(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observação</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais sobre o aparelho"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button type="submit" className="w-full md:w-auto">
                    {isEditing ? "Salvar Alterações" : "Adicionar ao Estoque"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full md:w-auto"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AddEditStock;
