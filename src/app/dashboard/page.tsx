import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="p-6">
      <header>
        <h1 className="text-2xl font-semibold">Empanada Demand Signal</h1>
      </header>
      <Card className="mt-6">
        <CardContent className="pt-6">
          Setup status: Ready
        </CardContent>
      </Card>
    </div>
  )
}
