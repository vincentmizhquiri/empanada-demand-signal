import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ensureBootstrap } from "@/lib/bootstrap"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { shopId } = await ensureBootstrap(user.id)
  const { data: shop } = await supabase
    .from("shops")
    .select("name, open_days, open_time, default_comparable_days, waste_factor, timezone")
    .eq("id", shopId)
    .single()

  const { data: skus } = await supabase
    .from("skus")
    .select("id, name, category")
    .eq("shop_id", shopId)
    .order("category")
    .order("name")

  return (
    <DashboardClient
      shopId={shopId}
      shopName={shop?.name ?? "Shop"}
      shopConfig={
        shop
          ? {
              open_days: (shop.open_days as number[]) ?? [3, 4, 5, 6, 0],
              open_time: shop.open_time ?? "11:00",
              default_comparable_days: shop.default_comparable_days ?? 3,
              waste_factor: Number(shop.waste_factor) ?? 0.9,
              timezone: shop.timezone ?? "America/New_York",
            }
          : null
      }
      skus={skus ?? []}
    />
  )
}
