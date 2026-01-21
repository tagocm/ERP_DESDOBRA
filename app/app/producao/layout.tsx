"use client";


import { ReactNode } from "react";
export default function PcpLayout({ children }: { children: ReactNode }) {
    return (
        <div className="h-full w-full">
            {children}
        </div>
    );
}
