import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Client } from "@/data/mockData";
import { ClientInput, useClientStore } from "@/stores/useClientStore";
import {
  clientToFormData,
  emptyClientForm,
  formDataToClientInput,
  formatClientCPF,
  formatClientPhone,
  type ClientFormData,
  type ClientFormErrors,
  validateClientForm,
} from "@/lib/clientForm";
import {
  Edit,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

export function ClientsTable() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const clients = useClientStore((state) => state.clients);
  const addClient = useClientStore((state) => state.addClient);
  const updateClient = useClientStore((state) => state.updateClient);
  const deleteClient = useClientStore((state) => state.deleteClient);

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyClientForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.telefone.includes(searchTerm) ||
          client.cpf.includes(searchTerm),
      ),
    [clients, searchTerm],
  );

  const totalPurchases = clients.reduce((sum, client) => sum + client.total_compras, 0);

  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    const maskMap: Partial<Record<keyof ClientFormData, (current: string) => string>> = {
      cpf: masks.cpf,
      telefone: masks.phone,
      cep: masks.cep,
    };

    const nextValue = maskMap[field] ? maskMap[field]?.(value) ?? value : value;

    setFormData((prev) => ({ ...prev, [field]: nextValue }));

    if (errors[field as keyof ClientFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const openCreateDialog = () => {
    setEditingClient(null);
    setFormData(emptyClientForm());
    setErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData(clientToFormData(client));
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const nextErrors = validateClientForm(
      formData,
      editingClient ? clientToFormData(editingClient) : undefined,
    );
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Revise o formulário",
        description: "Corrija os campos destacados antes de salvar o cliente.",
        variant: "destructive",
      });
      return;
    }

    const payload: ClientInput = formDataToClientInput(formData);

    if (editingClient) {
      updateClient(editingClient.id, payload);
      toast({
        title: "Cliente atualizado",
        description: `${payload.nome} foi atualizado com sucesso.`,
      });
    } else {
      addClient(payload);
      toast({
        title: "Cliente criado",
        description: `${payload.nome} foi adicionado à base.`,
      });
    }

    setIsDialogOpen(false);
  };

  const handleDelete = (client: Client) => {
    if (!window.confirm(`Deseja remover ${client.nome} da base de clientes?`)) {
      return;
    }

    deleteClient(client.id);
    toast({
      title: "Cliente removido",
      description: `${client.nome} foi excluído com sucesso.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            Organize sua carteira, atualize dados e mantenha o relacionamento sempre à mão.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de clientes</CardDescription>
            <CardTitle className="text-3xl">{clients.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Compras registradas</CardDescription>
            <CardTitle className="text-3xl">{totalPurchases}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Base filtrada</CardDescription>
            <CardTitle className="text-3xl">{filteredClients.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Clientes Cadastrados
              </CardTitle>
              <CardDescription>
                Busque, edite e remova clientes diretamente desta página.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email, telefone ou CPF..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Localidade</TableHead>
                  <TableHead>Compras</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum cliente encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left transition-colors hover:text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/clients/${client.id}`);
                          }}
                        >
                          {client.nome}
                        </button>
                      </TableCell>
                      <TableCell>{formatClientCPF(client.cpf)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {formatClientPhone(client.telefone)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {client.cidade}, {client.estado}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{client.total_compras}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/clients/${client.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDialog(client);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(client);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              Preencha os dados principais para manter a carteira de clientes atualizada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(event) => handleInputChange("nome", event.target.value)}
                className={errors.nome ? "border-destructive" : ""}
              />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(event) => handleInputChange("cpf", event.target.value)}
                maxLength={14}
                className={errors.cpf ? "border-destructive" : ""}
              />
              {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) => handleInputChange("email", event.target.value)}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(event) => handleInputChange("telefone", event.target.value)}
                maxLength={15}
                className={errors.telefone ? "border-destructive" : ""}
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(event) => handleInputChange("endereco", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(event) => handleInputChange("cidade", event.target.value)}
                className={errors.cidade ? "border-destructive" : ""}
              />
              {errors.cidade && <p className="text-sm text-destructive">{errors.cidade}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">UF</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(event) => handleInputChange("estado", event.target.value.toUpperCase())}
                maxLength={2}
                className={errors.estado ? "border-destructive" : ""}
              />
              {errors.estado && <p className="text-sm text-destructive">{errors.estado}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(event) => handleInputChange("cep", event.target.value)}
                maxLength={9}
                className={errors.cep ? "border-destructive" : ""}
              />
              {errors.cep && <p className="text-sm text-destructive">{errors.cep}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_compras">Compras registradas</Label>
              <Input
                id="total_compras"
                type="number"
                min="0"
                value={formData.total_compras}
                onChange={(event) => handleInputChange("total_compras", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingClient ? "Salvar alterações" : "Criar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
