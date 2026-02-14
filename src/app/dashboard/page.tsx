import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ensureBootstrap } from "@/lib/bootstrap"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { POSTab } from "./pos-tab"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { shopId } = await ensureBootstrap(user.id)
  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("id", shopId)
    .single()

  const { data: skus } = await supabase
    .from("skus")
    .select("id, name, category")
    .eq("shop_id", shopId)
    .order("category")
    .order("name")

  return (
    <div className="p-6">
      <header>
        <h1 className="text-2xl font-semibold">Empanada Demand Signal</h1>
      </header>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pos">POS</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p>
                <span className="font-medium">{shop?.name ?? "Shop"}</span>
              </p>
              <p className="text-muted-foreground">Setup status: Seed complete</p>
            </CardContent>
          </Card>
          <nav className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/history">History</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/prep">Prep List</Link>
            </Button>
          </nav>
        </TabsContent>
        <TabsContent value="pos" className="mt-4">
          <POSTab shopId={shopId} skus={skus ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
