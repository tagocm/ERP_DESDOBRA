import { getNFeEmissionData } from '@/lib/fiscal/nfe-emission-actions';
import { NFeEmissionForm } from '@/components/fiscal/emission/NFeEmissionForm';
import { notFound } from 'next/navigation';

export default async function NFeEmissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let data;
    try {
        data = await getNFeEmissionData(id);
        if (!data.order) notFound();
    } catch (e: unknown) {
        console.error('Error loading emission data:', e);
        console.error('Error Details:', {
            message: e instanceof Error ? e.message : 'Unknown error',
            stack: e instanceof Error ? e.stack : undefined,
            json: JSON.stringify(e)
        });
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        return (
            <div className="p-8 text-center text-red-600">
                <h2 className="text-lg font-bold mb-2">Erro ao carregar dados para emissão</h2>
                <pre className="text-sm bg-gray-100 p-4 rounded text-left overflow-auto max-w-2xl mx-auto whitespace-pre-wrap">
                    {errorMessage}
                </pre>
            </div>
        );
    }

    return <NFeEmissionForm data={data} orderId={id} />;
}
