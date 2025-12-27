
import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    className?: string
}

interface TabsListProps {
    children: React.ReactNode
    className?: string
}

interface TabsTriggerProps {
    value: string
    children: React.ReactNode
    className?: string
}

interface TabsContentProps {
    value: string
    children: React.ReactNode
    className?: string
}

const TabsContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
}>({
    value: "",
    onValueChange: () => { },
})

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
    ({ defaultValue = "", value: controlledValue, onValueChange, children, className }, ref) => {
        const [internalValue, setInternalValue] = React.useState(defaultValue)
        const value = controlledValue ?? internalValue
        const handleValueChange = onValueChange ?? setInternalValue

        return (
            <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
                <div ref={ref} className={cn("w-full", className)}>
                    {children}
                </div>
            </TabsContext.Provider>
        )
    }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
    ({ children, className }, ref) => (
        <div
            ref={ref}
            className={cn(
                "inline-flex h-12 items-center justify-start rounded-xl bg-gray-100 p-1 text-gray-500 w-full overflow-x-auto",
                className
            )}
        >
            {children}
        </div>
    )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
    ({ value, children, className }, ref) => {
        const { value: selectedValue, onValueChange } = React.useContext(TabsContext)
        const isActive = selectedValue === value

        return (
            <button
                ref={ref}
                type="button"
                onClick={() => onValueChange(value)}
                data-state={isActive ? "active" : "inactive"}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    isActive
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/50",
                    className
                )}
            >
                {children}
            </button>
        )
    }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
    ({ value, children, className }, ref) => {
        const { value: selectedValue } = React.useContext(TabsContext)

        if (selectedValue !== value) return null

        return (
            <div
                ref={ref}
                className={cn("mt-6 ring-offset-background focus-visible:outline-none", className)}
            >
                {children}
            </div>
        )
    }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
