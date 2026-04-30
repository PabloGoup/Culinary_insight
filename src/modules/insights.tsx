import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Percent, Store, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { useLocalStore } from '../hooks/useLocalStore';
import { money, percent } from '../lib/format';
import { calculateProjectionRevenue, getDashboardMetrics, getLatestProjection, getMenuEngineering, getReportSnapshot, simulateDishScenario } from '../services/costEngine';

type StoreState = ReturnType<typeof useLocalStore>['state'];

function parseNumericInput(value: string, fallback = 0) {
  if (value.trim() === '') return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function DashboardModule({ state }: { state: StoreState }) {
  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const latestProjection = useMemo(() => getLatestProjection(state.projections), [state.projections]);
  const projectionChart = latestProjection?.days.map((day) => ({
    day: day.day.slice(0, 3),
    ventas: day.projectedCustomers * (day.avgFoodTicket + day.avgBeverageTicket),
  })) ?? [];
  const ranking = metrics.topDishes.concat(metrics.lowDishes).map((item) => ({
    name: item.dish.name,
    margen: Number((item.result.netMarginPercent * 100).toFixed(1)),
  }));

  return (
    <section className="content-stack">
      <div className="kpi-grid">
        <KpiCard title="Ventas reales" value={money.format(metrics.totalSales)} icon={TrendingUp} />
        <KpiCard title="Costos reales" value={money.format(metrics.totalCosts)} icon={Wallet} />
        <KpiCard title="Food cost real" value={percent.format(metrics.foodCostPercent)} icon={Percent} />
        <KpiCard title="Margen bruto real" value={percent.format(metrics.grossMarginPercent)} icon={BarChart3} />
        <KpiCard title="Margen neto proyectado" value={percent.format(metrics.projectedNetMarginPercent)} icon={Target} />
        <KpiCard title="Proyeccion mensual" value={money.format(metrics.monthlyProjection)} icon={ClipboardList} />
      </div>

      <div className="dashboard-grid">
        <section className="panel wide">
          <PanelHeader title="Proyeccion de cierre mensual" />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(value) => money.format(Number(value)).replace('$', '')} />
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Line type="monotone" dataKey="ventas" stroke="#006d77" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="Alertas inteligentes" />
          <div className="stack-list">
            {metrics.alerts.map((alert) => (
              <AlertRow key={alert.id} title={alert.title} description={alert.description} severity={alert.severity} />
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Productos mas rentables" />
          <SimpleRanking items={metrics.topDishes.map((item) => ({
            id: item.dish.id,
            title: item.dish.name,
            subtitle: `${percent.format(item.result.netMarginPercent)} margen neto · ${item.unitsSold} uds`,
          }))} />
        </section>
        <section className="panel">
          <PanelHeader title="Productos menos rentables" />
          <SimpleRanking items={metrics.lowDishes.map((item) => ({
            id: item.dish.id,
            title: item.dish.name,
            subtitle: `${percent.format(item.result.netMarginPercent)} margen neto · ${item.unitsSold} uds`,
          }))} />
        </section>
        <section className="panel">
          <PanelHeader title="Comparacion de margen" />
          <div className="chart-box compact">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="margen" fill="#ca6702" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
}

export function AnalyticsModule({ state }: { state: StoreState }) {
  const items = useMemo(() => getMenuEngineering(state), [state]);

  return (
    <section className="content-stack">
      <div className="dashboard-grid">
        <section className="panel wide">
          <PanelHeader title="Ingenieria de menu" />
          <DataTable
            headers={['Plato', 'Unidades', 'Contribucion', 'Clasificacion', 'Accion sugerida']}
            rows={items.map((item) => [
              item.dish.name,
              String(item.unitsSold),
              money.format(item.contribution),
              <StatusBadge key={`${item.dish.id}-q`} tone={item.quadrant === 'Estrella' ? 'ok' : item.quadrant === 'Perro' ? 'danger' : 'warning'} text={item.quadrant} />,
              item.recommendedAction,
            ])}
          />
        </section>
        <section className="panel">
          <PanelHeader title="Cartas y menus" />
          <SimpleRanking items={state.menus.map((menu) => ({
            id: menu.id,
            title: menu.name,
            subtitle: `${menu.dishIds.length} platos · ${menu.categoryIds.length} categorias`,
          }))} />
        </section>
      </div>
    </section>
  );
}

export function SimulationsModule({ state }: { state: StoreState }) {
  const [dishId, setDishId] = useState(state.dishes[0]?.id ?? '');
  const [ingredientIncreasePercent, setIngredientIncreasePercent] = useState(12);
  const [salePriceChangePercent, setSalePriceChangePercent] = useState(6);
  const [yieldImprovementPercent, setYieldImprovementPercent] = useState(4);
  const [extraUnits, setExtraUnits] = useState(24);

  const simulation = useMemo(
    () =>
      simulateDishScenario(state, dishId, {
        ingredientIncreasePercent,
        salePriceChangePercent,
        yieldImprovementPercent,
        extraUnits,
      }),
    [state, dishId, ingredientIncreasePercent, salePriceChangePercent, yieldImprovementPercent, extraUnits],
  );

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Laboratorio de simulaciones" />
        <div className="form-grid four">
          <label>
            Plato
            <select value={dishId} onChange={(event) => setDishId(event.target.value)}>
              {state.dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
            </select>
          </label>
          <label>Alza materia prima %<input type="number" step="0.1" value={ingredientIncreasePercent} onChange={(event) => setIngredientIncreasePercent(parseNumericInput(event.target.value))} /></label>
          <label>Variacion precio venta %<input type="number" step="0.1" value={salePriceChangePercent} onChange={(event) => setSalePriceChangePercent(parseNumericInput(event.target.value))} /></label>
          <label>Mejora rendimiento %<input type="number" step="0.1" value={yieldImprovementPercent} onChange={(event) => setYieldImprovementPercent(parseNumericInput(event.target.value))} /></label>
          <label>Unidades extra<input type="number" step="1" value={extraUnits} onChange={(event) => setExtraUnits(parseNumericInput(event.target.value))} /></label>
        </div>
        {simulation && (
          <div className="summary-strip wide">
            <SummaryMetric label="Costo ajustado" value={money.format(simulation.adjustedCost)} />
            <SummaryMetric label="Precio ajustado" value={money.format(simulation.adjustedPrice)} />
            <SummaryMetric label="Margen ajustado" value={percent.format(simulation.adjustedMargin)} />
            <SummaryMetric label="Contribucion proyectada" value={money.format(simulation.projectedContribution)} />
          </div>
        )}
      </section>
    </section>
  );
}

export function ReportsModule({ state }: { state: StoreState }) {
  const report = useMemo(() => getReportSnapshot(state), [state]);
  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const latestProjection = useMemo(() => getLatestProjection(state.projections), [state.projections]);
  const projectedSales = metrics.monthlyProjection;
  const breakEvenCoverage = report.breakEvenSales > 0 ? projectedSales / report.breakEvenSales : 0;
  const contributionCoverage = projectedSales - report.breakEvenSales;
  const wasteRate = projectedSales > 0 ? report.wasteValue / projectedSales : 0;
  const fixedCostWeight = projectedSales > 0 ? report.totalMonthlyStructure / projectedSales : 0;
  const topContributionDishes = metrics.topDishes.slice(0, 4).map((item) => ({
    id: item.dish.id,
    name: item.dish.name,
    contribution: item.result.recommendedPrice - item.result.totalCost,
    margin: item.result.netMarginPercent,
    units: item.unitsSold,
  }));
  const priorityAlerts = [
    {
      id: 'coverage',
      severity: breakEvenCoverage >= 1.1 ? 'info' as const : breakEvenCoverage >= 1 ? 'warning' as const : 'critical' as const,
      title: breakEvenCoverage >= 1 ? 'Cobertura del equilibrio en rango' : 'Ventas proyectadas bajo equilibrio',
      description:
        breakEvenCoverage >= 1
          ? `La proyeccion cubre ${percent.format(breakEvenCoverage - 1)} por sobre el punto de equilibrio.`
          : `Faltan ${money.format(Math.abs(contributionCoverage))} para cubrir estructura fija con la proyeccion actual.`,
    },
    {
      id: 'fixed-weight',
      severity: fixedCostWeight <= 0.35 ? 'info' as const : fixedCostWeight <= 0.5 ? 'warning' as const : 'critical' as const,
      title: 'Peso de costos fijos sobre ventas',
      description: `${percent.format(fixedCostWeight)} de la venta proyectada se usa para sostener estructura fija mensual.`,
    },
    {
      id: 'waste-rate',
      severity: wasteRate <= 0.01 ? 'info' as const : wasteRate <= 0.025 ? 'warning' as const : 'critical' as const,
      title: 'Merma valorizada sobre venta proyectada',
      description: `${percent.format(wasteRate)} de la proyeccion mensual se fuga por merma registrada.`,
    },
    ...metrics.alerts.slice(0, 3),
  ];
  const financeBridge = [
    { name: 'Venta proyectada', value: projectedSales, fill: '#1f7a1f' },
    { name: 'Punto equilibrio', value: -report.breakEvenSales, fill: '#c1121f' },
    { name: 'Colchon neto', value: contributionCoverage, fill: contributionCoverage >= 0 ? '#ca6702' : '#c1121f' },
  ];
  const executiveRows = [
    { label: 'Margen de contribucion medio', value: money.format(report.contributionMargin), helper: 'Aporte promedio por unidad vendida antes de cubrir estructura fija.' },
    { label: 'Platos-equivalentes para equilibrio', value: report.breakEvenUnits > 0 ? `${report.breakEvenUnits} platos` : 'Sin base', helper: `Equivalen a platos vendidos con aporte medio de ${money.format(report.contributionMargin)} por unidad.` },
    { label: 'Tickets promedio para equilibrio', value: report.breakEvenGuestTickets > 0 ? `${report.breakEvenGuestTickets} tickets` : 'Sin base', helper: `Calculados con ticket promedio proyectado de ${money.format(report.projectedAverageFoodTicket)}.` },
    { label: 'Estructura mensual total', value: money.format(report.totalMonthlyStructure), helper: 'Incluye fijos base, indirectos mensualizados y costo total del personal.' },
    { label: 'Utilidad proyectada', value: money.format(report.projectedProfit), helper: 'Indicador preliminar basado en proyeccion actual; revisar junto con cobertura del equilibrio.' },
  ];
  const eventRows = state.eventQuotes.map((eventQuote) => {
    const eventOperationalCost = eventQuote.laborCost + eventQuote.transportCost + eventQuote.setupCost + eventQuote.equipmentCost;
    const targetRevenue = eventOperationalCost / Math.max(1 - eventQuote.marginTarget, 0.01);
    return {
      id: eventQuote.id,
      name: eventQuote.name,
      guests: eventQuote.guests,
      operationalCost: eventOperationalCost,
      marginTarget: eventQuote.marginTarget,
      targetRevenue,
    };
  });
  const projectionRows = [...state.projections].reverse().map((projection, index) => {
    const weeklyBaseRevenue = projection.days.reduce(
      (sum, day) => sum + day.projectedCustomers * (day.avgFoodTicket + day.avgBeverageTicket),
      0,
    );
    const weeklyGuests = projection.days.reduce((sum, day) => sum + day.projectedCustomers, 0);
    const multiplier = projection.period === 'mes' ? 4 : projection.period === 'semana' ? 1 : 30;
    const monthlyEquivalentRevenue = projection.period === 'mes' ? weeklyBaseRevenue * 4 : projection.period === 'semana' ? weeklyBaseRevenue * 4 : weeklyBaseRevenue * 30;
    const monthlyEquivalentGuests = projection.period === 'mes' ? weeklyGuests * 4 : projection.period === 'semana' ? weeklyGuests * 4 : weeklyGuests * 30;
    const averageTicket = weeklyGuests > 0 ? weeklyBaseRevenue / weeklyGuests : 0;
    return {
      id: projection.id,
      name: projection.name,
      period: projection.period,
      weeklyBaseRevenue,
      weeklyGuests,
      monthlyEquivalentRevenue,
      monthlyEquivalentGuests,
      averageTicket,
      multiplier,
      isLatest: index === 0,
      monthlyRevenue: calculateProjectionRevenue(projection),
    };
  });

  return (
    <section className="content-stack">
      <div className="kpi-grid">
        <KpiCard title="Inventario valorizado" value={money.format(report.inventoryValue)} icon={Boxes} />
        <KpiCard title="Merma valorizada" value={money.format(report.wasteValue)} icon={TrendingDown} />
        <KpiCard title="Punto de equilibrio" value={money.format(report.breakEvenSales)} icon={Target} />
        <KpiCard title="Venta proyectada" value={money.format(projectedSales)} icon={TrendingUp} />
        <KpiCard title="Cobertura equilibrio" value={percent.format(breakEvenCoverage)} icon={Percent} />
        <KpiCard title="Colchon proyectado" value={money.format(contributionCoverage)} icon={Wallet} />
      </div>

      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Lectura ejecutiva del negocio" />
          <div className="summary-strip compact">
            <SummaryMetric label="Cobertura del equilibrio" value={percent.format(breakEvenCoverage)} />
            <SummaryMetric label="Peso fijo sobre venta" value={percent.format(fixedCostWeight)} />
            <SummaryMetric label="Merma sobre venta" value={percent.format(wasteRate)} />
            <SummaryMetric label="Inventario vs venta proyectada" value={percent.format(projectedSales > 0 ? report.inventoryValue / projectedSales : 0)} />
            <SummaryMetric label="Precio promedio plato" value={money.format(report.averageDishSellingPrice)} />
            <SummaryMetric label="Ticket promedio proyectado" value={money.format(report.projectedAverageFoodTicket)} />
          </div>
          <div className="report-meter-block">
            <div className="report-meter-header">
              <strong>Capacidad de cubrir estructura fija</strong>
              <span>{breakEvenCoverage >= 1 ? `Superavit proyectado ${money.format(contributionCoverage)}` : `Brecha por cubrir ${money.format(Math.abs(contributionCoverage))}`}</span>
            </div>
            <div className="coverage-meter">
              <span
                className={`coverage-fill ${breakEvenCoverage >= 1 ? 'ok' : breakEvenCoverage >= 0.85 ? 'warning' : 'danger'}`}
                style={{ width: `${Math.min(Math.max(breakEvenCoverage, 0), 1.4) / 1.4 * 100}%` }}
              />
            </div>
            <div className="coverage-scale">
              <span>0%</span>
              <span>100%</span>
              <span>140%</span>
            </div>
          </div>
          <div className="metric-table">
            {executiveRows.map((row) => (
              <div className="report-metric-row" key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <small>{row.helper}</small>
                </div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="Focos prioritarios" />
          <div className="stack-list">
            {priorityAlerts.map((alert) => (
              <AlertRow key={alert.id} title={alert.title} description={alert.description} severity={alert.severity} />
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Puente de resultado proyectado" />
          <div className="chart-box compact">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeBridge}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => money.format(Number(value)).replace('$', '')} />
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {financeBridge.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="report-bridge-legend">
            <div className="report-legend-item"><span className="swatch positive" /> Venta proyectada del periodo.</div>
            <div className="report-legend-item"><span className="swatch negative" /> Exigencia minima para cubrir costos fijos.</div>
            <div className="report-legend-item"><span className="swatch accent" /> Holgura o brecha despues de cubrir equilibrio.</div>
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="Productos que sostienen el negocio" />
          <div className="stack-list">
            {topContributionDishes.map((item) => (
              <div className="record-row report-focus-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{`${item.units} uds · ${percent.format(item.margin)} margen neto`}</span>
                </div>
                <strong>{money.format(item.contribution)}</strong>
              </div>
            ))}
            {topContributionDishes.length === 0 && (
              <div className="report-empty-state">
                <strong>Sin ventas suficientes</strong>
                <span>Registra ventas para identificar los platos que empujan el margen real.</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Eventos y banqueteria" />
          {eventRows.length > 0 ? (
            <div className="compact-shell">
              <table>
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>PAX</th>
                    <th>Costo operativo</th>
                    <th>Margen objetivo</th>
                    <th>Venta minima sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((eventRow) => (
                    <tr key={eventRow.id}>
                      <td>{eventRow.name}</td>
                      <td>{eventRow.guests}</td>
                      <td>{money.format(eventRow.operationalCost)}</td>
                      <td>{percent.format(eventRow.marginTarget)}</td>
                      <td>{money.format(eventRow.targetRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="report-empty-state">
              <strong>Sin cotizaciones activas</strong>
              <span>Cuando registres eventos, aqui vas a ver costo operativo, PAX y venta minima para lograr el margen objetivo.</span>
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeader title="Como leer este reporte" />
          <div className="stack-list">
            <div className="record-row">
                <strong>Cobertura del equilibrio</strong>
                <span>Si supera 100%, la proyeccion alcanza a pagar la estructura mensual total. Si queda bajo 100%, falta venta o mejora de aporte.</span>
              </div>
              <div className="record-row">
                <strong>Margen de contribucion</strong>
                <span>Es el dinero que deja cada plato promedio vendido para absorber estructura. Sube mejorando precio, receta o mix de ventas.</span>
              </div>
              <div className="record-row">
                <strong>Unidades para equilibrio</strong>
                <span>{`Hoy significa ${report.breakEvenUnits} platos-equivalentes o ${report.breakEvenGuestTickets} tickets promedio para no perder dinero.`}</span>
              </div>
            </div>
        </section>
      </div>

      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Origen de la venta proyectada" />
          {projectionRows.length > 0 ? (
            <>
              <div className="summary-strip compact">
                <SummaryMetric label="Proyeccion vigente" value={latestProjection?.name ?? '-'} />
                <SummaryMetric label="Venta proyectada total" value={money.format(projectedSales)} />
                <SummaryMetric label="Clientes proyectados / mes" value={String(projectionRows.find((item) => item.isLatest)?.monthlyEquivalentGuests ?? 0)} />
                <SummaryMetric label="Ticket promedio ponderado" value={money.format(report.projectedAverageFoodTicket)} />
              </div>
              <div className="compact-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Proyeccion</th>
                      <th>Periodo</th>
                      <th>Clientes base</th>
                      <th>Ticket promedio</th>
                      <th>Base semanal</th>
                      <th>Factor mensual</th>
                      <th>Venta mensual equivalente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <StatusBadge tone={row.isLatest ? 'ok' : 'warning'} text={row.isLatest ? 'Vigente' : 'Historial'} />
                        </td>
                        <td>{row.name}</td>
                        <td>{row.period === 'mes' ? 'Semana tipo x 4' : row.period === 'semana' ? 'Semana x 4' : 'Dia x 30'}</td>
                        <td>{row.weeklyGuests}</td>
                        <td>{money.format(row.averageTicket)}</td>
                        <td>{money.format(row.weeklyBaseRevenue)}</td>
                        <td>{`${row.multiplier}x`}</td>
                        <td>{money.format(row.monthlyEquivalentRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="helper-text">
                Los KPIs y reportes usan solo la ultima proyeccion guardada. Las anteriores quedan como historial para revision y limpieza.
              </p>
            </>
          ) : (
            <div className="report-empty-state">
              <strong>Sin proyecciones comerciales activas</strong>
              <span>Registra una proyeccion en Ventas para que el tablero pueda calcular venta proyectada, tickets y cobertura del equilibrio.</span>
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeader title="Planillas y turnos" />
          <div className="stack-list">
            <div className="record-row">
              <strong>La planificacion mensual ya existe en UI</strong>
              <span>
                Esta disponible en <code>Planillas -&gt; Planificacion mensual</code> y tambien en el modulo <code>Planificacion</code>.
              </span>
            </div>
            <div className="record-row">
              <strong>No requiere SQL para operar</strong>
              <span>
                Los turnos se pueden crear, editar y borrar desde la interfaz usando <code>staffShifts</code>.
              </span>
            </div>
            <div className="record-row">
              <strong>Cuando si conviene SQL</strong>
              <span>Solo si quieres precargar un calendario mensual completo de ejemplo en Supabase para demo o arranque inicial.</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function KpiCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Store }) {
  return (
    <section className="kpi">
      <div className="kpi-icon"><Icon size={18} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
    </section>
  );
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AlertRow({
  title,
  description,
  severity,
}: {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}) {
  return (
    <div className={`alert-row ${severity}`}>
      <AlertTriangle size={16} />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}

function StatusBadge({ text, tone }: { text: string; tone: 'ok' | 'warning' | 'danger' }) {
  return <span className={`status-badge ${tone}`}>{text}</span>;
}

function SimpleRanking({ items }: { items: Array<{ id: string; title: string; subtitle: string }> }) {
  return (
    <div className="stack-list">
      {items.map((item) => (
        <div className="record-row" key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.subtitle}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title?: string;
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <section className="panel">
      {title && <PanelHeader title={title} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
