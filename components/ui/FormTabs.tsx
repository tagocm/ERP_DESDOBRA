import { TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";

interface FormTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsList> { }

export function FormTabsList({ className, ...props }: FormTabsListProps) {
    return (
        <TabsList
            className={cn(
                "bg-transparent h-auto w-full justify-start gap-6 p-0 border-b-0",
                className
            )}
            {...props}
        />
    );
}

interface FormTabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsTrigger> { }

export function FormTabsTrigger({ className, ...props }: FormTabsTriggerProps) {
    return (
        <TabsTrigger
            className={cn(
                "bg-transparent rounded-none border-b-2 border-transparent shadow-none",
                "data-[state=active]:border-brand-600 data-[state=active]:text-brand-600 data-[state=active]:bg-transparent",
                "text-gray-500 hover:text-gray-900 hover:border-gray-300",
                "px-0 pt-0 pb-3 h-auto text-sm font-medium transition-all data-[state=active]:shadow-none",
                className
            )}
            {...props}
        />
    );
}
