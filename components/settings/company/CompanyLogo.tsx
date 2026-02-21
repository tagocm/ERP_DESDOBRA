"use client";

type CompanyLogoProps = {
    url: string | null;
};

function LogoPlaceholder() {
    return (
        <div className="text-gray-300 flex flex-col items-center gap-2">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-4-3 3-5-5-4 4V5Z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-xs text-gray-400 font-medium">Sem logo</span>
        </div>
    );
}

export function CompanyLogo({ url }: CompanyLogoProps) {
    if (!url) {
        return <LogoPlaceholder />;
    }

    return (
        <img
            src={url}
            alt="Logo da empresa"
            className="absolute inset-0 w-full h-full object-contain p-2"
        />
    );
}

