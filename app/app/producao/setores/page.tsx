import { redirect } from "next/navigation";

export default function ProductionSectorsRedirectPage() {
    redirect("/app/configuracoes/preferencias?tab=production");
}
