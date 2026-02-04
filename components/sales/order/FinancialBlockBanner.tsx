/**
 * Financial Block Warning Banner Component
 * 
 * Displays a prominent warning when a sales order is financially blocked
 * Includes a button to resend the order for financial approval
 * 
 * Usage: Import and add near the top of SalesOrderForm JSX:
 * {mode === 'edit' && formData.dispatch_blocked && (
 *     <FinancialBlockBanner
 *         reason={formData.dispatch_blocked_reason}
 *         onResend={handleResendForApproval}
 *         isResending={isResending}
 *     />
 * )}
 */

import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface FinancialBlockBannerProps {
    reason?: string | null;
    onResend: () => void;
    isResending: boolean;
}

export function FinancialBlockBanner({ reason, onResend, isResending }: FinancialBlockBannerProps) {
    return (
        <Card className="bg-red-50 border-2 border-red-200">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                        <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-red-900 mb-1.5">
                            Pedido Bloqueado pelo Financeiro
                        </h3>
                        <p className="text-sm text-red-700 mb-4 leading-relaxed">
                            <strong>Motivo:</strong> {reason || 'Motivo não especificado'}
                        </p>
                        <Button
                            onClick={onResend}
                            disabled={isResending}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold transition-all duration-200"
                        >
                            {isResending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Reenviando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Reenviar para Aprovação
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
