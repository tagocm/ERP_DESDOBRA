
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Users, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PersonTypesPage() {
    return (
        <div className="max-w-screen-2xl mx-auto px-6">
            <Link
                href="/app/settings/master-data"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar para Cadastros Básicos
            </Link>

            <PageHeader
                title="Tipos de Pessoa"
                subtitle="Configure tipos e categorias de pessoas e entidades"
                actions={
                    <Button disabled title="Funcionalidade em desenvolvimento">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Tipo
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle>Tipos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Empty State */}
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum tipo cadastrado
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Os tipos de pessoa ajudam a categorizar e organizar seus contatos.
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 max-w-md mx-auto">
                            <p className="text-sm text-yellow-800">
                                <strong>Em desenvolvimento:</strong> A funcionalidade de cadastro de tipos
                                de pessoa será implementada em breve.
                            </p>
                        </div>
                    </div>

                    {/* Placeholder Table Structure */}
                    <div className="hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
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
