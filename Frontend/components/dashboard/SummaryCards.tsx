import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CCCResult } from "@/lib/ccc-engine/types";

interface SummaryCardsProps {
  result: CCCResult;
}

export function SummaryCards({ result }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card>
        <CardHeader>
          <CardTitle>CCC</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{result.ccc.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Cash Conversion Cycle</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>DIO</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{result.dio.value.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Days Inventory Outstanding</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>DSO</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{result.dso.value.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Days Sales Outstanding</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>DPO</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{result.dpo.value.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Days Payables Outstanding</p>
        </CardContent>
      </Card>
    </div>
  );
}
