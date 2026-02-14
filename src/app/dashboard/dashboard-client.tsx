"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { POSTab } from "./pos-tab"
import { HistoryTab } from "./history-tab"
import { PrepListTab } from "./prep-list-tab"

export function DashboardClient({
  shopId,
  shopName,
  shopConfig,
  skus,
}: {
  shopId: string
  shopName: string
  shopConfig: {
    open_days: number[]
    open_time: string
    default_comparable_days: number
    waste_factor: number
    timezone: string
  } | null
  skus: { id: string; name: string; category: string }[]
}) {
  const [tab, setTab] = useState("overview")

  return (
    <div className="p-6">
      <header>
        <h1 className="text-2xl font-semibold">Empanada Demand Signal</h1>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pos">POS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="prep">Prep List</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p>
                <span className="font-medium">{shopName}</span>
              </p>
              <p className="text-muted-foreground">Setup status: Seed complete</p>
            </CardContent>
          </Card>
          <nav className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setTab("history")}>
              History
            </Button>
            <Button variant="outline" onClick={() => setTab("prep")}>
              Prep List
            </Button>
          </nav>
        </TabsContent>
        <TabsContent value="pos" className="mt-4">
          <POSTab shopId={shopId} skus={skus} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab shopId={shopId} onOpenPOS={() => setTab("pos")} />
        </TabsContent>
        <TabsContent value="prep" className="mt-4">
          <PrepListTab
            shopId={shopId}
            shopConfig={shopConfig}
            onOpenPOS={() => setTab("pos")}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
