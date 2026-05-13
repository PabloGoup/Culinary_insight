import { useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Megaphone, Percent, Scale, Sparkles, Store, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
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
import { calculateDishCost, calculateProjectionRevenue, getDashboardMetrics, getLatestProjection, getMenuEngineering, getReportSnapshot, roundPriceForCustomer, simulateDishScenario } from '../services/costEngine';

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
        <KpiCard title="Ventas reales brutas" value={money.format(metrics.totalSales)} icon={TrendingUp} />
        <KpiCard title="Costos reales" value={money.format(metrics.totalCosts)} icon={Wallet} />
        <KpiCard title="Food cost real" value={percent.format(metrics.foodCostPercent)} icon={Percent} />
        <KpiCard title="Margen bruto real" value={percent.format(metrics.grossMarginPercent)} icon={BarChart3} />
        <KpiCard title="Utilidad real post IVA" value={money.format(metrics.projectedRealProfitAfterVat)} icon={Target} />
        <KpiCard title="Proyeccion mensual bruta" value={money.format(metrics.monthlyProjection)} icon={ClipboardList} />
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

function getDishCustomerPrice(dish: StoreState['dishes'][number], currentResult: ReturnType<typeof calculateDishCost>) {
  return dish.customerFacingPrice && dish.customerFacingPrice > 0
    ? dish.customerFacingPrice
    : roundPriceForCustomer(currentResult.recommendedPrice);
}

function getMarginPercentOnSales(price: number, totalCost: number) {
  return price > 0 ? (price - totalCost) / price : 0;
}

function getDefaultComparisonDishIds(dishes: StoreState['dishes']) {
  return dishes.slice(0, Math.min(3, dishes.length)).map((dish) => dish.id);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProjectedMonthlyDemandBase(state: StoreState) {
  const latestProjection = getLatestProjection(state.projections);
  if (latestProjection) {
    const projectedRevenue = calculateProjectionRevenue(latestProjection);
    const averagePrice =
      state.dishes.reduce((sum, dish) => {
        const result = calculateDishCost(state, dish);
        return sum + getDishCustomerPrice(dish, result);
      }, 0) / Math.max(state.dishes.length, 1);
    return Math.max(Math.round(projectedRevenue / Math.max(averagePrice, 1)), state.dishes.length * 18);
  }

  const historicalUnits = state.sales.reduce(
    (sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + item.quantity, 0),
    0,
  );
  return Math.max(historicalUnits, state.dishes.length * 18);
}

function getCategoryName(state: StoreState, categoryId: string) {
  return state.categories.find((category) => category.id === categoryId)?.name ?? 'Sin categoria';
}

function normalizeMarketingToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isSalmonMixSaladDish(name: string) {
  const token = normalizeMarketingToken(name);
  return token.includes('salmon') && token.includes('ensalada');
}

function isDessertCategory(categoryName: string) {
  return normalizeMarketingToken(categoryName).includes('postre');
}

function getDishAppealWeight(dish: StoreState['dishes'][number], categoryName: string) {
  const token = `${dish.name} ${categoryName}`.toLowerCase();
  if (token.includes('salmon') && token.includes('ensalada')) return 26;
  if (token.includes('ceviche') || token.includes('ostiones') || token.includes('pulpo')) return 15;
  if (token.includes('congrio') || token.includes('camaron')) return 14;
  if (token.includes('salmon')) return 16;
  if (token.includes('panacota') || token.includes('maracuya') || token.includes('selectino')) return 7;
  return 12;
}

function getPopularityTier(score: number) {
  if (score >= 75) return { label: 'Alta', tone: 'ok' as const };
  if (score >= 55) return { label: 'Media', tone: 'warning' as const };
  return { label: 'Baja', tone: 'danger' as const };
}

function getMarginTier(score: number) {
  if (score >= 0.68) return { label: 'Alto', tone: 'ok' as const };
  if (score >= 0.52) return { label: 'Medio', tone: 'warning' as const };
  return { label: 'Bajo', tone: 'danger' as const };
}

function getCommercialPriority(popularityScore: number, grossMarginPercent: number) {
  if (popularityScore >= 72 && grossMarginPercent >= 0.62) {
    return {
      label: 'Heroe comercial',
      tone: 'ok' as const,
      action: 'Empujar en carta, sala y redes. Es candidato a plato-ancla.',
    };
  }
  if (popularityScore >= 65 && grossMarginPercent < 0.62) {
    return {
      label: 'Traccion con ajuste',
      tone: 'warning' as const,
      action: 'Vende bien, pero conviene proteger margen con precio, guarnicion o gramaje.',
    };
  }
  if (popularityScore < 65 && grossMarginPercent >= 0.62) {
    return {
      label: 'Potencial rentable',
      tone: 'warning' as const,
      action: 'Tiene buen bruto, pero necesita visibilidad y venta sugerida.',
    };
  }
  return {
    label: 'Secundario',
    tone: 'danger' as const,
    action: 'Mantener en segundo plano, testear o rediseñar propuesta.',
  };
}

export function MarketingModule({ state }: { state: StoreState }) {
  const analysis = useMemo(() => {
    const demandBase = getProjectedMonthlyDemandBase(state);
    const rows = state.dishes.map((dish) => {
      const result = calculateDishCost(state, dish);
      const currentPrice = getDishCustomerPrice(dish, result);
      const historicalUnits = state.sales.reduce(
        (sum, sale) => sum + sale.items.filter((item) => item.dishId === dish.id).reduce((lineSum, item) => lineSum + item.quantity, 0),
        0,
      );
      const categoryName = getCategoryName(state, dish.categoryId);
      return {
        dish,
        result,
        currentPrice,
        historicalUnits,
        categoryName,
        directGrossProfit: currentPrice - result.directCost,
        grossMarginPercentOnCurrentPrice: currentPrice > 0 ? (currentPrice - result.directCost) / currentPrice : 0,
      };
    });

    const maxHistoricalUnits = Math.max(...rows.map((row) => row.historicalUnits), 0);
    const minPrice = Math.min(...rows.map((row) => row.currentPrice), 0);
    const maxPrice = Math.max(...rows.map((row) => row.currentPrice), 1);
    const minLabor = Math.min(...rows.map((row) => row.dish.laborMinutes), 0);
    const maxLabor = Math.max(...rows.map((row) => row.dish.laborMinutes), 1);

    const withScores = rows.map((row) => {
      const historyScore = maxHistoricalUnits > 0 ? (row.historicalUnits / maxHistoricalUnits) * 38 : 19;
      const priceScore = maxPrice > minPrice ? ((maxPrice - row.currentPrice) / (maxPrice - minPrice)) * 20 : 10;
      const laborScore = maxLabor > minLabor ? ((maxLabor - row.dish.laborMinutes) / (maxLabor - minLabor)) * 14 : 7;
      const appealScore = getDishAppealWeight(row.dish, row.categoryName);
      const marginScore = clamp(row.grossMarginPercentOnCurrentPrice / 0.75, 0, 1) * 13;
      const popularityScore = clamp(historyScore + priceScore + laborScore + appealScore + marginScore, 18, 96);
      return {
        ...row,
        popularityScore,
      };
    });

    const totalPopularityScore = withScores.reduce((sum, row) => sum + row.popularityScore, 0);

    const enriched = withScores.map((row) => {
      const expectedShare = totalPopularityScore > 0 ? row.popularityScore / totalPopularityScore : 1 / Math.max(withScores.length, 1);
      const expectedMonthlyUnits = Math.max(Math.round(demandBase * expectedShare), 1);
      const expectedGrossRevenue = expectedMonthlyUnits * row.currentPrice;
      const expectedGrossProfit = expectedMonthlyUnits * Math.max(row.directGrossProfit, 0);
      const popularityTier = getPopularityTier(row.popularityScore);
      const marginTier = getMarginTier(row.grossMarginPercentOnCurrentPrice);
      const priority = getCommercialPriority(row.popularityScore, row.grossMarginPercentOnCurrentPrice);
      return {
        ...row,
        expectedShare,
        expectedMonthlyUnits,
        expectedGrossRevenue,
        expectedGrossProfit,
        popularityTier,
        marginTier,
        priority,
      };
    }).sort((a, b) => b.expectedGrossProfit - a.expectedGrossProfit);

    const topHero = enriched[0] ?? null;
    const topPopularity =
      enriched.find((row) => isSalmonMixSaladDish(row.dish.name)) ??
      [...enriched].sort((a, b) => b.popularityScore - a.popularityScore)[0] ??
      null;
    const topMargin = [...enriched].sort((a, b) => b.grossMarginPercentOnCurrentPrice - a.grossMarginPercentOnCurrentPrice)[0] ?? null;
    const prioritySet = enriched.slice(0, 3);
    const savoryRows = enriched.filter((row) => !isDessertCategory(row.categoryName));
    const accessDish = [...(savoryRows.length > 0 ? savoryRows : enriched)].sort((a, b) => a.currentPrice - b.currentPrice)[0] ?? null;
    const premiumDish = [...(savoryRows.length > 0 ? savoryRows : enriched)].sort((a, b) => b.currentPrice - a.currentPrice)[0] ?? null;
    const dessertDish = enriched.find((row) => isDessertCategory(row.categoryName)) ?? null;

    return {
      demandBase,
      rows: enriched,
      topHero,
      topPopularity,
      topMargin,
      prioritySet,
      accessDish,
      premiumDish,
      dessertDish,
    };
  }, [state]);

  const marketingMix = useMemo(() => {
    const heroNames = analysis.prioritySet.map((item) => item.dish.name).join(', ');
    return [
      {
        title: 'Producto',
        icon: Sparkles,
        points: [
          `La propuesta de venta debe girar en torno a ${heroNames || 'los platos con mayor atractivo comercial'}.`,
          'Destaca frescura marina, ejecucion premium y recetas base propias como parte del valor percibido.',
          'Usa fotografia real, montaje consistente y descriptores cortos orientados a deseo y confianza.',
        ],
      },
      {
        title: 'Precio',
        icon: Wallet,
        points: [
          analysis.accessDish ? `${analysis.accessDish.dish.name} funciona como plato de entrada o acceso de ticket.` : 'Define un plato de entrada de ticket para capturar volumen.',
          analysis.premiumDish ? `${analysis.premiumDish.dish.name} debe sostener el ancla premium del menu.` : 'Mantén un ancla premium visible para elevar el ticket medio.',
          'Protege margen bruto en platos de alta salida con bundles, extras y venta sugerida antes que con descuentos planos.',
        ],
      },
      {
        title: 'Plaza',
        icon: Store,
        points: [
          'Prioriza sala y cena como espacio principal de empuje para platos marinos de mayor valor percibido.',
          analysis.dessertDish ? `${analysis.dessertDish.dish.name} debe activarse en cierre de comida, carta de postres y venta de sobremesa.` : 'Activa postres en cierre de comida y venta sugerida.',
          'Entrega el mismo mensaje comercial en carta, recomendacion del garzon, vitrina digital y RRSS.',
        ],
      },
      {
        title: 'Promocion',
        icon: Megaphone,
        points: [
          'Crea recomendacion guiada del equipo: plato estrella, maridaje, postre y upsell corto por servicio.',
          'Empuja contenido semanal con foco en plato heroe, prueba social y argumento de frescura/calidad.',
          'Usa combos de margen protegido: plato + bebida o plato + postre, evitando promociones que erosionen el bruto.',
        ],
      },
    ];
  }, [analysis]);

  return (
    <section className="content-stack">
      <div className="kpi-grid">
        <KpiCard title="Demanda mensual estimada" value={`${analysis.demandBase} platos`} icon={TrendingUp} />
        <KpiCard title="Plato con mayor tiraje esperado" value={analysis.topPopularity ? analysis.topPopularity.dish.name : 'Sin datos'} icon={Target} />
        <KpiCard title="Plato con mayor bruto esperado" value={analysis.topHero ? analysis.topHero.dish.name : 'Sin datos'} icon={Wallet} />
        <KpiCard title="Mayor margen bruto esperado" value={analysis.topMargin ? `${analysis.topMargin.dish.name} · ${percent.format(analysis.topMargin.grossMarginPercentOnCurrentPrice)}` : 'Sin datos'} icon={BarChart3} />
      </div>

      <section className="panel">
        <PanelHeader title="Propuesta comercial y mix de marketing" />
        <div className="marketing-mix-grid">
          {marketingMix.map((block) => (
            <section className="marketing-mix-card" key={block.title}>
              <div className="marketing-mix-title">
                <block.icon size={18} />
                <strong>{block.title}</strong>
              </div>
              <ul className="marketing-points">
                {block.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel wide">
          <PanelHeader title="Popularidad esperada y margen bruto esperado" />
          <DataTable
            headers={[
              'Plato',
              'Categoria',
              'Precio actual',
              'Popularidad esperada',
              'Margen bruto esperado',
              'Utilidad bruta por plato',
              'Unidades/mes esperadas',
              'Utilidad bruta mensual esperada',
              'Prioridad comercial',
            ]}
            rows={analysis.rows.map((row) => [
              row.dish.name,
              row.categoryName,
              money.format(row.currentPrice),
              <StatusBadge key={`${row.dish.id}-pop`} text={`${row.popularityTier.label} · ${row.popularityScore.toFixed(0)}/100`} tone={row.popularityTier.tone} />,
              <StatusBadge key={`${row.dish.id}-margin`} text={`${row.marginTier.label} · ${percent.format(row.grossMarginPercentOnCurrentPrice)}`} tone={row.marginTier.tone} />,
              money.format(row.directGrossProfit),
              `${row.expectedMonthlyUnits}`,
              money.format(row.expectedGrossProfit),
              <StatusBadge key={`${row.dish.id}-priority`} text={row.priority.label} tone={row.priority.tone} />,
            ])}
          />
        </section>

        <section className="panel">
          <PanelHeader title="Top prioridades de venta" />
          <div className="marketing-priority-grid">
            {analysis.prioritySet.map((row) => (
              <article className="marketing-priority-card" key={row.dish.id}>
                <div className="marketing-priority-head">
                  <strong>{row.dish.name}</strong>
                  <StatusBadge text={row.priority.label} tone={row.priority.tone} />
                </div>
                <span>{row.categoryName}</span>
                <div className="marketing-priority-metrics">
                  <div><strong>{percent.format(row.grossMarginPercentOnCurrentPrice)}</strong><span>margen bruto</span></div>
                  <div><strong>{row.expectedMonthlyUnits}</strong><span>uds/mes</span></div>
                  <div><strong>{money.format(row.expectedGrossProfit)}</strong><span>bruto mensual</span></div>
                </div>
                <p>{row.priority.action}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelHeader title="Lectura comercial ejecutiva" />
        <div className="summary-strip wide">
          <SummaryMetric label="Plato heroe sugerido" value={analysis.topHero ? analysis.topHero.dish.name : 'Sin datos'} />
          <SummaryMetric label="Plato de acceso" value={analysis.accessDish ? analysis.accessDish.dish.name : 'Sin datos'} />
          <SummaryMetric label="Ancla premium" value={analysis.premiumDish ? analysis.premiumDish.dish.name : 'Sin datos'} />
          <SummaryMetric label="Postre de empuje" value={analysis.dessertDish ? analysis.dessertDish.dish.name : 'Sin datos'} />
        </div>
      </section>
    </section>
  );
}

export function DishComparisonModule({ state }: { state: StoreState }) {
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>(() => getDefaultComparisonDishIds(state.dishes));

  useEffect(() => {
    const validIds = new Set(state.dishes.map((dish) => dish.id));
    setSelectedDishIds((current) => {
      const filtered = current.filter((dishId) => validIds.has(dishId));
      if (filtered.length > 0) return filtered;
      return getDefaultComparisonDishIds(state.dishes);
    });
  }, [state.dishes]);

  const selectedResults = useMemo(() => {
    const seen = new Set<string>();
    return selectedDishIds
      .filter((dishId) => {
        if (!dishId || seen.has(dishId)) return false;
        seen.add(dishId);
        return true;
      })
      .map((dishId) => {
        const dish = state.dishes.find((item) => item.id === dishId);
        if (!dish) return null;
        const result = calculateDishCost(state, dish);
        const customerPrice = getDishCustomerPrice(dish, result);
        const topDrivers = [...result.componentLines]
          .sort((a, b) => b.lineCost - a.lineCost)
          .slice(0, 4);
        return {
          dish,
          result,
          customerPrice,
          customerMarginPercent: getMarginPercentOnSales(customerPrice, result.totalCost),
          topDrivers,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [selectedDishIds, state]);

  const summary = useMemo(() => {
    if (selectedResults.length === 0) return null;
    const lowestTotalCost = [...selectedResults].sort((a, b) => a.result.totalCost - b.result.totalCost)[0];
    const highestMargin = [...selectedResults].sort((a, b) => b.customerMarginPercent - a.customerMarginPercent)[0];
    const highestFoodCost = [...selectedResults].sort((a, b) => b.result.foodCostPercent - a.result.foodCostPercent)[0];
    return { lowestTotalCost, highestMargin, highestFoodCost };
  }, [selectedResults]);

  const comparisonSections = useMemo(() => ([
    {
      title: 'Precio y rentabilidad',
      rows: [
        {
          label: 'Precio carta actual',
          render: (item: typeof selectedResults[number]) => money.format(item.customerPrice),
        },
        {
          label: 'Precio tecnico recomendado',
          render: (item: typeof selectedResults[number]) => money.format(roundPriceForCustomer(item.result.recommendedPrice)),
        },
        {
          label: 'Food cost sobre precio actual',
          render: (item: typeof selectedResults[number]) => percent.format(item.customerPrice > 0 ? item.result.directCost / item.customerPrice : 0),
        },
        {
          label: 'Margen real de ganancia',
          render: (item: typeof selectedResults[number]) => percent.format(item.customerMarginPercent),
        },
        {
          label: 'Ganancia real por plato',
          render: (item: typeof selectedResults[number]) => money.format(item.customerPrice - item.result.totalCost),
        },
        {
          label: 'Rentabilidad sobre costo',
          render: (item: typeof selectedResults[number]) => percent.format(item.result.totalUtilityOnCostPercent),
        },
      ],
    },
    {
      title: 'Costo directo del plato',
      rows: [
        {
          label: 'Materia prima directa',
          render: (item: typeof selectedResults[number]) => money.format(item.result.materialCost),
        },
        {
          label: 'Merma aplicada',
          render: (item: typeof selectedResults[number]) => money.format(item.result.wasteCost),
        },
        {
          label: 'Packaging',
          render: (item: typeof selectedResults[number]) => money.format(item.result.packagingCost),
        },
        {
          label: 'Costo directo total',
          render: (item: typeof selectedResults[number]) => money.format(item.result.directCost),
        },
      ],
    },
    {
      title: 'Produccion y recetas base',
      rows: [
        {
          label: 'Costo total recetas base',
          render: (item: typeof selectedResults[number]) => money.format(item.result.baseRecipeCost),
        },
        {
          label: 'MO embebida en recetas base',
          render: (item: typeof selectedResults[number]) => money.format(item.result.baseRecipeLaborCost),
        },
        {
          label: 'Indirectos embebidos en recetas base',
          render: (item: typeof selectedResults[number]) => money.format(item.result.baseRecipeIndirectCost),
        },
        {
          label: 'MO armado final',
          render: (item: typeof selectedResults[number]) => money.format(item.result.laborCost),
        },
        {
          label: 'Costo de produccion',
          render: (item: typeof selectedResults[number]) => money.format(item.result.productionCost),
        },
      ],
    },
    {
      title: 'Estructura e indirectos',
      rows: [
        {
          label: 'Indirectos variables',
          render: (item: typeof selectedResults[number]) => money.format(item.result.variableCost),
        },
        {
          label: 'Indirectos fijos asignados',
          render: (item: typeof selectedResults[number]) => money.format(item.result.fixedAllocatedCost),
        },
        {
          label: 'Comisiones / pasarela',
          render: (item: typeof selectedResults[number]) => money.format(item.result.commissionCost),
        },
        {
          label: 'Buffer de seguridad',
          render: (item: typeof selectedResults[number]) => money.format(item.result.safetyBufferCost),
        },
        {
          label: 'Costo total final',
          render: (item: typeof selectedResults[number]) => <strong>{money.format(item.result.totalCost)}</strong>,
        },
      ],
    },
  ]), [selectedResults]);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Comparador de platos finales" />
        <div className="comparison-selector-toolbar">
          {selectedDishIds.map((dishId, index) => (
            <label key={`${dishId || 'empty'}-${index}`}>
              Plato {index + 1}
              <div className="comparison-selector-row">
                <select
                  value={dishId}
                  onChange={(event) => setSelectedDishIds((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                >
                  <option value="">Seleccionar plato</option>
                  {state.dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
                </select>
                {selectedDishIds.length > 2 && (
                  <button
                    className="icon-button"
                    type="button"
                    title="Quitar plato"
                    onClick={() => setSelectedDishIds((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    ×
                  </button>
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="toolbar">
          <button
            className="secondary-button compact"
            type="button"
            disabled={selectedDishIds.length >= Math.min(4, state.dishes.length) || state.dishes.length === 0}
            onClick={() => {
              const currentSet = new Set(selectedDishIds);
              const nextDish = state.dishes.find((dish) => !currentSet.has(dish.id));
              if (!nextDish) return;
              setSelectedDishIds((current) => [...current, nextDish.id]);
            }}
          >
            <Scale size={16} /> Agregar plato
          </button>
        </div>
      </section>

      {summary && (
        <div className="summary-strip compact">
          <SummaryMetric label="Platos comparados" value={String(selectedResults.length)} />
          <SummaryMetric label="Menor costo total" value={`${summary.lowestTotalCost.dish.name} · ${money.format(summary.lowestTotalCost.result.totalCost)}`} />
          <SummaryMetric label="Mayor margen real" value={`${summary.highestMargin.dish.name} · ${percent.format(summary.highestMargin.customerMarginPercent)}`} />
          <SummaryMetric label="Food cost mas alto" value={`${summary.highestFoodCost.dish.name} · ${percent.format(summary.highestFoodCost.result.foodCostPercent)}`} />
        </div>
      )}

      {selectedResults.length > 0 ? (
        <>
          <section className="panel">
            <PanelHeader title="Comparacion integral de costos" />
            <div className="compact-shell comparison-shell">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    {selectedResults.map((item) => (
                      <th key={item.dish.id}>
                        <div className="comparison-column-head">
                          <strong>{item.dish.name}</strong>
                          <span>{item.dish.service}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonSections.map((section) => (
                    <Fragment key={section.title}>
                      <tr className="comparison-section-row">
                        <td colSpan={selectedResults.length + 1}>{section.title}</td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={`${section.title}-${row.label}`}>
                          <td className="comparison-label-cell">{row.label}</td>
                          {selectedResults.map((item) => (
                            <td key={`${item.dish.id}-${row.label}`} className="comparison-value-cell">{row.render(item)}</td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <PanelHeader title="Drivers principales por plato" />
            <div className="comparison-card-grid">
              {selectedResults.map((item) => (
                <section className="comparison-card" key={item.dish.id}>
                  <div className="comparison-card-header">
                    <div>
                      <strong>{item.dish.name}</strong>
                      <span>{`${money.format(item.result.totalCost)} costo total · ${percent.format(item.customerMarginPercent)} margen real`}</span>
                    </div>
                  </div>
                  <div className="stack-list">
                    {item.topDrivers.map((line) => (
                      <div className="record-row comparison-driver-row" key={line.componentId}>
                        <strong>{line.componentName}</strong>
                        <span>{`${line.quantity} ${line.unit} · ${line.componentType === 'baseRecipe' ? 'Receta base' : line.componentType === 'packaging' ? 'Packaging' : 'Ingrediente'}`}</span>
                        <strong>{money.format(line.lineCost)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <PanelHeader title="Comparacion integral de costos" />
          <div className="report-empty-state">
            <strong>Sin platos seleccionados</strong>
            <span>Selecciona al menos un plato final para comparar costo directo, produccion, indirectos, precio y margen.</span>
          </div>
        </section>
      )}
    </section>
  );
}

export function ReportsModule({ state }: { state: StoreState }) {
  const report = useMemo(() => getReportSnapshot(state), [state]);
  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const latestProjection = useMemo(() => getLatestProjection(state.projections), [state.projections]);
  const projectedSales = metrics.monthlyProjection;
  const projectedNetSales = report.projectedNetSales;
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
    { label: 'Utilidad proyectada antes IVA', value: money.format(report.projectedProfit), helper: 'Resultado operativo preliminar con ventas y costos brutos.' },
    { label: 'IVA debito proyectado', value: money.format(report.projectedVatDebit), helper: 'IVA generado por las ventas proyectadas, asumiendo tickets con IVA incluido.' },
    { label: 'IVA credito proyectado', value: money.format(report.projectedVatCredit), helper: 'IVA recuperable estimado desde compras e insumos afectos al periodo.' },
    { label: 'IVA neto proyectado', value: money.format(report.projectedVatPayable), helper: 'Diferencia entre IVA debito de ventas e IVA credito de compras.' },
    { label: 'Utilidad real despues de IVA', value: money.format(report.projectedRealProfitAfterVat), helper: 'Resultado final estimado del negocio despues de compensar IVA debito y credito.' },
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
        <KpiCard title="Venta proyectada bruta" value={money.format(projectedSales)} icon={TrendingUp} />
        <KpiCard title="IVA neto proyectado" value={money.format(report.projectedVatPayable)} icon={Percent} />
        <KpiCard title="Utilidad real post IVA" value={money.format(report.projectedRealProfitAfterVat)} icon={Wallet} />
      </div>

      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Lectura ejecutiva del negocio" />
          <div className="summary-strip compact">
            <SummaryMetric label="Cobertura del equilibrio" value={percent.format(breakEvenCoverage)} />
            <SummaryMetric label="Peso fijo sobre venta" value={percent.format(fixedCostWeight)} />
            <SummaryMetric label="Merma sobre venta" value={percent.format(wasteRate)} />
            <SummaryMetric label="Inventario vs venta proyectada" value={percent.format(projectedSales > 0 ? report.inventoryValue / projectedSales : 0)} />
            <SummaryMetric label="Venta neta proyectada" value={money.format(projectedNetSales)} />
            <SummaryMetric label="IVA debito proyectado" value={money.format(report.projectedVatDebit)} />
            <SummaryMetric label="IVA credito proyectado" value={money.format(report.projectedVatCredit)} />
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
                <SummaryMetric label="Venta proyectada bruta" value={money.format(projectedSales)} />
                <SummaryMetric label="Venta proyectada neta" value={money.format(projectedNetSales)} />
                <SummaryMetric label="IVA debito" value={money.format(report.projectedVatDebit)} />
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
                Los tickets de proyeccion se leen con IVA incluido. El reporte separa venta neta, IVA debito, IVA credito estimado y utilidad real post IVA usando la ultima proyeccion guardada.
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
