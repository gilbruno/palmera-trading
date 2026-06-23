import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

// Génère la liste de tous les mois "YYYY-MM" entre from et to inclus
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") ?? "m1";
  const from = searchParams.get("from"); // "YYYY-MM-DD"
  const to = searchParams.get("to");     // "YYYY-MM-DD"

  if (!instrument || !from || !to) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const allMonths = monthsBetween(from, to);

  // Pour chaque mois, vérifier si au moins 1 bar existe en DB
  let checks;
  try {
    checks = await Promise.all(
      allMonths.map(async (ym) => {
        const [year, month] = ym.split("-").map(Number);
        const monthStart = new Date(year, month - 1, 1).getTime();
        const monthEndExclusive = new Date(year, month, 1).getTime();

        const count = await prisma.ohlcvBar.count({
          where: {
            instrument,
            timeframe,
            timestamp: { gte: BigInt(monthStart), lt: BigInt(monthEndExclusive) },
          },
        });
        return { month: ym, covered: count > 0 };
      })
    );
  } catch (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const coveredMonths = checks.filter((c) => c.covered).map((c) => c.month);
  const missingMonths = checks.filter((c) => !c.covered).map((c) => c.month);

  return NextResponse.json({ coveredMonths, missingMonths });
}
