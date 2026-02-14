import "server-only"
import { supabaseAdmin } from "@/lib/supabase/service"

const SHOP_DEFAULTS = {
  name: "Mari Empanadas",
  timezone: "America/New_York",
  open_days: [3, 4, 5, 6, 0],
  open_time: "11:00",
  close_time: "19:00",
  default_comparable_days: 3,
  waste_factor: 0.9,
} as const

const SKU_SPECS = [
  { name: "Chicken", category: "empanada" },
  { name: "Cheese", category: "empanada" },
  { name: "Beef", category: "empanada" },
  { name: "Guava & Cheese", category: "empanada" },
  { name: "Ham & Cheese", category: "empanada" },
  { name: "Morocho", category: "drink" },
  { name: "Hot Chocolate", category: "drink" },
  { name: "Coffee (Black)", category: "drink" },
] as const

const INGREDIENTS = [
  { name: "flour", unit: "g" },
  { name: "water", unit: "ml" },
  { name: "salt", unit: "g" },
  { name: "oil", unit: "ml" },
  { name: "chicken", unit: "g" },
  { name: "beef", unit: "g" },
  { name: "cheese", unit: "g" },
  { name: "guava paste", unit: "g" },
  { name: "ham", unit: "g" },
  { name: "sugar", unit: "g" },
  { name: "cinnamon", unit: "g" },
  { name: "milk", unit: "ml" },
  { name: "cornmeal", unit: "g" },
  { name: "cocoa powder", unit: "g" },
  { name: "coffee grounds", unit: "g" },
] as const

const DOUGH_PER_UNIT = [
  { ingredient: "flour", amount: 80 },
  { ingredient: "water", amount: 40 },
  { ingredient: "salt", amount: 2 },
  { ingredient: "oil", amount: 10 },
]

const EMPANADA_FILLINGS: Record<string, { ingredient: string; amount: number }[]> = {
  Chicken: [{ ingredient: "chicken", amount: 60 }],
  Cheese: [{ ingredient: "cheese", amount: 60 }],
  Beef: [{ ingredient: "beef", amount: 60 }],
  "Guava & Cheese": [
    { ingredient: "guava paste", amount: 40 },
    { ingredient: "cheese", amount: 30 },
  ],
  "Ham & Cheese": [
    { ingredient: "ham", amount: 40 },
    { ingredient: "cheese", amount: 30 },
  ],
}

export async function ensureBootstrap(userId: string): Promise<{ shopId: string }> {
  const db = supabaseAdmin

  // 1. Upsert profile
  const { error: profileErr } = await db
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" })
  if (profileErr) throw profileErr
  console.log("[bootstrap] Profile ensured")

  // 2. Fetch or create shop
  const { data: existingShops } = await db
    .from("shops")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
  let shopId: string
  if (existingShops?.length) {
    shopId = existingShops[0].id
    console.log("[bootstrap] Shop exists:", shopId)
  } else {
    const { data: newShop, error } = await db
      .from("shops")
      .insert({ owner_id: userId, ...SHOP_DEFAULTS })
      .select("id")
      .single()
    if (error) throw error
    shopId = newShop!.id
    console.log("[bootstrap] Shop created:", shopId)
  }

  // 3. Upsert SKUs
  const skuRows = SKU_SPECS.map((s) => ({
    shop_id: shopId,
    name: s.name,
    category: s.category,
  }))
  const { data: skuResult, error: skuErr } = await db
    .from("skus")
    .upsert(skuRows, { onConflict: "shop_id,name" })
    .select("id")
  if (skuErr) throw skuErr
  const skusInserted = skuResult?.length ?? 0
  console.log("[bootstrap] SKUs upserted:", skusInserted)

  // 4. Upsert ingredients (per-shop)
  const ingRows = INGREDIENTS.map((i) => ({
    shop_id: shopId,
    name: i.name,
    unit: i.unit,
  }))
  const { data: ingResult, error: ingErr } = await db
    .from("ingredients")
    .upsert(ingRows, { onConflict: "shop_id,name" })
    .select("id")
  if (ingErr) throw ingErr
  const ingredientsInserted = ingResult?.length ?? 0
  console.log("[bootstrap] Ingredients upserted:", ingredientsInserted)

  // 5. Build ingredient name -> id map for this shop
  const { data: allIngredients } = await db
    .from("ingredients")
    .select("id, name")
    .eq("shop_id", shopId)
  const ingredientIds = new Map<string, string>()
  for (const i of allIngredients ?? []) ingredientIds.set(i.name, i.id)

  // 6. Build SKU name -> id map for this shop
  const { data: allSkus } = await db
    .from("skus")
    .select("id, name, category")
    .eq("shop_id", shopId)
  const skuByName = new Map<string, string>()
  for (const s of allSkus ?? []) skuByName.set(s.name, s.id)

  // 7. Upsert recipe items for empanadas only
  const recipeRows: { sku_id: string; ingredient_id: string; amount_per_unit: number }[] = []
  for (const spec of SKU_SPECS) {
    if (spec.category !== "empanada") continue
    const skuId = skuByName.get(spec.name)
    if (!skuId) continue

    for (const d of DOUGH_PER_UNIT) {
      const ingId = ingredientIds.get(d.ingredient)
      if (ingId) recipeRows.push({ sku_id: skuId, ingredient_id: ingId, amount_per_unit: d.amount })
    }
    const fillings = EMPANADA_FILLINGS[spec.name]
    if (fillings) {
      for (const f of fillings) {
        const ingId = ingredientIds.get(f.ingredient)
        if (ingId) recipeRows.push({ sku_id: skuId, ingredient_id: ingId, amount_per_unit: f.amount })
      }
    }
  }
  let recipesInserted = 0
  if (recipeRows.length) {
    const { data: recipeResult, error: recipeErr } = await db
      .from("recipes")
      .upsert(recipeRows, { onConflict: "sku_id,ingredient_id" })
      .select("id")
    if (recipeErr) throw recipeErr
    recipesInserted = recipeResult?.length ?? 0
  }
  console.log("[bootstrap] Recipe items upserted:", recipesInserted)

  return { shopId }
}
