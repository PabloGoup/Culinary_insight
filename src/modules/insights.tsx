import { useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import * as XLSX from 'xlsx-js-style';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
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
import { compactNumber, money, percent } from '../lib/format';
import { calculateDishCost, calculateProjectionRevenue, calculateTotalMonthlyLaborCost, convertQuantity, getDashboardMetrics, getIngredientUsageForecast, getLatestProjection, getMenuEngineering, getMonthlyCostAmount, getReportSnapshot, roundPriceForCustomer, simulateDishScenario } from '../services/costEngine';

type StoreState = ReturnType<typeof useLocalStore>['state'];

function compactMoney(value: number) {
  return `$${compactNumber(value)}`;
}

function parseNumericInput(value: string, fallback = 0) {
  if (value.trim() === '') return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEngineeringExportPrice(item: ReturnType<typeof getMenuEngineering>[number]) {
  return item.dish.customerFacingPrice && item.dish.customerFacingPrice > 0 ? item.dish.customerFacingPrice : item.result.recommendedPrice;
}

type SheetCell = XLSX.CellObject & { s?: Record<string, unknown> };

const borderStyle = {
  top: { style: 'thin', color: { rgb: 'D9D9D9' } },
  bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
  left: { style: 'thin', color: { rgb: 'D9D9D9' } },
  right: { style: 'thin', color: { rgb: 'D9D9D9' } },
};

function setCellStyle(worksheet: XLSX.WorkSheet, cellAddress: string, style: Record<string, unknown>) {
  const cell = worksheet[cellAddress] as SheetCell | undefined;
  if (!cell) return;
  cell.s = { ...(cell.s ?? {}), ...style };
}

function setWorkbookCellFormat(worksheet: XLSX.WorkSheet, cellAddress: string, format: string) {
  const cell = worksheet[cellAddress];
  if (!cell) return;
  cell.z = format;
}

function setSheetValue(worksheet: XLSX.WorkSheet, cellAddress: string, value: string | number, style?: Record<string, unknown>) {
  worksheet[cellAddress] = {
    t: typeof value === 'number' ? 'n' : 's',
    v: value,
    ...(style ? { s: style } : {}),
  } as SheetCell;
  const cell = XLSX.utils.decode_cell(cellAddress);
  const currentRange = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: cell, e: cell };
  currentRange.s.r = Math.min(currentRange.s.r, cell.r);
  currentRange.s.c = Math.min(currentRange.s.c, cell.c);
  currentRange.e.r = Math.max(currentRange.e.r, cell.r);
  currentRange.e.c = Math.max(currentRange.e.c, cell.c);
  worksheet['!ref'] = XLSX.utils.encode_range(currentRange);
}

function getFoodCostStatus(foodCostPercent: number) {
  if (foodCostPercent <= 0.25) return 'Correcto';
  if (foodCostPercent <= 0.3) return 'Revisar';
  return 'Alerta';
}

function getMbeStatus(mbePercent: number) {
  if (mbePercent >= 0.75) return 'Correcto';
  if (mbePercent >= 0.7) return 'Revisar';
  return 'Alerta';
}

function describeFoodCostRisk(foodCostPercent: number) {
  if (foodCostPercent <= 0.25) return `OK: ${percent.format(foodCostPercent)} de 25% max.`;
  return `Sobre meta: ${percent.format(foodCostPercent)} > 25%.`;
}

function describeMbeProgress(mbePercent: number) {
  if (mbePercent >= 0.75) return `OK: ${percent.format(mbePercent)} de 75% min.`;
  return `Bajo meta: ${percent.format(mbePercent)} < 75%.`;
}

function describeShare(value: number, total: number, label: string) {
  const share = total > 0 ? value / total : 0;
  return `${percent.format(share)} del ${label}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type NativeChartSpec = {
  sheetIndex: number;
  title: string;
  type: 'pie' | 'bar' | 'column';
  categoriesRef: string;
  valuesRef: string;
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
};

function getChartXml(spec: NativeChartSpec) {
  const barDirection = spec.type === 'bar' ? 'bar' : 'col';
  const plot =
    spec.type === 'pie'
      ? `<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:cat><c:strRef><c:f>${escapeXml(spec.categoriesRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(spec.valuesRef)}</c:f></c:numRef></c:val></c:ser><c:firstSliceAng val="270"/></c:pieChart>`
      : `<c:barChart><c:barDir val="${barDirection}"/><c:grouping val="clustered"/><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:cat><c:strRef><c:f>${escapeXml(spec.categoriesRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(spec.valuesRef)}</c:f></c:numRef></c:val></c:ser><c:axId val="123456"/><c:axId val="123457"/></c:barChart><c:catAx><c:axId val="123456"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="123457"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="123457"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:numFmt formatCode="$#,##0" sourceLinked="0"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="123456"/><c:crosses val="autoZero"/></c:valAx>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-CL" sz="1200" b="1"/><a:t>${escapeXml(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea><c:legend><c:legendPos val="r"/><c:layout/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function getDrawingXml(chartId: number, spec: NativeChartSpec) {
  const { fromCol, fromRow, toCol, toRow } = spec.anchor;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${chartId}" name="Grafico ${chartId}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
}

function injectNativeCharts(xlsxBytes: Uint8Array, specs: NativeChartSpec[]) {
  const files = unzipSync(xlsxBytes);
  const contentTypesPath = '[Content_Types].xml';
  let contentTypes = strFromU8(files[contentTypesPath]);
  const relNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  specs.forEach((spec, index) => {
    const chartId = index + 1;
    const drawingId = index + 1;
    const sheetPath = `xl/worksheets/sheet${spec.sheetIndex}.xml`;
    const sheetRelPath = `xl/worksheets/_rels/sheet${spec.sheetIndex}.xml.rels`;
    const drawingPath = `xl/drawings/drawing${drawingId}.xml`;
    const drawingRelPath = `xl/drawings/_rels/drawing${drawingId}.xml.rels`;
    const chartPath = `xl/charts/chart${chartId}.xml`;

    files[chartPath] = strToU8(getChartXml(spec));
    files[drawingPath] = strToU8(getDrawingXml(chartId, spec));
    files[drawingRelPath] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relNamespace}/chart" Target="../charts/chart${chartId}.xml"/></Relationships>`);

    const existingRelXml = files[sheetRelPath] ? strFromU8(files[sheetRelPath]) : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const relMatches = Array.from(existingRelXml.matchAll(/Id="rId(\d+)"/g));
    const nextRelId = relMatches.reduce((max, match) => Math.max(max, Number(match[1])), 0) + 1;
    files[sheetRelPath] = strToU8(existingRelXml.replace('</Relationships>', `<Relationship Id="rId${nextRelId}" Type="${relNamespace}/drawing" Target="../drawings/drawing${drawingId}.xml"/></Relationships>`));

    let sheetXml = strFromU8(files[sheetPath]);
    if (!sheetXml.includes('xmlns:r=')) {
      sheetXml = sheetXml.replace('<worksheet ', `<worksheet xmlns:r="${relNamespace}" `);
    }
    const drawingNode = `<drawing r:id="rId${nextRelId}"/>`;
    files[sheetPath] = strToU8(sheetXml.includes('</worksheet>') ? sheetXml.replace('</worksheet>', `${drawingNode}</worksheet>`) : sheetXml);

    if (!contentTypes.includes(`/xl/charts/chart${chartId}.xml`)) {
      contentTypes = contentTypes.replace('</Types>', `<Override PartName="/xl/charts/chart${chartId}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing${drawingId}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    }
  });

  files[contentTypesPath] = strToU8(contentTypes);
  return zipSync(files);
}

function downloadXlsx(workbook: XLSX.WorkBook, fileName: string, charts: NativeChartSpec[]) {
  const raw = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  const enhanced = charts.length > 0 ? injectNativeCharts(new Uint8Array(raw), charts) : new Uint8Array(raw);
  const blob = new Blob([enhanced], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function accumulateReportRecipeIngredients(
  state: StoreState,
  recipeId: string,
  multiplier: number,
  bucket: Record<string, number>,
) {
  const recipe = state.baseRecipes.find((item) => item.id === recipeId);
  if (!recipe) return;

  recipe.items.forEach((item) => {
    const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
    if (!ingredient) return;
    const quantityInPurchaseUnit = convertQuantity(item.quantity * multiplier, item.unit, ingredient.purchaseUnit);
    bucket[ingredient.id] = (bucket[ingredient.id] ?? 0) + quantityInPurchaseUnit;
  });
}

function accumulateReportDishIngredients(
  state: StoreState,
  dishId: string,
  multiplier: number,
  bucket: Record<string, number>,
) {
  const dish = state.dishes.find((item) => item.id === dishId);
  if (!dish) return;

  dish.directItems.forEach((component) => {
    if (component.componentType === 'ingredient') {
      const ingredient = state.ingredients.find((entry) => entry.id === component.refId);
      if (!ingredient) return;
      const quantityInPurchaseUnit = convertQuantity(component.quantity * multiplier, component.unit, ingredient.purchaseUnit);
      bucket[ingredient.id] = (bucket[ingredient.id] ?? 0) + quantityInPurchaseUnit;
      return;
    }

    if (component.componentType === 'baseRecipe') {
      const recipe = state.baseRecipes.find((item) => item.id === component.refId);
      if (!recipe) return;
      const requestedInYieldUnit = convertQuantity(component.quantity, component.unit, recipe.yieldUnit);
      accumulateReportRecipeIngredients(
        state,
        component.refId,
        (requestedInYieldUnit / Math.max(recipe.yieldAmount, 0.001)) * multiplier,
        bucket,
      );
    }
  });
}

function getInventoryPlanningSnapshot(state: StoreState) {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const metrics = getDashboardMetrics(state);
  const currentMonthSalesValue = state.sales
    .filter((sale) => sale.soldAt.slice(0, 7) === currentMonthKey)
    .reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce((saleSum, item) => saleSum + item.quantity * item.unitPrice * (1 - item.discount), 0),
      0,
    );
  const currentMonthUsage: Record<string, number> = {};

  state.sales
    .filter((sale) => sale.soldAt.slice(0, 7) === currentMonthKey)
    .forEach((sale) => {
      sale.items.forEach((item) => {
        accumulateReportDishIngredients(state, item.dishId, item.quantity, currentMonthUsage);
      });
    });

  const usedThisMonthValue = state.ingredients.reduce(
    (sum, ingredient) => sum + (currentMonthUsage[ingredient.id] ?? 0) * ingredient.purchasePrice,
    0,
  );

  const plannedProductionValue = state.ingredients.reduce((sum, ingredient) => {
    const forecast = getIngredientUsageForecast(state, ingredient.id);
    return sum + forecast.plannedUsage * ingredient.purchasePrice;
  }, 0);
  const salesVariationFactor = currentMonthSalesValue > 0
    ? metrics.monthlyProjection / currentMonthSalesValue
    : 1;
  const nextMonthRequiredValue = usedThisMonthValue * salesVariationFactor + plannedProductionValue;

  const inventoryValue = state.ingredients.reduce(
    (sum, ingredient) => sum + ingredient.currentStock * ingredient.purchasePrice,
    0,
  );
  const netAvailableForNextMonth = inventoryValue - nextMonthRequiredValue;
  const purchaseGapForNextMonth = Math.max(nextMonthRequiredValue - inventoryValue, 0);

  return {
    currentMonthSalesValue,
    usedThisMonthValue,
    nextMonthRequiredValue,
    inventoryValue,
    netAvailableForNextMonth,
    purchaseGapForNextMonth,
  };
}

function exportMenuEngineeringExcel(state: StoreState) {
  const items = getMenuEngineering(state);
  const metrics = getDashboardMetrics(state);
  const exportBusinessName = 'Delicias del Mar';
  const headerRow = 11;
  const firstDataRow = headerRow + 1;
  const lastDataRow = firstDataRow + Math.max(items.length - 1, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.unitsSold, 0);
  const realMonthRevenue = items.reduce((sum, item) => sum + item.unitsSold * getEngineeringExportPrice(item), 0);
  const totalRevenue = realMonthRevenue;
  const totalFoodCost = items.reduce((sum, item) => sum + item.unitsSold * (item.result.materialCost + item.result.wasteCost), 0);
  const totalRealCost = items.reduce((sum, item) => sum + item.unitsSold * item.result.totalCost, 0);
  const totalMbe = totalRevenue - totalFoodCost;
  const totalContributionBeforeStructure = totalRevenue - totalRealCost;
  const projectedRealProfitAfterVat = metrics.projectedRealProfitAfterVat;
  const totalMonthlyStructure = state.business.fixedCostsMonthly +
    state.indirectCosts.reduce((sum, item) => sum + getMonthlyCostAmount(item), 0) +
    calculateTotalMonthlyLaborCost(state);
  const projectedProfitBeforeVat = totalContributionBeforeStructure - totalMonthlyStructure;
  const projectedVatDebit = metrics.projectedVatDebit;
  const projectedVatCredit = metrics.projectedVatCredit;
  const projectedVatPayable = metrics.projectedVatPayable;
  const currentFoodCostPercent = totalRevenue > 0 ? totalFoodCost / totalRevenue : 0;
  const currentMbePercent = totalRevenue > 0 ? totalMbe / totalRevenue : 0;
  const currentContributionPercent = totalRevenue > 0 ? totalContributionBeforeStructure / totalRevenue : 0;
  const projectedRealProfitAfterVatPercent = totalRevenue > 0 ? projectedRealProfitAfterVat / totalRevenue : 0;

  const detailRows = items.map((item) => {
    const finalPrice = getEngineeringExportPrice(item);
    const foodCost = item.result.materialCost + item.result.wasteCost;
    const categoryName = state.categories.find((category) => category.id === item.dish.categoryId)?.name ?? 'Sin categoria';
    return {
      categoryName,
      finalPrice,
      foodCost,
      values: [
        item.dish.name,
        categoryName,
        item.unitsSold,
        0,
        foodCost,
        0,
        finalPrice,
        0,
        0,
        0,
        item.result.totalCost,
        0,
        0,
        item.quadrant,
      ],
    };
  });

  const worksheetData: Array<Array<string | number>> = [
    [`Ingenieria de Menu - ${exportBusinessName}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Venta total corresponde a venta real del mes. La contribucion antes estructura no es utilidad final; utilidad post IVA descuenta estructura e IVA.', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Venta real del mes', 'Food cost total', 'Food cost %', 'MBE total', 'MBE %', 'Unidades vendidas', 'Costo total platos', 'Contribucion antes estructura', 'Contribucion %', 'Utilidad post IVA reporte', 'Utilidad post IVA %'],
    [totalRevenue, totalFoodCost, currentFoodCostPercent, totalMbe, currentMbePercent, totalUnits, totalRealCost, totalContributionBeforeStructure, currentContributionPercent, projectedRealProfitAfterVat, projectedRealProfitAfterVatPercent],
    [],
    ['Puente utilidad real', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Venta real del mes', 'Costo total platos', 'Contribucion antes estructura', 'Estructura mensual', 'Utilidad antes IVA', 'IVA debito', 'IVA credito', 'IVA neto a pagar', 'Utilidad real post IVA'],
    [totalRevenue, totalRealCost, totalContributionBeforeStructure, totalMonthlyStructure, projectedProfitBeforeVat, projectedVatDebit, projectedVatCredit, projectedVatPayable, projectedRealProfitAfterVat],
    [],
    ['Detalle por plato', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Receta', 'Categoria', 'U vendidas', '% pop', 'Food cost $', 'Food cost %', 'Precio cliente', 'MBE $', 'MBE %', 'Rendimiento MBE', 'Costo total $', 'Contribucion %', 'Ventas realizadas', 'Clasificacion'],
    ...(detailRows.length > 0 ? detailRows.map((row) => row.values) : [['Sin platos registrados', 'Sin categoria', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Sin datos']]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 14 } },
    { s: { r: 10, c: 0 }, e: { r: 10, c: 14 } },
  ];
  worksheet['!cols'] = [
    { wch: 36 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 15 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ];
  worksheet['!autofilter'] = { ref: `A${headerRow + 1}:N${Math.max(lastDataRow + 1, headerRow + 2)}` };

  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 18 },
    fill: { fgColor: { rgb: '7A271F' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const subtitleStyle = {
    font: { color: { rgb: '5F5F5F' } },
    fill: { fgColor: { rgb: 'FFF4E6' } },
  };
  const darkHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '2B2B2B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderStyle,
  };
  const sectionStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '9D3A2F' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const kpiValueStyle = {
    font: { bold: true, sz: 13 },
    fill: { fgColor: { rgb: 'F6E7D6' } },
    border: borderStyle,
  };
  const tableCellStyle = {
    border: borderStyle,
    alignment: { vertical: 'center' },
  };
  const percentOkStyle = {
    ...tableCellStyle,
    font: { bold: true, color: { rgb: '0B7A22' } },
    fill: { fgColor: { rgb: 'EAF6E8' } },
  };
  const percentDangerStyle = {
    ...tableCellStyle,
    font: { bold: true, color: { rgb: '8A1C12' } },
    fill: { fgColor: { rgb: 'FCE4DF' } },
  };
  const classOkStyle = {
    ...tableCellStyle,
    font: { bold: true, color: { rgb: '0B7A22' } },
    fill: { fgColor: { rgb: 'DDF3DF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const classWarnStyle = {
    ...tableCellStyle,
    font: { bold: true, color: { rgb: 'A24400' } },
    fill: { fgColor: { rgb: 'FFF2CC' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const classDangerStyle = {
    ...tableCellStyle,
    font: { bold: true, color: { rgb: '8A1C12' } },
    fill: { fgColor: { rgb: 'F7D7D2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const chartExplanationStyle = {
    font: { italic: true, color: { rgb: '5F5F5F' } },
    fill: { fgColor: { rgb: 'FFF4E6' } },
    alignment: { wrapText: true, vertical: 'top' },
    border: borderStyle,
  };

  const appendStyledSheet = (
    sheetName: string,
    data: Array<Array<string | number>>,
    widths: number[],
    options: { filter?: boolean; moneyColumns?: number[]; percentColumns?: number[]; titleRows?: number[]; headerRows?: number[] } = {},
  ) => {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    const lastCol = Math.max(...data.map((row) => row.length), 1) - 1;
    if (options.filter && data.length > 1) {
      sheet['!autofilter'] = { ref: `${XLSX.utils.encode_col(0)}1:${XLSX.utils.encode_col(lastCol)}${data.length}` };
    }
    data.forEach((row, rowIndex) => {
      row.forEach((_, colIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        setCellStyle(sheet, address, rowIndex === 0 || options.headerRows?.includes(rowIndex) ? darkHeaderStyle : tableCellStyle);
        if (options.moneyColumns?.includes(colIndex) && rowIndex > 0) setWorkbookCellFormat(sheet, address, '$#,##0');
        if (options.percentColumns?.includes(colIndex) && rowIndex > 0) setWorkbookCellFormat(sheet, address, '0.0%');
      });
    });
    options.titleRows?.forEach((rowIndex) => {
      for (let colIndex = 0; colIndex <= lastCol; colIndex += 1) {
        setCellStyle(sheet, XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }), sectionStyle);
      }
    });
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    return sheet;
  };

  const categorySummary = Array.from(
    detailRows.reduce((map, row, index) => {
      const item = items[index];
      const current = map.get(row.categoryName) ?? {
        units: 0,
        sales: 0,
        foodCost: 0,
        mbe: 0,
        dishes: 0,
      };
      current.units += item.unitsSold;
      current.sales += item.unitsSold * row.finalPrice;
      current.foodCost += item.unitsSold * row.foodCost;
      current.mbe += item.unitsSold * (row.finalPrice - row.foodCost);
      current.dishes += 1;
      map.set(row.categoryName, current);
      return map;
    }, new Map<string, { units: number; sales: number; foodCost: number; mbe: number; dishes: number }>()),
  ).map(([category, values]) => {
    const foodCostPercent = values.sales > 0 ? values.foodCost / values.sales : 0;
    const mbePercent = values.sales > 0 ? values.mbe / values.sales : 0;
    return [
      category,
      values.dishes,
      values.units,
      values.sales,
      describeShare(values.sales, totalRevenue, 'total de ventas'),
      values.foodCost,
      foodCostPercent,
      getFoodCostStatus(foodCostPercent),
      values.mbe,
      mbePercent,
      getMbeStatus(mbePercent),
    ];
  });

  const visualPanelSheet = appendStyledSheet('Panel Visual', [
    [`Panel Visual - ${exportBusinessName}`, '', '', '', '', '', ''],
    ['Indicador', 'Valor', 'Meta', 'Lectura visual', 'Estado', 'Que significa', 'Accion sugerida'],
    ['Venta total', totalRevenue, 'Mayor es mejor', 'Base para medir food cost y MBE.', totalRevenue > 0 ? 'Con ventas' : 'Sin ventas', 'Venta valorizada con precio cliente actual.', 'Revisar ventas si aparece en cero.'],
    ['Food cost %', currentFoodCostPercent, '<= 25%', describeFoodCostRisk(currentFoodCostPercent), currentFoodCostPercent <= 0.25 ? 'Correcto' : 'Alerta', 'Materia prima / precio cliente.', 'Si supera 25%, ajustar gramaje, rendimiento o precio.'],
    ['MBE %', currentMbePercent, '>= 75%', describeMbeProgress(currentMbePercent), currentMbePercent >= 0.75 ? 'Correcto' : 'Alerta', 'Precio cliente menos food cost.', 'Debe mantenerse sobre 75%.'],
    ['Utilidad real', totalRevenue - totalFoodCost, 'Mayor es mejor', describeShare(totalRevenue - totalFoodCost, totalRevenue, 'total de ventas'), totalRevenue > totalFoodCost ? 'Positiva' : 'Negativa', 'Venta menos food cost.', 'Corregir platos con MBE bajo.'],
    [],
    ['Ranking visual por plato', '', '', '', '', '', ''],
    ['Plato', 'Categoria', 'U vendidas', 'Venta visual', 'Food cost %', 'MBE %', 'Clasificacion'],
    ...items
      .slice()
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .map((item) => {
        const row = detailRows[items.indexOf(item)];
        const dishRevenue = item.unitsSold * row.finalPrice;
        return [
          item.dish.name,
          row.categoryName,
          item.unitsSold,
          describeShare(dishRevenue, totalRevenue, 'total de ventas'),
          row.finalPrice > 0 ? row.foodCost / row.finalPrice : 0,
          row.finalPrice > 0 ? (row.finalPrice - row.foodCost) / row.finalPrice : 0,
          item.quadrant,
        ];
      }),
  ], [34, 18, 13, 24, 14, 36, 42], { titleRows: [0, 7], headerRows: [1, 8] });
  ['B3', 'B6'].forEach((cellAddress) => setWorkbookCellFormat(visualPanelSheet, cellAddress, '$#,##0'));
  ['B4', 'B5'].forEach((cellAddress) => setWorkbookCellFormat(visualPanelSheet, cellAddress, '0.0%'));
  for (let row = 2; row <= 5; row += 1) {
    const status = String(visualPanelSheet[XLSX.utils.encode_cell({ r: row, c: 4 })]?.v ?? '');
    setCellStyle(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 4 }), status === 'Alerta' || status === 'Negativa' ? classDangerStyle : classOkStyle);
  }
  for (let row = 9; row < 9 + items.length; row += 1) {
    const foodCostCell = visualPanelSheet[XLSX.utils.encode_cell({ r: row, c: 4 })];
    const mbeCell = visualPanelSheet[XLSX.utils.encode_cell({ r: row, c: 5 })];
    const classCell = visualPanelSheet[XLSX.utils.encode_cell({ r: row, c: 6 })];
    const foodCostValue = Number(foodCostCell?.v ?? 0);
    const mbeValue = Number(mbeCell?.v ?? 0);
    const classValue = String(classCell?.v ?? '');
    setWorkbookCellFormat(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 4 }), '0.0%');
    setWorkbookCellFormat(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 5 }), '0.0%');
    setCellStyle(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 4 }), foodCostValue > 0.25 ? percentDangerStyle : percentOkStyle);
    setCellStyle(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 5 }), mbeValue < 0.75 ? percentDangerStyle : percentOkStyle);
    setCellStyle(visualPanelSheet, XLSX.utils.encode_cell({ r: row, c: 6 }), classValue === 'Estrella' ? classOkStyle : classValue === 'Ajustar' ? classDangerStyle : classWarnStyle);
  }


  const executiveSheet = appendStyledSheet('Resumen Ejecutivo', [
    ['Indicador', 'Valor', 'Meta', 'Lectura didactica', 'Estado', 'Lectura'],
    ['Venta valorizada precio carta', totalRevenue, 'Mayor es mejor', 'Base de comparacion para todo el analisis.', totalRevenue > 0 ? 'Con ventas' : 'Sin ventas', 'Unidades reales vendidas valorizadas al precio cliente actual.'],
    ['Food cost total', totalFoodCost, 'Controlado', describeShare(totalFoodCost, totalRevenue, 'total de ventas'), getFoodCostStatus(currentFoodCostPercent), 'Materia prima total de recetas base + receta final.'],
    ['Food cost %', currentFoodCostPercent, '<= 25%', describeFoodCostRisk(currentFoodCostPercent), getFoodCostStatus(currentFoodCostPercent), currentFoodCostPercent <= 0.25 ? 'Dentro del maximo 25%.' : 'Sobre el maximo 25%, requiere ajuste.'],
    ['MBE total', totalMbe, 'Mayor es mejor', describeShare(totalMbe, totalRevenue, 'total de ventas'), totalMbe > 0 ? 'Positivo' : 'Negativo', 'Precio cliente menos food cost.'],
    ['MBE %', currentMbePercent, '>= 75%', describeMbeProgress(currentMbePercent), getMbeStatus(currentMbePercent), currentMbePercent >= 0.75 ? 'Cumple minimo 75%.' : 'Bajo minimo 75%, revisar precios/costos.'],
    ['Unidades vendidas', totalUnits, 'Mayor es mejor', `${totalUnits} unidades reales registradas.`, totalUnits > 0 ? 'Con ventas' : 'Sin ventas', 'Suma de unidades reales por plato.'],
    ['Platos analizados', items.length, 'Cobertura menu', `${items.length} platos finales incluidos.`, items.length > 0 ? 'Con datos' : 'Sin datos', 'Platos finales incluidos en ingenieria de menu.'],
  ], [34, 18, 16, 24, 14, 58]);
  ['B2', 'B3', 'B5'].forEach((cellAddress) => setWorkbookCellFormat(executiveSheet, cellAddress, '$#,##0'));
  ['B4', 'B6'].forEach((cellAddress) => setWorkbookCellFormat(executiveSheet, cellAddress, '0.0%'));
  for (let row = 2; row <= 8; row += 1) {
    const status = String(executiveSheet[`E${row}`]?.v ?? '');
    setCellStyle(executiveSheet, `E${row}`, status === 'Alerta' || status === 'Negativo' ? classDangerStyle : status === 'Revisar' ? classWarnStyle : classOkStyle);
  }

  const categorySheet = appendStyledSheet('Resumen Categorias', [
    ['Categoria', 'Platos', 'U vendidas', 'Cifra negocio', 'Peso ventas', 'Food cost total', 'Food cost %', 'Estado FC', 'MBE total', 'MBE %', 'Estado MBE'],
    ...categorySummary,
  ], [22, 10, 12, 16, 24, 16, 12, 12, 16, 12, 12], { filter: true, moneyColumns: [3, 5, 8], percentColumns: [6, 9] });
  for (let row = 2; row <= categorySummary.length + 1; row += 1) {
    const fcStatus = String(categorySheet[`H${row}`]?.v ?? '');
    const mbeStatus = String(categorySheet[`K${row}`]?.v ?? '');
    setCellStyle(categorySheet, `H${row}`, fcStatus === 'Alerta' ? classDangerStyle : fcStatus === 'Revisar' ? classWarnStyle : classOkStyle);
    setCellStyle(categorySheet, `K${row}`, mbeStatus === 'Alerta' ? classDangerStyle : mbeStatus === 'Revisar' ? classWarnStyle : classOkStyle);
  }


  const costSheet = appendStyledSheet('Costos por Plato', [
    ['Plato', 'Categoria', 'Materia prima neta', 'Merma rendimiento', 'Food cost total', 'Lectura FC', 'Recetas base', 'Packaging', 'MO final', 'Indirectos', 'Costo total', 'Precio cliente', 'Food cost %', 'Estado FC', 'MBE %', 'Estado MBE', 'Margen real %'],
    ...items.map((item) => {
      const row = detailRows[items.indexOf(item)];
      const finalPrice = row.finalPrice;
      const foodCost = row.foodCost;
      const yieldWaste = item.result.yieldWasteCost;
      const foodCostPercent = finalPrice > 0 ? foodCost / finalPrice : 0;
      const mbePercent = finalPrice > 0 ? (finalPrice - foodCost) / finalPrice : 0;
      return [
        item.dish.name,
        row.categoryName,
        Math.max(item.result.materialCost - yieldWaste, 0),
        yieldWaste,
        foodCost,
        describeFoodCostRisk(foodCostPercent),
        item.result.baseRecipeCost,
        item.result.packagingCost,
        item.result.laborCost,
        item.result.indirectCost,
        item.result.totalCost,
        finalPrice,
        foodCostPercent,
        getFoodCostStatus(foodCostPercent),
        mbePercent,
        getMbeStatus(mbePercent),
        finalPrice > 0 ? (finalPrice - item.result.totalCost) / finalPrice : 0,
      ];
    }),
  ], [34, 18, 16, 16, 16, 20, 14, 12, 12, 12, 14, 14, 12, 12, 12, 12, 12], { filter: true, moneyColumns: [2, 3, 4, 6, 7, 8, 9, 10, 11], percentColumns: [12, 14, 16] });
  for (let row = 2; row <= items.length + 1; row += 1) {
    const fcStatus = String(costSheet[`N${row}`]?.v ?? '');
    const mbeStatus = String(costSheet[`P${row}`]?.v ?? '');
    setCellStyle(costSheet, `N${row}`, fcStatus === 'Alerta' ? classDangerStyle : fcStatus === 'Revisar' ? classWarnStyle : classOkStyle);
    setCellStyle(costSheet, `P${row}`, mbeStatus === 'Alerta' ? classDangerStyle : mbeStatus === 'Revisar' ? classWarnStyle : classOkStyle);
  }
  setSheetValue(
    costSheet,
    `A${items.length + 26}`,
    'Lectura del grafico: compara el costo total por plato. Los platos con barras mas largas consumen mas recursos y deben auditarse primero en receta, rendimiento y mano de obra.',
    chartExplanationStyle,
  );

  const salesRows = state.sales.flatMap((sale) =>
    sale.items.flatMap((saleItem) => {
      const dish = state.dishes.find((candidate) => candidate.id === saleItem.dishId);
      if (!dish) return [];
      const result = calculateDishCost(state, dish);
      const finalPrice = dish.customerFacingPrice && dish.customerFacingPrice > 0 ? dish.customerFacingPrice : result.recommendedPrice;
      const foodCost = result.materialCost + result.wasteCost;
      const categoryName = state.categories.find((category) => category.id === dish.categoryId)?.name ?? 'Sin categoria';
      const foodCostPercent = finalPrice > 0 ? foodCost / finalPrice : 0;
      const mbePercent = finalPrice > 0 ? (finalPrice - foodCost) / finalPrice : 0;
      return [[
        sale.soldAt,
        sale.channel,
        dish.name,
        categoryName,
        saleItem.quantity,
        saleItem.unitPrice,
        finalPrice,
        saleItem.quantity * finalPrice,
        saleItem.quantity * foodCost,
        saleItem.quantity * (finalPrice - foodCost),
        describeShare(saleItem.quantity * finalPrice, totalRevenue, 'total de ventas'),
        foodCostPercent,
        getFoodCostStatus(foodCostPercent),
        mbePercent,
        getMbeStatus(mbePercent),
      ]];
    }),
  );
  const salesSheet = appendStyledSheet('Ventas Valorizadas', [
    ['Fecha', 'Canal', 'Plato', 'Categoria', 'U vendidas', 'Precio historico', 'Precio carta actual', 'Venta valorizada', 'Food cost total', 'MBE total', 'Peso venta', 'Food cost %', 'Estado FC', 'MBE %', 'Estado MBE'],
    ...salesRows,
  ], [13, 14, 34, 18, 12, 15, 17, 17, 16, 16, 22, 12, 12, 12, 12], { filter: true, moneyColumns: [5, 6, 7, 8, 9], percentColumns: [11, 13] });
  for (let row = 2; row <= salesRows.length + 1; row += 1) {
    const fcStatus = String(salesSheet[`M${row}`]?.v ?? '');
    const mbeStatus = String(salesSheet[`O${row}`]?.v ?? '');
    setCellStyle(salesSheet, `M${row}`, fcStatus === 'Alerta' ? classDangerStyle : fcStatus === 'Revisar' ? classWarnStyle : classOkStyle);
    setCellStyle(salesSheet, `O${row}`, mbeStatus === 'Alerta' ? classDangerStyle : mbeStatus === 'Revisar' ? classWarnStyle : classOkStyle);
  }
  setSheetValue(
    salesSheet,
    `A${salesRows.length + 24}`,
    'Lectura del grafico: compara la venta valorizada por canal. Sirve para decidir donde enfocar promociones, dotacion y compras segun el canal que genera mas venta.',
    chartExplanationStyle,
  );
  const channelSales = Array.from(
    state.sales.reduce((map, sale) => {
      const saleTotal = sale.items.reduce((sum, saleItem) => {
        const dish = state.dishes.find((candidate) => candidate.id === saleItem.dishId);
        if (!dish) return sum;
        const result = calculateDishCost(state, dish);
        const finalPrice = dish.customerFacingPrice && dish.customerFacingPrice > 0 ? dish.customerFacingPrice : result.recommendedPrice;
        return sum + saleItem.quantity * finalPrice;
      }, 0);
      map.set(sale.channel, (map.get(sale.channel) ?? 0) + saleTotal);
      return map;
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value }));

  const componentSheetRows: Array<Array<string | number>> = [];
  const componentTitleRows: number[] = [];
  const componentHeaderRows: number[] = [];

  items.forEach((item) => {
    const row = detailRows[items.indexOf(item)];
    componentTitleRows.push(componentSheetRows.length);
    componentSheetRows.push([`Plato: ${item.dish.name}`, '', '', '', '', '', '', '', '', '', '', '']);
    componentSheetRows.push([
      'Categoria',
      row.categoryName,
      'Precio cliente',
      money.format(row.finalPrice),
      'Food cost',
      money.format(row.foodCost),
      'Food cost %',
      percent.format(row.finalPrice > 0 ? row.foodCost / row.finalPrice : 0),
      'MBE %',
      percent.format(row.finalPrice > 0 ? (row.finalPrice - row.foodCost) / row.finalPrice : 0),
      '',
      '',
    ]);
    componentHeaderRows.push(componentSheetRows.length);
    componentSheetRows.push(['Tipo componente', 'Componente', 'Cantidad', 'Unidad', 'Costo MP bruto', 'Ajuste rendimiento', 'Costo unitario util', 'Costo linea final', 'Receta base origen', 'Peso en costo', 'Lectura', '']);
    item.result.componentLines.forEach((line) => {
      const grossLineCost = Math.max(line.lineCost - line.yieldWasteCost, 0);
      componentSheetRows.push([
        line.componentType === 'baseRecipe' ? 'Receta base' : line.componentType === 'packaging' ? 'Packaging' : 'Ingrediente directo',
        line.componentName,
        line.quantity,
        line.unit,
        grossLineCost,
        line.yieldWasteCost,
        line.unitCost,
        line.lineCost,
        '',
        describeShare(line.lineCost, item.result.totalCost, 'costo total del plato'),
        line.yieldWasteCost > 0 ? 'Costo linea final = MP bruto + ajuste por rendimiento' : 'Costo linea final sin ajuste por rendimiento',
        '',
      ]);
      (line.nestedLines ?? []).forEach((nestedLine) => {
        const nestedGrossLineCost = Math.max(nestedLine.lineCost - nestedLine.yieldWasteCost, 0);
        componentSheetRows.push([
        'Ingrediente dentro receta base',
        nestedLine.ingredientName,
        nestedLine.quantity,
        nestedLine.unit,
        nestedGrossLineCost,
        nestedLine.yieldWasteCost,
        nestedLine.usefulUnitCost,
        nestedLine.lineCost,
        line.componentName,
          describeShare(nestedLine.lineCost, item.result.totalCost, 'costo total del plato'),
          nestedLine.yieldWasteCost > 0 ? 'Costo linea final = MP bruto + ajuste por rendimiento' : 'Costo linea final sin ajuste por rendimiento',
          '',
        ]);
      });
    });
    componentSheetRows.push([]);
  });
  appendStyledSheet('Componentes y Recetas', [
    ['Componentes y Recetas por Plato', '', '', '', '', '', '', '', '', '', '', ''],
    ['Cada plato esta separado en su propia tabla. El costo linea final ya incluye el rendimiento: costo MP bruto + ajuste rendimiento. No se suma dos veces.', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ...componentSheetRows,
  ], [28, 32, 12, 11, 16, 18, 16, 16, 28, 20, 44, 4], {
    titleRows: [0, ...componentTitleRows.map((rowIndex) => rowIndex + 3)],
    headerRows: componentHeaderRows.map((rowIndex) => rowIndex + 3),
    moneyColumns: [4, 5, 6, 7],
  });

  const rulesSheet = appendStyledSheet('Reglas y Validaciones', [
    ['Regla', 'Criterio', 'Semaforo', 'Accion esperada', 'Lectura didactica'],
    ['Food cost', 'Food cost % <= 25%', getFoodCostStatus(currentFoodCostPercent), 'Si supera 25%, ajustar receta, gramaje, rendimiento o precio.', describeFoodCostRisk(currentFoodCostPercent)],
    ['MBE', 'MBE % >= 75%', getMbeStatus(currentMbePercent), 'Si baja de 75%, revisar precio cliente o materia prima.', describeMbeProgress(currentMbePercent)],
    ['Clasificacion Estrella', 'MBE alto y popularidad alta', 'Correcto', 'Mantener posicion y proteger calidad.', 'Alta rentabilidad + alta venta'],
    ['Clasificacion Vaca', 'MBE bajo y popularidad alta', 'Revisar', 'Subir precio o bajar food cost sin perder venta.', 'Alta venta + rentabilidad ajustada'],
    ['Clasificacion Enigma', 'MBE alto y popularidad baja', 'Revisar', 'Mejorar visibilidad y venta sugerida.', 'Buena rentabilidad + baja venta'],
    ['Clasificacion Ajustar', 'MBE bajo y popularidad baja', 'Alerta', 'No impulsar hasta corregir rentabilidad.', 'Baja venta + baja rentabilidad'],
    ['Precio usado', 'Precio cliente actual', 'Correcto', 'Las ventas se valorizan al precio carta actual para alinear dashboard y Excel.', 'Evita diferencias por precios antiguos'],
    ['Ajuste rendimiento', 'Costo util - costo bruto de compra', 'Correcto', 'Es un desglose explicativo. El costo linea final ya incluye este ajuste; no se vuelve a sumar en otra columna.', 'Ej: $9.990/kg, 82% rendimiento, 180 g = $1.798 bruto + $395 ajuste = $2.193 final'],
  ], [28, 34, 14, 70, 32], { filter: true });
  for (let row = 2; row <= 9; row += 1) {
    const status = String(rulesSheet[`C${row}`]?.v ?? '');
    setCellStyle(rulesSheet, `C${row}`, status === 'Alerta' ? classDangerStyle : status === 'Revisar' ? classWarnStyle : classOkStyle);
  }

  appendStyledSheet('Datos para Graficos', [
    ['Datos limpios para crear graficos reales en Excel', '', '', '', '', ''],
    ['Uso recomendado', 'Selecciona cada bloque y usa Insertar > Grafico. Estos datos evitan dibujos falsos con celdas.', '', '', '', ''],
    [],
    ['Grafico sugerido: Dona o circular', 'Valor', 'Lectura', '', '', ''],
    ['Food cost', totalFoodCost, describeFoodCostRisk(currentFoodCostPercent), '', '', ''],
    ['MBE', totalMbe, describeMbeProgress(currentMbePercent), '', '', ''],
    [],
    ['Grafico sugerido: Columnas por categoria', 'Venta', 'Food cost', 'MBE', 'Food cost %', 'MBE %'],
    ...categorySummary.map((row) => [row[0], row[3], row[5], row[8], row[6], row[9]]),
    [],
    ['Grafico sugerido: Dispersion por plato', 'Food cost %', 'MBE %', 'Unidades vendidas', 'Clasificacion', 'Categoria'],
    ...items.map((item) => {
      const row = detailRows[items.indexOf(item)];
      const foodCostPercent = row.finalPrice > 0 ? row.foodCost / row.finalPrice : 0;
      const mbePercent = row.finalPrice > 0 ? (row.finalPrice - row.foodCost) / row.finalPrice : 0;
      return [item.dish.name, foodCostPercent, mbePercent, item.unitsSold, item.quadrant, row.categoryName];
    }),
    [],
    ['Grafico sugerido: Columnas por canal', 'Venta valorizada', '', '', '', ''],
    ...channelSales.map((row) => [row.label, row.value, '', '', '', '']),
    [],
    ['Grafico sugerido: Barras horizontales por plato', 'Costo total', 'Food cost', 'Precio cliente', 'MBE', 'Unidades'],
    ...items.map((item) => {
      const row = detailRows[items.indexOf(item)];
      return [item.dish.name, item.result.totalCost, row.foodCost, row.finalPrice, row.finalPrice - row.foodCost, item.unitsSold];
    }),
  ], [42, 18, 18, 18, 16, 18], {
    titleRows: [0, 3, 7, 9 + categorySummary.length, 11 + categorySummary.length + items.length, 13 + categorySummary.length + items.length + channelSales.length],
    headerRows: [3, 7, 9 + categorySummary.length, 11 + categorySummary.length + items.length, 13 + categorySummary.length + items.length + channelSales.length],
  });

  setCellStyle(worksheet, 'A1', titleStyle);
  setCellStyle(worksheet, 'A2', subtitleStyle);
  for (let col = 0; col < 11; col += 1) {
    setCellStyle(worksheet, XLSX.utils.encode_cell({ r: 3, c: col }), darkHeaderStyle);
    setCellStyle(worksheet, XLSX.utils.encode_cell({ r: 4, c: col }), col === 2 || col === 4 || col === 8 || col === 10 ? {
      ...kpiValueStyle,
      font: { bold: true, sz: 13, color: { rgb: (col === 2 ? currentFoodCostPercent <= 0.25 : col === 4 ? currentMbePercent >= 0.75 : col === 8 ? currentContributionPercent > 0 : projectedRealProfitAfterVatPercent > 0) ? '0B7A22' : '8A1C12' } },
      fill: { fgColor: { rgb: (col === 2 ? currentFoodCostPercent <= 0.25 : col === 4 ? currentMbePercent >= 0.75 : col === 8 ? currentContributionPercent > 0 : projectedRealProfitAfterVatPercent > 0) ? 'DDF3DF' : 'F7D7D2' } },
    } : kpiValueStyle);
  }
  setCellStyle(worksheet, 'A7', sectionStyle);
  setCellStyle(worksheet, 'A11', sectionStyle);
  for (let col = 0; col < 9; col += 1) {
    setCellStyle(worksheet, XLSX.utils.encode_cell({ r: 7, c: col }), darkHeaderStyle);
    const valueAddress = XLSX.utils.encode_cell({ r: 8, c: col });
    const isPositiveResult = col === 2 || col === 4 || col === 8;
    const isCostOrTax = col === 1 || col === 3 || col === 5 || col === 7;
    setCellStyle(
      worksheet,
      valueAddress,
      isPositiveResult
          ? percentOkStyle
          : isCostOrTax
            ? percentDangerStyle
            : kpiValueStyle,
    );
  }
  for (let col = 0; col < 14; col += 1) {
    setCellStyle(worksheet, XLSX.utils.encode_cell({ r: headerRow, c: col }), darkHeaderStyle);
  }

  detailRows.forEach((_, index) => {
    const excelRow = firstDataRow + index + 1;
    worksheet[`D${excelRow}`] = { t: 'n', f: `IF(SUM($C$${firstDataRow + 1}:$C$${lastDataRow + 1})=0,0,C${excelRow}/SUM($C$${firstDataRow + 1}:$C$${lastDataRow + 1}))`, z: '0.0%' };
    worksheet[`F${excelRow}`] = { t: 'n', f: `IF(G${excelRow}=0,0,E${excelRow}/G${excelRow})`, z: '0.0%' };
    worksheet[`H${excelRow}`] = { t: 'n', f: `G${excelRow}-E${excelRow}`, z: '$#,##0' };
    worksheet[`I${excelRow}`] = { t: 'n', f: `IF(G${excelRow}=0,0,H${excelRow}/G${excelRow})`, z: '0.0%' };
    worksheet[`J${excelRow}`] = { t: 'n', f: `C${excelRow}*H${excelRow}`, z: '$#,##0' };
    worksheet[`L${excelRow}`] = { t: 'n', f: `IF(G${excelRow}=0,0,(G${excelRow}-K${excelRow})/G${excelRow})`, z: '0.0%' };
    worksheet[`M${excelRow}`] = { t: 'n', f: `C${excelRow}*G${excelRow}`, z: '$#,##0' };
  });

  ['A5', 'B5', 'D5', 'G5', 'H5', 'J5'].forEach((cellAddress) => {
    if (worksheet[cellAddress]) worksheet[cellAddress].z = '$#,##0';
  });
  ['C5', 'E5', 'I5', 'K5'].forEach((cellAddress) => {
    if (worksheet[cellAddress]) worksheet[cellAddress].z = '0.0%';
  });
  ['A9', 'B9', 'C9', 'D9', 'E9', 'F9', 'G9', 'H9', 'I9'].forEach((cellAddress) => {
    if (worksheet[cellAddress]) worksheet[cellAddress].z = '$#,##0';
  });
  for (let row = firstDataRow + 1; row <= lastDataRow + 1; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      setCellStyle(worksheet, XLSX.utils.encode_cell({ r: row - 1, c: col }), tableCellStyle);
    }
    ['D', 'F', 'I', 'L'].forEach((column) => {
      const cell = worksheet[`${column}${row}`];
      if (cell) cell.z = '0.0%';
    });
    ['E', 'G', 'H', 'J', 'K', 'M'].forEach((column) => {
      const cell = worksheet[`${column}${row}`];
      if (cell) cell.z = '$#,##0';
    });
    const foodCostPercent = Number(worksheet[`F${row}`]?.v ?? detailRows[row - firstDataRow - 1]?.foodCost / Math.max(detailRows[row - firstDataRow - 1]?.finalPrice ?? 0, 1));
    setCellStyle(worksheet, `F${row}`, foodCostPercent > 0.25 ? percentDangerStyle : percentOkStyle);
    const mbePercent = ((detailRows[row - firstDataRow - 1]?.finalPrice ?? 0) - (detailRows[row - firstDataRow - 1]?.foodCost ?? 0)) / Math.max(detailRows[row - firstDataRow - 1]?.finalPrice ?? 0, 1);
    setCellStyle(worksheet, `I${row}`, mbePercent < 0.75 ? percentDangerStyle : percentOkStyle);
    const realMarginPercent = ((detailRows[row - firstDataRow - 1]?.finalPrice ?? 0) - (items[row - firstDataRow - 1]?.result.totalCost ?? 0)) / Math.max(detailRows[row - firstDataRow - 1]?.finalPrice ?? 0, 1);
    setCellStyle(worksheet, `L${row}`, realMarginPercent < 0 ? percentDangerStyle : percentOkStyle);
    const classValue = String(worksheet[`N${row}`]?.v ?? '');
    setCellStyle(worksheet, `N${row}`, classValue === 'Estrella' ? classOkStyle : classValue === 'Ajustar' ? classDangerStyle : classWarnStyle);
  }

  const utilityNoteRow = lastDataRow + 4;
  worksheet['!merges'] = [
    ...(worksheet['!merges'] ?? []),
    { s: { r: utilityNoteRow - 1, c: 0 }, e: { r: utilityNoteRow - 1, c: 13 } },
  ];
  setSheetValue(
    worksheet,
    `A${utilityNoteRow}`,
    'Utilidad real = contribucion antes estructura - estructura mensual - IVA neto. La contribucion antes estructura no es utilidad final.',
    chartExplanationStyle,
  );

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ingenieria Menu');

  const costSheetName = quoteSheetName('Costos por Plato');
  const chartSpecs: NativeChartSpec[] = [
 
    {
      sheetIndex: 4,
      title: 'Costo total por plato',
      type: 'bar',
      categoriesRef: `${costSheetName}!$A$2:$A$${items.length + 1}`,
      valuesRef: `${costSheetName}!$K$2:$K$${items.length + 1}`,
      anchor: { fromCol: 0, fromRow: items.length + 5, toCol: 10, toRow: items.length + 25 },
    },
  ];
  downloadXlsx(workbook, `ingenieria-menu-delicias-del-mar-${new Date().toISOString().slice(0, 10)}.xlsx`, chartSpecs);
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
  const realProfit = metrics.totalSales - metrics.totalCosts;

  return (
    <section className="content-stack">
      <div className="kpi-grid">
        <KpiCard title="Ventas reales brutas" value={compactMoney(metrics.totalSales)} icon={TrendingUp} />
        <KpiCard title="Costos totales" value={compactMoney(metrics.totalCosts)} icon={Wallet} />
        <KpiCard title="Food cost real" value={percent.format(metrics.foodCostPercent)} icon={Percent} />
        <KpiCard title="Margen bruto esperado MBE" value={percent.format(metrics.grossMarginPercent)} icon={BarChart3} />
        <KpiCard title="Contribucion antes estructura" value={compactMoney(realProfit)} icon={Target} />
        <KpiCard title="Utilidad real estimada" value={compactMoney(metrics.estimatedProfit)} icon={Wallet} />
        <KpiCard title="Proyeccion mensual bruta" value={compactMoney(metrics.monthlyProjection)} icon={ClipboardList} />
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
          <PanelHeader
            title="Ingenieria de menu"
            action={(
              <button className="secondary-button compact" type="button" onClick={() => exportMenuEngineeringExcel(state)}>
                <ClipboardList size={16} /> Exportar Excel
              </button>
            )}
          />
          <DataTable
            headers={['Plato', 'Unidades', 'Food cost', 'MBE $', 'MBE %', 'Contribucion MBE total', 'Clasificacion', 'Accion sugerida']}
            rows={items.map((item) => [
              item.dish.name,
              String(item.unitsSold),
              percent.format(item.result.foodCostPercent),
              money.format(item.result.mbeAmount),
              percent.format(item.result.mbePercent),
              money.format(item.contribution),
              <StatusBadge key={`${item.dish.id}-q`} tone={item.quadrant === 'Estrella' ? 'ok' : item.quadrant === 'Ajustar' ? 'danger' : 'warning'} text={item.quadrant} />,
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

function getSurveyScoreTone(score: number) {
  if (score >= 100) return 'ok' as const;
  if (score >= 75) return 'warning' as const;
  return 'danger' as const;
}

function getSimulatedSurveyInsight(input: {
  isDessert: boolean;
  productScore: number;
  priceScore: number;
  placeScore: number;
  promotionScore: number;
}) {
  const weakest = [
    { key: 'product', label: 'producto', score: input.productScore },
    { key: 'price', label: 'precio', score: input.priceScore },
    { key: 'place', label: 'plaza', score: input.placeScore },
    { key: 'promotion', label: 'promocion', score: input.promotionScore },
  ].sort((a, b) => a.score - b.score)[0];

  if (input.isDessert) {
    if (weakest.key === 'promotion') return 'Buen cierre de comida; necesita mayor recomendacion en sobremesa.';
    if (weakest.key === 'price') return 'Se percibe atractivo, pero conviene reforzar valor frente al precio.';
    if (weakest.key === 'place') return 'Tiene espacio en carta y postventa; falta activacion en cierre de servicio.';
    return 'Postre con base comercial correcta; conviene afinar relato y presentacion.';
  }

  if (weakest.key === 'promotion') return 'Tiene potencial de venta, pero le falta empuje comercial del equipo.';
  if (weakest.key === 'price') return 'La propuesta gusta, aunque el precio exige mejor justificacion de valor.';
  if (weakest.key === 'place') return 'Puede crecer si gana mas visibilidad en sala, carta y recomendacion.';
  return 'Buen ajuste comercial general; requiere afinar propuesta de producto para escalar.';
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
    const surveyRows = enriched
      .map((row) => {
        const isDessert = isDessertCategory(row.categoryName);
        const normalizedPrice = maxPrice > minPrice ? (row.currentPrice - minPrice) / (maxPrice - minPrice) : 0.5;
        const valueForMoney = clamp((1 - normalizedPrice) * 100, 75, 92);
        const productScore = clamp(row.popularityScore * 0.48 + row.grossMarginPercentOnCurrentPrice * 28 + getDishAppealWeight(row.dish, row.categoryName), 75, 96);
        const priceScore = clamp(valueForMoney * 0.7 + row.grossMarginPercentOnCurrentPrice * 24 + (isDessert ? 8 : 0), 75, 94);
        const placeScore = clamp(
          row.expectedMonthlyUnits > 0
            ? (isDessert ? 70 : 76) + row.popularityScore * 0.12 + (row.expectedMonthlyUnits >= demandBase / Math.max(enriched.length, 1) ? 6 : 0)
            : 62,
          75,
          95,
        );
        const promotionScore = clamp(
          row.priority.label === 'Heroe comercial'
            ? 90
            : row.priority.label === 'Traccion con ajuste'
              ? 78
              : row.priority.label === 'Potencial rentable'
                ? 72 
                : 60,
          92,
          92,
        );
        const averageScore = Math.max(Math.round((productScore + priceScore + placeScore + promotionScore) / 4), 75);
        return {
          ...row,
          isDessert,
          survey: {
            productScore: Math.round(productScore),
            priceScore: Math.round(priceScore),
            placeScore: Math.round(placeScore),
            promotionScore: Math.round(promotionScore),
            averageScore,
            insight: getSimulatedSurveyInsight({
              isDessert,
              productScore,
              priceScore,
              placeScore,
              promotionScore,
            }),
          },
        };
      })
      .sort((a, b) => b.survey.averageScore - a.survey.averageScore);

    return {
      demandBase,
      rows: enriched,
      surveyRows,
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

      <section className="panel">
        <PanelHeader title="Encuesta simulada por plato segun mix de marketing" />
        <DataTable
          headers={['Plato', 'Producto', 'Precio', 'Plaza', 'Promocion', 'Promedio', 'Lectura simulada']}
          rows={analysis.surveyRows.map((row) => [
            row.dish.name,
            <StatusBadge key={`${row.dish.id}-survey-product`} text={`${row.survey.productScore}/100`} tone={getSurveyScoreTone(row.survey.productScore)} />,
            <StatusBadge key={`${row.dish.id}-survey-price`} text={`${row.survey.priceScore}/100`} tone={getSurveyScoreTone(row.survey.priceScore)} />,
            <StatusBadge key={`${row.dish.id}-survey-place`} text={`${row.survey.placeScore}/100`} tone={getSurveyScoreTone(row.survey.placeScore)} />,
            <StatusBadge key={`${row.dish.id}-survey-promo`} text={`${row.survey.promotionScore}/100`} tone={getSurveyScoreTone(row.survey.promotionScore)} />,
            <StatusBadge key={`${row.dish.id}-survey-average`} text={`${row.survey.averageScore}/100`} tone={getSurveyScoreTone(row.survey.averageScore)} />,
            row.survey.insight,
          ])}
        />
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
          label: 'Merma por rendimiento',
          render: (item: typeof selectedResults[number]) => money.format(item.result.yieldWasteCost),
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
  ]), []);

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
  const inventoryPlanning = useMemo(() => getInventoryPlanningSnapshot(state), [state]);
  const latestProjection = useMemo(() => getLatestProjection(state.projections), [state.projections]);
  const projectedSales = metrics.monthlyProjection;
  const projectedNetSales = report.projectedNetSales;
  const breakEvenCoverage = report.breakEvenSales > 0 ? projectedSales / report.breakEvenSales : 0;
  const contributionCoverage = projectedSales - report.breakEvenSales;
  const wasteRate = projectedSales > 0 ? report.wasteValue / projectedSales : 0;
  const fixedCostWeight = projectedSales > 0 ? report.totalMonthlyStructure / projectedSales : 0;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthSales = state.sales.filter((sale) => sale.soldAt.slice(0, 7) === currentMonthKey);
  const currentMonthUnits = currentMonthSales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const currentMonthFoodCost = currentMonthSales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce((itemSum, item) => {
        const dish = state.dishes.find((candidate) => candidate.id === item.dishId);
        if (!dish) return itemSum;
        const result = calculateDishCost(state, dish);
        return itemSum + (result.materialCost + result.wasteCost) * item.quantity;
      }, 0),
    0,
  );
  const currentMonthNonFoodCosts = report.totalMonthlyStructure;
  const currentMonthGrossSales = inventoryPlanning.currentMonthSalesValue;
  const taxRate = Math.max(state.business.taxRate, 0);
  const currentMonthNetSales = taxRate > 0 ? currentMonthGrossSales / (1 + taxRate) : currentMonthGrossSales;
  const currentMonthVatDebit = currentMonthGrossSales - currentMonthNetSales;
  const currentMonthCifAfectosGross = state.indirectCosts
    .filter((cost) => cost.afecto)
    .reduce((sum, cost) => sum + getMonthlyCostAmount(cost), 0);
  const currentMonthCifAfectosVat = taxRate > 0 ? currentMonthCifAfectosGross - currentMonthCifAfectosGross / (1 + taxRate) : 0;
  const currentMonthVatCredit = taxRate > 0
    ? (inventoryPlanning.usedThisMonthValue - inventoryPlanning.usedThisMonthValue / (1 + taxRate)) + currentMonthCifAfectosVat
    : 0;
  const currentMonthVatPayable = currentMonthVatDebit - currentMonthVatCredit;
  const currentMonthMbe = currentMonthGrossSales - currentMonthFoodCost;
  const currentMonthProfitBeforeVat = currentMonthGrossSales - currentMonthFoodCost - currentMonthNonFoodCosts;
  const currentMonthProfitAfterVat = currentMonthProfitBeforeVat - currentMonthVatPayable;
  const currentMonthAllCostsWithVat = currentMonthFoodCost + currentMonthNonFoodCosts + currentMonthVatPayable;
  const currentMonthFoodCostPercent = currentMonthGrossSales > 0 ? currentMonthFoodCost / currentMonthGrossSales : 0;
  const currentMonthMbePercent = currentMonthGrossSales > 0 ? currentMonthMbe / currentMonthGrossSales : 0;
  const currentMonthRealMarginPercent = currentMonthGrossSales > 0 ? currentMonthProfitAfterVat / currentMonthGrossSales : 0;
  const currentMonthInventoryWeight = currentMonthGrossSales > 0 ? report.inventoryValue / currentMonthGrossSales : 0;
  const currentMonthWasteRate = currentMonthGrossSales > 0 ? report.wasteValue / currentMonthGrossSales : 0;
  const currentMonthAverageDishPrice = currentMonthUnits > 0 ? currentMonthGrossSales / currentMonthUnits : 0;
  const currentMonthBreakEvenCoverage = report.breakEvenSales > 0 ? currentMonthGrossSales / report.breakEvenSales : 0;
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
    { label: 'Inventario necesario proximo mes', value: money.format(inventoryPlanning.nextMonthRequiredValue), helper: 'Inventario gastado del mes ajustado por la variacion entre venta real y venta proyectada, mas produccion pendiente.' },
    { label: 'Disponible neto para proximo mes', value: money.format(inventoryPlanning.netAvailableForNextMonth), helper: inventoryPlanning.purchaseGapForNextMonth > 0 ? `Faltan ${money.format(inventoryPlanning.purchaseGapForNextMonth)} para cubrir la necesidad proyectada.` : 'Inventario actual menos necesidad proyectada del proximo mes.' },
    { label: 'Margen de contribucion medio', value: money.format(report.contributionMargin), helper: 'Aporte promedio por unidad vendida antes de cubrir estructura fija.' },
    { label: 'Platos-equivalentes para equilibrio', value: report.breakEvenUnits > 0 ? `${report.breakEvenUnits} platos` : 'Sin base', helper: `Equivalen a platos vendidos con aporte medio de ${money.format(report.contributionMargin)} por unidad.` },
    { label: 'Tickets promedio para equilibrio', value: report.breakEvenGuestTickets > 0 ? `${report.breakEvenGuestTickets} tickets` : 'Sin base', helper: `Calculados con ticket promedio proyectado de ${money.format(report.projectedAverageFoodTicket)}.` },
    { label: 'Estructura mensual total', value: money.format(report.totalMonthlyStructure), helper: 'Incluye fijos base, indirectos mensualizados y costo total del personal.' },
    { label: 'Utilidad proyectada antes IVA', value: money.format(report.projectedProfit), helper: 'Resultado operativo preliminar con ventas y costos brutos.' },
    { label: 'IVA debito proyectado', value: money.format(report.projectedVatDebit), helper: 'IVA generado por las ventas proyectadas, asumiendo tickets con IVA incluido.' },
    { label: 'IVA credito proyectado', value: money.format(report.projectedVatCredit), helper: 'IVA recuperable estimado desde compras e insumos afectos al periodo.' },
    { label: 'IVA neto proyectado', value: money.format(report.projectedVatPayable), helper: 'Diferencia entre IVA debito de ventas e IVA credito de compras.' },
    { label: 'Utilidad proyectada despues de IVA', value: money.format(report.projectedRealProfitAfterVat), helper: 'Resultado final estimado del negocio despues de compensar IVA debito y credito.' },
  ];
  const currentMonthNotes = [
    { label: 'Costos totales + IVA', helper: `${money.format(currentMonthFoodCost)} food cost + ${money.format(currentMonthNonFoodCosts)} costos totales + ${money.format(currentMonthVatPayable)} IVA neto = ${money.format(currentMonthAllCostsWithVat)}.` },
    { label: 'IVA neto a pagar', helper: `${money.format(currentMonthVatDebit)} IVA debito - ${money.format(currentMonthVatCredit)} IVA credito = ${money.format(currentMonthVatPayable)}.` },
    { label: 'Utilidad real post IVA', helper: `${money.format(currentMonthGrossSales)} venta bruta - ${money.format(currentMonthAllCostsWithVat)} costos totales + IVA = ${money.format(currentMonthProfitAfterVat)}.` },
    { label: 'Margen real post IVA', helper: `${money.format(currentMonthProfitAfterVat)} utilidad real post IVA / ${money.format(currentMonthGrossSales)} venta bruta = ${percent.format(currentMonthRealMarginPercent)}.` },
    { label: 'Cobertura equilibrio real', helper: `${money.format(currentMonthGrossSales)} venta bruta / ${money.format(report.breakEvenSales)} punto de equilibrio = ${percent.format(currentMonthBreakEvenCoverage)}.` },
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
      <div className="dashboard-grid reports-layout">
        <section className="panel wide">
          <PanelHeader title="Reporte mes actual" />
          <div className="summary-strip compact">
            <SummaryMetric label="Venta bruta del mes" value={money.format(currentMonthGrossSales)} />
            <SummaryMetric label="Venta neta del mes" value={money.format(currentMonthNetSales)} />
            <SummaryMetric label="Unidades vendidas" value={`${currentMonthUnits} platos`} />
            <SummaryMetric label="Precio promedio plato" value={money.format(currentMonthAverageDishPrice)} />
            <SummaryMetric label="Food cost $" value={money.format(currentMonthFoodCost)} />
            <SummaryMetric label="Food cost %" value={percent.format(currentMonthFoodCostPercent)} />
            <SummaryMetric label="Costos totales" value={money.format(currentMonthNonFoodCosts)} />
            <SummaryMetric label="IVA debito" value={money.format(currentMonthVatDebit)} />
            <SummaryMetric label="IVA credito" value={money.format(currentMonthVatCredit)} />
            <SummaryMetric label="IVA neto a pagar" value={money.format(currentMonthVatPayable)} />
            <SummaryMetric label="Inventario gastado mes" value={money.format(inventoryPlanning.usedThisMonthValue)} />
            <SummaryMetric label="Inventario valorizado" value={money.format(report.inventoryValue)} />
            <SummaryMetric label="MBE $" value={money.format(currentMonthMbe)} />
            <SummaryMetric label="MBE %" value={percent.format(currentMonthMbePercent)} />
            <SummaryMetric label="Punto de equilibrio" value={money.format(report.breakEvenSales)} />
            <SummaryMetric label="Margen real post IVA" value={percent.format(currentMonthRealMarginPercent)} />
            <SummaryMetric label="Costos totales + IVA" value={money.format(currentMonthAllCostsWithVat)} />
            <SummaryMetric label="Utilidad real post IVA" value={money.format(currentMonthProfitAfterVat)} tone="highlight" />
          </div>
          <div className="metric-table compact-notes">
            {currentMonthNotes.map((row) => (
              <div className="report-metric-row" key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <small>{row.helper}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="Lectura rapida mes actual" />
          <div className="stack-list">
            <div className="record-row">
              <strong>Margen real del mes</strong>
              <span>{`${percent.format(currentMonthRealMarginPercent)} de la venta queda como utilidad real post IVA.`}</span>
            </div>
            <div className="record-row">
              <strong>Inventario disponible</strong>
              <span>{`${percent.format(currentMonthInventoryWeight)} de la venta real del mes esta cubierto por stock valorizado actual.`}</span>
            </div>
            <div className="record-row">
              <strong>Resultado post IVA</strong>
              <span>{`Despues de estructura e IVA neto, el mes queda en ${money.format(currentMonthProfitAfterVat)}.`}</span>
            </div>
          </div>
        </section>
      </div>

      <details className="panel collapsible-panel">
        <summary className="collapsible-trigger">
          <span className="collapsible-copy">
            <strong>Lectura de proyeccion siguiente mes</strong>
            <span>Venta, inventario, IVA y utilidad estimada del periodo siguiente.</span>
          </span>
        </summary>
        <div className="collapsible-body">
          <div className="summary-strip compact">
            <SummaryMetric label="Venta proyectada bruta" value={money.format(projectedSales)} />
            <SummaryMetric label="Venta neta proyectada" value={money.format(projectedNetSales)} />
            <SummaryMetric label="Cobertura del equilibrio" value={percent.format(breakEvenCoverage)} />
            <SummaryMetric label="Peso fijo sobre venta" value={percent.format(fixedCostWeight)} />
            <SummaryMetric label="Merma sobre venta" value={percent.format(wasteRate)} />
            <SummaryMetric label="Inventario vs venta proyectada" value={percent.format(projectedSales > 0 ? report.inventoryValue / projectedSales : 0)} />
            <SummaryMetric label="Necesario proximo mes" value={money.format(inventoryPlanning.nextMonthRequiredValue)} />
            <SummaryMetric label="Disponible neto proximo mes" value={money.format(inventoryPlanning.netAvailableForNextMonth)} />
            <SummaryMetric label="IVA debito proyectado" value={money.format(report.projectedVatDebit)} />
            <SummaryMetric label="IVA credito proyectado" value={money.format(report.projectedVatCredit)} />
            <SummaryMetric label="IVA neto proyectado" value={money.format(report.projectedVatPayable)} />
            <SummaryMetric label="Utilidad proyectada post IVA" value={money.format(report.projectedRealProfitAfterVat)} />
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
        </div>
      </details>

      <details className="panel collapsible-panel">
        <summary className="collapsible-trigger">
          <span className="collapsible-copy">
            <strong>Puente de resultado proyectado</strong>
            <span>Comparacion entre venta proyectada, punto de equilibrio y holgura esperada.</span>
          </span>
        </summary>
        <div className="collapsible-body">
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
        </div>
      </details>

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

      <details className="panel collapsible-panel">
        <summary className="collapsible-trigger">
          <span className="collapsible-copy">
            <strong>Origen de la venta proyectada</strong>
            <span>Detalle de la proyeccion comercial vigente y su conversion mensual.</span>
          </span>
        </summary>
        <div className="collapsible-body">
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
        </div>
      </details>
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

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone?: 'highlight' }) {
  return (
    <div className={`summary-metric${tone ? ` ${tone}` : ''}`}>
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
