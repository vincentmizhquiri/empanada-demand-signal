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
