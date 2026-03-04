import { redirect } from "next/navigation";

export default function StockModuleRedirectPage() {
  redirect("/app/estoque/movimentacoes");
}

