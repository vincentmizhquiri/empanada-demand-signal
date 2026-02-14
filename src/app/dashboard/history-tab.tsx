"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getHistoryData, type HistoryData } from "./actions"

const HOURS = [11, 12, 13, 14, 15, 16, 17, 18]
const HOUR_LABELS: Record<number, string> = {
  11: "11am",
  12: "12pm",
  13: "1pm",
  14: "2pm",
  15: "3pm",
  16: "4pm",
  17: "5pm",
  18: "6pm",
}

function formatDateForInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function computeInsights(data: HistoryData): string[] {
  const points: string[] = []
  if (data.totalOrders === 0) return points

  // Peak hour
  const hourEntries = Object.entries(data.hourTotals).filter(([, v]) => v > 0)
  if (hourEntries.length) {
    const [peakHour] = hourEntries.reduce((a, b) => (a[1] >= b[1] ? a : b))
    points.push(`Peak hour: ${HOUR_LABELS[Number(peakHour)] ?? peakHour}`)
  }

  // Top empanada
  const empanadaTotals: Record<string, number> = {}
  for (const row of data.rows) {
    for (const it of row.items) {
      if (it.category === "empanada") {
        empanadaTotals[it.skuName] = (empanadaTotals[it.skuName] ?? 0) + it.quantity
      }
    }
  }
  const topEmpanada = Object.entries(empanadaTotals).sort((a, b) => b[1] - a[1])[0]
  if (topEmpanada) {
    points.push(`Top empanada: ${topEmpanada[0]} (${topEmpanada[1]} sold)`)
  }

  // Top drink
  const drinkTotals: Record<string, number> = {}
  for (const row of data.rows) {
    for (const it of row.items) {
      if (it.category === "drink") {
        drinkTotals[it.skuName] = (drinkTotals[it.skuName] ?? 0) + it.quantity
      }
    }
  }
  const topDrink = Object.entries(drinkTotals).sort((a, b) => b[1] - a[1])[0]
  if (topDrink) {
    points.push(`Top drink: ${topDrink[0]} (${topDrink[1]} sold)`)
  }

  // Slowest hour
  const hoursWithSales = hourEntries.map(([h, v]) => [Number(h), v] as const)
  if (hoursWithSales.length) {
    const [slowHour] = hoursWithSales.reduce((a, b) => (a[1] <= b[1] ? a : b))
    points.push(`Slowest hour: ${HOUR_LABELS[slowHour] ?? slowHour}`)
  }

  return points
}

export function HistoryTab({
  shopId,
  onOpenPOS,
}: {
  shopId: string
  onOpenPOS: () => void
}) {
  const [date, setDate] = useState(() => formatDateForInput(new Date()))
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getHistoryData(shopId, date).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [shopId, date])

  const insights = data ? computeInsights(data) : []
  const isEmpty = data && data.totalOrders === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium" htmlFor="history-date">
          Date
        </label>
        <input
          id="history-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No orders for this date.</p>
            <Button variant="outline" className="mt-4" onClick={onOpenPOS}>
              Go to POS to add orders
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Total orders</h3>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data?.totalOrders ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Empanadas sold</h3>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data?.totalEmpanadas ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Drinks sold</h3>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data?.totalDrinks ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {insights.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium">Insights</h3>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {insights.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h3 className="text-sm font-medium">Sales by hour</h3>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    {data?.skus.map((s) => (
                      <TableHead key={s.id} className="text-right">
                        {s.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-medium">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {HOURS.map((h) => {
                    const row = data?.byHourSku[h] ?? {}
                    const total = data?.hourTotals[h] ?? 0
                    return (
                      <TableRow key={h}>
                        <TableCell>{HOUR_LABELS[h]}</TableCell>
                        {data?.skus.map((s) => (
                          <TableCell key={s.id} className="text-right tabular-nums">
                            {row[s.id] ?? 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">
                          {total}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
