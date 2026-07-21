import MainLayout from "@/components/layout/MainLayout";

export default function Home() {
  return (
    <MainLayout>
      <div className="space-y-8">

        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="mt-2 text-slate-400">
            Bem-vindo ao PersonalFlow.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6">

          <div className="rounded-xl bg-slate-900 p-6">
            <p className="text-slate-400">Atendimentos Hoje</p>
            <h3 className="mt-3 text-4xl font-bold">7</h3>
          </div>

          <div className="rounded-xl bg-slate-900 p-6">
            <p className="text-slate-400">Alunos Ativos</p>
            <h3 className="mt-3 text-4xl font-bold">52</h3>
          </div>

          <div className="rounded-xl bg-slate-900 p-6">
            <p className="text-slate-400">Avaliações</p>
            <h3 className="mt-3 text-4xl font-bold">3</h3>
          </div>

          <div className="rounded-xl bg-slate-900 p-6">
            <p className="text-slate-400">Treinos Pendentes</p>
            <h3 className="mt-3 text-4xl font-bold">5</h3>
          </div>

        </div>

      </div>
    </MainLayout>
  );
}