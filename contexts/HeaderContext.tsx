"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface HeaderContextType {
    title: string;
    setTitle: (title: string) => void;
    subtitle: string | undefined;
    setSubtitle: (subtitle: string | undefined) => void;
    actions: ReactNode | undefined;
    setActions: (actions: ReactNode | undefined) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState<string | undefined>();
    const [actions, setActions] = useState<ReactNode | undefined>();

    return (
        <HeaderContext.Provider value={{ title, setTitle, subtitle, setSubtitle, actions, setActions }}>
            {children}
        </HeaderContext.Provider>
    );
}

export function useHeader() {
    const context = useContext(HeaderContext);
    if (context === undefined) {
        throw new Error("useHeader must be used within a HeaderProvider");
    }
    return context;
}
