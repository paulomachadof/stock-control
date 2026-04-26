import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  Edit,
  FileDown,
  Upload,
  FileSpreadsheet,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { exportRowsToWorkbook, importRowsFromWorkbook } from "@/lib/excel";

interface SalesTableDevice {
  id: string | number;
  data: string;
  aparelho: string;
  cor: string;
  condicao: string;
  imei: string;
  comprador: string;
  numero_telefone: string;
  aparelho_recebido: boolean;
  observacao?: string;
  valor_compra: number;
  valor_total_venda: number;
  vendedor_nome?: string;
  canal_venda?: string;
  items?: Array<{
    productName: string;
    sku: string;
  }>;
}

interface SalesTableProps {
  devices: SalesTableDevice[];
  showSeller?: boolean;
}

export function SalesTable({ devices, showSeller = false }: SalesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const navigate = useNavigate();

  const sellers = Array.from(
    new Set(
      devices
        .map((device) => device.vendedor_nome)
        .filter((seller): seller is string => Boolean(seller)),
    ),
  );

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.aparelho.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.comprador.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.imei.includes(searchTerm) ||
      (device.items ?? []).some(
        (item) =>
          item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && device.aparelho_recebido) ||
      (statusFilter === "pending" && !device.aparelho_recebido);

    const matchesCondition =
      conditionFilter === "all" || device.condicao === conditionFilter;

    const matchesSeller =
      !showSeller ||
      sellerFilter === "all" ||
      (device.vendedor_nome ?? "") === sellerFilter;

    const deviceDate = new Date(`${device.data.split("T")[0]}T00:00:00`);
    const matchesStartDate =
      !startDate || deviceDate >= new Date(`${startDate}T00:00:00`);
    const matchesEndDate =
      !endDate || deviceDate <= new Date(`${endDate}T23:59:59`);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCondition &&
      matchesSeller &&
      matchesStartDate &&
      matchesEndDate
    );
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getConditionBadge = (condition: string) => {
    const variants: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        className: string;
      }
    > = {
      Novo: {
        variant: "default",
        className: "bg-success text-success-foreground",
      },
      Seminovo: {
        variant: "secondary",
        className: "bg-primary/10 text-primary",
      },
      Usado: {
        variant: "outline",
        className: "bg-warning/10 text-warning border-warning",
      },
      Recondicionado: {
        variant: "outline",
        className: "bg-accent/10 text-accent border-accent",
      },
    };

    const config = variants[condition] || variants.Usado;
    return (
      <Badge variant={config.variant} className={config.className}>
        {condition}
      </Badge>
    );
  };

  const calculateProfit = (device: SalesTableDevice) => {
    if (!device.aparelho_recebido) {
      return 0;
    }

    return device.valor_total_venda - device.valor_compra;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Relatório de Vendas", 14, 15);

    const tableData = filteredDevices.map((device) => [
      device.data,
      device.aparelho,
      device.condicao,
      showSeller ? (device.vendedor_nome ?? "-") : "-",
      formatCurrency(device.valor_total_venda),
      formatCurrency(device.valor_compra),
      formatCurrency(calculateProfit(device)),
      device.aparelho_recebido ? "Concluído" : "Pendente",
    ]);

    autoTable(doc, {
      head: [
        [
          "Data",
          "Aparelho",
          "Condição",
          "Vendedor",
          "Valor Venda",
          "Valor Custo",
          "Lucro",
          "Status",
        ],
      ],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`vendas-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToExcel = () => {
    const worksheetData = filteredDevices.map((device) => ({
      Data: device.data,
      Aparelho: device.aparelho,
      Cor: device.cor,
      IMEI: device.imei,
      Condição: device.condicao,
      Comprador: device.comprador,
      Telefone: device.numero_telefone,
      Vendedor: device.vendedor_nome ?? "-",
      Canal: device.canal_venda ?? "-",
      "Valor de Venda": device.valor_total_venda,
      "Valor de Compra": device.valor_compra,
      Lucro: calculateProfit(device),
      Status: device.aparelho_recebido ? "Concluído" : "Pendente",
      Observação: device.observacao,
    }));
    void exportRowsToWorkbook(
      worksheetData,
      `vendas-${new Date().toISOString().split("T")[0]}.xlsx`,
      "Vendas",
    );
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Use um arquivo .xlsx para importar vendas.");
      event.target.value = "";
      return;
    }

    try {
      const rows = await importRowsFromWorkbook(file);
      console.log("Dados importados:", rows);
      toast.success(`${rows.length} linha(s) lidas da planilha de vendas.`);
    } catch (error) {
      console.error("Erro ao importar planilha de vendas:", error);
      toast.error("Erro ao importar arquivo de vendas.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>
              {showSeller ? "Vendas da operação" : "Minhas vendas"}
            </CardTitle>
            <CardDescription>
              {showSeller
                ? "Acompanhe toda a equipe comercial com filtros rápidos."
                : "Acompanhe seu histórico, filtre negociações e exporte relatórios."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button onClick={exportToExcel} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="flex cursor-pointer items-center">
                <Upload className="mr-2 h-4 w-4" />
                Importar
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aparelho, comprador ou IMEI..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-8"
            />
          </div>
          <div className={`grid gap-3 ${showSeller ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            <Input
              type="date"
              placeholder="Data inicial"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              type="date"
              placeholder="Data final"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Condição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as condições</SelectItem>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Seminovo">Seminovo</SelectItem>
                <SelectItem value="Usado">Usado</SelectItem>
                <SelectItem value="Recondicionado">Recondicionado</SelectItem>
              </SelectContent>
            </Select>
            {showSeller && (
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a equipe</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller} value={seller}>
                      {seller}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Aparelho</TableHead>
                {showSeller && <TableHead>Vendedor</TableHead>}
                <TableHead>Condição</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Valor venda</TableHead>
                <TableHead>Lucro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showSeller ? 9 : 8}
                    className="text-center text-muted-foreground"
                  >
                    Nenhuma venda encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => {
                  const profit = calculateProfit(device);

                  return (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        {new Date(device.data).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.aparelho}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.cor}
                            {device.canal_venda ? ` • ${device.canal_venda}` : ""}
                          </div>
                          {device.items?.length ? (
                            <div className="mt-1 text-xs text-primary">
                              {device.items.length} linha(s) de item
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      {showSeller && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span>{device.vendedor_nome ?? "Sem vendedor"}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{getConditionBadge(device.condicao)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.comprador}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.numero_telefone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(device.valor_total_venda)}</TableCell>
                      <TableCell>
                        <span className={profit >= 0 ? "text-success" : "text-destructive"}>
                          {formatCurrency(profit)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={device.aparelho_recebido ? "default" : "secondary"}>
                          {device.aparelho_recebido ? "Concluído" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/sale/${device.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/sale/edit/${device.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
