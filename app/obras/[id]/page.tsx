import { notFound } from 'next/navigation'
import { getObraDetalle } from '@/lib/obras'
import DetalleObra from '@/components/obras/detalle/DetalleObra'

export default async function ObraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const obra   = await getObraDetalle(id)

  if (!obra) notFound()

  return <DetalleObra obra={obra} />
}
