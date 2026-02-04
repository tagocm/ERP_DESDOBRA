
import { createClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";

export function useDeliveriesModel(companyId?: string) {
    const [enabled, setEnabled] = useState<boolean>(false);
    // Initialize loading as false if no companyId from the start
    const [loading, setLoading] = useState(!companyId ? false : true);

    useEffect(() => {
        if (!companyId) {
            // Don't setState here, already initialized to false
            return;
        }

        const fetchSetting = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('company_settings')
                .select('use_deliveries_model')
                .eq('company_id', companyId)
                .single();

            if (data) {
                setEnabled(data.use_deliveries_model || false);
            }
            setLoading(false);
        };

        fetchSetting();
    }, [companyId]);

    return { enabled, loading };
}
