import { getNFeEmissionData } from '@/lib/fiscal/nfe-emission-actions';
import { NFeEmissionForm } from '@/components/fiscal/emission/NFeEmissionForm';
import { notFound } from 'next/navigation';

export default async function NFeEmissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const data = await getNFeEmissionData(id);
        if (!data.order) notFound();

        return <NFeEmissionForm data={data} orderId={id} />;
    } catch (e: any) {
        console.error('Error loading emission data:', e);
        console.error('Error Details:', {
            message: e?.message,
            stack: e?.stack,
            json: JSON.stringify(e)
        });
        return (
            <div className="p-8 text-center text-red-600">
                <h2 className="text-lg font-bold mb-2">Erro ao carregar dados para emissão</h2>
                <pre className="text-sm bg-gray-100 p-4 rounded text-left overflow-auto max-w-2xl mx-auto whitespace-pre-wrap">
                    {e?.message || JSON.stringify(e)}
                </pre>
            </div>
        );
    }
}
