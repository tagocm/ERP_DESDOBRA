import { getNFeEmissionData } from '@/lib/fiscal/nfe-emission-actions';
import { NFeEmissionForm } from '@/components/fiscal/emission/NFeEmissionForm';
import { notFound } from 'next/navigation';

export default async function NFeEmissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const data = await getNFeEmissionData(id);
        if (!data.order) notFound();

        return <NFeEmissionForm data={data} orderId={id} />;
    } catch (e) {
        console.error('Error loading emission data:', e);
        return <div className="p-8 text-center text-red-600">Erro ao carregar dados para emissão.</div>;
    }
}
