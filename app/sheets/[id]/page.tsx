export default function SheetDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">/sheets/{params.id}</h1>
      <p className="text-slate-600">Placeholder V1.</p>
    </div>
  );
}
