"use server"

import { supabaseAdmin } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export async function placeOrder(
  shopId: string,
  items: { skuId: string; quantity: number }[]
) {
  const filtered = items.filter((i) => i.quantity > 0)
  if (filtered.length === 0) return { ok: false, error: "No items" }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({ shop_id: shopId })
    .select("id")
    .single()
  if (orderErr) return { ok: false, error: orderErr.message }

  const orderItems = filtered.map((i) => ({
    order_id: order.id,
    sku_id: i.skuId,
    quantity: i.quantity,
  }))
  const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(orderItems)
  if (itemsErr) return { ok: false, error: itemsErr.message }

  revalidatePath("/dashboard")
  revalidatePath("/history")
  return { ok: true, orderId: order.id }
}

export type HistoryRow = {
  orderId: string
  createdAt: string
  items: { skuId: string; skuName: string; category: string; quantity: number }[]
}

export type HistoryData = {
  rows: HistoryRow[]
  skus: { id: string; name: string; category: string }[]
  totalOrders: number
  totalEmpanadas: number
  totalDrinks: number
  byHourSku: Record<number, Record<string, number>>
  hourTotals: Record<number, number>
}

export async function getHistoryData(
  shopId: string,
  dateStr: string
): Promise<HistoryData> {
  const start = `${dateStr}T00:00:00.000Z`
  const endDate = new Date(dateStr + "T00:00:00.000Z")
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const end = endDate.toISOString()

  const { data: allSkus } = await supabaseAdmin
    .from("skus")
    .select("id, name, category")
    .eq("shop_id", shopId)
    .order("category")
    .order("name")

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      created_at,
      order_items (
        quantity,
        skus (id, name, category)
      )
    `
    )
    .eq("shop_id", shopId)
    .gte("created_at", start)
    .lt("created_at", end)

  if (error) {
    return {
      rows: [],
      skus: [],
      totalOrders: 0,
      totalEmpanadas: 0,
      totalDrinks: 0,
      byHourSku: {},
      hourTotals: {},
    }
  }

  const skuSet = new Map<string, { name: string; category: string }>()
  const rows: HistoryRow[] = []
  const byHourSku: Record<number, Record<string, number>> = {}
  const hourTotals: Record<number, number> = {}
  let totalEmpanadas = 0
  let totalDrinks = 0

  const HOURS = [11, 12, 13, 14, 15, 16, 17, 18]
  for (const h of HOURS) {
    byHourSku[h] = {}
    hourTotals[h] = 0
  }

  for (const o of orders ?? []) {
    const rawItems = (o.order_items ?? []) as unknown[]
    const items = rawItems.map((it: unknown) => {
      const i = it as { quantity: number; skus: { id: string; name: string; category: string } | null }
      return { quantity: i.quantity, skus: i.skus }
    })
    const rowItems = items
      .filter((i): i is { quantity: number; skus: { id: string; name: string; category: string } } => !!i.skus)
      .map((i) => ({
        skuId: i.skus.id,
        skuName: i.skus.name,
        category: i.skus.category,
        quantity: i.quantity,
      }))
    rows.push({ orderId: o.id, createdAt: o.created_at, items: rowItems })

    const dt = new Date(o.created_at)
    const hour = dt.getUTCHours()
    const hourSlot = hour < 11 ? 11 : hour > 18 ? 18 : hour

    for (const it of rowItems) {
      skuSet.set(it.skuId, { name: it.skuName, category: it.category })
      if (it.category === "empanada") totalEmpanadas += it.quantity
      else if (it.category === "drink") totalDrinks += it.quantity
      byHourSku[hourSlot] ??= {}
      byHourSku[hourSlot][it.skuId] = (byHourSku[hourSlot][it.skuId] ?? 0) + it.quantity
      hourTotals[hourSlot] = (hourTotals[hourSlot] ?? 0) + it.quantity
    }
  }

  const skusFromOrders = Array.from(skuSet.entries())
    .map(([id, { name, category }]) => ({ id, name, category }))
    .sort((a, b) =>
      a.category !== b.category ? (a.category === "empanada" ? -1 : 1) : a.name.localeCompare(b.name)
    )
  const skus = (allSkus && allSkus.length > 0 ? allSkus : skusFromOrders) as {
    id: string
    name: string
    category: string
  }[]

  return {
    rows,
    skus,
    totalOrders: orders?.length ?? 0,
    totalEmpanadas,
    totalDrinks,
    byHourSku,
    hourTotals,
  }
}

// --- Forecast / Prep List ---

function getDateInTimezone(utcDate: Date, tz: string): { dateStr: string; hour: number } {
  const dateStr = utcDate.toLocaleDateString("en-CA", { timeZone: tz })
  const hour = parseInt(
    utcDate.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
    10
  )
  return { dateStr, hour }
}

function getWeekdayInTz(d: Date, tz: string): number {
  const s = d.toLocaleString("en-US", { timeZone: tz, weekday: "short" })
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[s] ?? 0
}

export type IngredientTotal = {
  id: string
  name: string
  unit: string
  total: number
}

export type ForecastData = {
  targetDate: string
  comparableDates: string[]
  openTime: string
  skus: { id: string; name: string; category: string }[]
  empanadaTotals: Record<string, number>
  drinkTotals: Record<string, number>
  empanadaByHour: Record<number, Record<string, number>>
  drinkTotalUnits: number
  ingredientTotals: IngredientTotal[]
  isEmpty: boolean
}

export async function getForecastData(
  shopId: string,
  targetDateStr: string,
  useWasteMinimizer: boolean
): Promise<ForecastData> {
  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("timezone, default_comparable_days, waste_factor, open_time")
    .eq("id", shopId)
    .single()

  const tz = (shop?.timezone as string) ?? "America/New_York"
  const N = (shop?.default_comparable_days as number) ?? 3
  const wasteFactor = Number(shop?.waste_factor) ?? 0.9
  const openTime = (shop?.open_time as string) ?? "11:00"

  const openHour = parseInt(openTime.slice(0, 2), 10)
  const HOURS = [openHour, openHour + 1, openHour + 2, openHour + 3, openHour + 4, openHour + 5, openHour + 6, openHour + 7]

  const { data: allSkus } = await supabaseAdmin
    .from("skus")
    .select("id, name, category")
    .eq("shop_id", shopId)
    .order("category")
    .order("name")

  const targetDate = new Date(targetDateStr + "T12:00:00")
  const targetWeekdayTz = getWeekdayInTz(targetDate, tz)

  const startRange = new Date(targetDate)
  startRange.setDate(startRange.getDate() - 90)

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select(
      `
      created_at,
      order_items (
        quantity,
        skus (id, name, category)
      )
    `
    )
    .eq("shop_id", shopId)
    .gte("created_at", startRange.toISOString())
    .lt("created_at", targetDate.toISOString())

  const dateHourSku: Record<string, Record<number, Record<string, number>>> = {}

  for (const o of orders ?? []) {
    const dt = new Date(o.created_at)
    const { dateStr, hour } = getDateInTimezone(dt, tz)
    const hourSlot = hour < openHour ? openHour : hour > openHour + 7 ? openHour + 7 : hour

    const rawItems = (o.order_items ?? []) as unknown[]
    for (const it of rawItems) {
      const i = it as { quantity: number; skus: { id: string; name: string; category: string } | null }
      if (!i.skus) continue
      dateHourSku[dateStr] ??= {}
      dateHourSku[dateStr][hourSlot] ??= {}
      dateHourSku[dateStr][hourSlot][i.skus.id] = (dateHourSku[dateStr][hourSlot][i.skus.id] ?? 0) + i.quantity
    }
  }

  const comparableDates: string[] = []
  let d = new Date(targetDate)
  d.setDate(d.getDate() - 1)
  for (let i = 0; i < 60 && comparableDates.length < N; i++) {
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: tz })
    if (getWeekdayInTz(d, tz) === targetWeekdayTz && dateHourSku[dateStr]) {
      comparableDates.push(dateStr)
    }
    d.setDate(d.getDate() - 1)
  }

  const empanadaByHour: Record<number, Record<string, number>> = {}
  const drinkTotals: Record<string, number> = {}
  const empanadaTotals: Record<string, number> = {}

  for (const h of HOURS) empanadaByHour[h] = {}

  if (comparableDates.length === 0) {
    for (const s of allSkus ?? []) {
      if (s.category === "empanada") empanadaTotals[s.id] = 0
      else drinkTotals[s.id] = 0
    }
    return {
      targetDate: targetDateStr,
      comparableDates: [],
      openTime,
      skus: allSkus ?? [],
      empanadaTotals,
      drinkTotals,
      empanadaByHour,
      drinkTotalUnits: 0,
      ingredientTotals: [],
      isEmpty: true,
    }
  }

  for (const sku of allSkus ?? []) {
    if (sku.category === "empanada") {
      empanadaTotals[sku.id] = 0
      for (const h of HOURS) empanadaByHour[h][sku.id] = 0
    } else {
      drinkTotals[sku.id] = 0
    }
  }

  const drinkByDateSku: Record<string, Record<string, number>> = {}
  for (const dateStr of comparableDates) drinkByDateSku[dateStr] = {}

  for (const dateStr of comparableDates) {
    const dayData = dateHourSku[dateStr] ?? {}
    for (const h of HOURS) {
      const hourData = dayData[h] ?? {}
      for (const [skuId, qty] of Object.entries(hourData)) {
        const sku = allSkus?.find((s) => s.id === skuId)
        if (!sku) continue
        if (sku.category === "empanada") {
          empanadaByHour[h][skuId] = (empanadaByHour[h][skuId] ?? 0) + qty
        } else {
          drinkByDateSku[dateStr][skuId] = (drinkByDateSku[dateStr][skuId] ?? 0) + qty
        }
      }
    }
  }

  const n = comparableDates.length
  for (const h of HOURS) {
    for (const skuId of Object.keys(empanadaByHour[h])) {
      const avg = Math.round((empanadaByHour[h][skuId] ?? 0) / n)
      const val = useWasteMinimizer ? Math.floor(avg * wasteFactor) : avg
      empanadaByHour[h][skuId] = val
      empanadaTotals[skuId] = (empanadaTotals[skuId] ?? 0) + val
    }
  }
  for (const sku of allSkus ?? []) {
    if (sku.category !== "drink") continue
    const dailyVals = comparableDates.map((d) => drinkByDateSku[d][sku.id] ?? 0)
    drinkTotals[sku.id] = Math.round(dailyVals.reduce((a, b) => a + b, 0) / n)
  }

  const drinkTotalUnits = Object.values(drinkTotals).reduce((a, b) => a + b, 0)

  const empanadaSkuIds = (allSkus ?? []).filter((s) => s.category === "empanada").map((s) => s.id)
  const ingredientTotals: IngredientTotal[] = []

  if (empanadaSkuIds.length > 0) {
    const { data: recipes } = await supabaseAdmin
      .from("recipes")
      .select("sku_id, ingredient_id, amount_per_unit")
      .in("sku_id", empanadaSkuIds)

    const { data: ingredients } = await supabaseAdmin
      .from("ingredients")
      .select("id, name, unit")
      .eq("shop_id", shopId)

    if (recipes && recipes.length > 0 && ingredients && ingredients.length > 0) {
      const ingMap = new Map(ingredients.map((i) => [i.id, { name: i.name, unit: i.unit }]))
      const totals = new Map<string, number>()

      for (const r of recipes) {
        const forecastUnits = empanadaTotals[r.sku_id] ?? 0
        const amt = forecastUnits * Number(r.amount_per_unit)
        totals.set(r.ingredient_id, (totals.get(r.ingredient_id) ?? 0) + amt)
      }

      for (const [ingId, total] of totals) {
        const ing = ingMap.get(ingId)
        if (ing) {
          ingredientTotals.push({
            id: ingId,
            name: ing.name,
            unit: ing.unit,
            total: Math.round(total),
          })
        }
      }
      ingredientTotals.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return {
    targetDate: targetDateStr,
    comparableDates,
    openTime,
    skus: allSkus ?? [],
    empanadaTotals,
    drinkTotals,
    empanadaByHour,
    drinkTotalUnits,
    ingredientTotals,
    isEmpty: false,
  }
}
