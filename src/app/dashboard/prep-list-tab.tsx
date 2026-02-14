"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getForecastData, type ForecastData } from "./actions"

type ShopConfig = {
  open_days: number[]
  open_time: string
  default_comparable_days: number
  waste_factor: number
  timezone: string
}

function formatDateForInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getNextOpenDay(openDays: number[]): string {
  const set = new Set(openDays)
  let d = new Date()
  for (let i = 0; i < 8; i++) {
    const day = d.getDay()
    if (set.has(day)) return formatDateForInput(d)
    d.setDate(d.getDate() + 1)
  }
  return formatDateForInput(new Date())
}

function formatHour(h: number): string {
  if (h === 0) return "12am"
  if (h < 12) return `${h}am`
  if (h === 12) return "12pm"
  return `${h - 12}pm`
}

export function PrepListTab({
  shopId,
  shopConfig,
  onOpenPOS,
}: {
  shopId: string
  shopConfig: ShopConfig | null
  onOpenPOS: () => void
}) {
  const openDays = shopConfig?.open_days ?? [3, 4, 5, 6, 0]
  const openTime = shopConfig?.open_time ?? "11:00"
  const openHour = parseInt(openTime.slice(0, 2), 10)
  const HOURS = [openHour, openHour + 1, openHour + 2, openHour + 3, openHour + 4, openHour + 5, openHour + 6, openHour + 7]

  const [targetDate, setTargetDate] = useState(() => getNextOpenDay(openDays))
  const [wasteMinimizer, setWasteMinimizer] = useState(false)
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getForecastData(shopId, targetDate, wasteMinimizer).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [shopId, targetDate, wasteMinimizer])

  const empanadaSkus = data?.skus.filter((s) => s.category === "empanada") ?? []
  const drinkSkus = data?.skus.filter((s) => s.category === "drink") ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="prep-date">Target date</Label>
          <input
            id="prep-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="waste-minimizer"
            checked={wasteMinimizer}
            onCheckedChange={setWasteMinimizer}
          />
          <Label htmlFor="waste-minimizer">Waste Minimizer</Label>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data?.isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No comparable data for this date.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add more orders to build a forecast.
            </p>
            <button
              type="button"
              onClick={onOpenPOS}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Go to POS to add orders
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          {data && data.comparableDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Comparable dates:</span>
              {data.comparableDates.map((d) => (
                <Badge key={d} variant="secondary">
                  {d}
                </Badge>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <h3 className="text-sm font-medium">Tomorrow&apos;s Forecast Totals</h3>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Forecast units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empanadaSkus.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {data?.empanadaTotals[s.id] ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                  {drinkSkus.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {data?.drinkTotals[s.id] ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {empanadaSkus.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-medium">Empanada Prep Schedule</h3>
                </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {empanadaSkus.flatMap((sku) =>
                    HOURS.filter((h) => (data?.empanadaByHour[h]?.[sku.id] ?? 0) > 0).map(
                      (h) => (
                        <li key={`${sku.id}-${h}`}>
                          {h === openHour
                            ? `Prep ${data!.empanadaByHour[h][sku.id]} ${sku.name} at open (${formatHour(h)})`
                            : `Prep ${data!.empanadaByHour[h][sku.id]} more ${sku.name} at ${formatHour(h)}`}
                        </li>
                      )
                    )
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium">Ingredients Needed</h3>
              </CardHeader>
              <CardContent>
                {!data?.ingredientTotals || data.ingredientTotals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recipes or ingredients found. Add recipes in Settings to see ingredient totals.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ingredientTotals.map((ing) => (
                        <TableRow key={ing.id}>
                          <TableCell>{ing.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ing.total}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {ing.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            </>
          )}

          {drinkSkus.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium">Drinks</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Total forecast units:{" "}
                  <span className="font-medium tabular-nums">{data?.drinkTotalUnits ?? 0}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
