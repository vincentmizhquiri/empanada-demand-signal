"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { placeOrder } from "./actions"

export type Sku = { id: string; name: string; category: string }

const CATEGORY_ORDER = ["empanada", "drink"] as const
const DEMO_ORDER: Record<string, number> = {
  Chicken: 2,
  Cheese: 1,
  Morocho: 1,
}

export function POSTab({
  shopId,
  skus,
}: {
  shopId: string
  skus: Sku[]
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: skus.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0)

  const qty = (id: string) => quantities[id] ?? 0
  const setQty = (id: string, n: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, n) }))
  }

  const lineItems = skus
    .map((s) => ({ sku: s, q: qty(s.id) }))
    .filter((x) => x.q > 0)
  const totalCount = lineItems.reduce((sum, x) => sum + x.q, 0)

  const handlePlaceOrder = async () => {
    if (totalCount === 0) {
      toast.error("Add items before placing order")
      return
    }
    setLoading(true)
    try {
      const result = await placeOrder(
        shopId,
        lineItems.map((x) => ({ skuId: x.sku.id, quantity: x.q }))
      )
      if (result.ok) {
        toast.success("Order placed")
        setQuantities({})
      } else {
        toast.error(result.error ?? "Failed to place order")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDemoOrder = () => {
    const next: Record<string, number> = { ...quantities }
    for (const [name, n] of Object.entries(DEMO_ORDER)) {
      const sku = skus.find((s) => s.name === name)
      if (sku) next[sku.id] = (next[sku.id] ?? 0) + n
    }
    setQuantities(next)
    toast.info("Demo order filled")
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.category}>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium capitalize">{g.category}s</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.items.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                  >
                    <span className="font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQty(s.id, qty(s.id) - 1)}
                        disabled={qty(s.id) === 0}
                        aria-label={`Decrease ${s.name}`}
                      >
                        −
                      </Button>
                      <span className="min-w-[2ch] text-center tabular-nums">
                        {qty(s.id)}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQty(s.id, qty(s.id) + 1)}
                        aria-label={`Increase ${s.name}`}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Card className="w-full md:w-72 shrink-0">
        <CardHeader>
          <h3 className="text-sm font-medium">Order Summary</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            {lineItems.length === 0 ? (
              <p className="text-muted-foreground">No items</p>
            ) : (
              lineItems.map(({ sku, q }) => (
                <div
                  key={sku.id}
                  className="flex justify-between"
                >
                  <span>{sku.name}</span>
                  <span className="tabular-nums">×{q}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-muted-foreground">
            Total items: <span className="font-medium text-foreground tabular-nums">{totalCount}</span>
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handlePlaceOrder}
              disabled={totalCount === 0 || loading}
            >
              {loading ? "Placing…" : "Place Order"}
            </Button>
            <Button variant="outline" onClick={handleDemoOrder}>
              Demo quick order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
