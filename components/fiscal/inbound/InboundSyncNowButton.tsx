"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";
import type { DfeEnvironment } from "@/lib/fiscal/inbound/schemas";

export function InboundSyncNowButton({ environment }: { environment: DfeEnvironment }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/fiscal/inbound/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment }),
      });

      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Falha ao enfileirar sincronização";
        throw new Error(message);
      }

      toast({
        title: "Sincronização enfileirada",
        description: "O worker irá buscar novos DF-e automaticamente.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" className="font-medium" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Sincronizando..." : "Sincronizar agora"}
    </Button>
  );
}
