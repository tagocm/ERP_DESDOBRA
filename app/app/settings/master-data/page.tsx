"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Calendar, Users, Tag, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

const masterDataSections = [
    {
        id: "payment-terms",
        title: "Prazos de Pagamento",
        description: "Gerencie os prazos de pagamento disponíveis para vendas e compras",
        icon: Calendar,
        href: "/app/settings/master-data/payment-terms",
        color: "text-blue-600 bg-blue-50"
    },
    {
        id: "person-types",
        title: "Tipos de Pessoa",
        description: "Configure tipos e categorias de pessoas e entidades",
        icon: Users,
        href: "/app/settings/master-data/person-types",
        color: "text-green-600 bg-green-50"
    },
    {
        id: "contact-tags",
        title: "Tags de Contato",
        description: "Crie e organize tags para classificar seus contatos",
        icon: Tag,
        href: "/app/settings/master-data/contact-tags",
        color: "text-purple-600 bg-purple-50"
    }
];

export default function MasterDataPage() {
    // HeaderContext removed

    return (
        <div className="max-w-screen-2xl mx-auto px-6">
            <PageHeader
                title="Cadastros Básicos"
                subtitle="Gerencie tabelas auxiliares e configurações básicas do sistema"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {masterDataSections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <Card key={section.id} className="hover:shadow-float transition-shadow">
                            <CardHeader>
                                <div className={`w-12 h-12 rounded-2xl ${section.color} flex items-center justify-center mb-4`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <CardTitle className="text-lg">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600 mb-4">
                                    {section.description}
                                </p>
                                <Link href={section.href}>
                                    <Button variant="secondary" className="w-full group">
                                        Gerenciar
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Info Section */}
            <Card className="mt-8 bg-gray-50 border-gray-200">
                <CardContent className="pt-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Sobre Cadastros Básicos</h3>
                    <p className="text-sm text-gray-600">
                        Os cadastros básicos são tabelas auxiliares que ajudam a padronizar informações
                        em todo o sistema. Configure-os de acordo com as necessidades do seu negócio.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
