import { redirect } from "next/navigation";

export default function LegacyInventoryRedirectPage() {
  redirect("/app/estoque/inventarios");
}

