import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatsCard } from "@/components/StatsCard";
import {
  buildConditionDistribution,
  buildMonthlyPerformance,
  buildSellerLeaderboard,
  formatCurrency,
  formatPercent,
  getGoalProgress,
  getMonthComparison,
  getSalesMetrics,
  getTopProduct,
} from "@/lib/salesInsights";
import { AppUser, roleLabels } from "@/stores/useSessionStore";
import type { SoldDevice } from "@/types/saleTypes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  BarChart3,
  DollarSign,
  LineChart,
  Package,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface SalesOverviewProps {
  currentUser: AppUser;
  users: AppUser[];
  visibleSales: SoldDevice[];
  allSales: SoldDevice[];
  stockSummary: {
    total: number;
    totalValue: number;
  };
}

const performanceChartConfig = {
  revenue: {
    label: "Receita",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "Lucro",
    color: "hsl(var(--accent))",
  },
} as const;

const leaderboardChartConfig = {
  revenue: {
    label: "Receita",
    color: "hsl(var(--primary))",
  },
} as const;

const distributionColors = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--secondary-foreground))",
];

export function SalesOverview({
  currentUser,
  users,
  visibleSales,
  allSales,
  stockSummary,
}: SalesOverviewProps) {
  const scopedMetrics = getSalesMetrics(visibleSales);
  const goalProgress = getGoalProgress(currentUser, allSales, users);
  const monthComparison = getMonthComparison(visibleSales);
  const monthlyPerformance = buildMonthlyPerformance(visibleSales);
  const leaderboard = buildSellerLeaderboard(allSales, users);
  const conditionDistribution = buildConditionDistribution(visibleSales);
  const topProduct = getTopProduct(visibleSales);

  const bestSeller = leaderboard[0];
  const adminView = currentUser.role === "admin";
  const headline =
    adminView
      ? "Visão consolidada da operação comercial"
      : "Seu acompanhamento diário de vendas e meta";

  const subtitle =
    adminView
      ? "Acompanhe a equipe inteira, identifique destaques e reaja rápido aos gargalos."
      : "Monitore seu ritmo, compare com a meta do mês e priorize oportunidades.";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-lg">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.6fr,1fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit border border-primary/20 bg-background/80">
              {roleLabels[currentUser.role]}
            </Badge>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">{headline}</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Receita do mês
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(monthComparison.currentMonth)}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    monthComparison.positive ? "text-accent" : "text-destructive"
                  }`}
                >
                  {monthComparison.positive ? "+" : ""}
                  {monthComparison.deltaPercent.toFixed(0)}% vs. mês anterior
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Meta</p>
                <p className="mt-2 text-2xl font-semibold">{formatPercent(goalProgress.percent)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(goalProgress.achieved)} de {formatCurrency(goalProgress.target)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Estoque monitorado
                </p>
                <p className="mt-2 text-2xl font-semibold">{stockSummary.total}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(stockSummary.totalValue)} em mercadoria
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {adminView ? "Meta do time" : "Sua meta mensal"}
                </p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(goalProgress.target)}</p>
              </div>
              <Target className="h-9 w-9 text-primary" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {adminView ? "Faturamento acumulado" : "Vendas acumuladas"}
                </span>
                <span className="font-medium">{formatCurrency(goalProgress.achieved)}</span>
              </div>
              <Progress value={goalProgress.percent} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatPercent(goalProgress.percent)} concluído</span>
                <span>Faltam {formatCurrency(goalProgress.remaining)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title={adminView ? "Vendas concluídas pela equipe" : "Suas vendas concluídas"}
          value={String(scopedMetrics.completedSales)}
          description="Negócios finalizados no período disponível"
          icon={ShoppingCart}
        />
        <StatsCard
          title="Receita total"
          value={formatCurrency(scopedMetrics.totalRevenue)}
          description="Faturamento das vendas concluídas"
          icon={DollarSign}
        />
        <StatsCard
          title="Lucro estimado"
          value={formatCurrency(scopedMetrics.totalProfit)}
          description="Receita menos custo de aquisição"
          icon={TrendingUp}
        />
        <StatsCard
          title="Ticket médio"
          value={formatCurrency(scopedMetrics.averageTicket)}
          description="Valor médio por venda concluída"
          icon={LineChart}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr,1fr]">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Evolução de receita e lucro
            </CardTitle>
            <CardDescription>
              {adminView
                ? "Histórico consolidado da equipe nos últimos meses."
                : "Seu ritmo de venda para acompanhar constância e margem."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="h-[320px] w-full" config={performanceChartConfig}>
              <AreaChart data={monthlyPerformance}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <>
                          <span className="text-muted-foreground">{String(name)}</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(Number(value))}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="url(#revenueFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--color-profit)"
                  fill="url(#profitFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Indicadores rápidos
            </CardTitle>
            <CardDescription>
              Resumo operacional para priorizar suas próximas ações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">Taxa de conclusão</p>
              <p className="mt-1 text-2xl font-semibold">{formatPercent(scopedMetrics.closeRate)}</p>
              <p className="text-xs text-muted-foreground">
                {scopedMetrics.pendingSales} negócio(s) aguardando fechamento completo
              </p>
            </div>
            <div className="rounded-2xl border bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">Acessórios agregados</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(scopedMetrics.accessoryRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">
                Receita complementar com capa e película
              </p>
            </div>
            <div className="rounded-2xl border bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">Produto destaque</p>
              <p className="mt-1 text-lg font-semibold">{topProduct?.name ?? "Sem histórico"}</p>
              <p className="text-xs text-muted-foreground">
                {topProduct
                  ? `${topProduct.sales} venda(s) somando ${formatCurrency(topProduct.revenue)}`
                  : "Assim que houver vendas, o ranking aparece aqui."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        {adminView ? (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Ranking de vendedores
              </CardTitle>
              <CardDescription>
                Compare receita, meta e produtividade de cada vendedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ChartContainer className="h-[250px] w-full" config={leaderboardChartConfig}>
                <BarChart data={leaderboard}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="sellerName" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-medium text-foreground">
                            {formatCurrency(Number(value))}
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="revenue" radius={[12, 12, 0, 0]} fill="var(--color-revenue)" />
                </BarChart>
              </ChartContainer>

              <div className="space-y-3">
                {leaderboard.map((seller, index) => (
                  <div
                    key={seller.sellerId}
                    className="rounded-2xl border border-border/70 bg-secondary/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          #{index + 1} {seller.sellerName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {seller.completedSales} venda(s) concluída(s) • ticket médio{" "}
                          {formatCurrency(seller.averageTicket)}
                        </p>
                      </div>
                      <Badge variant={seller.role === "admin" ? "secondary" : "outline"}>
                        {roleLabels[seller.role]}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="font-medium">{formatCurrency(seller.revenue)}</span>
                      </div>
                      <Progress value={seller.progress} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatPercent(seller.progress)} da meta individual</span>
                        <span>Lucro {formatCurrency(seller.profit)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Seu foco de performance
              </CardTitle>
              <CardDescription>
                Pontos práticos para sustentar resultado e bater a meta.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Meta restante</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(goalProgress.remaining)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Valor necessário para concluir o mês acima do objetivo
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Melhor margem</p>
                <p className="mt-2 text-lg font-semibold">{topProduct?.name ?? "Aguardando"}</p>
                <p className="text-xs text-muted-foreground">
                  Produto que mais puxou receita na sua carteira
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Estoque disponível</p>
                <p className="mt-2 text-2xl font-semibold">{stockSummary.total}</p>
                <p className="text-xs text-muted-foreground">
                  Mantenha o giro priorizando os modelos mais buscados
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Distribuição por condição
            </CardTitle>
            <CardDescription>
              {adminView
                ? "Perfil dos aparelhos vendidos por toda a equipe."
                : "Mix dos aparelhos que você vendeu recentemente."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1fr,180px] lg:items-center">
              <div className="space-y-3">
                {conditionDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: distributionColors[index % distributionColors.length] }}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.value} venda(s)</span>
                  </div>
                ))}
                {adminView && bestSeller && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground">Melhor vendedor no recorte</p>
                    <p className="mt-1 text-lg font-semibold">{bestSeller.sellerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(bestSeller.revenue)} em receita com{" "}
                      {bestSeller.completedSales} venda(s) concluída(s)
                    </p>
                  </div>
                )}
              </div>

              <ChartContainer
                className="mx-auto h-[180px] w-full max-w-[180px]"
                config={{}}
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">{String(name)}</span>
                            <span className="font-medium text-foreground">{value}</span>
                          </>
                        )}
                      />
                    }
                  />
                  <Pie data={conditionDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72}>
                    {conditionDistribution.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={distributionColors[index % distributionColors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
