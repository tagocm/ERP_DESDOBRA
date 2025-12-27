
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tag, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ContactTagsPage() {
    return (
        <div className="max-w-[1600px] mx-auto px-6">
            <Link
                href="/app/settings/master-data"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar para Cadastros Básicos
            </Link>

            <PageHeader
                title="Tags de Contato"
                subtitle="Crie e organize tags para classificar seus contatos"
                actions={
                    <Button disabled title="Funcionalidade em desenvolvimento">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Tag
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle>Tags Cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Empty State */}
                    <div className="text-center py-12">
                        <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhuma tag cadastrada
                        </h3>
                        <p className="text-gray-600 mb-6">
                            As tags facilitam a organização e segmentação de contatos.
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                            <p className="text-sm text-yellow-800">
                                <strong>Em desenvolvimento:</strong> A funcionalidade de cadastro de tags
                                de contato será implementada em breve.
                            </p>
                        </div>
                    </div>

                    {/* Placeholder Table Structure */}
                    <div className="hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cor</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contatos</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Rows will go here */}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
