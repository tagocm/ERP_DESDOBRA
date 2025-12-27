import { PageHeader } from "@/components/ui/PageHeader";
// ModuleTabs removed
import { Building2, CreditCard, FileText, Settings, Users } from "lucide-react";
import { CompanySettingsForm } from "@/components/settings/company/CompanySettingsForm";

// Tabs definitions removed


export default function CompanySettingsPage() {
    return (
        <div className="pb-20">
            <CompanySettingsForm />
        </div>
    );
}