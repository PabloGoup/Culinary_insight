# Analisis de archivos Excel para Culinary Insight

Fecha de revision: 2026-04-24

Archivos analizados:

- `/Users/ptoledos/Downloads/Ejerc_Carta_men_.xlsx`
- `/Users/ptoledos/Downloads/Proyecci_n_Ventas_Restaurante (2).xlsx`

## 1. Resumen ejecutivo

Los Excel no son simples planillas de apoyo. En conjunto representan el modelo operativo base para la plataforma:

- Carta menu con precios finales y textos comerciales.
- Recetas estandar con materia prima, rendimiento, tiempo, mano de obra y CIF.
- Bodega e inventario inicial.
- Costos y precio de venta con separacion de materia prima, mano de obra, CIF, utilidad, precio neto, IVA y precio final.
- Encuesta/preferencia de clientes por producto.
- Ingenieria de menu con unidades vendidas, popularidad, margen bruto esperado y clasificacion.
- Proyeccion de ventas diaria, semanal y mensual por desayuno, almuerzo, cena, alimentos y bebidas.
- Proyeccion separada para catering con ingresos, egresos y utilidad mensual/anual.

La app debe tratar estos archivos como especificacion funcional del negocio, no solo como datos semilla.

## 2. Workbook: Ejerc_Carta_men_.xlsx

### Hojas detectadas

- `Menu`: carta visible para cliente; toma precios desde `Costos y Precio de Venta`.
- `Bodega`: estructura base de inventario, nomenclatura y valores de mano de obra.
- `Recetas`: recetas estandar distribuidas por bloques.
- `Costos y Precio de Venta`: consolidado de costo, utilidad, IVA y precio final.
- `Hoja1`: version adicional de receta estandar o plantilla de trabajo.
- `Encuesta`: preferencia/seleccion por clientes, con totales por producto.
- `Ingenieria de Menu`: matriz de popularidad/rentabilidad y clasificacion final.

### Flujo de calculo principal

1. `Recetas` calcula materia prima por ingrediente:
   - Peso neto = peso bruto * rendimiento.
   - Monto ingrediente = valor unitario * cantidad / base de unidad.
   - Base frecuente: `1000` para gramos o cc; `1` para unidad.

2. `Recetas` calcula mano de obra:
   - Mano de obra = `(sueldo mensual / 10800) * minutos receta`.
   - `10800` representa minutos laborales mensuales estimados.

3. `Recetas` calcula CIF:
   - CIF = `materia prima * 30%`.
   - Este supuesto aparece repetido en todas las recetas.

4. `Costos y Precio de Venta` consolida:
   - Materia Prima.
   - Mano de Obra.
   - CIF.
   - Costo Total.
   - Utilidad.
   - Precio sin IVA.
   - IVA 19%.
   - Precio de Venta final.
   - Porcentaje de costo de materia prima.

5. `Menu` consume precios finales desde `Costos y Precio de Venta`.

6. `Ingenieria de Menu` consume costo y precio neto desde `Costos y Precio de Venta` y unidades vendidas manuales.

## 3. Productos detectados

### Entradas

1. Crostini Mousse de queso de cabra
   - Precio final: 4.990
   - Tiempo: 10 min
   - Ingredientes: pan baguette, queso de cabra, crema, sal

2. Ensalada de Quinoa
   - Precio final: 6.590
   - Tiempo: 30 min
   - Ingredientes: quinoa, cebolla morada, tomate, espinaca, pimenton amarillo, albahaca, aceite de oliva, sal

3. Tartar de Salmon
   - Precio final: 6.990
   - Tiempo: 8 min
   - Ingredientes: salmon, palta, cebolla morada, pepinillos, brote de arveja, pimienta, aceite de oliva, sal

### Fondos

4. Lasana de berenjenas con carne de pavo
   - Precio final: 7.990
   - Tiempo: 30 min
   - Ingredientes: berenjenas, cebolla, zanahoria, pimenton, carne molida de pavo, salsa de tomate, tomate, queso ricota

5. Queso fresco salteado con crema de espinacas
   - Precio final: 6.990
   - Tiempo: 30 min
   - Ingredientes: queso fresco, espinacas, cebolla, crema, sal, pimienta, aceite vegetal

6. Merluza Austral con verduras salteadas
   - Precio final: 8.990
   - Tiempo: 15 min
   - Ingredientes: merluza austral, cebolla, pimentones, zanahoria, zapallo italiano, champinon, sal, pimienta, aceite vegetal

### Postres

7. Tarta de Frutas
   - Precio final: 5.590
   - Tiempo: 30 min
   - Ingredientes: harina, margarina, huevos, leche, maicena, vainilla, sucralosa, durazno, arandanos, frambueza

8. Panacota con coulis de frambueza
   - Precio final: 5.590
   - Tiempo: 15 min
   - Ingredientes: crema, leche, sucralosa, gelatina, vainilla, frambueza, azucar flor, menta

9. Textura de manzana
   - Precio final: 5.990
   - Tiempo: 25 min
   - Ingredientes: manzanas, azucar, late harvest carmenere, queso roquefort

## 4. Ingenieria de menu detectada

La hoja `Ingenieria de Menu` usa:

- `U vendidas`: unidades vendidas por producto.
- `% pop`: unidades producto / unidades totales.
- `costo mp`: costo materia prima.
- `precio venta`: precio neto sin IVA.
- `mbe`: margen bruto esperado = precio venta - costo mp.
- `mbe%`: margen bruto esperado / precio venta.
- `costos totales`: costo materia prima * unidades vendidas.
- `cifra de neg`: margen bruto esperado * unidades vendidas.
- `rendimiento`: cifra de negocio - costos totales.
- `clas mbe`: alto/bajo margen.
- `Cla I P`: alta/baja popularidad.
- `Cla Final`: Enigma, Estrella, Perro.

Equivalencia recomendada en la app:

- Estrella = alto margen + alta venta.
- Vaca = bajo margen + alta venta.
- Puzzle/Enigma = alto margen + baja venta.
- Perro = bajo margen + baja venta.

Nota profesional: el Excel usa `Enigma`; el requerimiento de la app usa `Puzzle`. La app debe soportar ambos terminos o mapear `Enigma` a `Puzzle`.

## 5. Encuesta/preferencia

La hoja `Encuesta` registra selecciones por cliente y un total por producto:

- Crostini: 2
- Ensalada de Quinoa: 8
- Tartar de Salmon: 10
- Lasana de berenjenas: 10
- Queso fresco con espinacas: 2
- Merluza Austral: 8
- Tarta de Frutas: 12
- Panacota: 7
- Textura de manzana: 1

Uso recomendado:

- Alimentar popularidad inicial.
- Comparar preferencia declarada contra venta real.
- Detectar productos con alta preferencia pero baja rentabilidad.

## 6. Workbook: Proyecci_n_Ventas_Restaurante (2).xlsx

### Hoja1: proyeccion restaurante

Supuestos centrales:

- Capacidad del restaurante: 75 personas.
- Clientes proyectados por dia:
  - Lunes: 125
  - Martes: 95
  - Miercoles: 120
  - Jueves: 140
  - Viernes: 140
  - Sabado: 160
  - Domingo: 170

Distribucion por servicio:

- Desayuno: 10% de personas.
- Almuerzo: 60% de personas.
- Cena: 45% de personas.

Precios promedio:

- Alimentos desayuno neto: 5.800
- Bebidas desayuno neto: 2.300
- Alimentos almuerzo neto: combinacion de entrada/principal/postre.
- Bebidas almuerzo neto: bebida sin alcohol 2.300
- Alimentos cena neto: 19.500
- Bebidas cena neto: 11.500

Calculos:

- Personas almuerzo por dia = personas proyectadas * 60%.
- Personas cena por dia = personas proyectadas * 45%.
- Total alimentos dia = alimentos almuerzo + alimentos cena.
- Total bebidas dia = bebidas almuerzo + bebidas cena.
- Total dia = total alimentos + total bebidas.
- Total semanal = suma lunes a domingo.
- Total mensual = total semanal * 4.

### Hoja2: proyeccion catering

Supuestos:

- 6 semanas.
- 4 eventos/unidades por semana.
- Total semanal: semanas * cantidad.
- Valor unitario: 25.000.
- Ingreso mensual: monto semanal * 4.
- Ingreso anual: mensual * 12.

Egresos:

- Materia prima: 7.000 por unidad.
- Transporte.
- Mano de obra.
- Publicidad.
- Gastos oficina.
- Gastos administracion ventas.

Calculos:

- Total gastos mensual/anual.
- Utilidad mensual/anual = ingresos - egresos.

## 7. Hallazgos tecnicos importantes

1. Hay formulas compartidas en Excel que aparecen en XML como formulas sin texto propio. No deben tratarse como formulas rotas automaticamente; Excel las interpreta por herencia de formula compartida.

2. Varias celdas tienen valores cacheados aunque la formula no sea textual en esa celda. Al migrar, no conviene copiar solo los valores; hay que reconstruir la formula de negocio en TypeScript.

3. La mano de obra esta simplificada por receta usando sueldo mensual y minutos. Esto debe modelarse como una configuracion editable:
   - sueldo mensual por cargo
   - minutos laborales mensuales
   - tiempo de preparacion por receta

4. El CIF del Excel es 30% de materia prima. En la app se habia planteado prorrateo de costos indirectos reales. Recomendacion:
   - mantener ambos modos:
     - CIF porcentual rapido
     - prorrateo real por costos indirectos

5. El precio de venta del Excel esta fijado manualmente y luego se calculan utilidad/costo. La app tambien debe permitir el flujo inverso:
   - ingresar margen deseado
   - sugerir precio
   - comparar contra precio real de carta

6. El Excel trabaja con precio neto y precio con IVA. La app debe distinguir siempre:
   - precio neto
   - IVA
   - precio final
   - margen sobre neto
   - margen sobre final

7. La proyeccion usa ventas por servicio y familia (`alimentos`/`bebidas`), no solo por receta. La app debe soportar dos niveles:
   - proyeccion por producto/receta
   - proyeccion por servicio y ticket promedio

## 8. Implicancias para la base de datos

Tablas adicionales o campos recomendados:

- `recipe_labor`
  - recipe_id
  - role_name
  - monthly_salary
  - preparation_minutes
  - monthly_work_minutes

- `recipe_pricing`
  - recipe_id
  - net_price
  - tax_rate
  - gross_price
  - target_margin
  - suggested_price

- `service_projection`
  - day_of_week
  - projected_customers
  - breakfast_ratio
  - lunch_ratio
  - dinner_ratio
  - average_food_ticket
  - average_beverage_ticket

- `survey_preferences`
  - recipe_id
  - respondent_number
  - selected

- `menu_engineering_snapshot`
  - recipe_id
  - units_sold
  - popularity_percent
  - gross_margin
  - classification
  - snapshot_date

## 9. Recomendacion de implementacion en Culinary Insight

Prioridad alta:

1. Reemplazar datos demo genericos por datos reales del Excel.
2. Agregar precio neto, IVA y precio final a recetas.
3. Agregar tiempo de preparacion y costo laboral por receta.
4. Agregar modo CIF porcentual y modo prorrateo real.
5. Agregar proyeccion por dia/servicio/ticket promedio.
6. Mapear `Encuesta` como popularidad inicial.
7. Ajustar ingenieria de menu para soportar `Estrella`, `Vaca`, `Puzzle/Enigma`, `Perro`.

Prioridad media:

1. Importador Excel asistido.
2. Validacion de formulas reconstruidas versus valores Excel.
3. Versionado de precios de carta.
4. Escenarios: conservador, esperado y optimista.

## 10. Regla profesional clave

El Excel mezcla tres perspectivas:

- Costeo tecnico de receta.
- Precio comercial de carta.
- Evaluacion estrategica de venta/popularidad.

La app no debe unir todo en un solo formulario. Debe separar:

- `Receta`: ingredientes, rendimiento, tiempo.
- `Costeo`: materia prima, mano de obra, CIF.
- `Precio`: neto, IVA, final, margen deseado.
- `Venta`: unidades, ingresos, descuentos.
- `Analitica`: rentabilidad, popularidad, clasificacion e insights.
